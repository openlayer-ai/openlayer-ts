/**
 * Module with the different Step classes and helper functions that can be used in a trace.
 *
 * This is the consolidated module for all step-related functionality in the Openlayer SDK,
 * similar to the Python SDK's steps.py module.
 */

import { v4 as uuidv4 } from 'uuid';

// ============================= ENUMS ============================= //

export enum StepType {
  USER_CALL = 'user_call',
  CHAT_COMPLETION = 'chat_completion',
  CHAIN = 'chain',
  AGENT = 'agent',
  TOOL = 'tool',
  RETRIEVER = 'retriever',
  FUNCTION_CALL = 'function_call',
}

// ============================= INTERFACES ============================= //

export interface StepData {
  name: string;
  id: string;
  type: StepType;
  inputs: any;
  output: any;
  groundTruth: any;
  metadata: Record<string, any>;
  steps: StepData[];
  latency: number | null;
  startTime: number;
  endTime: number | null;
}

export interface ChatCompletionStepData extends StepData {
  provider: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  tokens: number | null;
  cost: number | null;
  model: string | null;
  modelParameters: Record<string, any> | null;
  rawOutput: string | null;
}

// ============================= STEP CLASSES ============================= //

/**
 * Step, defined as a single function call being traced.
 *
 * This is the base class for all the different types of steps that can be
 * used in a trace. Steps can also contain nested steps, which represent
 * function calls made within the parent step.
 */
export class Step {
  name: string;
  id: string;
  inputs: any;
  output: any;
  metadata: Record<string, any>;
  stepType: StepType | null = null;
  startTime: number;
  endTime: number | null = null;
  groundTruth: any = null;
  latency: number | null = null;
  steps: Step[] = [];

  constructor(
    name: string,
    inputs: any = null,
    output: any = null,
    metadata: Record<string, any> = {},
    startTime?: number | null,
    endTime?: number | null,
  ) {
    this.name = name;
    this.id = uuidv4();
    this.inputs = inputs;
    this.output = output;
    this.metadata = metadata;
    this.startTime = startTime ?? Date.now();
    this.endTime = endTime ?? null;
  }

  /**
   * Adds a nested step to the current step.
   */
  addNestedStep(nestedStep: Step): void {
    this.steps.push(nestedStep);
  }

  /**
   * Logs step data.
   */
  log(data: Partial<Record<keyof this, any>>): void {
    Object.keys(data).forEach((key) => {
      if (key in this) {
        // @ts-ignore
        this[key] = data[key];
      }
    });
  }

  /**
   * Dictionary representation of the Step.
   */
  toJSON(): StepData {
    return {
      name: this.name,
      id: this.id,
      type: this.stepType!,
      inputs: this.inputs,
      output: this.output,
      groundTruth: this.groundTruth,
      metadata: this.metadata,
      steps: this.steps.map((nestedStep) => nestedStep.toJSON()),
      latency: this.latency,
      startTime: this.startTime,
      endTime: this.endTime,
    };
  }
}

/**
 * User call step represents a generic user call in the trace.
 */
export class UserCallStep extends Step {
  constructor(
    name: string,
    inputs: any = null,
    output: any = null,
    metadata: Record<string, any> = {},
    startTime?: number | null,
    endTime?: number | null,
  ) {
    super(name, inputs, output, metadata, startTime, endTime);
    this.stepType = StepType.USER_CALL;
  }
}

/**
 * Chat completion step represents an LLM chat completion in the trace.
 */
export class ChatCompletionStep extends Step {
  provider: string | null = null;
  promptTokens: number | null = null;
  completionTokens: number | null = null;
  tokens: number | null = null;
  cost: number | null = null;
  model: string | null = null;
  modelParameters: Record<string, any> | null = null;
  rawOutput: string | null = null;

  constructor(
    name: string,
    inputs: any = null,
    output: any = null,
    metadata: Record<string, any> = {},
    startTime?: number | null,
    endTime?: number | null,
  ) {
    super(name, inputs, output, metadata, startTime, endTime);
    this.stepType = StepType.CHAT_COMPLETION;
  }

  override toJSON(): ChatCompletionStepData {
    const stepData = super.toJSON();
    return {
      ...stepData,
      provider: this.provider,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      tokens: this.tokens,
      cost: this.cost,
      model: this.model,
      modelParameters: this.modelParameters,
      rawOutput: this.rawOutput,
    };
  }
}

