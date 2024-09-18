import OpenAI from 'openai';
import { Stream } from 'openai/src/streaming';
import { addChatCompletionStepToTrace } from '../tracing/tracer';

export function traceOpenAI(openai: OpenAI): OpenAI {
  const createFunction = openai.chat.completions.create;

  openai.chat.completions.create = async function (
    this: typeof openai.chat.completions,
    ...args: Parameters<typeof createFunction>
  ): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk> | OpenAI.Chat.Completions.ChatCompletion> {
    const [params, options = { stream: false }] = args;
    try {
      const startTime = performance.now();
      if (options.stream) {
        console.log('streaming not implemented yet');
        return createFunction.apply(this, args) as unknown as Promise<
          Stream<OpenAI.Chat.Completions.ChatCompletionChunk>
        >;
      } else {
        const response = (await createFunction.apply(this, args)) as OpenAI.Chat.Completions.ChatCompletion;
        const completion = response.choices[0];
        const endTime = performance.now();
        const traceData = {
          name: 'OpenAI Chat Completion',
          inputs: { prompt: params.messages },
          output: completion?.message.content,
          latency: endTime - startTime,
          tokens: response?.usage?.total_tokens ?? null,
          promptTokens: response?.usage?.prompt_tokens ?? null,
          completionTokens: response?.usage?.completion_tokens ?? null,
          model: response?.model,
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
