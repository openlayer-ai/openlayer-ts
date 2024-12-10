import { Step } from './steps';

export class Trace {
  public steps: Step[];
  private currentStep: Step | null;

  constructor() {
    this.steps = [];
    this.currentStep = null;
  }

  public addStep(step: Step): void {
    this.steps.push(step);
  }

  public toJSON(): Array<Record<string, any>> {
    return this.steps.map((step) => step.toJSON());
  }
}
