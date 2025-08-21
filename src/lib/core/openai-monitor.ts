/**
 * @deprecated The module is deprecated. Please use the OpenAI tracer module instead. Refer to https://www.openlayer.com/docs/monitoring/publishing-data#openai for details.
 */
import OpenAI from 'openai';
import { RequestOptions } from 'openai/core';
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  Completion,
  CompletionCreateParams,
} from 'openai/resources';
import { Run } from 'openai/resources/beta/threads/runs/runs';
import { Threads } from 'openai/resources/beta/threads/threads';
import { Stream } from 'openai/streaming';
import Openlayer from '../../index';

type OpenAIMonitorConstructorProps = {
  openAiApiKey: string;
  openlayerClient: Openlayer;
  openlayerInferencePipelineId: string;
};

type Pricing = {
  input: number;
  output: number;
};

const OpenAIPricing: { [key: string]: Pricing } = {
  'babbage-002': {
    input: 0.0004,
    output: 0.0004,
  },
  'davinci-002': {
    input: 0.002,
    output: 0.002,
  },
  'gpt-3.5-turbo': {
    input: 0.0005,
    output: 0.0015,
  },
  'gpt-3.5-turbo-0125': {
    input: 0.0005,
    output: 0.0015,
  },
  'gpt-3.5-turbo-0301': {
    input: 0.0015,
    output: 0.002,
  },
  'gpt-3.5-turbo-0613': {
    input: 0.0015,
    output: 0.002,
  },
  'gpt-3.5-turbo-1106': {
    input: 0.001,
    output: 0.002,
  },
  'gpt-3.5-turbo-16k-0613': {
    input: 0.003,
    output: 0.004,
  },
  'gpt-3.5-turbo-instruct': {
    input: 0.0015,
    output: 0.002,
  },
  'gpt-4': {
    input: 0.03,
    output: 0.06,
  },
  'gpt-4-0125-preview': {
    input: 0.01,
    output: 0.03,
  },
  'gpt-4-0314': {
    input: 0.03,
    output: 0.06,
  },
  'gpt-4-0613': {
    input: 0.03,
    output: 0.06,
  },
  'gpt-4-1106-preview': {
    input: 0.01,
    output: 0.03,
  },
  'gpt-4-1106-vision-preview': {
    input: 0.01,
    output: 0.03,
  },
  'gpt-4-32k': {
    input: 0.06,
    output: 0.12,
  },
  'gpt-4-32k-0314': {
    input: 0.06,
    output: 0.12,
  },
  'gpt-4-32k-0613': {
    input: 0.03,
    output: 0.06,
  },
};

/**
 * @deprecated The OpenAIMonitor is deprecated. Please use the OpenAI tracer module instead. Refer to https://www.openlayer.com/docs/monitoring/publishing-data#openai for details.
 */
class OpenAIMonitor {
  private openlayerClient: Openlayer;

  private openAIClient: OpenAI;

  private openlayerInferencePipelineId: string;

  private defaultConfig: Openlayer.InferencePipelines.Data.DataStreamParams.LlmData = {
    costColumnName: 'cost',
    inferenceIdColumnName: 'id',
    latencyColumnName: 'latency',
    numOfTokenColumnName: 'tokens',
    outputColumnName: 'output',
    timestampColumnName: 'timestamp',
  };

