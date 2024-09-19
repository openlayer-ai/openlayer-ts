import OpenAI from 'openai';
import { Stream } from 'openai/src/streaming';
import { addChatCompletionStepToTrace } from '../tracing/tracer';

export function traceOpenAI(openai: OpenAI): OpenAI {
  const createFunction = openai.chat.completions.create;

  openai.chat.completions.create = async function (
    this: typeof openai.chat.completions,
    ...args: Parameters<typeof createFunction>
  ): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk> | OpenAI.Chat.Completions.ChatCompletion> {
    const [params, options] = args;
    const stream = params?.stream ?? false;

    try {
      const startTime = performance.now();

      // Call the original `create` function
      let response = await createFunction.apply(this, args);

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
                firstTokenTime = performance.now();
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
            const endTime = performance.now();
            const traceData = {
              name: 'OpenAI Chat Completion',
              inputs: { prompt: params.messages },
              output: collectedOutputData.join(''),
              latency: endTime - startTime,
              model: chunks[0]?.model as string,
              modelParameters: getModelParameters(args),
              rawOutput: chunks.map((chunk) => JSON.stringify(chunk, null, 2)).join('\n'),
              metadata: { timeToFistToken: firstTokenTime ? firstTokenTime - startTime : null },
              provider: 'OpenAI',
              completionTokens: completionTokens,
              promptTokens: 0,
              tokens: completionTokens,
            };
            addChatCompletionStepToTrace(traceData);
          }
          return tracedOutputGenerator() as unknown as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;
        }
      } else {
        // Handle non-streaming responses
        response = response as OpenAI.Chat.Completions.ChatCompletion;
        const completion = response.choices[0];
        const endTime = performance.now();

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
          rawOutput: JSON.stringify(response, null, 2),
          metadata: {},
          provider: 'OpenAI',
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
  } as typeof createFunction;

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

const isAsyncIterable = (x: any) =>
  x != null && typeof x === 'object' && typeof x[Symbol.asyncIterator] === 'function';
