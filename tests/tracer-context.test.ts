import { addChainStepToTrace, getCurrentTrace, runInTraceContext } from '../src/lib/tracing/tracer';

describe('tracer async context', () => {
  const originalDisablePublish = process.env['OPENLAYER_DISABLE_PUBLISH'];

  beforeEach(() => {
    process.env['OPENLAYER_DISABLE_PUBLISH'] = 'true';
  });

  afterEach(() => {
    if (originalDisablePublish === undefined) {
      delete process.env['OPENLAYER_DISABLE_PUBLISH'];
    } else {
      process.env['OPENLAYER_DISABLE_PUBLISH'] = originalDisablePublish;
    }
  });

  it('closes a step even when endStep runs outside the context that created it', () => {
    // Frameworks routinely invoke a completion callback from wherever they
    // happen to be, not from the context that opened the step.
    let endOutside: (() => void) | undefined;

    runInTraceContext(() => {
      const { endStep } = addChainStepToTrace({ name: 'detached', inputs: { a: 1 } });
      endOutside = endStep;
    });

    expect(() => endOutside!()).not.toThrow();
  });

  it('keeps concurrent contexts from sharing a trace', async () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const traceFor = async (name: string, delay: number): Promise<string[]> =>
      runInTraceContext(async () => {
        const { endStep } = addChainStepToTrace({ name, inputs: { name } });
        await sleep(delay);
        endStep();
        return (getCurrentTrace()?.steps ?? []).map((step) => step.name);
      });

    const [a, b, c] = await Promise.all([traceFor('A', 30), traceFor('B', 15), traceFor('C', 5)]);

    expect(a).toEqual(['Handoffs: A']);
    expect(b).toEqual(['Handoffs: B']);
    expect(c).toEqual(['Handoffs: C']);
  });
});
