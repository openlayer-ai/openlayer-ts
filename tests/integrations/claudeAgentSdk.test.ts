/**
 * Tests for the @anthropic-ai/claude-agent-sdk Openlayer integration.
 *
 * The unit cases never reach the network: they mock the SDK module via
 * jest's virtual-mock support and disable Openlayer trace publishing so
 * no client is constructed. Trace shape is asserted by snapshotting the
 * tracer's in-memory ``Trace`` object after the wrapper finishes.
 *
 * Live tests live alongside in ``claudeAgentSdk.live.test.ts`` and skip
 * unless ``ANTHROPIC_API_KEY`` is set.
 */
import { getCurrentTrace } from '../../src/lib/tracing/tracer';
import {
  FakeTextBlock,
  initSystemMessage,
  makeStream,
  resultMessage,
} from './claudeAgentSdkMocks';

// Disable Openlayer trace upload for unit tests (we assert on the in-memory
// trace, not on the publish wire).
process.env['OPENLAYER_DISABLE_PUBLISH'] = 'true';

// Virtual-mock the SDK so tests run without it being installed. Individual
// tests override ``query`` per-case via ``mockImplementation``.
jest.mock(
  '@anthropic-ai/claude-agent-sdk',
  () => ({
    query: jest.fn(),
  }),
  { virtual: true },
);

describe('claudeAgentSdk integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the integration's cached SDK reference so each test re-resolves
    // the (potentially) re-mocked module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../src/lib/integrations/claudeAgentSdk');
    mod._resetUnderlyingQueryForTesting();
  });

  it('module imports cleanly even without the SDK installed', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../src/lib/integrations/claudeAgentSdk');
    expect(mod).toBeDefined();
    expect(typeof mod.tracedQuery).toBe('function');
  });

  it('tracedQuery emits a root AGENT step with cost/tokens/session_id from ResultMessage', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(() =>
      makeStream([
        initSystemMessage({ session_id: 's1', model: 'claude-opus-4-7' }),
        resultMessage({
          session_id: 's1',
          total_cost_usd: 0.0042,
          duration_ms: 1500,
          num_turns: 1,
          result: 'Hello back',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        }),
      ]),
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    const forwarded: any[] = [];
    for await (const m of tracedQuery({ prompt: 'hi' })) {
      forwarded.push(m);
    }

    // The wrapper must be a pure observer: all SDK messages flow through.
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(forwarded).toHaveLength(2);
    expect(forwarded[0].type).toBe('system');
    expect(forwarded[1].type).toBe('result');

    // Assert trace shape.
    const trace = getCurrentTrace();
    expect(trace).not.toBeNull();
    expect(trace!.steps).toHaveLength(1);
    const root: any = trace!.steps[0];
    expect(root.stepType).toBe('agent');
    expect(root.name).toContain('claude-agent-sdk:');
    expect(root.name).toContain('hi');
    expect(root.inputs).toEqual({ prompt: 'hi' });
    expect(root.output).toBe('Hello back');
    expect(root.metadata.session_id).toBe('s1');
    expect(root.metadata.num_turns).toBe(1);
    expect(root.metadata.stop_reason).toBe('end_turn');
    expect(root.metadata.subtype).toBe('success');
    expect(root.metadata.agent_config.model).toBe('claude-opus-4-7');
    expect(root.metadata.agent_config.tools).toEqual(['Read', 'Bash']);
    // Root step props (set via .log → key-name match).
    expect((root as any).cost).toBeCloseTo(0.0042);
    expect((root as any).tokens).toBe(15);
    expect(root.latency).toBe(1500);
  });

  it('forwards every SDK message unchanged and in order (passthrough invariant)', async () => {
    const messages = [
      initSystemMessage({ session_id: 'p1' }),
      { type: 'assistant', message: { content: [new FakeTextBlock('hi')] } },
      resultMessage({ session_id: 'p1' }),
    ];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(() => makeStream(messages));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    const out: any[] = [];
    for await (const m of tracedQuery({ prompt: 'hi' })) out.push(m);
    expect(out).toHaveLength(3);
    // Same references, in identical order.
    for (let i = 0; i < messages.length; i++) {
      expect(out[i]).toBe(messages[i]);
    }
  });
});
