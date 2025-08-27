// tracing/tracer.ts

import { Trace } from './traces';
import {
  Step,
  ChatCompletionStep,
  AgentStep,
  RetrieverStep,
  FunctionCallStep,
  StepType,
  stepFactory,
} from './steps';
import Openlayer from '../../index';

let currentTrace: Trace | null = null;

const publish = process.env['OPENLAYER_DISABLE_PUBLISH'] != 'true';
let client: Openlayer | null = null;
if (publish) {
  console.debug('Publishing is enabled');
  client = new Openlayer();
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

  const inferencePipelineId = openlayerInferencePipelineId || process.env['OPENLAYER_INFERENCE_PIPELINE_ID'];

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
    if (newStep.startTime && newStep.endTime) {
      newStep.latency = newStep.endTime - newStep.startTime;
    } else {
      newStep.latency = 0; // Fallback to 0 if timestamps are missing
    }

    stepStack.pop(); // Remove the current step from the stack
    console.debug(`Ending step ${newStep.name}`);

    if (isRootStep) {
      console.debug('Ending the trace...');
      const traceData = getCurrentTrace();
      // Post process trace and get the input variable names
      const { traceData: processedTraceData, inputVariableNames } = postProcessTrace(traceData!);

      if (publish && inferencePipelineId) {
        console.debug('Uploading trace to Openlayer...');

        client!.inferencePipelines.data
          .stream(inferencePipelineId, {
            config: {
              outputColumnName: 'output',
              inputVariableNames: inputVariableNames,
              groundTruthColumnName: 'groundTruth',
              latencyColumnName: 'latency',
              costColumnName: 'cost',
              timestampColumnName: 'inferenceTimestamp',
              inferenceIdColumnName: 'inferenceId',
              numOfTokenColumnName: 'tokens',
            },
            rows: [processedTraceData],
          })
          .then(() => {
            console.debug('Trace uploaded successfully to Openlayer');
          })
          .catch((error) => {
            console.error('Failed to upload trace to Openlayer:', error);
            console.error(
              'Trace data that failed to upload:',
              JSON.stringify(
                {
                  pipelineId: inferencePipelineId,
                  inputVariableNames,
                  processedTraceData,
                },
                null,
                2,
              ),
            );
          });
      } else {
        if (!publish) {
          console.debug('Trace upload disabled (OPENLAYER_DISABLE_PUBLISH=true)');
        } else if (!inferencePipelineId) {
          console.warn('Trace upload skipped: OPENLAYER_INFERENCE_PIPELINE_ID environment variable not set');
        }
      }

      // // Reset the entire trace state
      // setCurrentTrace(null);
      // stepStack.length = 0; // Clear the step stack
    } else {
      console.debug(`Ending step ${name}`);
    }
  };

  return [newStep, endStep];
}

function getCurrentStep(): Step | null | undefined {
  const currentStep = stepStack.length > 0 ? stepStack[stepStack.length - 1] : null;
  return currentStep;
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
    startTime: new Date().toISOString(),
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
  const stepName = `Handoffs: ${params.fromComponent} → ${params.toComponent}`;
  const [step, endStep] = createStep(stepName, StepType.CHAIN, params.handoffData, undefined, {
    ...params.metadata,
    handoffType: 'component_transition',
    fromComponent: params.fromComponent,
    toComponent: params.toComponent,
    timestamp: new Date().toISOString(),
  });
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

  return { traceData, inputVariableNames };
}

export default trace;
