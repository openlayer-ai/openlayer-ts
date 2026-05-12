/**
 * Openlayer tracing integration for the Claude Agent SDK (TypeScript).
 *
 * Wraps ``@anthropic-ai/claude-agent-sdk``'s ``query()`` (and, via
 * ``traceClaudeAgentSdk()``, ``ClaudeSDKClient``) so each call becomes
 * an Openlayer trace.
 *
 * Trace shape (one trace per ``query()`` call):
 *
 * ```
 * AGENT  "claude-agent-sdk: <prompt summary>"
 *  |-- CHAT_COMPLETION  "assistant turn 1"     (text + thinking + tokens)
 *  |-- TOOL             "<tool name>"           (input/output, latency)
 *  |-- CHAT_COMPLETION  "assistant turn 2"
 *  |-- TOOL             "Agent: code-reviewer"  (subagent)
 *  |    |-- CHAT_COMPLETION ...                 (nested via parent_tool_use_id)
 *  |    `-- TOOL ...
 *  `-- ...
 * ```
 *
 * See ``docs/superpowers/specs/2026-05-12-claude-agent-sdk-integration-design.md``.
 */
import { StepType } from '../tracing/steps';
import { _internalCreateStep } from '../tracing/tracer';

/** Tunable per-integration configuration. */
export interface ClaudeAgentSdkConfig {
  /** Inference pipeline ID for trace publishing. Falls back to ``OPENLAYER_INFERENCE_PIPELINE_ID``. */
  inferencePipelineId?: string;
  /** Max characters to keep from each tool output before truncation. */
  truncateToolOutputChars: number;
  /** Whether to capture thinking blocks in the trace. */
  captureThinking: boolean;
  /** Whether to strip env/headers/auth from MCP server configs in metadata. */
  redactMcpEnv: boolean;
}

let _config: ClaudeAgentSdkConfig = {
  inferencePipelineId: undefined,
  truncateToolOutputChars: 8192,
  captureThinking: true,
  redactMcpEnv: true,
};

/** Internal trace state for a single ``tracedQuery()`` invocation. */
interface TraceState {
  rootStep: any;
  endRootStep: () => void;
  sessionId?: string;
  turnCounter: number;
}

function summarizePrompt(prompt: any): string {
  if (typeof prompt === 'string') {
    const s = prompt.trim().replace(/\n/g, ' ');
    return s.length > 80 ? s.slice(0, 80) + '...' : s;
  }
  return 'claude-agent-sdk query';
}

function redactMcpServers(servers: any): any {
  if (!Array.isArray(servers)) return servers;
  return servers.map((s) => {
    if (s && typeof s === 'object') {
      // Strip well-known secret-bearing fields.
      const { env, headers, authorization, ...rest } = s;
      void env;
      void headers;
      void authorization;
      return rest;
    }
    return s;
  });
}

/** Apply the SystemMessage(subtype=init) payload to the root step. */
function observeSystemInit(msg: any, state: TraceState): void {
  if (msg.subtype !== 'init') return;
  state.sessionId = msg.session_id;
  state.rootStep.log({
    metadata: {
      ...(state.rootStep.metadata ?? {}),
      session_id: msg.session_id,
      agent_config: {
        model: msg.model,
        tools: msg.tools,
        mcp_servers: _config.redactMcpEnv ? redactMcpServers(msg.mcp_servers) : msg.mcp_servers,
        skills: msg.skills,
        slash_commands: msg.slash_commands,
        plugins: msg.plugins,
        permission_mode: msg.permissionMode,
        cwd: msg.cwd,
        claude_code_version: msg.claude_code_version,
        api_key_source: msg.apiKeySource,
        output_style: msg.output_style,
      },
    },
  });
}

/** Apply the terminal ResultMessage to the root step (cost/tokens/duration). */
function observeResult(msg: any, state: TraceState): void {
  const usage = msg.usage || {};
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  // ``AgentStep`` doesn't declare ``cost``/``tokens`` properties, but
  // ``postProcessTrace`` reads them off the root step regardless (via a
  // ChatCompletionStep cast). Assign them directly so they make it into
  // the published trace.
  state.rootStep.cost = msg.total_cost_usd ?? null;
  state.rootStep.tokens = input + output;
  state.rootStep.promptTokens = input;
  state.rootStep.completionTokens = output;
  state.rootStep.log({
    output: msg.result ?? '',
    latency: msg.duration_ms ?? null,
    metadata: {
      ...(state.rootStep.metadata ?? {}),
      session_id: msg.session_id ?? state.sessionId,
      num_turns: msg.num_turns,
      stop_reason: msg.stop_reason,
      subtype: msg.subtype,
      is_error: msg.is_error,
      duration_api_ms: msg.duration_api_ms,
      model_usage: msg.modelUsage,
      permission_denials: msg.permission_denials,
      cache_read_input_tokens: usage.cache_read_input_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens,
    },
  });
}

