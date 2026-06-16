// tracing/tracer.ts

import { Trace } from './traces';
import {
  Step,
  ChatCompletionStep,
  AgentStep,
  RetrieverStep,
  FunctionCallStep,
  HandoffStep,
  GuardrailStep,
  StepType,
  stepFactory,
} from './steps';
import Openlayer, { type ClientOptions } from '../../index';
import type { DataStreamParams } from '../../resources/inference-pipelines/data';
import { OfflineBuffer } from './offlineBuffer';

let currentTrace: Trace | null = null;

// Lazy-initialized Openlayer client to ensure environment variables are loaded
let client: Openlayer | null = null;
let clientInitialized = false;

// ----------------------------------------------------------------------------
// Offline buffering & failure-resilience types and configuration
//
// Ports the Python SDK's data-loss-prevention features (offline buffer,
// onFlushFailure callback, configure(), and manual replay).
// ----------------------------------------------------------------------------

/** Invoked when a trace fails to flush to Openlayer. */
export type OnFlushFailureCallback = (
  traceData: Record<string, any>,
  config: Record<string, any>,
  error: unknown,
) => void;

/** Invoked when a buffered trace is successfully replayed. */
export type OnReplaySuccessCallback = (traceData: Record<string, any>, config: Record<string, any>) => void;

/** Invoked when a buffered trace fails to replay after all retries. */
export type OnReplayFailureCallback = (
  traceData: Record<string, any>,
  config: Record<string, any>,
  error: unknown,
) => void;

export interface ConfigureOptions {
  apiKey?: string;
  inferencePipelineId?: string;
  baseURL?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
  maxRetries?: number;
  /** Callback invoked on every failed flush (before buffering). */
  onFlushFailure?: OnFlushFailureCallback;
  /** Persist failed traces to disk for later replay. Defaults to false. */
  offlineBufferEnabled?: boolean;
  /** Directory for buffered traces. Defaults to ~/.openlayer/buffer. */
  offlineBufferPath?: string;
  /** Maximum number of buffered trace files. Defaults to 1000. */
  maxBufferSize?: number;
}

export interface BufferStatus {
  enabled: boolean;
  bufferPath?: string;
  totalTraces?: number;
  maxBufferSize?: number;
  totalSizeBytes?: number;
  oldestTrace?: string | null;
  newestTrace?: string | null;
  error?: string;
}

export interface ReplayResult {
  totalTraces: number;
  successCount: number;
  failureCount: number;
  failedTraces?: Array<{ traceId: string; error: string; filePath: string }>;
  error?: string;
}

// Programmatic configuration (set via configure()). Environment variables remain
// the fallback for every field, so existing env-only setups keep working.
let configuredApiKey: string | undefined;
let configuredPipelineId: string | undefined;
let configuredBaseURL: string | undefined;
let configuredTimeout: number | undefined;
let configuredMaxRetries: number | undefined;
let configuredOnFlushFailure: OnFlushFailureCallback | undefined;
let configuredOfflineBufferEnabled = false;
let configuredOfflineBufferPath: string | undefined;
let configuredMaxBufferSize: number | undefined;

let offlineBuffer: OfflineBuffer | null = null;

function getOpenlayerClient(): Openlayer | null {
  if (clientInitialized) {
    return client;
  }
  clientInitialized = true;

  const publish = process.env['OPENLAYER_DISABLE_PUBLISH'] !== 'true';
  if (publish) {
    console.debug('Publishing is enabled');
    // Build from configured values; the Openlayer constructor falls back to
    // environment variables for any option left unset.
    const options: ClientOptions = {};
    if (configuredApiKey !== undefined) options.apiKey = configuredApiKey;
    if (configuredBaseURL !== undefined) options.baseURL = configuredBaseURL;
    if (configuredTimeout !== undefined) options.timeout = configuredTimeout;
    if (configuredMaxRetries !== undefined) options.maxRetries = configuredMaxRetries;
    client = new Openlayer(options);
  }
  return client;
}

export function getCurrentTrace(): Trace | null {
  return currentTrace;
}

function setCurrentTrace(trace: Trace | null) {
  currentTrace = trace;
}

