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
    // Reset the (virtually-mocked) SDK's ``query`` to a fresh jest mock so
    // any test that called ``traceClaudeAgentSdk()`` doesn't leak a patched
    // function into subsequent tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('@anthropic-ai/claude-agent-sdk');
    sdk.query = jest.fn();
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

  it('composes with user-provided hooks rather than replacing them', async () => {
    const userPreCalls: Array<{ input: any; toolUseID: string | undefined }> = [];
    const userPreHook = jest.fn(async (input: any, toolUseID: string | undefined) => {
      userPreCalls.push({ input, toolUseID });
      // User hook returns a deny decision — confirms we never clobber it.
      return { hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: 'test' } };
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(async function* (opts: any) {
      const userMatchers = opts.options.hooks.PreToolUse;
      // Run every matcher's hook(s) — that's what the SDK does in practice.
      for (const matcher of userMatchers) {
        for (const fn of matcher.hooks) {
          await fn({ tool_name: 'Bash', tool_input: { command: 'ls' } }, 'tu-comp-1', {});
        }
      }
      // PostToolUse: only run our internal one (user didn't provide one).
      const postMatchers = opts.options.hooks.PostToolUse;
      for (const matcher of postMatchers) {
        for (const fn of matcher.hooks) {
          await fn(
            { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: 'ok' },
            'tu-comp-1',
            {},
          );
        }
      }
      yield initSystemMessage();
      yield resultMessage({});
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    for await (const _ of tracedQuery({
      prompt: 'compose',
      options: {
        hooks: {
          PreToolUse: [{ hooks: [userPreHook] }],
        },
      },
    })) {
      void _;
    }

    // The user's PreToolUse hook still fired.
    expect(userPreHook).toHaveBeenCalledTimes(1);
    expect(userPreCalls).toHaveLength(1);
    // And the Openlayer tool step was captured alongside it.
    const root: any = getCurrentTrace()!.steps[0];
    const tool = root.steps.find((s: any) => s.stepType === 'tool');
    expect(tool).toBeDefined();
    expect(tool.name).toBe('Bash');
  });

  it('redacts env / headers / authorization from mcp_servers in metadata', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(() =>
      makeStream([
        initSystemMessage({
          mcp_servers: [
            {
              name: 'playwright',
              status: 'connected',
              transport: 'stdio',
              env: { API_KEY: 'sk-secret', OTHER: 'also-secret' },
              headers: { Authorization: 'Bearer secret' },
              authorization: 'Bearer secret',
              command: 'mcp-playwright',
            },
            {
              name: 'github',
              status: 'connected',
              transport: 'http',
              url: 'https://mcp.example.com',
              env: { GITHUB_TOKEN: 'ghp_secret' },
            },
          ],
        }),
        resultMessage({}),
      ]),
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    for await (const _ of tracedQuery({ prompt: 'mcp' })) void _;

    const root: any = getCurrentTrace()!.steps[0];
    const servers = root.metadata.agent_config.mcp_servers;
    expect(servers).toHaveLength(2);
    for (const srv of servers) {
      expect(srv).not.toHaveProperty('env');
      expect(srv).not.toHaveProperty('headers');
      expect(srv).not.toHaveProperty('authorization');
    }
    // Non-sensitive fields are preserved.
    expect(servers[0].name).toBe('playwright');
    expect(servers[0].status).toBe('connected');
    expect(servers[0].transport).toBe('stdio');
    expect(servers[1].url).toBe('https://mcp.example.com');
  });

  it('traceClaudeAgentSdk patches the SDK query symbol (idempotent)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('@anthropic-ai/claude-agent-sdk');
    // Reset to a fresh jest mock so we test patching from scratch.
    sdk.query = jest.fn();
    const original = sdk.query;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { traceClaudeAgentSdk } = require('../../src/lib/integrations/claudeAgentSdk');
    traceClaudeAgentSdk({ inferencePipelineId: 'test-pipeline' });

    expect(sdk.query).not.toBe(original);
    expect((sdk.query as any)._openlayerPatched).toBe(true);
    expect((sdk.query as any)._openlayerOriginal).toBe(original);

    // Idempotent — second call doesn't re-wrap.
    const firstPatched = sdk.query;
    traceClaudeAgentSdk();
    expect(sdk.query).toBe(firstPatched);
  });

  it('exposes `query` as a drop-in export', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: ourQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    expect(typeof ourQuery).toBe('function');
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

  it('traceClaudeAgentSdk patches ClaudeSDKClient.prototype when present', async () => {
    // Build a minimal fake ClaudeSDKClient and re-attach it onto the
    // virtually-mocked SDK module before calling ``traceClaudeAgentSdk``.
    class FakeClient {
      public options: any;
      public __openlayerLastPrompt: any;
      constructor(opts: any = {}) {
        this.options = opts;
      }
      async query(prompt: any) {
        this.__openlayerLastPrompt = prompt;
        return undefined;
      }
      // The SDK exposes ``receive_response`` (snake) as the async iterator
      // the caller awaits to get the message stream.
      async *receive_response() {
        yield initSystemMessage({ session_id: 'client-1' });
        yield resultMessage({ session_id: 'client-1' });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('@anthropic-ai/claude-agent-sdk');
    sdk.query = jest.fn();
    sdk.ClaudeSDKClient = FakeClient;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { traceClaudeAgentSdk } = require('../../src/lib/integrations/claudeAgentSdk');
    traceClaudeAgentSdk();

    expect((FakeClient.prototype as any)._openlayerPatched).toBe(true);

    const client = new FakeClient({ hooks: {} });
    await client.query('hello from client');
    const out: any[] = [];
    for await (const m of client.receive_response()) out.push(m);
    expect(out).toHaveLength(2);

    // The patched receive_response should have created a fresh AGENT trace.
    const trace = getCurrentTrace();
    const root: any = trace!.steps[trace!.steps.length - 1];
    expect(root.stepType).toBe('agent');
    expect(root.name).toContain('hello from client');
    expect(root.metadata.session_id).toBe('client-1');
  });

  it('passthrough invariant: wrapper neither swallows messages nor mutates them, even with tools', async () => {
    // The wrapper must be a pure observer: every yielded message is the same
    // object reference the SDK produced, in the same order. We construct a
    // realistic mixed stream (system + assistant with tool_use + user
    // tool_result + final assistant + result) and check identity for each.
    const initMsg = initSystemMessage({ session_id: 'passthru' });
    const turn1Content = [new FakeTextBlock('thinking'), new FakeToolUseBlock('tu-passthru', 'Bash', { cmd: 'pwd' })];
    const assistantTurn1 = assistantMessage(turn1Content, { message: { content: turn1Content, model: 'm', usage: {} } });
    const toolResultMsg = {
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'tu-passthru', content: '/tmp' }] },
      parent_tool_use_id: null,
    };
    const assistantTurn2 = assistantMessage([new FakeTextBlock('done')]);
    const finalMsg = resultMessage({ session_id: 'passthru' });

    const all = [initMsg, assistantTurn1, toolResultMsg, assistantTurn2, finalMsg];

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query: mockedQuery } = require('@anthropic-ai/claude-agent-sdk');
    (mockedQuery as jest.Mock).mockImplementation(async function* (opts: any) {
      const hooks = opts.options.hooks;
      const pre = hooks.PreToolUse[hooks.PreToolUse.length - 1].hooks[0];
      const post = hooks.PostToolUse[hooks.PostToolUse.length - 1].hooks[0];
      yield initMsg;
      yield assistantTurn1;
      await pre({ tool_name: 'Bash', tool_input: { cmd: 'pwd' } }, 'tu-passthru', {});
      yield toolResultMsg;
      await post({ tool_name: 'Bash', tool_response: '/tmp' }, 'tu-passthru', {});
      yield assistantTurn2;
      yield finalMsg;
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tracedQuery } = require('../../src/lib/integrations/claudeAgentSdk');
    const seen: any[] = [];
    for await (const m of tracedQuery({ prompt: 'passthru' })) seen.push(m);

    expect(seen).toHaveLength(all.length);
    for (let i = 0; i < all.length; i++) {
      // Identity, not just equality.
      expect(seen[i]).toBe(all[i]);
    }
  });
});