/**
 * Capture an ``AssistantMessage`` as a nested ``CHAT_COMPLETION`` step under
 * whichever step is currently top-of-stack. For top-level assistant turns
 * that is the root ``AGENT`` step; for subagent turns it is the spawning
 * Agent ``ToolStep`` (kept open across the subagent's stream by the
 * PreToolUse/PostToolUse hook pair — see Task B5).
 */
function observeAssistant(msg: any, state: TraceState): void {
  state.turnCounter += 1;
  const blocks: any[] = msg.message?.content ?? [];
  const textParts: string[] = [];
  const thinkingParts: string[] = [];
  const toolUseIds: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text') textParts.push(b.text ?? '');
    else if (b.type === 'thinking') thinkingParts.push(b.thinking ?? '');
    else if (b.type === 'tool_use') toolUseIds.push(b.id);
  }

  const usage = msg.message?.usage ?? {};
  const [chatStep, endChatStep] = _internalCreateStep(
    `assistant turn ${state.turnCounter}`,
    StepType.CHAT_COMPLETION,
    undefined,
    undefined,
    null,
  );
  // ChatCompletionStep has first-class fields for these; ``.log`` will pick
  // them up because they exist on the prototype.
  chatStep.log({
    output: textParts.join('\n'),
    model: msg.message?.model ?? null,
    provider: 'anthropic',
    promptTokens: usage.input_tokens ?? null,
    completionTokens: usage.output_tokens ?? null,
    tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    metadata: {
      thinking: _config.captureThinking && thinkingParts.length ? thinkingParts.join('\n') : null,
      tool_calls: toolUseIds.length ? toolUseIds : null,
      stop_reason: msg.message?.stop_reason ?? null,
      parent_tool_use_id: msg.parent_tool_use_id ?? null,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? null,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? null,
    },
  });
  endChatStep();
}

/** Dispatch a single message from the SDK stream to the right observer. */
function observe(msg: any, state: TraceState): void {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'system') observeSystemInit(msg, state);
  else if (msg.type === 'assistant') observeAssistant(msg, state);
  else if (msg.type === 'result') observeResult(msg, state);
  // user / tool observers added in later tasks
}

let _underlyingQuery: ((opts: any) => AsyncIterable<any>) | null = null;

function loadUnderlyingQuery(): (opts: any) => AsyncIterable<any> {
  if (_underlyingQuery) return _underlyingQuery;
  let mod: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@anthropic-ai/claude-agent-sdk');
  } catch {
    throw new Error(
      '@anthropic-ai/claude-agent-sdk is not installed. ' +
        'Install with: npm install @anthropic-ai/claude-agent-sdk@^0.2.111',
    );
  }
  if (typeof mod.query !== 'function') {
    throw new Error('@anthropic-ai/claude-agent-sdk module is missing the expected `query` export');
  }
  _underlyingQuery = mod.query;
  return _underlyingQuery!;
}

/**
 * Wrap ``claude-agent-sdk`` ``query()`` and emit an Openlayer trace.
 *
 * The wrapper is a pure observer of the underlying message stream: every
 * message yielded by the SDK is forwarded to the caller unchanged, in the
 * same order. Trace steps are emitted as a side effect.
 *
 * @example
 * ```ts
 * import { tracedQuery } from "@openlayer/sdk/integrations/claude-agent-sdk";
 * for await (const message of tracedQuery({ prompt: "Plan a trip" })) {
 *   console.log(message);
 * }
 * ```
 */
export async function* tracedQuery(params: {
  prompt: string | AsyncIterable<any>;
  options?: any;
  inferencePipelineId?: string;
}): AsyncGenerator<any, void, unknown> {
  const underlyingQuery = loadUnderlyingQuery();

  const name = 'claude-agent-sdk: ' + summarizePrompt(params.prompt);
  const [rootStep, endRootStep] = _internalCreateStep(
    name,
    StepType.AGENT,
    { prompt: params.prompt },
    undefined,
    null,
    null,
    null,
    params.inferencePipelineId ?? _config.inferencePipelineId,
  );

  const state: TraceState = { rootStep, endRootStep, turnCounter: 0 };

  try {
    for await (const msg of underlyingQuery({ prompt: params.prompt, options: params.options })) {
      try {
        observe(msg, state);
      } catch (err) {
        // Never break the user's stream because of a tracing bug.
        // eslint-disable-next-line no-console
        console.error('[openlayer] claude-agent-sdk observation failed:', err);
      }
      yield msg;
    }
  } finally {
    try {
      endRootStep();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[openlayer] failed to close root trace step:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Test-only helper: mutate the in-process configuration. Not part of the
// supported public API.
// ---------------------------------------------------------------------------
/** @internal */
export function _setConfigForTesting(overrides: Partial<ClaudeAgentSdkConfig>): void {
  _config = { ..._config, ...overrides };
}

/** @internal */
export function _getConfigForTesting(): Readonly<ClaudeAgentSdkConfig> {
  return _config;
}

/** @internal — used by tests to reset the cached SDK query reference. */
export function _resetUnderlyingQueryForTesting(): void {
  _underlyingQuery = null;
}