// Function to create a new step
const stepStack: Step[] = [];

function createStep(
  name: string,
  stepType: StepType = StepType.USER_CALL,
  inputs?: any,
  output?: any,
  metadata: Record<string, any> | null = null,
  startTime?: number | null,
  endTime?: number | null,
  openlayerInferencePipelineId?: string,
): [Step, () => void] {
  metadata = metadata || {};
  const newStep = stepFactory(stepType, name, inputs, output, metadata, startTime, endTime);

  const inferencePipelineId =
    openlayerInferencePipelineId || configuredPipelineId || process.env['OPENLAYER_INFERENCE_PIPELINE_ID'];

  const parentStep = getCurrentStep();
  const isRootStep = parentStep === null;

  if (isRootStep) {
    console.debug('Starting a new trace...');
    console.debug(`Adding step ${name} as the root step`);
    const currentTrace = new Trace();
    setCurrentTrace(currentTrace);
    currentTrace.addStep(newStep);
  } else {
    console.debug(`Adding step ${name} as a nested step to ${parentStep!.name}`);
    currentTrace = getCurrentTrace()!;
    parentStep!.addNestedStep(newStep);
  }

  stepStack.push(newStep);

  const endStep = () => {
    // Calculate latency for this step before removing from stack
    newStep.endTime = Date.now();
    // Only calculate latency if it hasn't been manually set
    if (newStep.latency === null) {
      if (newStep.startTime && newStep.endTime) {
        newStep.latency = newStep.endTime - newStep.startTime;
      } else {
        newStep.latency = 0; // Fallback to 0 if timestamps are missing
      }
    }

    stepStack.pop(); // Remove the current step from the stack
    console.debug(`Ending step ${newStep.name}`);

    if (isRootStep) {
      console.debug('Ending the trace...');
      const traceData = getCurrentTrace();

      // NOTE: currentTrace is intentionally NOT reset here — integrations and
      // tests inspect the completed trace via getCurrentTrace() after the root
      // step ends. The next root step replaces it.
      processAndUploadTrace(traceData!, inferencePipelineId);
    } else {
      console.debug(`Ending step ${name}`);
    }
  };

  return [newStep, endStep];
}

export function getCurrentStep(): Step | null | undefined {
  const currentStep = stepStack.length > 0 ? stepStack[stepStack.length - 1] : null;
  return currentStep;
}

/**
 * Post-processes and uploads a completed trace to Openlayer. Used by the root
 * step's endStep and by integrations (e.g. the LangChain callback handler) that
 * assemble traces themselves.
 */
export function processAndUploadTrace(trace: Trace, openlayerInferencePipelineId?: string): Promise<void> {
  const { traceData: processedTraceData, inputVariableNames } = postProcessTrace(trace);

  const inferencePipelineId =
    openlayerInferencePipelineId || configuredPipelineId || process.env['OPENLAYER_INFERENCE_PIPELINE_ID'];
  const openlayerClient = getOpenlayerClient();

  if (openlayerClient && inferencePipelineId) {
    console.debug('Uploading trace to Openlayer...');

    // Lifted to a const so the failure handler can buffer it for later replay.
    const config = buildStreamConfig(processedTraceData, inputVariableNames);

    return openlayerClient.inferencePipelines.data
      .stream(inferencePipelineId, { config, rows: [processedTraceData] })
      .then(() => {
        console.debug('Trace uploaded successfully to Openlayer');
      })
      .catch((error: unknown) => {
        // Compact failure log (mirrors the Python SDK) — never dump the full
        // trace, which can be multiple MBs.
        console.error('Failed to upload trace to Openlayer:', error);
        console.error(
          `Failed trace summary: pipelineId=${inferencePipelineId} ` +
            `inferenceId=${processedTraceData?.['inferenceId']} ` +
            `payloadBytes=${JSON.stringify(processedTraceData).length} ` +
            `inputVariableNames=${JSON.stringify(inputVariableNames)}`,
        );
        // Invoke the failure callback and persist to the offline buffer so the
        // data is not lost.
        handleStreamingFailure(processedTraceData, config, inferencePipelineId, error);
      });
  } else {
    if (!openlayerClient) {
      console.debug('Trace upload disabled (OPENLAYER_DISABLE_PUBLISH=true or missing API key)');
    } else if (!inferencePipelineId) {
      console.warn('Trace upload skipped: OPENLAYER_INFERENCE_PIPELINE_ID environment variable not set');
    }
    return Promise.resolve();
  }
}

