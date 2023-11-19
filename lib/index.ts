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
import { Stream } from 'openai/streaming';

interface ChatCompletionData {
  input: string | string[] | number[] | number[][] | null;
  output: string | null;
  tokens?: number;
  latency: number;
}

type CreateChatCompletionReturnType = ReturnType<
  typeof OpenAI.Chat.Completions.prototype.create
>;

type CreateCompletionReturnType = ReturnType<
  typeof OpenAI.Completions.prototype.create
>;

type CreateChatCompletion = (
  ...args: Parameters<typeof OpenAI.Chat.Completions.prototype.create>
) => CreateChatCompletionReturnType;

type CreateCompletion = (
  ...args: Parameters<typeof OpenAI.Completions.prototype.create>
) => CreateCompletionReturnType;

class OpenAIMonitor {
  private originalCreateChatCompletion: CreateChatCompletion;
  private originalCreateCompletion: CreateCompletion;
  private monitoringOn: boolean = false;
  private data: ChatCompletionData[] = [];

  constructor(
    private openlayerApiKey?: string,
    private openlayerProjectName?: string,
    private publish: boolean = true
  ) {
    // If credentials are not provided, read them from environment variables
    this.openlayerApiKey = openlayerApiKey;
    this.openlayerProjectName = openlayerProjectName;

    this.originalCreateChatCompletion =
      OpenAI.Chat.Completions.prototype.create;
    this.originalCreateCompletion = OpenAI.Completions.prototype.create;

    if (this.publish && (!this.openlayerApiKey || !this.openlayerProjectName)) {
      throw new Error(
        'Openlayer API key and project name are required for publishing.'
      );
    }

    // Initialize Openlayer client and load inference pipeline here
    // ...
  }

  public startMonitoring() {
    if (this.monitoringOn) {
      console.warn('Monitoring is already on!');
      return;
    }

    OpenAI.Chat.Completions.prototype.create =
      this.monkeyPatchedCreateChatCompletion.bind(this) as any;
    OpenAI.Completions.prototype.create =
      this.monkeyPatchedCreateCompletion.bind(this) as any;

    this.monitoringOn = true;
    console.info('Monitoring started.');
  }

  public stopMonitoring() {
    if (!this.monitoringOn) {
      console.warn('Monitoring is not active.');
      return;
    }

    OpenAI.Chat.Completions.prototype.create = this
      .originalCreateChatCompletion as unknown as typeof OpenAI.Chat.Completions.prototype.create;
    OpenAI.Completions.prototype.create = this
      .originalCreateCompletion as unknown as typeof OpenAI.Completions.prototype.create;

    this.monitoringOn = false;
    console.info('Monitoring stopped.');
  }

  private formatInput = (messages: ChatCompletionMessageParam[]) =>
    messages
      .filter(({ role }) => role === 'user')
      .map(({ content }) => content)
      .join('\n')
      .trim();

  private monkeyPatchedCreateCompletion(
    body: CompletionCreateParams,
    options?: RequestOptions
  ): CreateCompletionReturnType {
    const startTime = Date.now();
    // Accumulate output and tokens data for streamed responses
    let outputData = '';
    let tokensData = 0;

    const responsePromise = this.originalCreateCompletion
      .call(OpenAI.Completions, body, options)
      .then(async (response) => {
        if (body.stream) {
          const streamedResponse = response as Stream<Completion>;

          for await (const chunk of streamedResponse) {
            // Process each chunk - for example, accumulate input data
            outputData += chunk.choices[0].text.trim();
            tokensData += chunk.usage?.total_tokens ?? 0;
          }

          const endTime = Date.now();
          const latency = endTime - startTime;

          // Process complete streamed data here
          this.data.push({
            input: body.prompt,
            latency: latency,
            output: outputData,
            tokens: tokensData,
          });

          if (this.publish) {
            this.uploadDataToOpenlayer();
          }

          return response;
        } else {
          const nonStreamedResponse = response as Completion;
          // Handle regular (non-streamed) response
          const endTime = Date.now();
          const latency = endTime - startTime;

          this.data.push({
            input: body.prompt,
            output: nonStreamedResponse.choices[0].text,
            latency: latency,
            tokens: nonStreamedResponse.usage?.total_tokens ?? 0,
          });

          if (this.publish) {
            this.uploadDataToOpenlayer();
          }

          return response;
        }
      });

    return responsePromise as unknown as CreateCompletionReturnType;
  }

  private monkeyPatchedCreateChatCompletion(
    body: ChatCompletionCreateParams,
    options?: RequestOptions
  ): CreateChatCompletionReturnType {
    const startTime = Date.now();
    // Accumulate output and tokens data for streamed responses
    let outputData = '';

    const responsePromise = this.originalCreateChatCompletion
      .call(OpenAI.Chat.Completions, body, options)
      .then(async (response) => {
        if (body.stream) {
          const streamedResponse = response as Stream<ChatCompletionChunk>;

          for await (const chunk of streamedResponse) {
            // Process each chunk - for example, accumulate input data
            outputData += chunk.choices[0].delta.content;
          }

          const endTime = Date.now();
          const latency = endTime - startTime;

          // Process complete streamed data here
          this.data.push({
            input: this.formatInput(body.messages),
            latency: latency,
            output: outputData,
          });

          if (this.publish) {
            this.uploadDataToOpenlayer();
          }

          return response;
        } else {
          const nonStreamedResponse = response as ChatCompletion;
          // Handle regular (non-streamed) response
          const endTime = Date.now();
          const latency = endTime - startTime;

          this.data.push({
            input: this.formatInput(body.messages),
            output: nonStreamedResponse.choices[0].message.content,
            latency: latency,
            tokens: nonStreamedResponse.usage?.total_tokens ?? 0,
          });

          if (this.publish) {
            this.uploadDataToOpenlayer();
          }

          return response;
        }
      });

    return responsePromise as unknown as CreateChatCompletionReturnType;
  }

  private async uploadDataToOpenlayer(): Promise<void> {
    // Implement the logic to upload the data to Openlayer
    // This might involve an HTTP POST request with the data
    console.log(this.data);
  }

  // ... other private methods
}

// Usage Example
(async () => {
  const monitor = new OpenAIMonitor('TEST', 'TEST');
  monitor.startMonitoring();

  const openai = new OpenAI({
    apiKey: '',
  });

  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Say this is a test' }],
    model: 'gpt-3.5-turbo',
  });

  console.log('Client chat completion:', chatCompletion);

  monitor.stopMonitoring();
})();

export default OpenAIMonitor;
