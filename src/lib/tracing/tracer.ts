// tracing/tracer.ts

import Openlayer from '../../index';
import { StepType } from './enums';
import { ChatCompletionStep, Step, UserCallStep } from './steps';
import { Trace } from './traces';

let currentTrace: Trace | null = null;

const publish = process.env['OPENLAYER_DISABLE_PUBLISH'] != 'true';
let client: Openlayer | null = null;
if (publish) {
  console.debug('Publishing is enabled');
  client = new Openlayer();
}

function getCurrentTrace(): Trace | null {
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
  let newStep: Step;
  if (stepType === StepType.CHAT_COMPLETION) {
    newStep = new ChatCompletionStep(name, inputs, output, metadata, startTime, endTime);
  } else {
    newStep = new UserCallStep(name, inputs, output, metadata, startTime, endTime);
  }

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
    stepStack.pop(); // Remove the current step from the stack

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

      // Reset the entire trace state
      setCurrentTrace(null);
      stepStack.length = 0; // Clear the step stack
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
    model = null,
    modelParameters = null,
    rawOutput = null,
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
    model?: string | null;
    modelParameters?: Record<string, any> | null;
    rawOutput?: string | null;
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
    (step as ChatCompletionStep).model = model;
    (step as ChatCompletionStep).modelParameters = modelParameters;
    (step as ChatCompletionStep).rawOutput = rawOutput;
  }

  step.latency = latency;

  step.log({ inputs, output, metadata });
  endStep();
}

function postProcessTrace(traceObj: Trace): { traceData: any; inputVariableNames: string[] } {
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
    cost: 0, // fix
    tokens: 0, // fix
    steps: processed_steps,
  };

  if (input_variables) {
    Object.assign(traceData, input_variables);
  }

  return { traceData, inputVariableNames };
}

export default trace;