// ----------------------------------------------------------------------------
// Public configuration & offline-buffer management API
// ----------------------------------------------------------------------------

/**
 * Configure the Openlayer tracer programmatically.
 *
 * Only the fields you pass are updated; any field left unset keeps its
 * previously configured value (and falls back to the corresponding environment
 * variable if it was never set). This makes it safe to call configure() more
 * than once — e.g. to rotate the API key without clearing a previously
 * registered onFlushFailure callback or disabling the offline buffer. Calling
 * configure() resets the lazily created client and offline buffer so they pick
 * up the new settings.
 */
export function configure(options: ConfigureOptions): void {
  if (options.apiKey !== undefined) configuredApiKey = options.apiKey;
  if (options.inferencePipelineId !== undefined) configuredPipelineId = options.inferencePipelineId;
  if (options.baseURL !== undefined) configuredBaseURL = options.baseURL;
  if (options.timeout !== undefined) configuredTimeout = options.timeout;
  if (options.maxRetries !== undefined) configuredMaxRetries = options.maxRetries;
  if (options.onFlushFailure !== undefined) configuredOnFlushFailure = options.onFlushFailure;
  if (options.offlineBufferEnabled !== undefined)
    configuredOfflineBufferEnabled = options.offlineBufferEnabled;
  if (options.offlineBufferPath !== undefined) configuredOfflineBufferPath = options.offlineBufferPath;
  if (options.maxBufferSize !== undefined) configuredMaxBufferSize = options.maxBufferSize;

  // Reset so they are recreated with the new configuration.
  client = null;
  clientInitialized = false;
  offlineBuffer = null;
}

/** Get or lazily create the offline buffer, or null when buffering is disabled. */
function getOfflineBuffer(): OfflineBuffer | null {
  if (!configuredOfflineBufferEnabled) {
    return null;
  }
  if (offlineBuffer === null) {
    offlineBuffer = new OfflineBuffer(configuredOfflineBufferPath, configuredMaxBufferSize);
  }
  return offlineBuffer;
}

/**
 * Handle a streaming failure: invoke the configured failure callback and persist
 * the trace to the offline buffer when enabled.
 */
function handleStreamingFailure(
  traceData: Record<string, any>,
  config: Record<string, any>,
  inferencePipelineId: string,
  error: unknown,
): void {
  try {
    if (configuredOnFlushFailure) {
      try {
        configuredOnFlushFailure(traceData, config, error);
      } catch (callbackErr) {
        console.error('Error in onFlushFailure callback:', callbackErr);
      }
    }

    const buffer = getOfflineBuffer();
    if (buffer) {
      const ok = buffer.storeTrace(traceData, config, inferencePipelineId);
      if (ok) {
        console.info('Stored failed trace to offline buffer for later replay');
      } else {
        // storeTrace logs its own error on a real write failure; this branch
        // also covers an intentionally disabled buffer (maxBufferSize <= 0).
        console.debug('Trace not stored to offline buffer');
      }
    }
  } catch (handlerErr) {
    console.error('Error handling streaming failure:', handlerErr);
  }
}

/**
 * Replay all buffered traces to Openlayer. Each trace is attempted up to
 * `maxRetries` times (always at least once); successfully sent traces are
 * removed from the buffer.
 */
