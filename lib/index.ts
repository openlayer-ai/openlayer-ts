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

/**
 * Represents the data structure for a chat completion.
 */
export interface ChatCompletionData {
  [key: string]: any;

  /**
   * The input data for the chat completion. It can be a string, an array of strings,
   * or a nested array of numbers.
   */
  input: string | string[] | number[] | number[][];

  /**
   * The latency of the chat completion in milliseconds. Optional.
   */
  latency?: number;

  /**
   * The output string generated by the chat completion.
   */
  output: string;

  /**
   * A timestamp representing when the chat completion occurred. Optional.
   */
  timestamp?: number;

  /**
   * The number of tokens used in the chat completion. Optional.
   */
  tokens?: number;
}

/**
 * Configuration settings for uploading chat completion data to Openlayer.
 */
interface ChatCompletionConfig {
  /**
   * The name of the column that stores the ground truth data. Can be null.
   */
  groundTruthColumnName: string | null;

  /**
   * The name of the column that stores inference IDs. Can be null.
   */
  inferenceIdColumnName: string | null;

  /**
   * An array of names for input variable columns. Can be null.
   */
  inputVariableNames: string[] | null;

  /**
   * The name of the column that stores latency data. Can be null.
   */
  latencyColumnName: string | null;

  /**
   * The name of the column that stores the number of tokens. Can be null.
   */
  numOfTokenColumnName: string | null;

  /**
   * The name of the column that stores output data. Can be null.
   */
  outputColumnName: string | null;

  /**
   * The name of the column that stores timestamp data. Can be null.
   */
  timestampColumnName: string | null;
}

type OpenlayerClientConstructorProps = {
  openlayerApiKey?: string;
  openlayerInferencePipelineName?: string;
  openlayerProjectName?: string;
  openlayerServerUrl?: string;
};

type OpenAIMonitorConstructorProps = OpenlayerClientConstructorProps & {
  openAiApiKey: string;
  openlayerInferencePipelineName?: string;
  openlayerProjectName: string;
};

type OpenlayerInferencePipeline = {
  dataVolumeGraphs?: OpenlayerSampleVolumeGraph;
  dateCreated: string;
  dateLastEvaluated?: string;
  dateLastSampleReceived?: string;
  dateOfNextEvaluation?: string;
  dateUpdated: string;
  description?: string;
  failingGoalCount: number;
  id: string;
  name: string;
  passingGoalCount: number;
  projectId: string;
  status: OpenlayerInferencePipelineStatus;
  statusMessage?: string;
  totalGoalCount: number;
};

type OpenlayerInferencePipelineStatus =
  | 'completed'
  | 'failed'
  | 'paused'
  | 'queued'
  | 'running'
  | 'unknown';

type OpenlayerProject = {
  dateCreated: string;
  dateUpdated: string;
  description?: string;
  developmentGoalCount: number;
  goalCount: number;
  id: string;
  inferencePipelineCount: number;
  memberIds: string[];
  monitoringGoalCount: number;
  name: string;
  sample?: boolean;
  slackChannelId?: string;
  slackChannelName?: string;
  slackChannelNotificationsEnabled: boolean;
  taskType: OpenlayerTaskType;
  unreadNotificationCount: number;
  versionCount: number;
};

type OpenlayerSampleVolumeGraphBucket = {
  title: string;
  xAxis: {
    data: string[];
    title: string;
  };
  yAxis: {
    data: number[];
    title: string;
  };
};

type OpenlayerSampleVolumeGraph = {
  daily: OpenlayerSampleVolumeGraphBucket;
  hourly: OpenlayerSampleVolumeGraphBucket;
  monthly: OpenlayerSampleVolumeGraphBucket;
  weekly: OpenlayerSampleVolumeGraphBucket;
};

type OpenlayerTaskType =
  | 'llm-base'
  | 'tabular-classification'
  | 'tabular-regression'
  | 'text-classification';

export class OpenlayerClient {
  private openlayerApiKey?: string;

  private openlayerDefaultDataConfig: ChatCompletionConfig = {
    groundTruthColumnName: null,
    inferenceIdColumnName: 'id',
    inputVariableNames: ['input'],
    latencyColumnName: 'latency',
    numOfTokenColumnName: 'tokens',
    outputColumnName: 'output',
    timestampColumnName: 'timestamp',
  };

