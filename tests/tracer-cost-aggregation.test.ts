import { postProcessTrace } from '../src/lib/tracing/tracer';
import { Trace } from '../src/lib/tracing/traces';
import { ChatCompletionStep, stepFactory, StepType } from '../src/lib/tracing/steps';

/**
 * Cost and token totals must come from the whole trace, not just its root.
 * Any agent-shaped trace roots on an agent/chain step that carries neither,
 * so reading the root alone silently reports nothing. Regression for OPEN-12426.
 */
describe('postProcessTrace cost/token aggregation', () => {
  const llmStep = (name: string, tokens: number, cost: number): ChatCompletionStep => {
    const step = stepFactory(StepType.CHAT_COMPLETION, name, { prompt: name }, 'ok') as ChatCompletionStep;
    step.tokens = tokens;
    step.cost = cost;
    return step;
  };

  it('sums cost and tokens from nested steps under a non-LLM root', () => {
    const trace = new Trace();
    const root = stepFactory(StepType.AGENT, 'qa-agent', { userQuery: 'hi' }, 'answer');
    root.addNestedStep(llmStep('llm-1', 42, 0.00031));
    trace.addStep(root);

    const { traceData } = postProcessTrace(trace);

    expect(traceData.tokens).toBe(42);
    expect(traceData.cost).toBeCloseTo(0.00031, 8);
  });

  it('sums across sibling and deeply nested LLM steps', () => {
    const trace = new Trace();
    const root = stepFactory(StepType.AGENT, 'qa-agent', { userQuery: 'hi' }, 'answer');
    root.addNestedStep(llmStep('llm-1', 10, 0.001));

    const toolStep = stepFactory(StepType.TOOL, 'search', { q: 'x' }, 'res');
    toolStep.addNestedStep(llmStep('llm-2', 30, 0.002));
    root.addNestedStep(toolStep);

    trace.addStep(root);

    const { traceData } = postProcessTrace(trace);

    expect(traceData.tokens).toBe(40);
    expect(traceData.cost).toBeCloseTo(0.003, 8);
  });

  it('still reports the root values for a trace rooted on an LLM step', () => {
    const trace = new Trace();
    trace.addStep(llmStep('root-llm', 25, 0.005));

    const { traceData } = postProcessTrace(trace);

    expect(traceData.tokens).toBe(25);
    expect(traceData.cost).toBeCloseTo(0.005, 8);
  });

  it('reports zero when no step in the trace carries cost or tokens', () => {
    const trace = new Trace();
    const root = stepFactory(StepType.AGENT, 'agent', { a: 1 }, 'b');
    root.addNestedStep(stepFactory(StepType.TOOL, 'tool', { a: 1 }, 'b'));
    trace.addStep(root);

    const { traceData } = postProcessTrace(trace);

    expect(traceData.tokens).toBe(0);
    expect(traceData.cost).toBe(0);
  });
});
