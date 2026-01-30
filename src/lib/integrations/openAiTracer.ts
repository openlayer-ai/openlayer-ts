import OpenAI from 'openai';
import { Stream } from 'openai/streaming';
import performanceNow from 'performance-now';
import { addChatCompletionStepToTrace } from '../tracing/tracer';
import type { ResponseStreamEvent } from 'openai/resources/responses/responses';

export function traceOpenAI(openai: OpenAI): OpenAI {
  // Wrap Chat Completions API
  const chatCreateFunction = openai.chat.completions.create;

  openai.chat.completions.create = async function (
    this: typeof openai.chat.completions,
    ...args: Parameters<typeof chatCreateFunction>
  ): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk> | OpenAI.Chat.Completions.ChatCompletion> {
    const [params, options] = args;
    const stream = params?.stream ?? false;

    try {
      const startTime = performanceNow();

      // Call the original `create` function
      let response = await chatCreateFunction.apply(this, args);

      if (stream) {
        // Handle streaming responses
        const chunks: OpenAI.Chat.Completions.ChatCompletionChunk[] = [];
        let collectedOutputData: any[] = [];
        let firstTokenTime: number | undefined;
        let completionTokens: number = 0;
        if (isAsyncIterable(response)) {
          async function* tracedOutputGenerator(): AsyncGenerator<
            OpenAI.Chat.Completions.ChatCompletionChunk,
            void,
            unknown
          > {
            for await (const rawChunk of response as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
              if (chunks.length === 0) {
                firstTokenTime = performanceNow();
              }
              chunks.push(rawChunk);
              const delta = rawChunk.choices[0]?.delta;
              if (delta?.content) {
                collectedOutputData.push(delta?.content);
              } else if (delta?.tool_calls) {
                const tool_call = delta.tool_calls[0];
                if (tool_call?.function?.name) {
                  const functionName: string =
                    '{\n    "name": ' + '"' + tool_call.function.name + '"' + '\n    "arguments": ';
                  collectedOutputData.push(functionName);
                } else if (tool_call?.function?.arguments) {
                  collectedOutputData.push(tool_call.function.arguments);
                }
              }

              if (rawChunk.choices[0]?.finish_reason === 'tool_calls') {
                collectedOutputData.push('\n}');
              }
              completionTokens += 1;
              yield rawChunk;
            }
            const endTime = performanceNow();
            const traceData = {
              name: 'OpenAI Chat Completion',
              inputs: { prompt: params.messages },
              output: collectedOutputData.join(''),
              latency: endTime - startTime,
              model: chunks[0]?.model as string,
              modelParameters: getModelParameters(args),
              metadata: { timeToFistToken: firstTokenTime ? firstTokenTime - startTime : null },
              provider: 'OpenAI',
              completionTokens: completionTokens,
              promptTokens: 0,
              tokens: completionTokens,
              startTime: startTime,
              endTime: endTime,
            };
            addChatCompletionStepToTrace(traceData);
          }
          return tracedOutputGenerator() as unknown as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;
        }
      } else {
        // Handle non-streaming responses
        response = response as OpenAI.Chat.Completions.ChatCompletion;
        const completion = response.choices[0];
        const endTime = performanceNow();

        let output: string = '';
        if (completion?.message?.content) {
          output = completion.message.content;
        } else if (completion?.message.tool_calls) {
          const tool_call = completion.message.tool_calls[0];
          output = JSON.stringify(tool_call?.function, null, 2);
        }

        const traceData = {
          name: 'OpenAI Chat Completion',
          inputs: { prompt: params.messages },
          output: output,
          latency: endTime - startTime,
          tokens: response.usage?.total_tokens ?? null,
          promptTokens: response.usage?.prompt_tokens ?? null,
          completionTokens: response.usage?.completion_tokens ?? null,
          model: response.model,
          modelParameters: getModelParameters(args),
          metadata: {},
          provider: 'OpenAI',
          startTime: startTime,
          endTime: endTime,
        };
        addChatCompletionStepToTrace(traceData);
        return response;
      }
    } catch (error) {
      console.error('Failed to trace the create chat completion request with Openlayer', error);
      throw error;
    }
    // Ensure a return statement is present
    return undefined as any;
  } as typeof chatCreateFunction;

  // Wrap Responses API (only if available)
  if (!openai.responses) {
    return openai;
  }
  const responsesCreateFunction = openai.responses.create;

  openai.responses.create = async function (
    this: typeof openai.responses,
    ...args: Parameters<typeof responsesCreateFunction>
  ): Promise<Stream<ResponseStreamEvent> | OpenAI.Responses.Response> {
    const [params, options] = args;
    const stream = params?.stream ?? false;

    try {
      const startTime = performanceNow();

      // Call the original `create` function
      let response = await responsesCreateFunction.apply(this, args);

      if (stream) {
        // Handle streaming responses
        const chunks: ResponseStreamEvent[] = [];
        let collectedOutputData: any[] = [];
        let firstTokenTime: number | undefined;
        let completionTokens: number = 0;
        if (isAsyncIterable(response)) {
          async function* tracedOutputGenerator(): AsyncGenerator<ResponseStreamEvent, void, unknown> {
            for await (const rawChunk of response as AsyncIterable<ResponseStreamEvent>) {
              if (chunks.length === 0) {
                firstTokenTime = performanceNow();
              }
              chunks.push(rawChunk);

              // Handle different event types
              if (rawChunk.type === 'response.output_text.delta') {
                if ('delta' in rawChunk && rawChunk.delta) {
                  collectedOutputData.push(rawChunk.delta);
                }
              } else if (rawChunk.type === 'response.function_call_arguments.delta') {
                if ('delta' in rawChunk && rawChunk.delta) {
                  collectedOutputData.push(rawChunk.delta);
                }
              } else if (rawChunk.type === 'response.completed') {
                // Extract final response data
                if ('response' in rawChunk && rawChunk.response) {
                  const finalResponse = rawChunk.response;
                  completionTokens = finalResponse.usage?.output_tokens ?? 0;
                }
              }

              yield rawChunk;
            }
            const endTime = performanceNow();

            // Find the final response from chunks
            const doneChunk = chunks.find((c) => c.type === 'response.completed');
            const finalResponse = doneChunk && 'response' in doneChunk ? (doneChunk as any).response : null;

            const traceData = {
              name: 'OpenAI Response',
              inputs: { prompt: params.input },
              output: collectedOutputData.join(''),
              latency: endTime - startTime,
              model: finalResponse?.model ?? params.model,
              modelParameters: getResponsesModelParameters(args),
              metadata: { timeToFistToken: firstTokenTime ? firstTokenTime - startTime : null },
              provider: 'OpenAI',
              completionTokens: finalResponse?.usage?.output_tokens ?? completionTokens,
              promptTokens: finalResponse?.usage?.input_tokens ?? 0,
              tokens: finalResponse?.usage?.total_tokens ?? completionTokens,
              startTime: startTime,
              endTime: endTime,
            };
            addChatCompletionStepToTrace(traceData);
          }
          return tracedOutputGenerator() as unknown as Stream<ResponseStreamEvent>;
        }
      } else {
        // Handle non-streaming responses
        response = response as OpenAI.Responses.Response;
        const endTime = performanceNow();

        // Extract output from the response
        let output: string = response.output_text ?? '';

        // If output_text is empty, try to extract from output array
        if (!output && response.output && response.output.length > 0) {
          const outputItems: string[] = [];

          for (const outputItem of response.output) {
            if (outputItem && 'type' in outputItem) {
              if (outputItem.type === 'message' && 'content' in outputItem) {
                // Extract text from message content
                const content = outputItem.content;
                if (Array.isArray(content)) {
                  const textContent = content
                    .filter((c: any) => c.type === 'output_text')
                    .map((c: any) => c.text)
                    .join('');
                  if (textContent) {
                    outputItems.push(textContent);
                  }
                }
              } else if (outputItem.type === 'function_call') {
                // Extract function call details - Responses API format
                const functionCall = {
                  name: (outputItem as any).name,
                  arguments: (outputItem as any).arguments,
                };
                outputItems.push(JSON.stringify(functionCall, null, 2));
              }
            }
          }

          output = outputItems.join('\n');
        }

        const traceData = {
          name: 'OpenAI Response',
          inputs: { prompt: params.input },
          output: output,
          latency: endTime - startTime,
          tokens: response.usage?.total_tokens ?? null,
          promptTokens: response.usage?.input_tokens ?? null,
          completionTokens: response.usage?.output_tokens ?? null,
          model: response.model,
          modelParameters: getResponsesModelParameters(args),
          metadata: {},
          provider: 'OpenAI',
          startTime: startTime,
          endTime: endTime,
        };
        addChatCompletionStepToTrace(traceData);
        return response;
      }
    } catch (error) {
      console.error('Failed to trace the create response request with Openlayer', error);
      throw error;
    }
    // Ensure a return statement is present
    return undefined as any;
  } as typeof responsesCreateFunction;

  return openai;
}

function getModelParameters(args: any): Record<string, any> {
  const params = args[0];
  return {
    frequency_penalty: params?.frequencyPenalty ?? 0,
    logit_bias: params?.logitBias ?? null,
    logprobs: params?.logprobs ?? false,
    top_logprobs: params?.topLogprobs ?? null,
    max_tokens: params?.maxTokens ?? null,
    n: params?.n ?? 1,
    presence_penalty: params?.presencePenalty ?? 0,
    seed: params?.seed ?? null,
    stop: params?.stop ?? null,
    temperature: params?.temperature ?? 1,
    top_p: params?.topP ?? 1,
  };
}

function getResponsesModelParameters(args: any): Record<string, any> {
  const params = args[0];
  return {
    max_output_tokens: params?.max_output_tokens ?? null,
    temperature: params?.temperature ?? null,
    top_p: params?.top_p ?? null,
    parallel_tool_calls: params?.parallel_tool_calls ?? null,
    tool_choice: params?.tool_choice ?? null,
  };
}

const isAsyncIterable = (x: any) =>
  x != null && typeof x === 'object' && typeof x[Symbol.asyncIterator] === 'function';
