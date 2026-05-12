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

  it('captures tool calls via PreToolUse/PostToolUse hooks (TOOL step with input/output/latency)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');

    // The mocked SDK simulates: stream init -> assistant turn with tool_use ->
    // fire PreToolUse(Bash) -> stream UserMessage(tool_result) -> fire
    // PostToolUse(Bash) -> stream final assistant turn -> ResultMessage.
    (mockedQuery as jest.Mock).mockImplementation(async function* (opts: any) {
      const hooks = opts.options.hooks;
      const pre = hooks.PreToolUse[hooks.PreToolUse.length - 1].hooks[0];
      const post = hooks.PostToolUse[hooks.PostToolUse.length - 1].hooks[0];

      yield initSystemMessage({ session_id: 's-tool' });
      yield assistantMessage([new FakeTextBlock('Running...'), new FakeToolUseBlock('tu-bash-1', 'Bash', { command: 'ls' })], {
        message: {
          content: [
            new FakeTextBlock('Running...'),
            new FakeToolUseBlock('tu-bash-1', 'Bash', { command: 'ls' }),
          ],
          model: 'claude-opus-4-7',
          usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
          stop_reason: 'tool_use',
        },
      });
      await pre({ tool_name: 'Bash', tool_input: { command: 'ls' } }, 'tu-bash-1', {});
      yield {
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu-bash-1', content: 'file1.txt\nfile2.txt' }] },
      };
      await post(
        {
          tool_name: 'Bash',
          tool_input: { command: 'ls' },
          tool_response: 'file1.txt\nfile2.txt',
        },
        'tu-bash-1',
        {},
      );
      yield assistantMessage([new FakeTextBlock('Done')]);
      yield resultMessage({});
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    for await (const _ of tracedQuery({ prompt: 'run ls' })) {
      void _;
    }

    const trace = getCurrentTrace();
    const root: any = trace!.steps[0];
    const tools = root.steps.filter((s: any) => s.stepType === 'tool');
    expect(tools).toHaveLength(1);
    const tool: any = tools[0];
    expect(tool.name).toBe('Bash');
    expect(tool.inputs).toEqual({ command: 'ls' });
    expect(tool.output).toBe('file1.txt\nfile2.txt');
    expect(tool.metadata.tool_use_id).toBe('tu-bash-1');
    expect(tool.metadata.is_error).toBe(false);
    expect(typeof tool.metadata.latency_ms).toBe('number');
  });

  it('records is_error=true and the error payload when PostToolUseFailure fires', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(async function* (opts: any) {
      const hooks = opts.options.hooks;
      const pre = hooks.PreToolUse[hooks.PreToolUse.length - 1].hooks[0];
      const fail = hooks.PostToolUseFailure[hooks.PostToolUseFailure.length - 1].hooks[0];

      yield initSystemMessage();
      await pre({ tool_name: 'Bash', tool_input: { command: 'rm /' } }, 'tu-err-1', {});
      await fail({ tool_name: 'Bash', error: 'permission denied' }, 'tu-err-1', {});
      yield resultMessage({});
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    for await (const _ of tracedQuery({ prompt: 'rm /' })) void _;

    const root: any = getCurrentTrace()!.steps[0];
    const tools = root.steps.filter((s: any) => s.stepType === 'tool');
    expect(tools).toHaveLength(1);
    expect(tools[0].metadata.is_error).toBe(true);
    expect(tools[0].output).toBe('permission denied');
  });

  it('parses mcp__<server>__<tool> names into mcp_server / mcp_tool_name metadata', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(async function* (opts: any) {
      const hooks = opts.options.hooks;
      const pre = hooks.PreToolUse[hooks.PreToolUse.length - 1].hooks[0];
      const post = hooks.PostToolUse[hooks.PostToolUse.length - 1].hooks[0];

      yield initSystemMessage();
      await pre(
        { tool_name: 'mcp__playwright__browser_navigate', tool_input: { url: 'https://example.com' } },
        'tu-mcp-1',
        {},
      );
      await post(
        {
          tool_name: 'mcp__playwright__browser_navigate',
          tool_input: { url: 'https://example.com' },
          tool_response: 'navigated',
        },
        'tu-mcp-1',
        {},
      );
      yield resultMessage({});
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    for await (const _ of tracedQuery({ prompt: 'browse' })) void _;

    const root: any = getCurrentTrace()!.steps[0];
    const tool = root.steps.find((s: any) => s.stepType === 'tool');
    expect(tool.name).toBe('mcp__playwright__browser_navigate');
    expect(tool.metadata.mcp_server).toBe('playwright');
    expect(tool.metadata.mcp_tool_name).toBe('browser_navigate');
  });

  it('subagent assistant turns nest under the spawning Agent ToolStep via parent_tool_use_id', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(async function* (opts: any) {
      const hooks = opts.options.hooks;
      const pre = hooks.PreToolUse[hooks.PreToolUse.length - 1].hooks[0];
      const post = hooks.PostToolUse[hooks.PostToolUse.length - 1].hooks[0];

      yield initSystemMessage();
      // Top-level assistant turn delegates to a subagent via the Agent tool.
      yield assistantMessage(
        [new FakeToolUseBlock('agent-tu-1', 'Agent', { description: 'review code' })],
        {
          message: {
            content: [new FakeToolUseBlock('agent-tu-1', 'Agent', { description: 'review code' })],
            model: 'claude-opus-4-7',
            usage: {
              input_tokens: 1,
              output_tokens: 1,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
            stop_reason: 'tool_use',
          },
        },
      );
      // PreToolUse(Agent) opens the Agent tool step. Subagent's internal
      // stream now arrives with ``parent_tool_use_id`` set.
      await pre({ tool_name: 'Agent', tool_input: { description: 'review code' } }, 'agent-tu-1', {});
      yield assistantMessage([new FakeTextBlock('subagent thinking')], {
        parent_tool_use_id: 'agent-tu-1',
      });
      yield assistantMessage([new FakeTextBlock('subagent done')], {
        parent_tool_use_id: 'agent-tu-1',
      });
      await post(
        { tool_name: 'Agent', tool_input: { description: 'review code' }, tool_response: 'subagent done' },
        'agent-tu-1',
        {},
      );
      yield resultMessage({});
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    for await (const _ of tracedQuery({ prompt: 'review' })) void _;

    const root: any = getCurrentTrace()!.steps[0];
    // root should have: assistant turn 1, Agent tool step
    const agentTool = root.steps.find((s: any) => s.stepType === 'tool' && s.name === 'Agent');
    expect(agentTool).toBeDefined();
    // Subagent assistant turns should be nested under the Agent tool step.
    const nestedChats = agentTool.steps.filter((s: any) => s.stepType === 'chat_completion');
    expect(nestedChats).toHaveLength(2);
    expect(nestedChats[0].metadata.parent_tool_use_id).toBe('agent-tu-1');
    expect(nestedChats[1].metadata.parent_tool_use_id).toBe('agent-tu-1');
    // And those subagent turns should NOT also appear under root.
    const rootChatNames = root.steps
      .filter((s: any) => s.stepType === 'chat_completion')
      .map((s: any) => s.name);
    // Root has just the initial assistant turn 1.
    expect(rootChatNames).toEqual(['assistant turn 1']);
  });

  it('captures error_max_turns subtype on the root step metadata', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(() =>
      makeStream([
        initSystemMessage(),
        resultMessage({ subtype: 'error_max_turns', is_error: true, result: null }),
      ]),
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    for await (const _ of tracedQuery({ prompt: 'forever' })) void _;

    const root: any = getCurrentTrace()!.steps[0];
    expect(root.metadata.subtype).toBe('error_max_turns');
    expect(root.metadata.is_error).toBe(true);
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
