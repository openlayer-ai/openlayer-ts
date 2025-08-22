import performanceNow from 'performance-now';

import { addChatCompletionStepToTrace } from '../tracing/tracer';

export function traceBedrockAgent(client: any, openlayerInferencePipelineId?: string): any {
  const originalSend = client.send.bind(client);

  client.send = async function (this: any, command: any, options?: any): Promise<any> {
    // Debug logging to see what we're receiving
    const hasInput = command?.input;
    const hasAgentId = typeof command?.input?.agentId === 'string';
    const hasInputText = typeof command?.input?.inputText === 'string';

    // Check if this looks like an InvokeAgentCommand by checking for expected properties
    const isInvokeAgentCommand = hasInput && hasAgentId && hasInputText;

    if (!isInvokeAgentCommand) {
      console.debug('Command is not an InvokeAgentCommand, passing through uninstrumented');
      return originalSend(command, options);
    }

    const startTime = performanceNow();
    const input = command.input;

    try {
      // Call the original send method
      const response = await originalSend(command, options);

      if (!response.completion) {
        throw new Error('Completion is undefined');
      }

      // Create a traced async iterator that preserves the original
      const tracedCompletion = createTracedCompletion(
        response.completion,
        input,
        startTime,
        openlayerInferencePipelineId,
      );

      // Return the response with the traced completion
      return {
        ...response,
        completion: tracedCompletion,
      };
    } catch (error) {
      console.error('Failed to trace the Bedrock agent invocation with Openlayer', error);
      throw error;
    }
  };

  return client;
}

// Create a traced completion that collects data while yielding original events
function createTracedCompletion(
  originalCompletion: AsyncIterable<any>,
  input: any,
  startTime: number,
  openlayerInferencePipelineId?: string,
): AsyncIterable<any> {
  return {
    async *[Symbol.asyncIterator]() {
      let firstTokenTime: number | undefined;
      let totalTokens = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      let collectedOutput = '';
      const rawOutputChunks: any[] = [];
      let agentModel: string | null = null;
      let citations: any[] = [];
      let traceData: any[] = [];
      let chunkCount = 0;

      try {
        for await (const chunkEvent of originalCompletion) {
          // Yield first - ensure user gets data immediately
          yield chunkEvent;

          // Then collect tracing data
          if (chunkCount === 0) {
            firstTokenTime = performanceNow();
          }

          chunkCount++;

          // Handle chunk events
          if (chunkEvent.chunk) {
            const chunk = chunkEvent.chunk;
            rawOutputChunks.push(chunk);

            if (chunk.bytes) {
              // Convert the object-based bytes to a proper Uint8Array
              const bytesObject = chunk.bytes;
              const byteArray = new Uint8Array(Object.values(bytesObject));
              const decodedResponse = new TextDecoder('utf-8').decode(byteArray);
              collectedOutput += decodedResponse;
            }

            if (chunk.attribution && chunk.attribution.citations) {
              citations.push(...chunk.attribution.citations);
            }
          }

          // Handle trace events
          if (chunkEvent.trace) {
            traceData.push(chunkEvent.trace);

            if (chunkEvent.trace.trace) {
              const trace = chunkEvent.trace.trace;

              // Extract tokens and model info
              if (
                'orchestrationTrace' in trace &&
                trace.orchestrationTrace?.modelInvocationOutput?.metadata?.usage
              ) {
                const usage = trace.orchestrationTrace.modelInvocationOutput.metadata.usage;
                promptTokens += usage.inputTokens || 0;
                completionTokens += usage.outputTokens || 0;
              }

              if (
                'orchestrationTrace' in trace &&
                trace.orchestrationTrace?.modelInvocationInput?.foundationModel
              ) {
                agentModel = trace.orchestrationTrace.modelInvocationInput.foundationModel;
              }
            }
          }
        }

        // After the stream is complete, send trace data
        const endTime = performanceNow();
        totalTokens = promptTokens + completionTokens;

        // Send trace data to Openlayer
        const inputs = extractInputs(input, traceData);
        const metadata: Record<string, any> = {
          agentId: input.agentId,
          agentAliasId: input.agentAliasId,
          sessionId: input.sessionId,
          timeToFirstToken: firstTokenTime ? firstTokenTime - startTime : null,
        };

        if (citations.length > 0) {
          metadata['citations'] = citations;
        }

        const reasoning = extractReasoning(traceData);
        if (reasoning && reasoning.length > 0) {
          metadata['reasoning'] = reasoning;
        }

        if (input.sessionState) {
          metadata['sessionState'] = {
            hasSessionAttributes: !!input.sessionState.sessionAttributes,
            hasPromptSessionAttributes: !!input.sessionState.promptSessionAttributes,
            hasFiles: !!input.sessionState.files && input.sessionState.files.length > 0,
            hasKnowledgeBaseConfigurations:
              !!input.sessionState.knowledgeBaseConfigurations &&
              input.sessionState.knowledgeBaseConfigurations.length > 0,
          };
        }

        const traceStepData = {
          name: 'AWS Bedrock Agent Invocation',
          inputs: inputs,
          output: collectedOutput,
          latency: endTime - startTime,
          tokens: totalTokens > 0 ? totalTokens : null,
          promptTokens: promptTokens > 0 ? promptTokens : null,
          completionTokens: completionTokens > 0 ? completionTokens : null,
          model: agentModel || `${input.agentId}:${input.agentAliasId}`,
          modelParameters: extractModelParameters(input),
          rawOutput: JSON.stringify(rawOutputChunks, null, 2),
          metadata: metadata,
          provider: 'Bedrock',
          startTime: startTime,
          endTime: endTime,
        };

        addChatCompletionStepToTrace(traceStepData, openlayerInferencePipelineId);
      } catch (error) {
        console.error('Error in traced completion:', error);
        // Don't rethrow - we don't want tracing errors to break the user's stream
      }
    },
  };
}