  /**
   * Constructs an OpenAIMonitor instance.
   * @param {OpenAIMonitorConstructorProps} props - The configuration properties for the OpenAI and Openlayer clients.
   */
  constructor({
    openAiApiKey,
    openlayerClient,
    openlayerInferencePipelineId,
  }: OpenAIMonitorConstructorProps) {
    this.openlayerInferencePipelineId = openlayerInferencePipelineId;
    this.openlayerClient = openlayerClient;

    this.openAIClient = new OpenAI({
      apiKey: openAiApiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  private cost = (model: string, inputTokens: number, outputTokens: number) => {
    const pricing: Pricing | undefined = OpenAIPricing[model];
    const inputCost = typeof pricing === 'undefined' ? undefined : (inputTokens / 1000) * pricing.input;
    const outputCost = typeof pricing === 'undefined' ? undefined : (outputTokens / 1000) * pricing.output;
    return typeof pricing === 'undefined' ? undefined : (inputCost ?? 0) + (outputCost ?? 0);
  };

  private chatCompletionPrompt = (
    fromMessages: ChatCompletionMessageParam[],
  ): Openlayer.InferencePipelines.Data.DataStreamParams.LlmData.Prompt[] =>
    fromMessages.map(({ content, role }, i) => ({
      content:
        role === 'user' ? `{{ message_${i} }}`
        : content === null || typeof content === 'undefined' ? ''
        : String(content),
      role,
    }));

  private threadPrompt = async (
    fromMessages: Threads.MessagesPage,
  ): Promise<ChatCompletionMessageParam[]> => {
    const messages: Threads.Messages.Message[] = [];
    for await (const page of fromMessages.iterPages()) {
      messages.push(...page.getPaginatedItems());
    }

    return messages
      .map(({ content, role }) =>
        content.map((item) => ({
          content: (() => {
            switch (item.type) {
              case 'image_file':
                return item.image_file.file_id;
              case 'text':
                return item.text.value;
              default:
                return '';
            }
          })(),
          role,
        })),
      )
      .flat();
  };

  private inputVariables = (
    fromPrompt: Openlayer.InferencePipelines.Data.DataStreamParams.LlmData.Prompt[],
    andMessages: ChatCompletionMessageParam[],
  ) => {
    const inputVariableNames = fromPrompt
      .filter(({ role }) => role === 'user')
      .map(({ content }) => String(content).replace(/{{\s*|\s*}}/g, '')) as string[];
    const inputVariables = andMessages
      .filter(({ role }) => role === 'user')
      .map(({ content }) => content) as string[];
    const inputVariablesMap = inputVariableNames.reduce(
      (acc, name, i) => ({ ...acc, [name]: inputVariables[i] }),
      {},
    );

    return { inputVariableNames, inputVariables, inputVariablesMap };
  };

  /**
   * Creates a chat completion using the OpenAI client and streams the result to Openlayer.
   * @param {ChatCompletionCreateParams} body - The parameters for creating a chat completion.
   * @param {RequestOptions} [options] - Optional request options.
   * @param {Openlayer.RequestOptions<any> | undefined} [additionalLogs] - Optional metadata logs to include with the request sent to Openlayer.
   * @returns {Promise<ChatCompletion | Stream<ChatCompletionChunk>>} Promise of a ChatCompletion or a Stream
   * @throws {Error} Throws errors from the OpenAI client.
   */
  public createChatCompletion = async (
    body: ChatCompletionCreateParams,
    options?: RequestOptions,
    additionalLogs?: Openlayer.RequestOptions | undefined,
  ): Promise<ChatCompletion | Stream<ChatCompletionChunk>> => {
    // Start a timer to measure latency
    const startTime = Date.now();
    // Accumulate output for streamed responses
    let streamedOutput = '';

    const response = await this.openAIClient.chat.completions.create(body, options);

    if (this.openlayerInferencePipelineId.length > 0) {
      try {
        const prompt = this.chatCompletionPrompt(body.messages);
        const { inputVariableNames, inputVariablesMap } = this.inputVariables(prompt, body.messages);

        const config: Openlayer.InferencePipelines.Data.DataStreamParams.LlmData = {
          ...this.defaultConfig,
          inputVariableNames,
          prompt,
        };

        if (body.stream) {
          const streamedResponse = response as Stream<ChatCompletionChunk>;

          for await (const chunk of streamedResponse) {
            const [choice] = chunk.choices;
            // Process each chunk - for example, accumulate input data
            const chunkOutput = choice?.delta.content ?? '';
            streamedOutput += chunkOutput;
          }

          const endTime = Date.now();
          const latency = endTime - startTime;

          this.openlayerClient.inferencePipelines.data.stream(this.openlayerInferencePipelineId, {
            config,
            rows: [
              {
                latency,
                output: streamedOutput,
                timestamp: startTime,
                ...inputVariablesMap,
                ...additionalLogs,
              },
            ],
          });
        } else {
          const nonStreamedResponse = response as ChatCompletion;
          // Handle regular (non-streamed) response
          const endTime = Date.now();
          const latency = endTime - startTime;
          const [choice] = nonStreamedResponse.choices;
          const output = choice?.message.content;
          const tokens = nonStreamedResponse.usage?.total_tokens ?? 0;
          const inputTokens = nonStreamedResponse.usage?.prompt_tokens ?? 0;
          const outputTokens = nonStreamedResponse.usage?.completion_tokens ?? 0;
          const cost = this.cost(nonStreamedResponse.model, inputTokens, outputTokens);

          if (typeof output === 'string') {
            this.openlayerClient.inferencePipelines.data.stream(this.openlayerInferencePipelineId, {
              config,
              rows: [
                {
                  cost,
                  latency,
                  model: nonStreamedResponse.model,
                  output,
                  timestamp: startTime,
                  tokens,
                  ...inputVariablesMap,
                  ...additionalLogs,
                },
              ],
            });
          } else {
            console.error('No output received from OpenAI.');
          }
        }
      } catch (error) {
        console.error(error);
      }
    }

    return response;
  };

  /**
   * Creates a completion using the OpenAI client and streams the result to Openlayer.
   * @param {CompletionCreateParams} body - The parameters for creating a completion.
   * @param {RequestOptions} [options] - Optional request options.
   * @param {Openlayer.RequestOptions<any> | undefined} [additionalLogs] - Optional metadata logs to include with the request sent to Openlayer.
   * @returns {Promise<Completion | Stream<Completion>>} Promise that resolves to a Completion or a Stream.
   * @throws {Error} Throws errors from the OpenAI client.
   */
  public createCompletion = async (
    body: CompletionCreateParams,
    options?: RequestOptions,
    additionalLogs?: Openlayer.RequestOptions | undefined,
  ): Promise<Completion | Stream<Completion>> => {
    if (!body.prompt) {
      console.error('No prompt provided.');
    }

    // Start a timer to measure latency
    const startTime = Date.now();

    // Accumulate output and tokens data for streamed responses
    let streamedModel = body.model;
    let streamedOutput = '';
    let streamedTokens = 0;
    let streamedInputTokens = 0;
    let streamedOutputTokens = 0;

    const response = await this.openAIClient.completions.create(body, options);

    if (this.openlayerInferencePipelineId.length > 0) {
      try {
        const config: Openlayer.InferencePipelines.Data.DataStreamParams.LlmData = {
          ...this.defaultConfig,
          inputVariableNames: ['input'],
        };

        if (body.stream) {
          const streamedResponse = response as Stream<Completion>;

          for await (const chunk of streamedResponse) {
            const [choice] = chunk.choices;
            // Process each chunk - for example, accumulate input data
            streamedModel = chunk.model;
            streamedOutput += choice?.text.trim();
            streamedTokens += chunk.usage?.total_tokens ?? 0;
            streamedInputTokens += chunk.usage?.prompt_tokens ?? 0;
            streamedOutputTokens += chunk.usage?.completion_tokens ?? 0;
          }

          const endTime = Date.now();
          const latency = endTime - startTime;
          const cost = this.cost(streamedModel, streamedInputTokens, streamedOutputTokens);

          this.openlayerClient.inferencePipelines.data.stream(this.openlayerInferencePipelineId, {
            config,
            rows: [
              {
                cost,
                input: body.prompt,
                latency,
                output: streamedOutput,
                timestamp: startTime,
                tokens: streamedTokens,
                ...additionalLogs,
              },
            ],
          });
        } else {
          const nonStreamedResponse = response as Completion;
          const [choice] = nonStreamedResponse.choices;
          // Handle regular (non-streamed) response
          const endTime = Date.now();
          const latency = endTime - startTime;
          const tokens = nonStreamedResponse.usage?.total_tokens ?? 0;
          const inputTokens = nonStreamedResponse.usage?.prompt_tokens ?? 0;
          const outputTokens = nonStreamedResponse.usage?.completion_tokens ?? 0;
          const cost = this.cost(nonStreamedResponse.model, inputTokens, outputTokens);

          this.openlayerClient.inferencePipelines.data.stream(this.openlayerInferencePipelineId, {
            config,
            rows: [
              {
                cost,
                input: body.prompt,
                latency,
                output: choice?.text ?? '',
                timestamp: startTime,
                tokens,
                ...additionalLogs,
              },
            ],
          });
        }
      } catch (error) {
        console.error(error);
      }
    }

    return response;
  };

  /**
   * Monitor a run from an OpenAI assistant.
   * Once the run is completed, the thread data is published to Openlayer,
   * along with the latency, cost, and number of tokens used.
   * @param {Run} run - The run created by the OpenAI assistant.
   * @param {Openlayer.RequestOptions<any> | undefined} [additionalLogs] - Optional metadata logs to include with the request sent to Openlayer.
   * @returns {Promise<void>} A promise that resolves when the run data has been successfully published to Openlayer.
   */
  public async monitorThreadRun(run: Run, additionalLogs?: Openlayer.RequestOptions | undefined) {
    if (run.status !== 'completed' || this.openlayerInferencePipelineId.length === 0) {
      return;
    }

    try {
      const {
        assistant_id,
        completed_at,
        created_at,
        model,
        thread_id,
        // @ts-ignore
        usage,
      } = run;

      // @ts-ignore
      const { completion_tokens, prompt_tokens, total_tokens } =
        typeof usage === 'undefined' || typeof usage !== 'object' || usage === null ? {} : usage;

      const cost = this.cost(model, prompt_tokens ?? 0, completion_tokens ?? 0);
      const latency =
        completed_at === null || created_at === null || isNaN(completed_at) || isNaN(created_at) ?
          undefined
        : (completed_at - created_at) * 1000;

      const messages = await this.openAIClient.beta.threads.messages.list(thread_id, { order: 'asc' });

      const populatedPrompt = await this.threadPrompt(messages);
      const prompt = this.chatCompletionPrompt(populatedPrompt);
      const { inputVariableNames, inputVariablesMap } = this.inputVariables(prompt, populatedPrompt);

      const config: Openlayer.InferencePipelines.Data.DataStreamParams.LlmData = {
        ...this.defaultConfig,
        inputVariableNames,
        prompt: prompt.slice(0, prompt.length - 1),
      };

      const output = prompt[prompt.length - 1]?.content;
      const resolvedOutput =
        typeof output === 'string' ? output
        : typeof output === 'undefined' || output === null ? ''
        : `${output}`;

      this.openlayerClient.inferencePipelines.data.stream(this.openlayerInferencePipelineId, {
        config,
        rows: [
          {
            cost,
            latency,
            openai_assistant_id: assistant_id,
            openai_thread_id: thread_id,
            output: resolvedOutput,
            timestamp: run.created_at,
            tokens: total_tokens,
            ...inputVariablesMap,
            ...additionalLogs,
          },
        ],
      });
    } catch (error) {
      console.error('Error logging thread run:', error);
    }
  }
}

export default OpenAIMonitor;
