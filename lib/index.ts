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
import { v4 as uuid } from 'uuid';
import { RequestParameters, resolvedQuery } from './utils/request';

interface ChatCompletionData {
  input: string | string[] | number[] | number[][] | null;
  latency: number;
  output: string | null;
  tokens?: number;
}

type ConstructorProps = {
  openAiApiKey: string;
  openlayerApiKey?: string;
  openlayerInferencePipelineName?: string;
  openlayerProjectName?: string;
  openlayerServerUrl?: string;
};

class OpenAIMonitor {
  private OpenAIClient: OpenAI;

  private monitoringOn: boolean = false;

  private openlayerApiKey?: string;

  private openlayerProjectName?: string;

  private openlayerInferencePipelineName?: string;

  private openlayerServerUrl: string = 'https://api.openlayer.com/v1';

  private version = '0.1.0a16';

  constructor({
    openAiApiKey,
    openlayerApiKey,
    openlayerInferencePipelineName,
    openlayerProjectName,
    openlayerServerUrl,
  }: ConstructorProps) {
    this.OpenAIClient = new OpenAI({
      apiKey: openAiApiKey,
      dangerouslyAllowBrowser: true,
    });

    this.openlayerApiKey = openlayerApiKey;
    this.openlayerInferencePipelineName = openlayerInferencePipelineName;
    this.openlayerProjectName = openlayerProjectName;

    if (openlayerServerUrl) {
      this.openlayerServerUrl = openlayerServerUrl;
    }

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

  private resolvedQuery = (endpoint: string, args: RequestParameters = {}) =>
    resolvedQuery(this.openlayerServerUrl, endpoint, {
      version: this.version,
      ...args,
    });

  private uploadDataToOpenlayer = async (
    data: ChatCompletionData
  ): Promise<void> => {
    const uploadToInferencePipeline = async (id: string) => {
      const dataStreamEndpoint = `/inference-pipelines/${id}/data-stream`;
      const dataStreamQuery = this.resolvedQuery(dataStreamEndpoint);

      const response = await fetch(dataStreamQuery, {
        body: JSON.stringify({
          config: {
            groundTruthColumnName: null,
            inferenceIdColumnName: 'id',
            inputVariableNames: ['input'],
            latencyColumnName: 'latency',
            outputColumnName: 'output',
            timestampColumnName: 'timestamp',
            tokensColumnName: 'tokens',
          },
          rows: [
            {
              id: uuid(),
              ...data,
            },
          ],
        }),
        headers: {
          Authorization: `Bearer ${this.openlayerApiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
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
      const projectsEndpoint = '/projects';
      const projectsQueryParameters = {
        name: this.openlayerProjectName,
      };

      const projectsQuery = this.resolvedQuery(
        projectsEndpoint,
        projectsQueryParameters
      );

      const projectsResponse = await fetch(projectsQuery, {
        headers: {
          Authorization: `Bearer ${this.openlayerApiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      });

      const { items: projects } = await projectsResponse.json();

      if (!Array.isArray(projects)) {
        throw new Error('Invalid response from Openlayer');
      }

      const project = projects.find(
        ({ name }) => name === this.openlayerProjectName
      );

      if (!project?.id) {
        throw new Error('Project not found');
      }

      const inferencePipelineEndpoint = `/projects/${project.id}/inference-pipelines`;
      const inferencePipelineQueryParameters = {
        name: this.openlayerInferencePipelineName,
      };

      const inferencePipelineQuery = this.resolvedQuery(
        inferencePipelineEndpoint,
        inferencePipelineQueryParameters
      );

      const inferencePipelineResponse = await fetch(inferencePipelineQuery, {
        headers: {
          Authorization: `Bearer ${this.openlayerApiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
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

      if (inferencePipeline?.id) {
        const { id: inferencePipelineId } = inferencePipeline;
        await uploadToInferencePipeline(inferencePipelineId);
      } else {
        const createInferencePipelineEndpoint = `/projects/${project.id}/inference-pipelines`;
        const createInferencePipelineQuery = this.resolvedQuery(
          createInferencePipelineEndpoint
        );

        const createInferencePipelineResponse = await fetch(
          createInferencePipelineQuery,
          {
            body: JSON.stringify({
              description: '',
              name:
                typeof this.openlayerInferencePipelineName === 'undefined'
                  ? 'production'
                  : this.openlayerInferencePipelineName,
            }),
            headers: {
              Authorization: `Bearer ${this.openlayerApiKey}`,
              'Content-Type': 'application/json',
            },
            method: 'POST',
          }
        );

        const { id: inferencePipelineId } =
          await createInferencePipelineResponse.json();

        if (!inferencePipelineId) {
          throw new Error('Error creating inference pipeline');
        }

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
        latency,
        output: outputData,
      });
    } else {
      const nonStreamedResponse = response as ChatCompletion;
      // Handle regular (non-streamed) response
      const endTime = Date.now();
      const latency = endTime - startTime;

      this.uploadDataToOpenlayer({
        input: this.formatChatCompletionInput(body.messages),
        latency,
        output: nonStreamedResponse.choices[0].message.content,
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
        latency,
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
        latency,
        output: nonStreamedResponse.choices[0].text,
        tokens: nonStreamedResponse.usage?.total_tokens ?? 0,
      });
    }

    return response;
  };
}

export default OpenAIMonitor;