function extractInputs(input: any, traceData: any[]): Record<string, any> {
  const inputs: Record<string, any> = {};

  // Build the prompt in OpenAI-compatible format
  const prompt: Array<{ role: string; content: string }> = [];

  // Add the main user message
  if (input.inputText) {
    prompt.push({
      role: 'user',
      content: input.inputText,
    });
  }

  // Add conversation history if present
  if (input.sessionState?.conversationHistory?.messages) {
    for (const message of input.sessionState.conversationHistory.messages) {
      const content =
        message.content ?
          message.content.map((block: any) => ('text' in block ? block.text || '' : '')).join('')
        : '';

      const role = message.role || 'user';

      prompt.unshift({
        role: role,
        content: content,
      });
    }
  }

  // Extract system prompt from trace data if available
  const systemPrompt = extractSystemPrompt(traceData);
  if (systemPrompt) {
    prompt.unshift({
      role: 'system',
      content: systemPrompt,
    });
  }

  inputs['prompt'] = prompt;

  // Add additional context as separate fields
  if (input.sessionState?.sessionAttributes) {
    inputs['sessionAttributes'] = input.sessionState.sessionAttributes;
  }

  if (input.sessionState?.promptSessionAttributes) {
    inputs['promptSessionAttributes'] = input.sessionState.promptSessionAttributes;
  }

  if (input.sessionState?.files && input.sessionState.files.length > 0) {
    inputs['files'] = input.sessionState.files.map((file: any) => ({
      name: file.name,
      useCase: file.useCase,
      sourceType: file.source?.sourceType,
    }));
  }

  return inputs;
}

function extractSystemPrompt(traceData: any[]): string | null {
  for (const trace of traceData) {
    if (trace.trace?.orchestrationTrace?.modelInvocationInput?.text) {
      try {
        const parsed = JSON.parse(trace.trace.orchestrationTrace.modelInvocationInput.text);
        if (parsed.system) {
          return parsed.system;
        }
      } catch (e) {
        // If parsing fails, continue
      }
    }
  }
  return null;
}

function extractReasoning(traceData: any[]): string[] | undefined {
  const reasoning: string[] = [];

  for (const trace of traceData) {
    if (trace.trace?.orchestrationTrace?.rationale?.text) {
      reasoning.push(trace.trace.orchestrationTrace.rationale.text);
    }
  }

  return reasoning.length > 0 ? reasoning : undefined;
}

function extractModelParameters(input: any): Record<string, any> {
  const params: Record<string, any> = {};

  if (input.enableTrace !== undefined) {
    params['enableTrace'] = input.enableTrace;
  }

  if (input.endSession !== undefined) {
    params['endSession'] = input.endSession;
  }

  if (input.bedrockModelConfigurations) {
    params['bedrockModelConfigurations'] = input.bedrockModelConfigurations;
  }

  if (input.streamingConfigurations) {
    params['streamingConfigurations'] = input.streamingConfigurations;
  }

  if (input.promptCreationConfigurations) {
    params['promptCreationConfigurations'] = input.promptCreationConfigurations;
  }

  return params;
}
