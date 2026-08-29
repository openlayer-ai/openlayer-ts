/**
 * Openlayer tracing integration for the GitHub Copilot SDK (TypeScript).
 *
 * The Copilot SDK (`@github/copilot-sdk`) drives the Copilot CLI over JSON-RPC
 * and exposes a rich session event stream. This module subscribes to that
 * stream and turns each `send()` into an Openlayer trace with nested steps for
 * assistant turns, tool calls and subagents.
 *
 * Why we buffer instead of building steps live
 * --------------------------------------------
 * `assistant.usage` -- which carries every token count and the premium-request
 * figure -- is `ephemeral` and absent from `session.getEvents()`, so we have to
 * listen live. But Copilot fires tool calls *concurrently*: three
 * `tool.execution_start` events arrive before any completion, and the
 * completions come back out of order. Driving step creation straight from the
 * live callbacks would therefore nest sibling tools inside one another. We
 * buffer live and build the whole trace in one deterministic, correctly-nested
 * pass when the session goes idle.
 *
 * Trace shape (one trace per `send()`):
 *
 * ```
 * AGENT  "GitHub Copilot"
 *  |-- CHAT_COMPLETION  "turn 0"
 *  |-- TOOL             "bash"
 *  |-- AGENT            "subagent: Explore Agent"
 *  |    |-- CHAT_COMPLETION "turn 0"
 *  |    `-- TOOL            "view"
 *  `-- CHAT_COMPLETION  "turn 1"
 * ```
 *
 * See `docs/superpowers/specs/2026-08-27-github-copilot-sdk-integration-design.md`.
 */
import { StepType } from '../tracing/steps';
import { _internalCreateStep } from '../tracing/tracer';

export const ROOT_STEP_NAME = 'GitHub Copilot';

/** Tunable per-integration configuration. */
export interface CopilotConfig {
  /** Inference pipeline ID. Falls back to `OPENLAYER_INFERENCE_PIPELINE_ID`. */
  inferencePipelineId?: string | undefined;
  /** Max characters to keep from each tool output before truncation. */
  truncateToolOutputChars: number;
  /** Whether to capture reasoning text into chat-step metadata. */
  captureReasoning: boolean;
}

const DEFAULT_CONFIG: CopilotConfig = {
  truncateToolOutputChars: 8192,
  captureReasoning: true,
};

/**
 * High-frequency events that carry no step-level meaning. Dropped at ingest so
 * the buffer stays small -- a single session emits hundreds of these.
 */
const IGNORED_EVENT_TYPES = new Set([
  'assistant.message_delta',
  'assistant.reasoning_delta',
  'assistant.streaming_delta',
  'assistant.tool_call_delta',
  'tool.execution_partial_result',
  'session.background_tasks_changed',
]);

/**
 * Copilot routes to several model families. The Openlayer cost service keys on
 * the *real* provider, and Copilot's model ids match its slugs verbatim
 * (verified: anthropic/claude-haiku-4.5 and openai/gpt-5.4 both resolve, while
 * github/* returns "No cost data found"). Labelling these "github" would yield
 * a silent $0, so an unrecognized prefix omits the provider entirely --
 * landing unpriced is recoverable, landing priced-wrong is not.
 */
const PROVIDER_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['claude-', 'anthropic'],
  ['gpt-', 'openai'],
  ['o1', 'openai'],
  ['o3', 'openai'],
  ['o4', 'openai'],
  ['gemini-', 'google'],
  ['grok-', 'xai'],
];

// --------------------------------------------------------------------------- //
// Event accessors
// --------------------------------------------------------------------------- //

function snakeToCamel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase());
}

/**
 * Read a field tolerating snake_case and camelCase.
 *
 * The TypeScript binding yields `toolCallId`; keeping the tolerant accessor
 * lets this file stay structurally identical to its Python counterpart and
 * makes the recorded fixtures interchangeable.
 */
function field(data: any, name: string): any {
  if (data === null || typeof data !== 'object') return undefined;
  if (name in data) return data[name];
  return data[snakeToCamel(name)];
}

