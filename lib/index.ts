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
  private version = '0.1.0a16';

  constructor(
    openAiApiKey: string,
    private openlayerApiKey?: string,
    private openlayerProjectName?: string,
    private openlayerInferencePipelineName?: string,
    private openlayerServerUrl: string = 'https://api.openlayer.com/v1'
  ) {
    this.OpenAIClient = new OpenAI({ apiKey: openAiApiKey });
    this.openlayerApiKey = openlayerApiKey;
    this.openlayerProjectName = openlayerProjectName;
    this.openlayerServerUrl = this.openlayerServerUrl;

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

  private uploadDataToOpenlayer = async (
    data: ChatCompletionData
  ): Promise<void> => {
    const uploadToInferencePipeline = async (id: string) => {
      const dataStreamEndpoint = `/inference-pipelines/${id}/data-stream?version=${this.version}`;
      const dataStreamUrl = `${this.openlayerServerUrl}${dataStreamEndpoint}`;

      const response = await fetch(dataStreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openlayerApiKey}`,
        },
        body: JSON.stringify({
          dataset: [data],
          datasetConfig: {},
        }),
      });

      if (!response.ok) {
        console.error('Error making POST request:', response.status);
        throw new Error(`Error: ${response.status}`);
      }

      return await response.json();
    };

    if (!this.openlayerApiKey || !this.openlayerProjectName) {
      throw new Error(
        'Openlayer API key and project name are required for publishing.'
      );
    }

    try {
      const projectsEndpoint = `/projects?perPage=100&name=${this.openlayerProjectName}&version=${this.version}`;
      const projectsUrl = `${this.openlayerServerUrl}${projectsEndpoint}`;

      const projectsResponse = await fetch(projectsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openlayerApiKey}`,
        },
      });

      const { items: projects, ...data } = await projectsResponse.json();

      if (!Array.isArray(projects)) {
        throw new Error('Invalid response from Openlayer');
      }

      const project = projects.find(
        ({ name }) => name === this.openlayerProjectName
      );

      if (!project?.id) {
        throw new Error('Project not found');
      }

      const inferencePipelineEndpoint = `/projects/${project.id}/inference-pipelines?perPage=100&name=${this.openlayerInferencePipelineName}&version=${this.version}`;
      const inferencePipelineUrl = `${this.openlayerServerUrl}${inferencePipelineEndpoint}`;

      const inferencePipelineResponse = await fetch(inferencePipelineUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openlayerApiKey}`,
        },
      });

      const { items: inferencePipelines } =
        await inferencePipelineResponse.json();
      const inferencePipeline = Array.isArray(inferencePipelines)
        ? inferencePipelines.find(
            ({ name }) =>
              typeof this.openlayerInferencePipelineName === 'undefined' ||
              name === this.openlayerInferencePipelineName
          )
        : undefined;

      if (!inferencePipeline?.id) {
        const createInferencePipelineEndpoint = `/projects/${project.id}/inference-pipelines?version=${this.version}`;
        const createInferencePipelineUrl = `${this.openlayerServerUrl}${createInferencePipelineEndpoint}`;

        const createInferencePipelineResponse = await fetch(
          createInferencePipelineUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.openlayerApiKey}`,
            },
            body: JSON.stringify({
              description: '',
              name:
                typeof this.openlayerInferencePipelineName === 'undefined'
                  ? 'production'
                  : this.openlayerInferencePipelineName,
            }),
          }
        );

        const { id: inferencePipelineId, ...response } =
          await createInferencePipelineResponse.json();

        if (!inferencePipelineId) {
          throw new Error('Error creating inference pipeline');
        }

        await uploadToInferencePipeline(inferencePipelineId);
      } else {
        const { id: inferencePipelineId } = inferencePipeline;
        await uploadToInferencePipeline(inferencePipelineId);
      }
    } catch (error) {
      console.error('Error publishing data to Openlayer:', error);
      throw error;
    }
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

      this.uploadDataToOpenlayer({
        input: this.formatChatCompletionInput(body.messages),
        latency: latency,
        output: outputData,
      });
    } else {
      const nonStreamedResponse = response as ChatCompletion;
      // Handle regular (non-streamed) response
      const endTime = Date.now();
      const latency = endTime - startTime;

      this.uploadDataToOpenlayer({
        input: this.formatChatCompletionInput(body.messages),
        output: nonStreamedResponse.choices[0].message.content,
        latency: latency,
        tokens: nonStreamedResponse.usage?.total_tokens ?? 0,
      });
    }

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

      this.uploadDataToOpenlayer({
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

      this.uploadDataToOpenlayer({
        input: body.prompt,
        output: nonStreamedResponse.choices[0].text,
        latency: latency,
        tokens: nonStreamedResponse.usage?.total_tokens ?? 0,
      });
    }

    return response;
  };
}

export default OpenAIMonitor;