/**
 * Chain step represents sequential operations or workflow chains in AI applications.
 */
export class ChainStep extends Step {
  constructor(name: string, inputs: any = null, output: any = null, metadata: Record<string, any> = {}) {
    super(name, inputs, output, metadata);
    this.stepType = StepType.CHAIN;
  }
}

/**
 * Agent step tracks AI agent actions and decision-making processes.
 */
export class AgentStep extends Step {
  tool: string | null = null;
  action: any = null;

  constructor(name: string, inputs: any = null, output: any = null, metadata: Record<string, any> = {}) {
    super(name, inputs, output, metadata);
    this.stepType = StepType.AGENT;
  }
}

/**
 * Tool step tracks individual tool executions within AI workflows.
 */
export class ToolStep extends Step {
  constructor(name: string, inputs: any = null, output: any = null, metadata: Record<string, any> = {}) {
    super(name, inputs, output, metadata);
    this.stepType = StepType.TOOL;
  }
}

/**
 * Retriever step tracks document retrieval and search operations.
 */
export class RetrieverStep extends Step {
  documents: any[] = [];

  constructor(name: string, inputs: any = null, output: any = null, metadata: Record<string, any> = {}) {
    super(name, inputs, output, metadata);
    this.stepType = StepType.RETRIEVER;
  }
}

/**
 * Function call step tracks specific function calls with detailed execution metadata.
 */
export class FunctionCallStep extends Step {
  functionName: string | null = null;
  arguments: Record<string, any> | null = null;
  result: any = null;
  executionTime: number | null = null;

  constructor(name: string, inputs: any = null, output: any = null, metadata: Record<string, any> = {}) {
    super(name, inputs, output, metadata);
    this.stepType = StepType.FUNCTION_CALL;
  }
}

// ============================= FACTORY FUNCTION ============================= //

/**
 * Factory function to create a step based on the step type.
 */
export function stepFactory(
  stepType: StepType,
  name: string,
  inputs: any = null,
  output: any = null,
  metadata: Record<string, any> = {},
  startTime?: number | null,
  endTime?: number | null,
): Step {
  if (!Object.values(StepType).includes(stepType)) {
    throw new Error(`Step type ${stepType} not recognized.`);
  }

  switch (stepType) {
    case StepType.USER_CALL:
      return new UserCallStep(name, inputs, output, metadata, startTime, endTime);
    case StepType.CHAT_COMPLETION:
      return new ChatCompletionStep(name, inputs, output, metadata, startTime, endTime);
    case StepType.CHAIN:
      return new ChainStep(name, inputs, output, metadata);
    case StepType.AGENT:
      return new AgentStep(name, inputs, output, metadata);
    case StepType.TOOL:
      return new ToolStep(name, inputs, output, metadata);
    case StepType.RETRIEVER:
      return new RetrieverStep(name, inputs, output, metadata);
    case StepType.FUNCTION_CALL:
      return new FunctionCallStep(name, inputs, output, metadata);
    default:
      throw new Error(`Step type ${stepType} not recognized.`);
  }
}

// ============================= HELPER FUNCTION INTERFACES ============================= //

/**
 * Interface for step creation parameters used by helper functions
 */
export interface StepCreationParams {
  name: string;
  inputs?: any;
  output?: any;
  metadata?: Record<string, any>;
}

export interface ChatCompletionStepParams extends StepCreationParams {
  latency: number;
  tokens?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  model?: string | null;
  modelParameters?: Record<string, any> | null;
  rawOutput?: string | null;
  provider?: string;
  startTime?: number | null;
  endTime?: number | null;
}

export interface AgentStepParams extends StepCreationParams {
  tool?: string;
  action?: any;
}

export interface RetrieverStepParams extends StepCreationParams {
  documents?: any[];
}

export interface FunctionCallStepParams extends StepCreationParams {
  functionName: string;
  arguments: Record<string, any>;
}

export interface EnhancedAgentStepParams extends StepCreationParams {
  agentType: string;
}

export interface HandoffStepParams {
  name: string;
  fromComponent: string;
  toComponent: string;
  handoffData: any;
  metadata?: Record<string, any>;
}