/** An event's `type` as a plain string (the binding may hand back an enum). */
function eventType(event: any): string {
  if (event === null || typeof event !== 'object') return '';
  const raw = event.type;
  if (raw === null || raw === undefined) return '';
  const value = typeof raw === 'object' && 'value' in raw ? raw.value : raw;
  return typeof value === 'string' ? value : String(value);
}

function eventData(event: any): any {
  if (event === null || typeof event !== 'object') return {};
  return event.data ?? {};
}

function envelope(event: any, name: string): any {
  if (event === null || typeof event !== 'object') return undefined;
  return field(event, name);
}

/** ISO-8601 event timestamp to epoch milliseconds (the unit TS steps use). */
function timestampMs(event: any): number | undefined {
  const raw = envelope(event, 'timestamp');
  if (!raw) return undefined;
  if (typeof raw === 'number') return raw;
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Cap oversized tool payloads; results can contain whole files. */
function truncate(value: any, maxChars: number): any {
  if (typeof value === 'string' && value.length > maxChars) {
    return `${value.slice(0, maxChars)}…<truncated ${value.length - maxChars} chars>`;
  }
  return value;
}

// --------------------------------------------------------------------------- //
// Mapping helpers
// --------------------------------------------------------------------------- //

/** Map a Copilot model id to the real underlying provider slug. */
export function providerForModel(model?: string | null): string | undefined {
  if (!model) return undefined;
  const lowered = String(model).toLowerCase();
  for (const [prefix, provider] of PROVIDER_PREFIXES) {
    if (lowered.startsWith(prefix)) return provider;
  }
  return undefined;
}

/**
 * Build the non-overlapping token partition the cost backend prices.
 *
 * Copilot reports `inputTokens` as a *superset* that already contains
 * `cacheReadTokens` and `cacheWriteTokens`. The backend sums a price per
 * recognized key, so the granular categories must be broken out and subtracted
 * from the base or cached tokens get charged twice. Reasoning stays folded into
 * `output_tokens`, matching the convention in `langchainCallback`.
 */
export function usageDetails(usage: any): Record<string, number> {
  const inputTotal = Number(field(usage, 'input_tokens') ?? 0);
  const outputTotal = Number(field(usage, 'output_tokens') ?? 0);
  const cacheRead = Number(field(usage, 'cache_read_tokens') ?? 0);
  const cacheWrite = Number(field(usage, 'cache_write_tokens') ?? 0);

  const details: Record<string, number> = {};
  const entries: ReadonlyArray<readonly [string, number]> = [
    ['input_tokens', inputTotal - cacheRead - cacheWrite],
    ['output_tokens', outputTotal],
    ['cached_tokens', cacheRead],
    ['cache_creation_tokens', cacheWrite],
  ];
  for (const [key, value] of entries) {
    if (value && value > 0) details[key] = value;
  }
  return details;
}

/**
 * GitHub meters every call in AIU ("AI Units") and reports the total on
 * `copilot_usage.total_nano_aiu`. Decoding the per-token rates GitHub ships
 * alongside it (`copilot_usage._token_details`) for `claude-haiku-4.5` gives
 * 100 / 500 / 10 / 125 AIU per 1M input / output / cache-read / cache-write
 * tokens -- exactly Anthropic's published list prices scaled by 100. So one AIU
 * is one US cent, and `total_nano_aiu / 1e11` reproduced the priced cost of an
 * observed call to twelve decimal places ($0.01675375 both ways).
 *
 * Confirmed across two vendors: `gpt-5-mini` bills 25 / 200 / 2.5 AIU per 1M
 * input / output / cache-read tokens, which is OpenAI's $0.25 / $2.00 / $0.025
 * list pricing under the same 1 AIU = $0.01 constant. Live rows carry both
 * figures and they agree to twelve decimal places.
 *
 * Still not proven for *every* vendor Copilot may route to, so this is used as a
 * *fallback* for models we cannot map to a provider, and as a cross-check
 * alongside the priced cost -- never in place of Openlayer's own pricing when
 * the provider is known.
 */
const NANO_AIU_PER_USD = 1e11;

/** GitHub's own metered value of a call, in USD, or undefined if unavailable. */
export function meteredCostUsd(usage: any): number | undefined {
  const copilotUsage = field(usage, 'copilot_usage');
  if (!copilotUsage || typeof copilotUsage !== 'object') return undefined;
  const nanoAiu = field(copilotUsage, 'total_nano_aiu');
  if (!nanoAiu) return undefined;
  const value = Number(nanoAiu);
  return Number.isFinite(value) ? value / NANO_AIU_PER_USD : undefined;
}

// --------------------------------------------------------------------------- //
// Buffered records
// --------------------------------------------------------------------------- //

interface Interaction {
  interactionId: string;
  userPrompt: string;
  events: any[];
  startTime: number;
}

interface TurnRecord {
  kind: 'turn';
  agentId?: string | undefined;
  turnId: any;
  model?: string | undefined;
  startTime?: number | undefined;
  endTime?: number | undefined;
  output: string;
  reasoning: string;
  usage: any;
  apiCallId?: string | undefined;
  error?: Record<string, any> | undefined;
  parentToolCallId?: string | undefined;
}

interface ToolRecord {
  kind: 'tool';
  toolCallId: string;
  name: string;
  arguments?: any | undefined;
  result?: any | undefined;
  error?: any | undefined;
  success?: boolean | undefined;
  startTime?: number | undefined;
  endTime?: number | undefined;
  parentToolCallId?: string | undefined;
  agentId?: string | undefined;
  mcpServerName?: string | undefined;
  isSubagent: boolean;
  subagentName?: string | undefined;
  subagentMetadata: Record<string, any>;
  permission?: string | undefined;
}

type Record_ = TurnRecord | ToolRecord;

// --------------------------------------------------------------------------- //
// Collector
// --------------------------------------------------------------------------- //

/**
 * Buffers a Copilot session's events and builds traces when it goes idle.
 * One instance per session.
 */
export class CopilotTraceCollector {
  readonly config: CopilotConfig;
  sessionId?: string | undefined;
  sessionModel?: string | undefined;
  interactions = new Map<string, Interaction>();
  builtCount = 0;

  // Correlation tables. Needed because assistant.turn_end and assistant.usage
  // carry no interactionId at all.
  private turnToInteraction = new Map<string, string>();
  private toolToInteraction = new Map<string, string>();
  private apiCallToInteraction = new Map<string, string>();
  private agentToInteraction = new Map<string, string>();
  private currentInteractionId?: string | undefined;

  constructor(config: Partial<CopilotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Entry point wired to `createSession({ onEvent })`.
   *
   * Must never throw: it runs inside the SDK's own event dispatch, and
   * observability must not be able to break the customer's agent.
   */
  handle = (event: any): void => {
    try {
      this.handleInner(event);
    } catch (err) {
      console.debug('Openlayer: failed to handle Copilot event', err);
    }
  };

  /** Build any still-open interactions (e.g. on disconnect). */
  flush(): void {
    try {
      this.buildAll();
    } catch (err) {
      console.debug('Openlayer: failed to flush Copilot traces', err);
    }
  }

  private handleInner(event: any): void {
    const type = eventType(event);
    if (!type || IGNORED_EVENT_TYPES.has(type)) return;

    const data = eventData(event);

    if (type === 'session.start') {
      this.sessionId = field(data, 'session_id') ?? this.sessionId;
      return;
    }
    if (type === 'session.model_change') {
      this.sessionModel = field(data, 'model') ?? this.sessionModel;
      return;
    }
    if (type === 'session.idle' || type === 'session.shutdown') {
      // "The session went quiescent" -- not "this send finished". Two
      // overlapping send() calls are serialized by Copilot and produce a single
      // idle with both interactions open, so build them all.
      this.buildAll();
      return;
    }

    const agentId = envelope(event, 'agent_id');

    if (type === 'user.message' && !agentId) {
      // Root-agent user messages open an interaction. Subagents emit their own
      // user.message; those belong to the dispatching interaction.
      const interactionId = field(data, 'interaction_id') ?? `_auto_${this.interactions.size}`;
      const interaction: Interaction = {
        interactionId,
        userPrompt: field(data, 'content') ?? '',
        events: [event],
        startTime: timestampMs(event) ?? Date.now(),
      };
      this.interactions.set(interactionId, interaction);
      this.currentInteractionId = interactionId;
      return;
    }

    const interactionId = this.route(data, event);
    if (!interactionId) return;
    const interaction = this.interactions.get(interactionId);
    if (!interaction) return;
    interaction.events.push(event);
    this.rememberCorrelations(type, data, interactionId, event);
  }

  /**
   * Find the interaction an event belongs to.
   *
   * Order matters. `assistant.usage` carries no interactionId and no turnId,
   * and its apiCallId is only learned from the `assistant.message` that arrives
   * *after* it -- so it must be routable by parentToolCallId or agentId before
   * any fallback.
   */
  private route(data: any, event: any): string | undefined {
    const explicit = field(data, 'interaction_id');
    if (explicit && this.interactions.has(explicit)) return explicit;

    const lookups: ReadonlyArray<readonly [string, Map<string, string>]> = [
      ['tool_call_id', this.toolToInteraction],
      ['parent_tool_call_id', this.toolToInteraction],
      ['api_call_id', this.apiCallToInteraction],
    ];
    for (const [key, table] of lookups) {
      const value = field(data, key);
      if (value && table.has(value)) return table.get(value);
    }

    const agentId = envelope(event, 'agent_id');
    if (agentId && this.agentToInteraction.has(agentId)) {
      return this.agentToInteraction.get(agentId);
    }
    const turnKey = `${agentId ?? ''}::${field(data, 'turn_id')}`;
    if (this.turnToInteraction.has(turnKey)) return this.turnToInteraction.get(turnKey);

    return this.currentInteractionId;
  }

  private rememberCorrelations(type: string, data: any, interactionId: string, event: any): void {
    const toolCallId = field(data, 'tool_call_id');
    if (toolCallId) this.toolToInteraction.set(toolCallId, interactionId);
    const apiCallId = field(data, 'api_call_id');
    if (apiCallId) this.apiCallToInteraction.set(apiCallId, interactionId);
    // subagent.started is the first event tying an agentId to an interaction,
    // and it arrives before any of that subagent's own events.
    if (type === 'subagent.started' && toolCallId) {
      this.agentToInteraction.set(toolCallId, interactionId);
    }
    if (type === 'assistant.turn_start') {
      const agentId = envelope(event, 'agent_id');
      this.turnToInteraction.set(`${agentId ?? ''}::${field(data, 'turn_id')}`, interactionId);
    }
  }

  // ----------------------------- assembly ----------------------------- //

  private buildAll(): void {
    for (const interaction of Array.from(this.interactions.values())) {
      if (interaction.events.length) this.buildInteraction(interaction);
    }
    this.interactions.clear();
    this.currentInteractionId = undefined;
  }

  private assemble(interaction: Interaction): {
    turns: Map<string, TurnRecord>;
    tools: Map<string, ToolRecord>;
    order: TurnRecord[];
  } {
    const turns = new Map<string, TurnRecord>();
    const tools = new Map<string, ToolRecord>();
    const order: TurnRecord[] = [];
    // assistant.usage arrives *before* the assistant.message it belongs to and
    // carries no turnId, so park it by apiCallId until the message names the
    // turn. Never join on adjacency.
    const pendingUsage = new Map<string, any>();

    const turnKey = (agentId: any, turnId: any) => `${agentId ?? ''}::${turnId}`;

    for (const event of interaction.events) {
      const type = eventType(event);
      const data = eventData(event);
      const agentId = envelope(event, 'agent_id');
      const ts = timestampMs(event);
      const key = turnKey(agentId, field(data, 'turn_id'));

      switch (type) {
        case 'assistant.turn_start': {
          const turn: TurnRecord = {
            kind: 'turn',
            agentId,
            turnId: field(data, 'turn_id'),
            model: field(data, 'model'),
            startTime: ts,
            output: '',
            reasoning: '',
            usage: {},
          };
          turns.set(key, turn);
          order.push(turn);
          break;
        }
        case 'model.call_start': {
          const turn = turns.get(key);
          if (turn) {
            turn.model = field(data, 'model') ?? turn.model;
            turn.startTime = turn.startTime ?? ts;
          }
          break;
        }
        case 'assistant.usage': {
          const apiCallId = field(data, 'api_call_id');
          if (apiCallId) pendingUsage.set(apiCallId, data);
          break;
        }
        case 'assistant.message': {
          let turn = turns.get(key);
          if (!turn) {
            turn = {
              kind: 'turn',
              agentId,
              turnId: field(data, 'turn_id'),
              startTime: ts,
              output: '',
              reasoning: '',
              usage: {},
            };
            turns.set(key, turn);
            order.push(turn);
          }
          turn.output += field(data, 'content') ?? '';
          turn.model = field(data, 'model') ?? turn.model;
          turn.endTime = ts ?? turn.endTime;
          turn.parentToolCallId = field(data, 'parent_tool_call_id');
          const apiCallId = field(data, 'api_call_id');
          turn.apiCallId = apiCallId;
          const reasoning = field(data, 'reasoning_text');
          if (reasoning) turn.reasoning = reasoning;
          // Join usage to message on apiCallId -- verified 1:1 across every
          // turn, including inside subagents.
          if (apiCallId && pendingUsage.has(apiCallId)) {
            turn.usage = pendingUsage.get(apiCallId);
            pendingUsage.delete(apiCallId);
          }
          break;
        }
        case 'assistant.reasoning': {
          const turn = turns.get(key);
          const text = field(data, 'text') ?? field(data, 'content');
          if (turn && text && !turn.reasoning) turn.reasoning = text;
          break;
        }
        case 'assistant.turn_end': {
          const turn = turns.get(key);
          if (turn && ts) turn.endTime = ts;
          break;
        }
        case 'model.call_failure': {
          const turn = turns.get(key);
          if (turn) {
            turn.error = {
              message: field(data, 'error_message'),
              code: field(data, 'error_code'),
              type: field(data, 'error_type'),
              statusCode: field(data, 'status_code'),
            };
          }
          break;
        }
        case 'tool.execution_start': {
          const toolCallId = field(data, 'tool_call_id');
          if (!toolCallId) break;
          tools.set(toolCallId, {
            kind: 'tool',
            toolCallId,
            name: field(data, 'tool_name') ?? 'tool',
            arguments: field(data, 'arguments'),
            startTime: ts,
            parentToolCallId: field(data, 'parent_tool_call_id'),
            agentId,
            mcpServerName: field(data, 'mcp_server_name'),
            isSubagent: false,
            subagentMetadata: {},
          });
          break;
        }
        case 'tool.execution_complete': {
          const tool = tools.get(field(data, 'tool_call_id'));
          if (!tool) break;
          tool.success = field(data, 'success');
          tool.error = field(data, 'error');
          tool.result = field(data, 'result');
          tool.endTime = ts;
          break;
        }
        case 'subagent.started': {
          const tool = tools.get(field(data, 'tool_call_id'));
          if (!tool) break;
          tool.isSubagent = true;
          tool.subagentName = field(data, 'agent_display_name') ?? field(data, 'agent_name');
          Object.assign(tool.subagentMetadata, {
            agent_name: field(data, 'agent_name'),
            agent_description: field(data, 'agent_description'),
            model: field(data, 'model'),
          });
          break;
        }
        case 'subagent.completed': {
          const tool = tools.get(field(data, 'tool_call_id'));
          if (!tool) break;
          Object.assign(tool.subagentMetadata, {
            total_tokens: field(data, 'total_tokens'),
            total_tool_calls: field(data, 'total_tool_calls'),
            duration_ms: field(data, 'duration_ms'),
            cancelled: field(data, 'cancelled'),
          });
          break;
        }
        case 'permission.completed': {
          const tool = tools.get(field(data, 'tool_call_id'));
          if (tool) tool.permission = field(data, 'decision') ?? field(data, 'outcome');
          break;
        }
        default:
          break;
      }
    }

    return { turns, tools, order };
  }

  // ----------------------------- building ----------------------------- //

  buildInteraction(interaction: Interaction): void {
    const { tools, order } = this.assemble(interaction);

    // The root's output is the LAST root-agent assistant message. Openlayer
    // builds a row's output from the root step, so an empty root silently
    // yields an unusable row.
    let finalOutput = '';
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const turn = order[i]!;
      if (!turn.agentId && turn.output) {
        finalOutput = turn.output;
        break;
      }
    }

    // A record's parent is its parentToolCallId, else the tool call that
    // dispatched its agent, else the root. Never parentId -- that is a
    // chronological chain, not a tree.
    const children = new Map<string, Record_[]>();
    const parentOf = (record: Record_): string => {
      if (record.parentToolCallId) return record.parentToolCallId;
      if (record.agentId && tools.has(record.agentId)) return record.agentId;
      return '';
    };
    const all: Record_[] = [...order, ...Array.from(tools.values())];
    for (const record of all) {
      const parent = parentOf(record);
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(record);
    }
    for (const bucket of children.values()) {
      bucket.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
    }

    const endTimes = all.map((r) => r.endTime).filter((t): t is number => !!t);
    const rootEnd = endTimes.length ? Math.max(...endTimes) : undefined;

    const [root, endRoot] = _internalCreateStep(
      ROOT_STEP_NAME,
      StepType.AGENT,
      { prompt: interaction.userPrompt },
      finalOutput,
      {
        copilot_session_id: this.sessionId,
        copilot_interaction_id: interaction.interactionId,
        model: this.sessionModel,
      },
      interaction.startTime,
      rootEnd ?? null,
      this.config.inferencePipelineId,
    );
    if (rootEnd) (root as any).log({ latency: rootEnd - interaction.startTime });
    this.emit(children, '');
    endRoot();

    this.builtCount += 1;
  }

  /**
   * Recursively open and close steps in correct nesting order.
   *
   * Because this pass is synchronous and properly nested, the tracer's step
   * stack yields the right tree -- the concurrency hazard was removed by
   * deferring construction until every event was in hand.
   */
  private emit(children: Map<string, Record_[]>, parentKey: string): void {
    for (const record of children.get(parentKey) ?? []) {
      if (record.kind === 'turn') this.emitTurn(record);
      else this.emitTool(record, children);
    }
  }

  private emitTurn(turn: TurnRecord): void {
    const usage = turn.usage ?? {};
    const metadata: Record<string, any> = { turn_id: turn.turnId };
    if (turn.agentId) metadata['agent_id'] = turn.agentId;

    const premium = field(usage, 'cost');
    if (premium !== undefined && premium !== null) {
      // NOT dollars -- Copilot premium-request units, a flat per-model
      // multiplier. Kept as metadata so the step's real cost is priced by
      // Openlayer from provider+model instead.
      metadata['copilot_premium_requests'] = premium;
    }
    const copilotUsage = field(usage, 'copilot_usage');
    const nanoAiu = copilotUsage ? field(copilotUsage, 'total_nano_aiu') : undefined;
    if (nanoAiu !== undefined && nanoAiu !== null) metadata['copilot_nano_aiu'] = nanoAiu;
    const meteredCost = meteredCostUsd(usage);
    if (meteredCost !== undefined) {
      // GitHub's own metered value of this call in USD. Recorded even when
      // Openlayer prices the step, so the two figures can be compared.
      metadata['copilot_metered_cost_usd'] = meteredCost;
    }
    for (const key of ['finish_reason', 'api_endpoint', 'service_request_id', 'initiator']) {
      const value = field(usage, key);
      if (value !== undefined && value !== null) metadata[`copilot_${key}`] = value;
    }
    if (turn.reasoning && this.config.captureReasoning) metadata['reasoning'] = turn.reasoning;
    if (turn.error) metadata['error'] = turn.error;

    const details = usageDetails(usage);
    const total = Object.values(details).reduce((a, b) => a + b, 0);
    const name = turn.turnId !== undefined ? `turn ${turn.turnId}` : 'assistant turn';

    const [step, endStep] = _internalCreateStep(
      name,
      StepType.CHAT_COMPLETION,
      { prompt: [] },
      turn.output,
      metadata,
      turn.startTime ?? null,
      turn.endTime ?? null,
      this.config.inferencePipelineId,
    );
    const provider = providerForModel(turn.model);
    (step as any).log({
      model: turn.model ?? null,
      provider: provider ?? null,
      promptTokens: details['input_tokens'] ?? null,
      completionTokens: details['output_tokens'] ?? null,
      tokens: total || null,
      usageDetails: Object.keys(details).length ? details : null,
    });
    if (provider === undefined && meteredCost !== undefined) {
      // Without a provider Openlayer cannot price the step, and an unpriced
      // step reads as $0. GitHub's own metered figure is far better than
      // nothing, so a model we have no mapping for still lands costed.
      (step as any).log({ cost: meteredCost });
    }
    if (turn.endTime && turn.startTime) (step as any).log({ latency: turn.endTime - turn.startTime });
    endStep();
  }

  private emitTool(tool: ToolRecord, children: Map<string, Record_[]>): void {
    const metadata: Record<string, any> = {
      tool_call_id: tool.toolCallId,
      success: tool.success ?? null,
    };
    if (tool.error) metadata['error'] = tool.error;
    if (tool.mcpServerName) metadata['mcp_server_name'] = tool.mcpServerName;
    if (tool.permission) metadata['permission'] = tool.permission;

    let stepType = StepType.TOOL;
    let name = tool.name;
    if (tool.isSubagent) {
      stepType = StepType.AGENT;
      name = `subagent: ${tool.subagentName ?? 'unknown'}`;
      Object.assign(metadata, tool.subagentMetadata);
    }

    const [step, endStep] = _internalCreateStep(
      name,
      stepType,
      tool.arguments ?? null,
      truncate(tool.result, this.config.truncateToolOutputChars),
      metadata,
      tool.startTime ?? null,
      tool.endTime ?? null,
      this.config.inferencePipelineId,
    );
    if (tool.endTime && tool.startTime) (step as any).log({ latency: tool.endTime - tool.startTime });
    this.emit(children, tool.toolCallId);
    endStep();
  }
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

const OPENLAYER_HANDLER_FLAG = '__openlayerCopilotHandler';

/** True if `handler` was produced by {@link openlayerEventHandler}. */
function isOpenlayerHandler(handler: any): handler is OpenlayerEventHandler {
  return Boolean(handler && (handler as any)[OPENLAYER_HANDLER_FLAG]);
}

/** Run both handlers; neither may break the other. */
export function composeHandlers(
  userHandler: ((event: any) => void) | undefined,
  ourHandler: (event: any) => void,
): (event: any) => void {
  return (event: any) => {
    if (userHandler) {
      try {
        userHandler(event);
      } catch (err) {
        console.debug('Openlayer: user onEvent handler threw', err);
      }
    }
    ourHandler(event);
  };
}

/**
 * Return an `onEvent` handler that traces one Copilot session.
 *
 * @example
 * ```typescript
 * import { openlayerEventHandler } from "openlayer/lib/integrations/copilotSdk";
 * const session = await client.createSession({ onEvent: openlayerEventHandler() });
 * ```
 */
export interface OpenlayerEventHandler {
  (event: any): void;
  /** Publish any interaction that never reached `session.idle`. */
  flush(): void;
  /** The underlying collector, exposed for advanced use. */
  collector: CopilotTraceCollector;
}

export function openlayerEventHandler(config: Partial<CopilotConfig> = {}): OpenlayerEventHandler {
  const collector = new CopilotTraceCollector(config);
  const handler = ((event: any) => collector.handle(event)) as OpenlayerEventHandler;
  handler.flush = () => collector.flush();
  handler.collector = collector;
  (handler as any)[OPENLAYER_HANDLER_FLAG] = true;
  return handler;
}

/**
 * Flush any still-open interaction when the session is disconnected.
 *
 * `session.idle` is the normal trigger, but a session torn down mid-flight
 * never emits it and the buffered work would otherwise be dropped silently.
 * Flushing is idempotent: `buildAll` clears the buffer, so a disconnect after a
 * normal idle publishes nothing extra.
 */
function wrapDisconnect(session: any, collector: CopilotTraceCollector): void {
  const originalDisconnect = session?.disconnect;
  if (typeof originalDisconnect !== 'function') return;
  try {
    session.disconnect = async (...args: any[]) => {
      try {
        collector.flush();
      } catch (err) {
        console.debug('Openlayer: failed to flush on disconnect', err);
      }
      return originalDisconnect.apply(session, args);
    };
  } catch (err) {
    console.debug('Openlayer: could not wrap session.disconnect', err);
  }
}

let patched = false;
let originalCreateSession: ((...args: any[]) => any) | null = null;
let patchedClass: any = null;

/**
 * Patch an explicit `CopilotClient` class. Exposed as a testable seam so unit
 * tests need not have `@github/copilot-sdk` installed.
 */
export function traceCopilotOn(clientClass: any, config: Partial<CopilotConfig> = {}): void {
  if (patched) return;
  originalCreateSession = clientClass.prototype.createSession;
  patchedClass = clientClass;
  const original = originalCreateSession!;

  clientClass.prototype.createSession = async function (sessionConfig: any = {}) {
    const existing = sessionConfig?.onEvent;
    if (isOpenlayerHandler(existing)) {
      // The caller already passed an `openlayerEventHandler()`. Adding a second
      // collector would build the same interaction twice and publish duplicate
      // rows -- and mixing the two entry points is easy to do by following the
      // quickstart and then the "trace specific sessions" snippet. Defer to
      // theirs.
      const session = await original.call(this, sessionConfig);
      wrapDisconnect(session, existing.collector);
      return session;
    }
    const handler = openlayerEventHandler(config);
    const composed = composeHandlers(existing, handler);
    const session = await original.call(this, { ...sessionConfig, onEvent: composed });
    wrapDisconnect(session, handler.collector);
    return session;
  };
  patched = true;
}

/**
 * Enable Openlayer tracing for every GitHub Copilot SDK session.
 *
 * Patches `CopilotClient.prototype.createSession` so each session gets an
 * Openlayer event handler, composed with any `onEvent` the caller supplies.
 * Idempotent.
 *
 * Requires `@github/copilot-sdk >= 1.0.11` to be installed.
 *
 * @example
 * ```typescript
 * import { traceCopilot } from "openlayer/lib/integrations/copilotSdk";
 * traceCopilot();
 * ```
 */
export function traceCopilot(config: Partial<CopilotConfig> = {}): void {
  if (patched) return;
  let sdk: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = require('@github/copilot-sdk');
  } catch {
    throw new Error(
      '@github/copilot-sdk is required for Copilot SDK tracing. ' +
        'Install with: npm install @github/copilot-sdk',
    );
  }
  traceCopilotOn(sdk.CopilotClient, config);
}

/** Undo {@link traceCopilot}. Primarily for tests. */
export function untraceCopilot(): void {
  if (!patched || !patchedClass || !originalCreateSession) return;
  patchedClass.prototype.createSession = originalCreateSession;
  patched = false;
  patchedClass = null;
  originalCreateSession = null;
}