  private openlayerServerUrl: string = 'https://api.openlayer.com/v1';

  private version = '0.1.0a16';

  /**
   * Constructs an OpenlayerClient instance.
   * @param {OpenlayerClientConstructorProps} props - The config for the Openlayer client. The API key is required.
   * @throws {Error} Throws an error if the Openlayer API key is not provided.
   */
  constructor({
    openlayerApiKey,
    openlayerServerUrl,
  }: OpenlayerClientConstructorProps) {
    this.openlayerApiKey = openlayerApiKey;

    if (openlayerServerUrl) {
      this.openlayerServerUrl = openlayerServerUrl;
    }

    if (!this.openlayerApiKey) {
      throw new Error('Openlayer API key are required for publishing.');
    }
  }

  private resolvedQuery = (endpoint: string, args: RequestParameters = {}) =>
    resolvedQuery(this.openlayerServerUrl, endpoint, args);

  /**
   * Streams data to the Openlayer inference pipeline.
   * @param {ChatCompletionData} data - The chat completion data to be streamed.
   * @param {string} inferencePipelineId - The ID of the Openlayer inference pipeline to which data is streamed.
   * @returns {Promise<void>} A promise that resolves when the data has been successfully streamed.
   * @throws {Error} Throws an error if the Openlayer API key is not set or an error occurs in the streaming process.
   */
  public streamData = async (
    data: ChatCompletionData,
    inferencePipelineId: string
  ): Promise<void> => {
    if (!this.openlayerApiKey) {
      throw new Error('Openlayer API key are required for streaming data.');
    }

    try {
      const dataStreamEndpoint = `/inference-pipelines/${inferencePipelineId}/data-stream`;
      const dataStreamQuery = this.resolvedQuery(dataStreamEndpoint);

      const response = await fetch(dataStreamQuery, {
        body: JSON.stringify({
          config: this.openlayerDefaultDataConfig,
          rows: [
            {
              ...data,
              id: uuid(),
              timestamp: Math.round((data.timestamp ?? Date.now()) / 1000),
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
    } catch (error) {
      console.error('Error streaming data to Openlayer:', error);
      throw error;
    }
  };

  /**
   * Creates a new inference pipeline in Openlayer or loads an existing one.
   * @param {string} projectId - The ID of the project containing the inference pipeline.
   * @param {string} [name='production'] - The name of the inference pipeline, defaults to 'production'.
   * @returns {Promise<OpenlayerInferencePipeline>} A promise that resolves to an OpenlayerInferencePipeline object.
   * @throws {Error} Throws an error if the inference pipeline cannot be created or found.
   */
  public createInferencePipeline = async (
    projectId: string,
    name: string = 'production'
  ): Promise<OpenlayerInferencePipeline> => {
    try {
      return await this.loadInferencePipeline(projectId, name);
    } catch {
      const createInferencePipelineEndpoint = `/projects/${projectId}/inference-pipelines`;
      const createInferencePipelineQuery = this.resolvedQuery(
        createInferencePipelineEndpoint,
        { version: this.version }
      );

      const createInferencePipelineResponse = await fetch(
        createInferencePipelineQuery,
        {
          body: JSON.stringify({
            description: '',
            name,
          }),
          headers: {
            Authorization: `Bearer ${this.openlayerApiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        }
      );

      const inferencePipeline = await createInferencePipelineResponse.json();

      if (!inferencePipeline?.id) {
        throw new Error('Error creating inference pipeline');
      }

      return inferencePipeline;
    }
  };

  /**
   * Creates a new project in Openlayer or loads an existing one.
   * @param {string} name - The name of the project.
   * @param {OpenlayerTaskType} taskType - The type of task associated with the project.
   * @param {string} [description] - Optional description of the project.
   * @returns {Promise<OpenlayerProject>} A promise that resolves to an OpenlayerProject object.
   * @throws {Error} Throws an error if the project cannot be created or found.
   */
  public createProject = async (
    name: string,
    taskType: OpenlayerTaskType,
    description?: string
  ): Promise<OpenlayerProject> => {
    try {
      return await this.loadProject(name);
    } catch {
      const projectsEndpoint = '/projects';
      const projectsQuery = this.resolvedQuery(projectsEndpoint);

      const projectsResponse = await fetch(projectsQuery, {
        body: JSON.stringify({
          description,
          name,
          taskType,
        }),
        headers: {
          Authorization: `Bearer ${this.openlayerApiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const { items: projects } = await projectsResponse.json();

      if (!Array.isArray(projects)) {
        throw new Error('Invalid response from Openlayer');
      }

      const project = projects.find((p) => p.name === name);

      if (!project?.id) {
        throw new Error('Project not found');
      }

      return project;
    }
  };

  /**
   * Loads an existing inference pipeline from Openlayer based on its name and project ID.
   * @param {string} projectId - The ID of the project containing the inference pipeline.
   * @param {string} [name='production'] - The name of the inference pipeline, defaults to 'production'.
   * @returns {Promise<OpenlayerInferencePipeline>} A promise that resolves to an OpenlayerInferencePipeline object.
   * @throws {Error} Throws an error if the inference pipeline is not found.
   */
  public loadInferencePipeline = async (
    projectId: string,
    name: string = 'production'
  ): Promise<OpenlayerInferencePipeline> => {
    const inferencePipelineEndpoint = `/projects/${projectId}/inference-pipelines`;
    const inferencePipelineQueryParameters = {
      name,
      version: this.version,
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
      ? inferencePipelines.find((p) => p.name === name)
      : undefined;

    if (!inferencePipeline?.id) {
      throw new Error('Inference pipeline not found');
    }

    return inferencePipeline;
  };

  /**
   * Loads an existing project from Openlayer based on its name.
   * @param {string} name - The name of the project.
   * @returns {Promise<OpenlayerProject>} A promise that resolves to an OpenlayerProject object.
   * @throws {Error} Throws an error if the project is not found.
   */
  public loadProject = async (name: string): Promise<OpenlayerProject> => {
    const projectsEndpoint = '/projects';
    const projectsQueryParameters = {
      name,
      version: this.version,
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

    const project = projects.find((p) => p.name === name);

    if (!project?.id) {
      throw new Error('Project not found');
    }

    return project;
  };
}

export class OpenAIMonitor {
  private openlayerClient: OpenlayerClient;

  private openAIClient: OpenAI;

  private openlayerProjectName: string;

  private openlayerInferencePipelineName: string = 'production';

  private monitoringOn: boolean = false;

  /**
   * Constructs an OpenAIMonitor instance.
   * @param {OpenAIMonitorConstructorProps} props - The configuration properties for the OpenAI and Openlayer clients.
   */
  constructor({
    openAiApiKey,
    openlayerApiKey,
    openlayerProjectName,
    openlayerInferencePipelineName,
    openlayerServerUrl,
  }: OpenAIMonitorConstructorProps) {
    this.openlayerProjectName = openlayerProjectName;
    if (openlayerInferencePipelineName) {
      this.openlayerInferencePipelineName = openlayerInferencePipelineName;
    }

    this.openlayerClient = new OpenlayerClient({
      openlayerApiKey,
      openlayerServerUrl,
    });

    this.openAIClient = new OpenAI({
      apiKey: openAiApiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  private formatChatCompletionInput = (
    messages: ChatCompletionMessageParam[]
  ) =>
    messages
      .filter(({ role }) => role === 'user')
      .map(({ content }) => content)
      .join('\n')
      .trim();

  /**
   * Creates a chat completion using the OpenAI client and streams the result to Openlayer.
   * @param {ChatCompletionCreateParams} body - The parameters for creating a chat completion.
   * @param {RequestOptions} [options] - Optional request options.
   * @returns {Promise<ChatCompletion | Stream<ChatCompletionChunk>>} Promise of a ChatCompletion or a Stream
   * @throws {Error} Throws an error if monitoring is not active or if no output is received from OpenAI.
   */
  public createChatCompletion = async (
    body: ChatCompletionCreateParams,
    options?: RequestOptions
  ): Promise<ChatCompletion | Stream<ChatCompletionChunk>> => {
    if (!this.monitoringOn) {
      throw new Error('Monitoring is not active.');
    }

    const project = await this.openlayerClient.createProject(
      this.openlayerProjectName,
      'llm-base'
    );

    const inferencePipeline =
      await this.openlayerClient.createInferencePipeline(
        project.id,
        this.openlayerInferencePipelineName
      );

    // Start a timer to measure latency
    const startTime = Date.now();
    // Accumulate output for streamed responses
    let outputData = '';

    const response = await this.openAIClient.chat.completions.create(
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

      this.openlayerClient.streamData(
        {
          input: this.formatChatCompletionInput(body.messages),
          latency,
          output: outputData,
          timestamp: startTime,
        },
        inferencePipeline.id
      );
    } else {
      const nonStreamedResponse = response as ChatCompletion;
      // Handle regular (non-streamed) response
      const endTime = Date.now();
      const latency = endTime - startTime;
      const output = nonStreamedResponse.choices[0].message.content;
      if (typeof output !== 'string') {
        throw new Error('No output received from OpenAI.');
      }

      this.openlayerClient.streamData(
        {
          input: this.formatChatCompletionInput(body.messages),
          latency,
          output,
          timestamp: startTime,
          tokens: nonStreamedResponse.usage?.total_tokens ?? 0,
        },
        inferencePipeline.id
      );
    }

    return response;
  };

  /**
   * Creates a completion using the OpenAI client and streams the result to Openlayer.
   * @param {CompletionCreateParams} body - The parameters for creating a completion.
   * @param {RequestOptions} [options] - Optional request options.
   * @returns {Promise<Completion | Stream<Completion>>} Promise that resolves to a Completion or a Stream.
   * @throws {Error} Throws an error if monitoring is not active or if no prompt is provided.
   */
  public createCompletion = async (
    body: CompletionCreateParams,
    options?: RequestOptions
  ): Promise<Completion | Stream<Completion>> => {
    if (!this.monitoringOn) {
      throw new Error('Monitoring is not active.');
    }

    if (!body.prompt) {
      throw new Error('No prompt provided.');
    }

    const project = await this.openlayerClient.createProject(
      this.openlayerProjectName,
      'llm-base'
    );

    const inferencePipeline =
      await this.openlayerClient.createInferencePipeline(
        project.id,
        this.openlayerInferencePipelineName
      );

    // Start a timer to measure latency
    const startTime = Date.now();

    // Accumulate output and tokens data for streamed responses
    let outputData = '';
    let tokensData = 0;

    const response = await this.openAIClient.completions.create(body, options);

    if (body.stream) {
      const streamedResponse = response as Stream<Completion>;

      for await (const chunk of streamedResponse) {
        // Process each chunk - for example, accumulate input data
        outputData += chunk.choices[0].text.trim();
        tokensData += chunk.usage?.total_tokens ?? 0;
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      this.openlayerClient.streamData(
        {
          input: body.prompt,
          latency,
          output: outputData,
          timestamp: startTime,
          tokens: tokensData,
        },
        inferencePipeline.id
      );
    } else {
      const nonStreamedResponse = response as Completion;
      // Handle regular (non-streamed) response
      const endTime = Date.now();
      const latency = endTime - startTime;

      this.openlayerClient.streamData(
        {
          input: body.prompt,
          latency,
          output: nonStreamedResponse.choices[0].text,
          timestamp: startTime,
          tokens: nonStreamedResponse.usage?.total_tokens ?? 0,
        },
        inferencePipeline.id
      );
    }

    return response;
  };

  /**
   * Starts monitoring for the OpenAI Monitor instance. If monitoring is already active, a warning is logged.
   */
  public startMonitoring() {
    if (this.monitoringOn) {
      console.warn('Monitoring is already on!');
      return;
    }

    this.monitoringOn = true;
    console.info('Monitoring started.');
  }

  /**
   * Stops monitoring for the OpenAI Monitor instance. If monitoring is not active, a warning is logged.
   */
  public stopMonitoring() {
    if (!this.monitoringOn) {
      console.warn('Monitoring is not active.');
      return;
    }

    this.monitoringOn = false;
    console.info('Monitoring stopped.');
  }
}
