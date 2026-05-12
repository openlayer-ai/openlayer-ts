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
  FakeThinkingBlock,
  FakeToolUseBlock,
  assistantMessage,
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

  it('captures each AssistantMessage as a nested CHAT_COMPLETION step', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(() =>
      makeStream([
        initSystemMessage(),
        assistantMessage(
          [
            new FakeThinkingBlock('planning...'),
            new FakeTextBlock('answer turn 1'),
            new FakeToolUseBlock('tu-1', 'Bash', { command: 'ls' }),
          ],
          {
            message: {
              content: [
                new FakeThinkingBlock('planning...'),
                new FakeTextBlock('answer turn 1'),
                new FakeToolUseBlock('tu-1', 'Bash', { command: 'ls' }),
              ],
              model: 'claude-opus-4-7',
              usage: {
                input_tokens: 12,
                output_tokens: 4,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0,
              },
              stop_reason: 'tool_use',
            },
          },
        ),
        assistantMessage([new FakeTextBlock('done')]),
        resultMessage({}),
      ]),
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    for await (const _ of tracedQuery({ prompt: 'do stuff' })) {
      void _;
    }

    const trace = getCurrentTrace();
    const root: any = trace!.steps[0];
    const turns = root.steps.filter((s: any) => s.stepType === 'chat_completion');
    expect(turns).toHaveLength(2);

    const turn1: any = turns[0];
    expect(turn1.name).toBe('assistant turn 1');
    expect(turn1.output).toContain('answer turn 1');
    expect(turn1.provider).toBe('anthropic');
    expect(turn1.model).toBe('claude-opus-4-7');
    expect(turn1.promptTokens).toBe(12);
    expect(turn1.completionTokens).toBe(4);
    expect(turn1.tokens).toBe(16);
    expect(turn1.metadata.thinking).toContain('planning');
    expect(turn1.metadata.tool_calls).toEqual(['tu-1']);
    expect(turn1.metadata.stop_reason).toBe('tool_use');

    const turn2: any = turns[1];
    expect(turn2.name).toBe('assistant turn 2');
    expect(turn2.output).toBe('done');
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
