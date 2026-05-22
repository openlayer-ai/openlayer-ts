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
 * AGENT  "Claude Agent SDK query"
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
import { AsyncLocalStorage } from 'node:async_hooks';

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
  truncateToolOutputChars: 8192,
  captureThinking: true,
  redactMcpEnv: true,
};

/** Internal trace state for a single ``tracedQuery()`` invocation. */
interface TraceState {
  rootStep: any;
  endRootStep: () => void;
  sessionId?: string;
  model?: string;
  userPrompt?: string;
  turnCounter: number;
  /** ``tool_use_id`` -> open tool step handle. Set on PreToolUse, deleted on
   * PostToolUse/PostToolUseFailure once the step is closed. */
  pendingTools: Map<string, { step: any; endStep: () => void; startTime: number }>;
  /** ``tool_use_id`` -> closed tool step (kept around so subagent messages
   * can resolve their ``parent_tool_use_id`` to the right step if needed). */
  toolStepById: Map<string, any>;
  /** ``subagent_tool_use_id`` -> parent AGENT step. Populated when we observe
   * a subagent's assistant message that declares a tool_use block, so that
   * the subsequent PreToolUse hook for that tool can nest the TOOL step
   * inside the subagent's AGENT boundary even when the hook fires in a
   * different async context than the one that opened the AGENT step. */
  toolToParentStep: Map<string, any>;
  /** Lookup of subagent definitions (from ``options.agents``) so the
   * PreToolUse hook can attach a subagent's prompt/tools/model to the AGENT
   * step opened for its dispatch. */
  agentsDefined?: Record<string, any>;
}

/** Per-query() AsyncLocalStorage context so concurrent invocations don't
 * trample each other's pending-tool bookkeeping. */
const _als = new AsyncLocalStorage<TraceState>();

const ROOT_STEP_NAME = 'Claude Agent SDK query';

/** Coerce ``options.systemPrompt`` (string | preset object) into a JSON-safe
 * value, truncated to 4096 chars for string forms. */
function serializeSystemPrompt(sp: any): any {
  if (sp == null) return null;
  if (typeof sp === 'string') return truncateString(sp, 4096);
  if (typeof sp === 'object') return sp; // preset / { type, preset, append, ... }
  return String(sp);
}

/** Capture each subagent definition's description, prompt (truncated), tools. */
function serializeAgentDefinitions(agents: any): Record<string, any> | null {
  if (!agents || typeof agents !== 'object') return null;
  const out: Record<string, any> = {};
  for (const [name, defn] of Object.entries<any>(agents)) {
    out[name] = {
      description: defn?.description,
      prompt: truncateString(defn?.prompt, 4096),
      tools: defn?.tools,
      model: defn?.model,
    };
  }
  return Object.keys(out).length ? out : null;
}

/** Snapshot user-provided options onto the root step metadata. Called once
 * per query with the *original* (pre-hook-injection) options. */
function captureOptionsMetadata(rootStep: any, options: any): void {
  if (!options) return;
  const metadata: Record<string, any> = {};

  const sp = serializeSystemPrompt(options.systemPrompt);
  if (sp !== null && sp !== undefined) metadata['system_prompt'] = sp;

  const agents = serializeAgentDefinitions(options.agents);
  if (agents) metadata['agents_defined'] = agents;

  const optKeys = [
    'model',
    'fallbackModel',
    'maxTurns',
    'maxBudgetUsd',
    'permissionMode',
    'cwd',
    'allowedTools',
    'disallowedTools',
    'continue',
    'resume',
    'forkSession',
  ];
  const optCapture: Record<string, any> = {};
  for (const k of optKeys) {
    const v = options[k];
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    optCapture[k] = v;
  }
  if (Object.keys(optCapture).length) metadata['options'] = optCapture;

  if (Object.keys(metadata).length) {
    rootStep.log({ metadata });
  }
}

/** Truncate a string-or-undefined value to ``maxChars``. Used for system
 * prompt and subagent prompt capture. Returns undefined for null/undefined input. */
