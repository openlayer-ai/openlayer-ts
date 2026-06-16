import { buildStreamConfig, postProcessTrace } from '../src/lib/tracing/tracer';
import { Trace } from '../src/lib/tracing/traces';
import { stepFactory, StepType } from '../src/lib/tracing/steps';

describe('buildStreamConfig', () => {
  it('always includes the fixed column config', () => {
    const config = buildStreamConfig({}, ['question']);
    expect(config).toMatchObject({
      outputColumnName: 'output',
      inputVariableNames: ['question'],
      groundTruthColumnName: 'groundTruth',
      latencyColumnName: 'latency',
      costColumnName: 'cost',
      timestampColumnName: 'inferenceTimestamp',
      inferenceIdColumnName: 'inferenceId',
      numOfTokenColumnName: 'tokens',
    });
  });

  it('omits the session/user column names when the row carries neither', () => {
    const config = buildStreamConfig({ output: 'hi' }, []);
    expect(config.sessionIdColumnName).toBeUndefined();
    expect(config.userIdColumnName).toBeUndefined();
  });

  it('adds sessionIdColumnName only when the row carries a session_id', () => {
    const config = buildStreamConfig({ session_id: 'thread-1' }, []);
    expect(config.sessionIdColumnName).toBe('session_id');
    expect(config.userIdColumnName).toBeUndefined();
  });

  it('adds userIdColumnName only when the row carries a user_id', () => {
    const config = buildStreamConfig({ user_id: 'u-1' }, []);
    expect(config.userIdColumnName).toBe('user_id');
    expect(config.sessionIdColumnName).toBeUndefined();
  });

  it('adds both column names when the row carries both', () => {
    const config = buildStreamConfig({ session_id: 's', user_id: 'u' }, []);
    expect(config.sessionIdColumnName).toBe('session_id');
    expect(config.userIdColumnName).toBe('user_id');
  });
});

describe('postProcessTrace session/user promotion', () => {
  function traceWithRootMetadata(metadata: Record<string, any>): Trace {
    const trace = new Trace();
    const root = stepFactory(StepType.CHAT_COMPLETION, 'root', { question: 'hi' }, 'answer', metadata);
    trace.addStep(root);
    return trace;
  }

  it('promotes session_id and user_id from root metadata to top-level columns', () => {
    const { traceData } = postProcessTrace(
      traceWithRootMetadata({ session_id: 'thread-42', user_id: 'user-7' }),
    );

    expect(traceData.session_id).toBe('thread-42');
    expect(traceData.user_id).toBe('user-7');

    // ...and they flow through to the stream config the platform reads.
    const config = buildStreamConfig(traceData, []);
    expect(config.sessionIdColumnName).toBe('session_id');
    expect(config.userIdColumnName).toBe('user_id');
  });

  it('does not add session_id / user_id when the root metadata has none', () => {
    const { traceData } = postProcessTrace(traceWithRootMetadata({ foo: 'bar' }));
    expect('session_id' in traceData).toBe(false);
    expect('user_id' in traceData).toBe(false);
  });

  it('lets an input variable named session_id win over the metadata promotion', () => {
    const trace = new Trace();
    const root = stepFactory(StepType.CHAT_COMPLETION, 'root', { session_id: 'from-input' }, 'answer', {
      session_id: 'from-metadata',
    });
    trace.addStep(root);

    const { traceData } = postProcessTrace(trace);
    expect(traceData.session_id).toBe('from-input');
  });
});
