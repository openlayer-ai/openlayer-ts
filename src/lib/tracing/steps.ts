import { v4 as uuidv4 } from 'uuid';
import { StepType } from './enums';

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

  constructor(name: string, inputs: any = null, output: any = null, metadata: Record<string, any> = {}) {
    this.name = name;
    this.id = uuidv4();
    this.inputs = inputs;
    this.output = output;
    this.metadata = metadata;

    this.startTime = Date.now();
  }

  addNestedStep(nestedStep: Step): void {
    this.steps.push(nestedStep);
  }

  log(data: Partial<Record<keyof this, any>>): void {
    Object.keys(data).forEach((key) => {
      if (key in this) {
        // @ts-ignore
        this[key] = data[key];
      }
    });
  }

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

export class UserCallStep extends Step {
  constructor(name: string, inputs: any = null, output: any = null, metadata: Record<string, any> = {}) {
    super(name, inputs, output, metadata);
    this.stepType = StepType.USER_CALL;
  }
}

export class ChatCompletionStep extends Step {
  provider: string | null = null;
  promptTokens: number | null = null;
  completionTokens: number | null = null;
  tokens: number | null = null;
  cost: number | null = null;
  model: string | null = null;
  modelParameters: Record<string, any> | null = null;
  rawOutput: string | null = null;

  constructor(name: string, inputs: any = null, output: any = null, metadata: Record<string, any> = {}) {
    super(name, inputs, output, metadata);
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
