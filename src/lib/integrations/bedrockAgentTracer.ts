import performanceNow from 'performance-now';

import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
  InvokeAgentCommandInput,
  InvokeAgentCommandOutput,
  ResponseStream,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { addChatCompletionStepToTrace } from '../tracing/tracer';

export function traceBedrockAgent(
  client: BedrockAgentRuntimeClient,
  openlayerInferencePipelineId?: string,
): BedrockAgentRuntimeClient {
  const originalSend = client.send.bind(client);

  client.send = async function (
    this: any,
    command: InvokeAgentCommand,
    options?: any,
  ): Promise<InvokeAgentCommandOutput & { completion: AsyncIterable<ResponseStream> | undefined }> {
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
      const response: InvokeAgentCommandOutput = await originalSend(command, options);

      if (!response.completion) {
        throw new Error('Completion is undefined');
      }

      // Create a traced async iterator that preserves the original
      const tracedCompletion = createTracedCompletion(
        response.completion,
        input,
        startTime,
        openlayerInferencePipelineId,
        client.config.region,
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
  originalCompletion: AsyncIterable<ResponseStream>,
  input: InvokeAgentCommandInput,
  startTime: number,
  openlayerInferencePipelineId?: string,
  region?: () => Promise<string>,
): AsyncIterable<ResponseStream> {
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

        // Calculate cost based on tokens, model, and region
        const cost = calculateCost(
          promptTokens,
          completionTokens,
          agentModel,
          typeof region === 'function' ? await region() : region || 'us-east-1',
        );

        const traceStepData = {
          name: 'AWS Bedrock Agent Invocation',
          inputs: inputs,
          output: collectedOutput,
          latency: endTime - startTime,
          tokens: totalTokens > 0 ? totalTokens : null,
          promptTokens: promptTokens > 0 ? promptTokens : null,
          completionTokens: completionTokens > 0 ? completionTokens : null,
          cost: cost,
          model: agentModel || `${input.agentId}:${input.agentAliasId}`,
          modelParameters: extractModelParameters(input),
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

// Bedrock pricing per 1K tokens by region and model ID (as of 2024)
// Source: https://aws.amazon.com/bedrock/pricing/
const BedrockPricing: { [region: string]: { [modelId: string]: { input: number; output: number } } } = {
  'us-east-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },
    'anthropic.claude-sonnet-4': { input: 0.003, output: 0.015 },
    'anthropic.claude-opus-4': { input: 0.015, output: 0.075 },
    'anthropic.claude-haiku-4': { input: 0.00025, output: 0.00125 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },
    'amazon.nova-pro': { input: 0.003, output: 0.015 },
    'amazon.nova-express': { input: 0.00025, output: 0.00125 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },
    'meta.llama3.1-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3.1-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3.1-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },
    'cohere.command-r-v1:0': { input: 0.0015, output: 0.002 },
    'cohere.command-r-plus-v1:0': { input: 0.003, output: 0.015 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },
    'mistral.mistral-7b-instruct-v0:3': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:3': { input: 0.00045, output: 0.0007 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'us-east-2': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },
    'anthropic.claude-sonnet-4': { input: 0.003, output: 0.015 },
    'anthropic.claude-opus-4': { input: 0.015, output: 0.075 },
    'anthropic.claude-haiku-4': { input: 0.00025, output: 0.00125 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },
    'amazon.nova-pro': { input: 0.003, output: 0.015 },
    'amazon.nova-express': { input: 0.00025, output: 0.00125 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },
    'meta.llama3.1-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3.1-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3.1-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },
    'cohere.command-r-v1:0': { input: 0.0015, output: 0.002 },
    'cohere.command-r-plus-v1:0': { input: 0.003, output: 0.015 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },
    'mistral.mistral-7b-instruct-v0:3': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:3': { input: 0.00045, output: 0.0007 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'us-west-2': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },
    'anthropic.claude-sonnet-4': { input: 0.003, output: 0.015 },
    'anthropic.claude-opus-4': { input: 0.015, output: 0.075 },
    'anthropic.claude-haiku-4': { input: 0.00025, output: 0.00125 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'eu-west-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'ap-southeast-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  // Additional regions from AWS Bedrock pricing
  'us-west-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'eu-central-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'ap-northeast-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'ap-south-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'ca-central-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'sa-east-1': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },

  'ap-northeast-2': {
    // Anthropic models
    'anthropic.claude-3-5-sonnet-20241022-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-3-opus-20240229-v1:0': { input: 0.015, output: 0.075 },
    'anthropic.claude-3-sonnet-20240229-v1:0': { input: 0.003, output: 0.015 },
    'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.00025, output: 0.00125 },
    'anthropic.claude-v2:1': { input: 0.008, output: 0.024 },
    'anthropic.claude-v2': { input: 0.008, output: 0.024 },
    'anthropic.claude-instant-v1': { input: 0.00163, output: 0.00551 },
    'anthropic.claude-sonnet-4': { input: 0.003, output: 0.015 },
    'anthropic.claude-opus-4': { input: 0.015, output: 0.075 },
    'anthropic.claude-haiku-4': { input: 0.00025, output: 0.00125 },

    // Amazon models
    'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
    'amazon.titan-text-lite-v1': { input: 0.0003, output: 0.0004 },
    'amazon.titan-embed-text-v1': { input: 0.0001, output: 0 },
    'amazon.titan-embed-image-v1': { input: 0.0001, output: 0 },
    'amazon.titan-image-generator-v1': { input: 0.008, output: 0 },

    // AI21 models
    'ai21.j2-ultra-v1': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1': { input: 0.0006, output: 0.0006 },
    'ai21.j2-ultra-v1:0': { input: 0.0128, output: 0.0128 },
    'ai21.j2-mid-v1:0': { input: 0.008, output: 0.008 },
    'ai21.j2-light-v1:0': { input: 0.0006, output: 0.0006 },

    // Meta models
    'meta.llama2-13b-chat-v1': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1': { input: 0.0006, output: 0.0006 },
    'meta.llama2-13b-chat-v1:0': { input: 0.00075, output: 0.001 },
    'meta.llama2-70b-chat-v1:0': { input: 0.00195, output: 0.00256 },
    'meta.llama2-7b-chat-v1:0': { input: 0.0006, output: 0.0006 },
    'meta.llama3-8b-instruct-v1:0': { input: 0.0002, output: 0.0002 },
    'meta.llama3-70b-instruct-v1:0': { input: 0.0008, output: 0.0008 },
    'meta.llama3-405b-instruct-v1:0': { input: 0.0012, output: 0.0012 },

    // Cohere models
    'cohere.command-text-v14': { input: 0.0015, output: 0.002 },
    'cohere.command-light-text-v14': { input: 0.0003, output: 0.0006 },
    'cohere.embed-english-v3': { input: 0.0001, output: 0 },
    'cohere.embed-multilingual-v3': { input: 0.0001, output: 0 },

    // Mistral models
    'mistral.mistral-7b-instruct-v0:2': { input: 0.00015, output: 0.0002 },
    'mistral.mixtral-8x7b-instruct-v0:1': { input: 0.00045, output: 0.0007 },
    'mistral.mistral-large-2402-v1:0': { input: 0.008, output: 0.024 },
    'mistral.mistral-small-2402-v1:0': { input: 0.001, output: 0.003 },

    // Stability AI models
    'stability.stable-diffusion-xl-v1': { input: 0.036, output: 0 }, // per image
    'stability.stable-diffusion-xl-v1:0': { input: 0.036, output: 0 }, // per image

    // TwelveLabs models
    'twelvelabs.pegasus-1.2': { input: 0.00049, output: 0.0075 }, // per second + per token
    'twelvelabs.marengo-embed-2.7': { input: 0.0007, output: 0.00007 }, // per minute + per request

    // Writer models
    'writer.palmyra-x-5': { input: 0.003, output: 0.015 },
    'writer.palmyra-x-5:0': { input: 0.003, output: 0.015 },
  },
};

function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: string | null,
  region: string = 'us-east-1',
): number | null {
  if (!model || promptTokens <= 0 || completionTokens <= 0) {
    return null;
  }

  const regionPricing = BedrockPricing[region];
  if (!regionPricing) {
    console.warn(`No pricing information available for region: ${region}`);
    return null;
  }

  const pricing =
    regionPricing[model] ?? Object.entries(regionPricing).find(([key]) => model.startsWith(key))?.[1];
  if (!pricing) {
    console.warn(`No pricing information available for model: ${model} in region: ${region}`);
    return null;
  }

  const inputCost = (promptTokens / 1000) * pricing['input'];
  const outputCost = (completionTokens / 1000) * pricing['output'];

  return inputCost + outputCost;
}
