// tracing/tracer.ts

import { Trace } from './traces';
import { Step, UserCallStep, ChatCompletionStep } from './steps';
import { StepType } from './enums';
import Openlayer from '../../index';

let currentTrace: Trace | null = null;

const publish = process.env['OPENLAYER_DISABLE_PUBLISH'] != 'true';
let client: Openlayer | null = null;
if (publish) {
  console.log('Publishing is enabled');
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
): [Step, () => void] {
  metadata = metadata || {};
  let newStep: Step;
  if (stepType === StepType.CHAT_COMPLETION) {
    newStep = new ChatCompletionStep(name, inputs, output, metadata);
  } else {
    newStep = new UserCallStep(name, inputs, output, metadata);
  }
  newStep.startTime = performance.now();

  const parentStep = getCurrentStep();
  const isRootStep = parentStep === null;

  if (isRootStep) {
    console.log('Starting a new trace...');
    console.log(`Adding step ${name} as the root step`);
    const currentTrace = new Trace();
    setCurrentTrace(currentTrace);
    currentTrace.addStep(newStep);
  } else {
    console.log(`Adding step ${name} as a nested step to ${parentStep!.name}`);
    currentTrace = getCurrentTrace()!;
    parentStep!.addNestedStep(newStep);
  }

  stepStack.push(newStep);

  const endStep = () => {
    newStep.endTime = performance.now();
    newStep.latency = newStep.endTime - newStep.startTime;

    stepStack.pop(); // Remove the current step from the stack

    if (isRootStep) {
      console.log('Ending the trace...');
      const traceData = getCurrentTrace();
      // Post process trace and get the input variable names
      const { traceData: processedTraceData, inputVariableNames } = postProcessTrace(traceData!);
      console.log('Processed trace data:', JSON.stringify(processedTraceData, null, 2));
      console.log('Input variable names:', inputVariableNames);

      if (publish && process.env['OPENLAYER_INFERENCE_PIPELINE_ID']) {
        client!.inferencePipelines.data.stream(process.env['OPENLAYER_INFERENCE_PIPELINE_ID'], {
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
        });
      }
      console.log('Trace data ready for upload:', JSON.stringify(traceData, null, 2));

      // Reset the entire trace state
      setCurrentTrace(null);
      stepStack.length = 0; // Clear the step stack
    } else {
      console.log(`Ending step ${name}`);
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
function trace(fn: Function, stepType: StepType = StepType.USER_CALL, stepName?: string): Function {
  return async function (...args: any[]) {
    const name = stepName || fn.name;
    const paramNames = getParamNames(fn);
    const inputs = Object.fromEntries(paramNames.map((name, index) => [name, args[index]]));
    const [step, endStep] = createStep(name, stepType, args);

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

// Example usage of specialized function to add a chat completion step
export function addChatCompletionStepToTrace(
  name: string,
  inputs: any,
  output: any,
  metadata?: Record<string, any>,
) {
  const [step, endStep] = createStep(name, StepType.CHAT_COMPLETION, inputs, output, metadata);
  step.log({ inputs, output });
  endStep();
}

function postProcessTrace(traceObj: Trace): { traceData: any; inputVariableNames: string[] } {
  const rootStep = traceObj.steps[0];

  const input_variables = rootStep!.inputs;
  const inputVariableNames = input_variables ? Object.keys(input_variables) : [];

  const processed_steps = traceObj.toJSON();

  const traceData = {
    inferenceTimestamp: Date.now(),
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