export async function replayBufferedTraces(
  options: {
    maxRetries?: number;
    onReplaySuccess?: OnReplaySuccessCallback;
    onReplayFailure?: OnReplayFailureCallback;
  } = {},
): Promise<ReplayResult> {
  const { maxRetries = 3, onReplaySuccess, onReplayFailure } = options;
  // Always make at least one attempt, even if a caller passes 0 or a negative.
  const attempts = Math.max(1, maxRetries);

  const buffer = getOfflineBuffer();
  if (!buffer) {
    console.warn('Offline buffer not enabled - nothing to replay');
    return { totalTraces: 0, successCount: 0, failureCount: 0, error: 'Offline buffer not enabled' };
  }

  const openlayerClient = getOpenlayerClient();
  if (!openlayerClient) {
    console.error('No Openlayer client available for replay');
    return { totalTraces: 0, successCount: 0, failureCount: 0, error: 'No Openlayer client available' };
  }

  const buffered = buffer.getBufferedTraces();
  const totalTraces = buffered.length;
  let successCount = 0;
  let failureCount = 0;
  const failedTraces: Array<{ traceId: string; error: string; filePath: string }> = [];

  console.info(`Starting replay of ${totalTraces} buffered traces`);

  for (const payload of buffered) {
    const { traceData, config, inferencePipelineId, filePath } = payload;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        await openlayerClient.inferencePipelines.data.stream(inferencePipelineId, {
          config,
          rows: [traceData],
        });

        buffer.removeTrace(filePath);
        successCount++;
        if (onReplaySuccess) {
          try {
            onReplaySuccess(traceData, config);
          } catch (cbErr) {
            console.error('Error in replay success callback:', cbErr);
          }
        }
        break;
      } catch (err) {
        if (attempt === attempts - 1) {
          failureCount++;
          failedTraces.push({
            traceId: String(traceData?.['inferenceId'] ?? 'unknown'),
            error: String(err),
            filePath,
          });
          if (onReplayFailure) {
            try {
              onReplayFailure(traceData, config, err);
            } catch (cbErr) {
              console.error('Error in replay failure callback:', cbErr);
            }
          }
        }
      }
    }
  }

  console.info(`Replay completed: ${successCount}/${totalTraces} traces successfully sent`);
  return { totalTraces, successCount, failureCount, failedTraces };
}

/** Current status of the offline buffer. */
export function getBufferStatus(): BufferStatus {
  const buffer = getOfflineBuffer();
  if (!buffer) {
    return { enabled: false, error: 'Offline buffer not enabled' };
  }
  return { enabled: true, ...buffer.getBufferStatus() };
}

/** Permanently remove all buffered traces from disk. */
export function clearOfflineBuffer(): { tracesRemoved: number; error?: string } {
  const buffer = getOfflineBuffer();
  if (!buffer) {
    return { tracesRemoved: 0, error: 'Offline buffer not enabled' };
  }
  return { tracesRemoved: buffer.clearBuffer() };
}

function getParamNames(func: Function): string[] {
  const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
  const ARGUMENT_NAMES = /([^\s,]+)/g;
  const fnStr = func.toString().replace(STRIP_COMMENTS, '');
  const result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  return result || [];
}

// Higher-order function to trace synchronous or asynchronous functions
function trace(
  fn: Function,
  stepType: StepType = StepType.USER_CALL,
  stepName?: string,
  openlayerInferencePipelineId?: string,
): Function {
  return async function (...args: any[]) {
    const name = stepName || fn.name;
    const paramNames = getParamNames(fn);
    const inputs = Object.fromEntries(paramNames.map((name, index) => [name, args[index]]));
    const [step, endStep] = createStep(name, stepType, args, openlayerInferencePipelineId);

    try {
      const result = await fn(...args);
      step.log({ inputs, output: result });
      return result;
    } catch (error: any) {
      step.log({ inputs, metadata: { error: error.message } });
      throw error;
    } finally {
      endStep();
    }
  };
}

export function addChatCompletionStepToTrace(
  {
    name,
    inputs,
    output,
    latency,
    tokens = null,
    promptTokens = null,
    completionTokens = null,
    cost = null,
    model = null,
    modelParameters = null,
    metadata = {},
    provider = 'OpenAI',
    startTime = null,
    endTime = null,
  }: {
    name: string;
    inputs: any;
    output: any;
    latency: number;
    tokens?: number | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    cost?: number | null;
    model?: string | null;
    modelParameters?: Record<string, any> | null;
    metadata?: Record<string, any>;
    provider?: string;
    startTime?: number | null;
    endTime?: number | null;
  },
  openlayerInferencePipelineId?: string,
) {
  const [step, endStep] = createStep(
    name,
    StepType.CHAT_COMPLETION,
    inputs,
    output,
    metadata,
    startTime,
    endTime,
    openlayerInferencePipelineId,
  );

  if (step.stepType === StepType.CHAT_COMPLETION) {
    (step as ChatCompletionStep).provider = provider;
    (step as ChatCompletionStep).promptTokens = promptTokens;
    (step as ChatCompletionStep).completionTokens = completionTokens;
    (step as ChatCompletionStep).tokens = tokens;
    (step as ChatCompletionStep).cost = cost;
    (step as ChatCompletionStep).model = model;
    (step as ChatCompletionStep).modelParameters = modelParameters;
  }

  step.latency = latency;

  step.log({ inputs, output, metadata });
  endStep();
}

