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
  latency: number;
  output: string | null;
  tokens?: number;
}

class OpenAIMonitor {
  private OpenAIClient: OpenAI;
  private monitoringOn: boolean = false;
  public data: ChatCompletionData[] = [];

  constructor(
    openAiApiKey: string,
    private openlayerApiKey?: string,
    private openlayerProjectName?: string
  ) {
    this.OpenAIClient = new OpenAI({ apiKey: openAiApiKey });
    this.openlayerApiKey = openlayerApiKey;
    this.openlayerProjectName = openlayerProjectName;

    if (!this.openlayerApiKey || !this.openlayerProjectName) {
      throw new Error(
        'Openlayer API key and project name are required for publishing.'
      );
    }
  }

  private formatChatCompletionInput = (
    messages: ChatCompletionMessageParam[]
  ) =>
    messages
      .filter(({ role }) => role === 'user')
      .map(({ content }) => content)
      .join('\n')
      .trim();

  private uploadDataToOpenlayer = async (): Promise<void> => {
    // Implement the logic to upload the data to Openlayer
    // This might involve an HTTP POST request with the data
    console.log(this.data);
  };

  public startMonitoring() {
    if (this.monitoringOn) {
      console.warn('Monitoring is already on!');
      return;
    }

    this.monitoringOn = true;
    console.info('Monitoring started.');
  }

  public stopMonitoring() {
    if (!this.monitoringOn) {
      console.warn('Monitoring is not active.');
      return;
    }

    this.monitoringOn = false;
    console.info('Monitoring stopped.');
  }

  public createChatCompletion = async (
    body: ChatCompletionCreateParams,
    options?: RequestOptions
  ): Promise<ChatCompletion | Stream<ChatCompletionChunk>> => {
    if (!this.monitoringOn) {
      throw new Error('Monitoring is not active.');
    }

    // Start a timer to measure latency
    const startTime = Date.now();
    // Accumulate output for streamed responses
    let outputData = '';

    const response = await this.OpenAIClient.chat.completions.create(
      body,
      options
    );

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
        input: this.formatChatCompletionInput(body.messages),
        latency: latency,
        output: outputData,
      });
    } else {
      const nonStreamedResponse = response as ChatCompletion;
      // Handle regular (non-streamed) response
      const endTime = Date.now();
      const latency = endTime - startTime;

      this.data.push({
        input: this.formatChatCompletionInput(body.messages),
        output: nonStreamedResponse.choices[0].message.content,
        latency: latency,
        tokens: nonStreamedResponse.usage?.total_tokens ?? 0,
      });
    }

    this.uploadDataToOpenlayer();
    return response;
  };

  public createCompletion = async (
    body: CompletionCreateParams,
    options?: RequestOptions
  ): Promise<Completion | Stream<Completion>> => {
    if (!this.monitoringOn) {
      throw new Error('Monitoring is not active.');
    }

    // Start a timer to measure latency
    const startTime = Date.now();

    // Accumulate output and tokens data for streamed responses
    let outputData = '';
    let tokensData = 0;

    const response = await this.OpenAIClient.completions.create(body, options);

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
    }

    this.uploadDataToOpenlayer();
    return response;
  };
}

// Usage Example
(async () => {
  const monitor = new OpenAIMonitor(
    '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',
    'TEST',
    'TEST'
  );

  monitor.startMonitoring();

  const chatCompletion = await monitor.createChatCompletion({
    messages: [{ role: 'user', content: 'Say this is a test' }],
    model: 'gpt-3.5-turbo',
  });

  const completion = await monitor.createCompletion({
    model: 'gpt-3.5-turbo-instruct',
    prompt: 'Say this is a test',
  });

  console.log('Client chat completion:', chatCompletion);
  console.log('Client completion:', completion);

  monitor.stopMonitoring();
})();

export default OpenAIMonitor;