function truncateString(value: any, maxChars: number): any {
  if (value == null) return undefined;
  if (typeof value !== 'string') return value;
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}... [truncated, full length ${value.length}]`;
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
  state.model = msg.model;
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
      // Surface the same fields in metadata too — the base ``Step`` toJSON()
      // doesn't include cost/tokens for AgentStep, so downstream consumers
      // reading metadata still get the picture.
      cost: msg.total_cost_usd ?? null,
      tokens: input + output,
      promptTokens: input,
      completionTokens: output,
      model: state.model ?? null,
      provider: 'anthropic',
      // No first-class rawOutput on AgentStep; expose via metadata.
      rawOutput: serializeResultMessage(msg),
    },
  });
}

/** Serialize a ResultMessage to a JSON-ish string for raw_output display. */
function serializeResultMessage(msg: any): string | null {
  try {
    return JSON.stringify({
      subtype: msg.subtype,
      result: msg.result,
      session_id: msg.session_id,
      duration_ms: msg.duration_ms,
      duration_api_ms: msg.duration_api_ms,
      num_turns: msg.num_turns,
      stop_reason: msg.stop_reason,
      is_error: msg.is_error,
      total_cost_usd: msg.total_cost_usd,
      usage: msg.usage,
      modelUsage: msg.modelUsage,
      permission_denials: msg.permission_denials,
    });
  } catch {
    return null;
  }
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
  const toolUseBlocks: Array<{ id: string; name: string; input: any }> = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text') textParts.push(b.text ?? '');
    else if (b.type === 'thinking') thinkingParts.push(b.thinking ?? '');
    else if (b.type === 'tool_use') toolUseBlocks.push({ id: b.id, name: b.name, input: b.input });
  }

  const usage = msg.message?.usage ?? {};
  const text = textParts.filter(Boolean).join('\n');
  // Output: prefer text, fall back to tool-use summary, then thinking, then a
  // marker so users see *something* in the UI rather than an empty step.
  let output: string;
  if (text) output = text;
  else if (toolUseBlocks.length) output = `[tool call: ${toolUseBlocks.map((b) => b.name).join(', ')}]`;
  else if (thinkingParts.length && _config.captureThinking)
    output = `[thinking]\n${thinkingParts.join('\n')}`;
  else output = '[no content]';

  // For top-level assistant turns, surface the user's original prompt as the
  // step's input so reviewers see what triggered this turn. Subagent turns
  // are driven by the parent's Agent tool call, not by a user prompt.
  const isSubagentTurn = msg.parent_tool_use_id != null;
  const stepInputs = !isSubagentTurn && state.userPrompt != null ? { prompt: state.userPrompt } : undefined;

  // If this is a subagent message declaring tool calls, register each
  // declared tool_use_id -> parent AGENT step so the later PreToolUse hook
  // can nest the TOOL step inside the subagent's AGENT boundary. Without
  // this, subagent tools can escape to the root because the synchronous
  // step stack may have been popped by the time the SDK fires PreToolUse
  // for an async subagent.
  if (isSubagentTurn && toolUseBlocks.length) {
    const parentAgentStep = state.pendingTools.get(msg.parent_tool_use_id)?.step;
    if (parentAgentStep) {
      for (const b of toolUseBlocks) {
        if (b.id) state.toolToParentStep.set(b.id, parentAgentStep);
      }
    }
  }

  const [chatStep, endChatStep] = _internalCreateStep(
    `assistant turn ${state.turnCounter}`,
    StepType.CHAT_COMPLETION,
    stepInputs,
    undefined,
    null,
  );
  // ChatCompletionStep has first-class fields for these; cast to ``any`` so
  // ``.log`` accepts them — its ``Partial<Record<keyof this, any>>`` signature
  // is computed off the base ``Step`` type and doesn't pick up the subclass
  // fields without explicit narrowing.
  (chatStep as any).log({
    output,
    model: msg.message?.model ?? null,
    provider: 'anthropic',
    promptTokens: usage.input_tokens ?? null,
    completionTokens: usage.output_tokens ?? null,
    tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    metadata: {
      thinking: _config.captureThinking && thinkingParts.length ? thinkingParts.join('\n') : null,
      tool_calls: toolUseBlocks.length ? toolUseBlocks : null,
      stop_reason: msg.message?.stop_reason ?? null,
      parent_tool_use_id: msg.parent_tool_use_id ?? null,
      message_id: msg.message?.id ?? msg.uuid ?? null,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? null,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? null,
      // No first-class rawOutput field on the TS ChatCompletionStep, so we
      // stash the full assistant message in metadata so reviewers can still
      // inspect the unfiltered model response.
      rawOutput: serializeAssistantMessage(msg, blocks),
    },
  });
  endChatStep();
}

/** Serialize an AssistantMessage's full content array to JSON for raw_output
 * inspection. */
function serializeAssistantMessage(msg: any, blocks: any[]): string | null {
  try {
    return JSON.stringify({
      model: msg.message?.model ?? null,
      stop_reason: msg.message?.stop_reason ?? null,
      usage: msg.message?.usage ?? null,
      parent_tool_use_id: msg.parent_tool_use_id ?? null,
      content: blocks.map((b) => {
        if (!b || typeof b !== 'object') return { repr: String(b) };
        if (b.type === 'text') return { type: 'text', text: b.text };
        if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking, signature: b.signature };
        if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
        return { type: b.type ?? 'unknown', value: b };
      }),
    });
  } catch {
    return null;
  }
}

/** Dispatch a single message from the SDK stream to the right observer. */
function observe(msg: any, state: TraceState): void {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'system') observeSystemInit(msg, state);
  else if (msg.type === 'assistant') observeAssistant(msg, state);
  else if (msg.type === 'result') observeResult(msg, state);
  // user / tool observers added in later tasks
}

// ---------------------------------------------------------------------------
// Hook callbacks — installed via ``injectHooks`` into the user's options so
// the SDK calls them around each tool invocation. They never mutate the
// agent flow: they always resolve to ``{}`` (an empty hook response) so the
// user's own hooks retain full influence over deny / defer / allow / etc.
// ---------------------------------------------------------------------------

/** Parse an MCP-namespaced tool name (``mcp__<server>__<tool>``) into parts.
 * Returns an empty object for non-MCP tool names. */
function parseMcpName(name: string): { mcp_server?: string; mcp_tool_name?: string } {
  if (typeof name !== 'string' || !name.startsWith('mcp__')) return {};
  // Names use double-underscore as separator. Split into at most three parts:
  // ``mcp``, ``<server>``, ``<tool_with_underscores>``.
  const after = name.slice('mcp__'.length);
  const sep = after.indexOf('__');
  if (sep < 0) return {};
  return { mcp_server: after.slice(0, sep), mcp_tool_name: after.slice(sep + 2) };
}

function truncateToolOutput(value: any, maxChars: number): string {
  let s: string;
  if (typeof value === 'string') s = value;
  else {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  }
  return s.length > maxChars ? s.slice(0, maxChars) + `... [truncated, full length ${s.length}]` : s;
}

async function preToolUseHook(input: any, toolUseID: string | undefined, _ctx: any): Promise<any> {
  void _ctx;
  const state = _als.getStore();
  if (!state || !toolUseID) return {};
  const toolName: string = input?.tool_name ?? 'unknown';
  const toolInput = input?.tool_input ?? {};
  const meta: Record<string, any> = {
    tool_use_id: toolUseID,
    ...parseMcpName(toolName),
  };

  // The built-in ``Agent`` tool dispatches a subagent. We open an AGENT step
  // (not TOOL) so the subagent's chat / tool steps live inside an agent
  // boundary. The subagent name typically rides in ``subagent_type``.
  let stepType: StepType = StepType.TOOL;
  let displayName: string = toolName;
  if (toolName === 'Agent') {
    stepType = StepType.AGENT;
    const subagentType = (toolInput as any)?.subagent_type;
    const description = (toolInput as any)?.description;
    displayName = subagentType ? `Agent: ${subagentType}` : 'Agent (subagent)';
    meta['subagent_type'] = subagentType;
    meta['subagent_description'] = description;
    const defn = state.agentsDefined?.[subagentType];
    if (defn) meta['agent_definition'] = defn;
  }

  try {
    const [step, endStep] = _internalCreateStep(displayName, stepType, toolInput, undefined, meta);
    // If this tool was declared inside a subagent message, observeAssistant
    // pre-registered its parent AGENT step. Re-parent the freshly-created
    // step there if the current stepStack put it somewhere else (e.g. root).
    const explicitParent = state.toolToParentStep.get(toolUseID);
    if (explicitParent && explicitParent !== step) {
      reparentStep(step, explicitParent, state.rootStep);
    }
    state.pendingTools.set(toolUseID, { step, endStep, startTime: Date.now() });
  } catch (err) {
    console.error('[openlayer] preToolUseHook failed:', err);
  }
  return {};
}

/** Walk the trace tree from ``root`` down to find which step currently
 * contains ``target`` in its ``steps`` array, then move ``target`` from
 * there into ``newParent``. Defensive — bails on the first failure rather
 * than partially mutating the tree. */
function reparentStep(target: any, newParent: any, root: any): void {
  try {
    // Already correctly parented? Bail.
    if (Array.isArray(newParent.steps) && newParent.steps.includes(target)) {
      return;
    }
    // Find and remove target from its current parent's steps array.
    const queue: any[] = [root];
    let removed = false;
    while (queue.length) {
      const node = queue.shift();
      if (!node || !Array.isArray(node.steps)) continue;
      const idx = node.steps.indexOf(target);
      if (idx >= 0) {
        node.steps.splice(idx, 1);
        removed = true;
        break;
      }
      for (const child of node.steps) queue.push(child);
    }
    if (!removed) return; // Couldn't find — don't double-insert.
    if (typeof newParent.addNestedStep === 'function') {
      newParent.addNestedStep(target);
    } else if (Array.isArray(newParent.steps)) {
      newParent.steps.push(target);
    }
  } catch {
    /* noop — never break the user's stream over a bookkeeping issue */
  }
}

async function postToolUseHook(input: any, toolUseID: string | undefined, _ctx: any): Promise<any> {
  void _ctx;
  const state = _als.getStore();
  if (!state || !toolUseID) return {};
  const handle = state.pendingTools.get(toolUseID);
  if (!handle) return {};
  state.pendingTools.delete(toolUseID);
  try {
    const raw = input?.tool_response ?? input?.tool_output ?? input?.output;
    const output = truncateToolOutput(raw, _config.truncateToolOutputChars);
    handle.step.log({
      output,
      metadata: {
        ...(handle.step.metadata ?? {}),
        is_error: false,
        latency_ms: Date.now() - handle.startTime,
      },
    });
    handle.endStep();
    state.toolStepById.set(toolUseID, handle.step);
  } catch (err) {
    console.error('[openlayer] postToolUseHook failed:', err);
    // Still pop the stack to avoid corrupting future steps.
    try {
      handle.endStep();
    } catch {
      /* noop */
    }
  }
  return {};
}

async function postToolUseFailureHook(input: any, toolUseID: string | undefined, _ctx: any): Promise<any> {
  void _ctx;
  const state = _als.getStore();
  if (!state || !toolUseID) return {};
  const handle = state.pendingTools.get(toolUseID);
  if (!handle) return {};
  state.pendingTools.delete(toolUseID);
  try {
    const errPayload = input?.error ?? input?.tool_response ?? input;
    const output = truncateToolOutput(errPayload, _config.truncateToolOutputChars);
    handle.step.log({
      output,
      metadata: {
        ...(handle.step.metadata ?? {}),
        is_error: true,
        latency_ms: Date.now() - handle.startTime,
      },
    });
    handle.endStep();
    state.toolStepById.set(toolUseID, handle.step);
  } catch (err) {
    console.error('[openlayer] postToolUseFailureHook failed:', err);
    try {
      handle.endStep();
    } catch {
      /* noop */
    }
  }
  return {};
}

/**
 * Merge our internal observation hooks into the user's ``options.hooks``
 * map without replacing any existing user matchers.
 *
 * The SDK's hook structure is::
 *
 *   { hooks: { PreToolUse: [{ matcher?: string, hooks: [fn, ...] }], ... } }
 *
 * We append a new matcher entry per event so user matchers fire first and
 * our internal observers fire alongside them.
 */
function injectHooks(options: any): any {
  const opts = options ? { ...options } : {};
  const userHooks: Record<string, any[]> = { ...((opts.hooks as Record<string, any[]>) ?? {}) };
  const append = (event: string, fn: any) => {
    userHooks[event] = [...(userHooks[event] ?? []), { hooks: [fn] }];
  };
  append('PreToolUse', preToolUseHook);
  append('PostToolUse', postToolUseHook);
  append('PostToolUseFailure', postToolUseFailureHook);
  opts.hooks = userHooks;
  return opts;
}

let _underlyingQuery: ((opts: any) => AsyncIterable<any>) | null = null;

/**
 * Resolve the SDK's ``query`` export. The SDK ships ESM-only, but it's
 * common to consume Openlayer from CommonJS contexts (Jest with the default
 * preset, etc.). Try ``require()`` first (works on Node 22.12+ for ESM, and
 * always works for the virtual jest mock used in unit tests), then fall
 * back to dynamic ``import()`` for older Node and pure-CJS Jest workers.
 */
async function loadUnderlyingQuery(): Promise<(opts: any) => AsyncIterable<any>> {
  if (_underlyingQuery) return _underlyingQuery;
  let mod: any = null;
  let requireErr: unknown;
  try {
    mod = require('@anthropic-ai/claude-agent-sdk');
  } catch (err) {
    requireErr = err;
    mod = null;
  }
  if (!mod || typeof mod.query !== 'function') {
    try {
      mod = await import('@anthropic-ai/claude-agent-sdk');
      // ``import()`` of a CJS module wraps named exports under ``default``
      // on some runtimes; unwrap if needed.
      if (mod && typeof mod.query !== 'function' && mod.default && typeof mod.default.query === 'function') {
        mod = mod.default;
      }
    } catch (err2) {
      const r = requireErr instanceof Error ? requireErr.message : '';
      const i = err2 instanceof Error ? err2.message : String(err2);
      throw new Error(
        '@anthropic-ai/claude-agent-sdk is not installed or could not be loaded' +
          ` (require: ${r || 'no error'}; import: ${i}). ` +
          'Install with: npm install @anthropic-ai/claude-agent-sdk@^0.2.111',
      );
    }
  }
  if (!mod || typeof mod.query !== 'function') {
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
  const underlyingQuery = await loadUnderlyingQuery();

  const name = ROOT_STEP_NAME;
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

  // Snapshot user-provided options BEFORE we inject our hooks so the captured
  // metadata reflects what the user actually configured, not our mutations.
  captureOptionsMetadata(rootStep, params.options);

  // ``exactOptionalPropertyTypes`` rejects explicit ``undefined`` for
  // optional fields; spread the conditional ones in only when defined.
  const userPrompt = typeof params.prompt === 'string' ? params.prompt : null;
  const agentsDefined = serializeAgentDefinitions(params.options?.agents);
  const state: TraceState = {
    rootStep,
    endRootStep,
    turnCounter: 0,
    pendingTools: new Map(),
    toolStepById: new Map(),
    toolToParentStep: new Map(),
    ...(userPrompt !== null ? { userPrompt } : {}),
    ...(agentsDefined ? { agentsDefined } : {}),
  };
  const optionsWithHooks = injectHooks(params.options);

  // ``yield`` cannot live inside ``_als.run(() => ...)`` directly (the
  // callback can't be a generator). Instead, we manually iterate the
  // underlying async generator wrapped in ``_als.run`` for each ``next()``
  // call so all hook callbacks (which may be invoked during ``next()``) see
  // our state via ``_als.getStore()``.
  //
  // Contract assumption: every hook callback reads ``_als.getStore()``
  // synchronously, before its first ``await``. Node's AsyncLocalStorage
  // propagates through awaited continuations correctly via ``async_hooks``,
  // so this almost always Just Works — but if a future hook were to defer
  // its state read past a setImmediate or a foreign Promise the store may
  // be unset there. Today all hooks (preToolUseHook, postToolUseHook,
  // postToolUseFailureHook) read state synchronously at the top, so the
  // invariant holds.
  const iter = _als.run(state, () => underlyingQuery({ prompt: params.prompt, options: optionsWithHooks }));
  const asyncIter =
    (iter as any)[Symbol.asyncIterator] ? (iter as any)[Symbol.asyncIterator]() : (iter as any);

  try {
    while (true) {
      const result: IteratorResult<any> = await _als.run(state, () => asyncIter.next());
      if (result.done) break;
      const msg = result.value;
      try {
        await _als.run(state, async () => observe(msg, state));
      } catch (err) {
        // Never break the user's stream because of a tracing bug.

        console.error('[openlayer] claude-agent-sdk observation failed:', err);
      }
      yield msg;
    }
  } finally {
    // Close any tool steps that never received a PostToolUse (defensive —
    // the SDK contract is that every Pre is followed by a Post or Failure).
    for (const handle of state.pendingTools.values()) {
      try {
        handle.endStep();
      } catch {
        /* noop */
      }
    }
    state.pendingTools.clear();
    try {
      endRootStep();
    } catch (err) {
      console.error('[openlayer] failed to close root trace step:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API: drop-in ``query`` and ``traceClaudeAgentSdk`` runtime patcher.
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for ``@anthropic-ai/claude-agent-sdk``'s ``query``.
 *
 * @example
 * ```ts
 * import { query } from "@openlayer/sdk/integrations/claude-agent-sdk";
 * for await (const message of query({ prompt: "Plan a trip" })) { ... }
 * ```
 */
export function query(params: {
  prompt: string | AsyncIterable<any>;
  options?: any;
  inferencePipelineId?: string;
}): AsyncGenerator<any, void, unknown> {
  return tracedQuery(params);
}

/**
 * One-shot init for codebases that can't change their imports.
 *
 * Mutates the ``@anthropic-ai/claude-agent-sdk`` module's ``query`` (and
 * ``ClaudeSDKClient.prototype.query`` / ``.receiveResponse`` once available)
 * so every subsequent call is auto-traced. Idempotent: calling it multiple
 * times only patches once but does refresh the tunable config.
 *
 * @example
 * ```ts
 * import { traceClaudeAgentSdk } from "@openlayer/sdk/integrations/claude-agent-sdk";
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 *
 * traceClaudeAgentSdk({ inferencePipelineId: "..." });
 * for await (const m of query({ prompt: "..." })) { ... }
 * ```
 */
export function traceClaudeAgentSdk(opts: Partial<ClaudeAgentSdkConfig> = {}): void {
  // Refresh in-process config every call so users can re-tune at any time.
  _config = { ..._config, ...opts };

  // We need a SYNCHRONOUS module reference here to mutate ``sdk.query``.
  // Pure-ESM modules only work via ``import()`` (async) on older Node.
  // ``require()`` does work on Node 22.12+ for ESM, and is the fast path
  // for the jest virtual mock and CJS consumers.
  let sdk: any = null;
  let cause: unknown;
  try {
    sdk = require('@anthropic-ai/claude-agent-sdk');
  } catch (err) {
    cause = err;
    sdk = null;
  }
  if (!sdk) {
    const detail = cause instanceof Error ? ` (cause: ${cause.message})` : '';
    throw new Error(
      '@anthropic-ai/claude-agent-sdk is not installed or could not be loaded' +
        detail +
        '. On Node <22.12 with pure-ESM SDK builds, use the drop-in `query` ' +
        'export from this module instead (which lazy-loads via dynamic import). ' +
        'Install with: npm install @anthropic-ai/claude-agent-sdk@^0.2.111',
    );
  }

  if (typeof sdk.query !== 'function') {
    throw new Error('@anthropic-ai/claude-agent-sdk is missing the expected `query` export');
  }

  // Patch the client prototype FIRST and unconditionally. The function is
  // idempotent (it carries its own ``_openlayerPatched`` guard on the
  // prototype), and pulling it above the ``query``-already-patched
  // early-return means a caller that imports ``ClaudeSDKClient`` lazily
  // — after a first ``traceClaudeAgentSdk()`` call had already patched
  // ``query`` — still gets client instrumentation on the second call.
  patchClaudeSdkClientIfPresent(sdk);

  // Already patched? Just refresh config and exit (already done above).
  if ((sdk.query as any)._openlayerPatched) return;

  const original = sdk.query;
  const patched: any = function patchedQuery(params: any) {
    return tracedQuery(params);
  };
  patched._openlayerPatched = true;
  patched._openlayerOriginal = original;
  try {
    sdk.query = patched;
  } catch (err) {
    // ESM module bindings are read-only; fall back to defineProperty.
    try {
      Object.defineProperty(sdk, 'query', { value: patched, writable: true, configurable: true });
    } catch {
      console.error('[openlayer] failed to monkey-patch @anthropic-ai/claude-agent-sdk.query', err);
      return;
    }
  }
}

/**
 * Wrap ``ClaudeSDKClient.prototype.query`` / ``.receiveResponse`` so existing
 * client-based codepaths get traced too. Each ``client.query(...)`` is
 * treated as one trace, with the same step shape as the standalone
 * ``query()`` function.
 */
function patchClaudeSdkClientIfPresent(sdk: any): void {
  const Client = sdk.ClaudeSDKClient;
  if (typeof Client !== 'function' || !Client.prototype) return;
  if ((Client.prototype as any)._openlayerPatched) return;

  // ``receive_response`` (snake) is the iterator the user awaits. We
  // intercept it to attach our trace state via AsyncLocalStorage and emit
  // the root AGENT step around the whole streamed response. We also patch
  // ``query`` (which sends the user prompt) so that the prompt becomes
  // visible on the root step.
  const originalReceive = Client.prototype.receive_response ?? Client.prototype.receiveResponse;
  const originalQuery = Client.prototype.query;

  if (typeof originalReceive === 'function') {
    const patchedReceive = async function* patchedReceiveResponse(this: any, ...args: any[]) {
      const name = ROOT_STEP_NAME;
      const [rootStep, endRootStep] = _internalCreateStep(
        name,
        StepType.AGENT,
        { prompt: this.__openlayerLastPrompt },
        undefined,
        null,
        null,
        null,
        _config.inferencePipelineId,
      );
      // Snapshot the user's original options (stashed at construction) onto
      // root metadata so users see the system prompt, subagent definitions,
      // model, permission mode, etc. that drove this run.
      captureOptionsMetadata(rootStep, this.__openlayerOriginalOptions);

      const userPromptVal =
        typeof this.__openlayerLastPrompt === 'string' ? this.__openlayerLastPrompt : null;
      const agentsDefinedVal = serializeAgentDefinitions(this.__openlayerOriginalOptions?.agents);
      const state: TraceState = {
        rootStep,
        endRootStep,
        turnCounter: 0,
        pendingTools: new Map(),
        toolStepById: new Map(),
        toolToParentStep: new Map(),
        ...(userPromptVal !== null ? { userPrompt: userPromptVal } : {}),
        ...(agentsDefinedVal ? { agentsDefined: agentsDefinedVal } : {}),
      };
      const upstream = originalReceive.apply(this, args);
      const asyncIter = upstream[Symbol.asyncIterator] ? upstream[Symbol.asyncIterator]() : upstream;
      try {
        while (true) {
          const result: IteratorResult<any> = await _als.run(state, () => asyncIter.next());
          if (result.done) break;
          const msg = result.value;
          try {
            await _als.run(state, async () => observe(msg, state));
          } catch (err) {
            console.error('[openlayer] observation failed (ClaudeSDKClient):', err);
          }
          yield msg;
        }
      } finally {
        for (const handle of state.pendingTools.values()) {
          try {
            handle.endStep();
          } catch {
            /* noop */
          }
        }
        state.pendingTools.clear();
        try {
          endRootStep();
        } catch (err) {
          console.error('[openlayer] failed to close root trace step:', err);
        }
      }
    };
    Client.prototype.receive_response = patchedReceive;
    Client.prototype.receiveResponse = patchedReceive;
  }

  if (typeof originalQuery === 'function') {
    const patchedClientQuery = async function patchedClientQuery(this: any, prompt: any) {
      // Remember the prompt so receive_response can name the root step.
      this.__openlayerLastPrompt = prompt;
      // Snapshot the user's original options so receive_response can capture
      // system_prompt / agents / model / etc. onto the root step BEFORE we
      // inject our hooks below. The clone is shallow but our injection only
      // replaces the ``hooks`` field, leaving everything else intact.
      if (this.options && !this.__openlayerOriginalOptions) {
        this.__openlayerOriginalOptions = { ...this.options };
      }
      // Ensure our hooks are merged into the options the client was
      // constructed with. The client typically holds them on
      // ``this.options``; we splice ours in once.
      if (this.options && !this.options.__openlayerHooksInjected) {
        this.options = injectHooks(this.options);
        this.options.__openlayerHooksInjected = true;
      }
      return originalQuery.call(this, prompt);
    };
    Client.prototype.query = patchedClientQuery;
  }

  (Client.prototype as any)._openlayerPatched = true;
}

// ---------------------------------------------------------------------------
// Test-only helpers. Not part of the supported public API.
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