export function addChainStepToTrace(params: {
  name: string;
  inputs: any;
  output?: any;
  metadata?: Record<string, any>;
}) {
  // Add "Handoffs: " prefix for chain steps (representing workflow transitions)
  const stepName = `Handoffs: ${params.name}`;
  const [step, endStep] = createStep(stepName, StepType.CHAIN, params.inputs, params.output, params.metadata);
  return { step, endStep };
}

export function addAgentStepToTrace(params: {
  name: string;
  inputs: any;
  output?: any;
  metadata?: Record<string, any>;
  tool?: string;
  action?: any;
}) {
  // Add "Agent: " prefix for agent steps
  const stepName = `Agent: ${params.name}`;
  const [step, endStep] = createStep(stepName, StepType.AGENT, params.inputs, params.output, params.metadata);
  if (step instanceof AgentStep) {
    step.tool = params.tool || null;
    step.action = params.action || null;
  }
  return { step, endStep };
}

export function addToolStepToTrace(params: {
  name: string;
  inputs: any;
  output?: any;
  metadata?: Record<string, any>;
}) {
  const [step, endStep] = createStep(
    params.name,
    StepType.TOOL,
    params.inputs,
    params.output,
    params.metadata,
  );
  return { step, endStep };
}

export function addRetrieverStepToTrace(params: {
  name: string;
  inputs: any;
  output?: any;
  metadata?: Record<string, any>;
  documents?: any[];
}) {
  const [step, endStep] = createStep(
    params.name,
    StepType.RETRIEVER,
    params.inputs,
    params.output,
    params.metadata,
  );
  if (step instanceof RetrieverStep) {
    step.documents = params.documents || [];
  }
  return { step, endStep };
}

export function addFunctionCallStepToTrace(params: {
  name: string;
  functionName: string;
  arguments: Record<string, any>;
  output?: any;
  metadata?: Record<string, any>;
}) {
  // Add "Tool Call: " prefix for better dashboard visibility
  const stepName = `Tool Call: ${params.name}`;
  const [step, endStep] = createStep(
    stepName,
    StepType.FUNCTION_CALL,
    params.arguments,
    params.output,
    params.metadata,
  );
  if (step instanceof FunctionCallStep) {
    step.functionName = params.functionName;
    step.arguments = params.arguments;
    step.result = params.output;
  }
  return { step, endStep };
}

// Enhanced agent step creator with nested LLM tracking
export function startAgentStep(params: {
  name: string;
  agentType: string;
  inputs: any;
  metadata?: Record<string, any>;
}) {
  // Add "Agent: " prefix for better dashboard visibility
  const stepName = `Agent: ${params.name}`;
  const [step, endStep] = createStep(stepName, StepType.AGENT, params.inputs, undefined, {
    ...params.metadata,
    agentType: params.agentType,
  });

  if (step instanceof AgentStep) {
    step.action = params.inputs;
  }

  return { step, endStep };
}

// Explicit handoff function for agent-to-agent or component-to-component transitions
export function addHandoffStepToTrace(params: {
  name: string;
  fromComponent: string;
  toComponent: string;
  handoffData: any;
  metadata?: Record<string, any>;
}) {
  const stepName = `Handoff: ${params.fromComponent} → ${params.toComponent}`;
  const [step, endStep] = createStep(
    stepName,
    StepType.HANDOFF,
    params.handoffData,
    undefined,
    params.metadata ?? {},
  );
  if (step instanceof HandoffStep) {
    step.fromComponent = params.fromComponent;
    step.toComponent = params.toComponent;
    step.handoffData = params.handoffData;
  }
  return { step, endStep };
}

// Guardrail step for tracking input/output validation and content filtering
export function addGuardrailStepToTrace(params: {
  name: string;
  inputs: any;
  output?: any;
  metadata?: Record<string, any>;
  action?: string;
  reason?: string;
  blockedEntities?: string[];
  detectedEntities?: string[];
  redactedEntities?: string[];
  confidenceThreshold?: number;
  blockStrategy?: string;
  dataType?: string;
}) {
  const [step, endStep] = createStep(
    params.name,
    StepType.GUARDRAIL,
    params.inputs,
    params.output,
    params.metadata,
  );
  if (step instanceof GuardrailStep) {
    step.action = params.action ?? null;
    step.reason = params.reason ?? null;
    step.blockedEntities = params.blockedEntities ?? null;
    step.detectedEntities = params.detectedEntities ?? null;
    step.redactedEntities = params.redactedEntities ?? null;
    step.confidenceThreshold = params.confidenceThreshold ?? null;
    step.blockStrategy = params.blockStrategy ?? null;
    step.dataType = params.dataType ?? null;
  }
  return { step, endStep };
}

export function postProcessTrace(traceObj: Trace): { traceData: any; inputVariableNames: string[] } {
  const rootStep = traceObj.steps[0];

  const input_variables = rootStep!.inputs;
  const inputVariableNames = input_variables ? Object.keys(input_variables) : [];

  const processed_steps = traceObj.toJSON();

  const traceData = {
    inferenceTimestamp: Math.floor(Date.now() / 1000),
    inferenceId: rootStep!.id.toString(),
    output: rootStep!.output,
    groundTruth: rootStep!.groundTruth,
    latency: rootStep!.latency,
    cost: (rootStep as ChatCompletionStep)!.cost,
    tokens: (rootStep as ChatCompletionStep)!.tokens,
    steps: processed_steps,
    metadata: rootStep!.metadata,
  };

  if (input_variables) {
    Object.assign(traceData, input_variables);
  }

  // Surface session_id / user_id from the root step's metadata as top-level
  // columns so the stream config can map them to a first-class session/user
  // (mirrors the Python SDK). An explicit input variable of the same name wins.
  const rootMetadata = (rootStep!.metadata ?? {}) as Record<string, any>;
  for (const key of ['session_id', 'user_id'] as const) {
    if (rootMetadata[key] != null && !(key in traceData)) {
      (traceData as Record<string, any>)[key] = rootMetadata[key];
    }
  }

  return { traceData, inputVariableNames };
}

/**
 * Builds the inference-pipeline stream config for a processed trace row.
 *
 * The session/user column names are only included when the row actually carries
 * a `session_id` / `user_id`, so the Openlayer platform records a first-class
 * session/user for the trace. This mirrors the Python SDK's `post_process_trace`.
 */
export function buildStreamConfig(
  traceData: Record<string, any>,
  inputVariableNames: string[],
): DataStreamParams.LlmData {
  const config: DataStreamParams.LlmData = {
    outputColumnName: 'output',
    inputVariableNames: inputVariableNames,
    groundTruthColumnName: 'groundTruth',
    latencyColumnName: 'latency',
    costColumnName: 'cost',
    timestampColumnName: 'inferenceTimestamp',
    inferenceIdColumnName: 'inferenceId',
    numOfTokenColumnName: 'tokens',
  };

  if (traceData['session_id'] != null) {
    config.sessionIdColumnName = 'session_id';
  }
  if (traceData['user_id'] != null) {
    config.userIdColumnName = 'user_id';
  }

  return config;
}

export default trace;

// ----------------------------------------------------------------------------
// Internal helpers re-exported under prefixed names for use by first-party
// Openlayer integrations that need to drive a step's lifecycle manually
// (e.g., open a step from one callback and close it from another). These are
// NOT part of the supported public API: external callers should use the
// `add*StepToTrace` helpers above.
// ----------------------------------------------------------------------------
export { createStep as _internalCreateStep, getCurrentStep as _internalGetCurrentStep };
