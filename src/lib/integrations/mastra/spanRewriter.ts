/**
 * Rewrites the OpenTelemetry span attributes produced by `@mastra/otel-exporter`
 * so Openlayer's OTLP ingest can read them.
 *
 * Mastra already emits GenAI semconv v1.38 — but it only sets
 * `gen_ai.input.messages` / `gen_ai.output.messages` on MODEL_GENERATION spans.
 * Every other span type, including the AGENT_RUN and WORKFLOW_RUN roots that
 * Openlayer builds a row's input and output from, carries its payload under
 * `mastra.<span_type>.input` / `.output`, which Openlayer files into step
 * metadata and never reads. Left alone, a Mastra trace lands with correct
 * hierarchy, cost, tokens and latency — and an empty input and output.
 *
 * Both `@mastra/arize` and `@mastra/langfuse` solve the same problem the same
 * way: scan for a `mastra.*` payload key, guarded on the gen_ai attributes
 * being absent. This is a capability guard rather than a span-type allowlist,
 * so it degrades gracefully as Mastra adds span types, and it yields the
 * required "leave model and tool spans alone" behaviour for free.
 *
 * A second, unrelated gap lives here too: some `gen_ai.provider.name` values
 * Mastra reports (e.g. `openai.responses`) don't match Openlayer's cost table
 * even though the underlying vendor is priced under a different slug. See
 * `normalizeProviderSlug` below.
 */
import { toGenAIMessages } from './genaiMessages';

/** OTel span attributes. Values must stay primitives on the wire. */
export type SpanAttributes = Record<string, any>;

const LOG_PREFIX = '[OpenlayerExporter]';

const GEN_AI_INPUT_MESSAGES = 'gen_ai.input.messages';
const GEN_AI_OUTPUT_MESSAGES = 'gen_ai.output.messages';
const GEN_AI_TOOL_CALL_ARGUMENTS = 'gen_ai.tool.call.arguments';
const GEN_AI_TOOL_CALL_RESULT = 'gen_ai.tool.call.result';

// `gen_ai.provider.name` is the current stable GenAI semconv attribute (and
// the one `@mastra/otel-exporter` 1.3.11 actually sets, confirmed by logging
// a live span's attributes); `gen_ai.system` is the OTel name it superseded.
// Both are checked because a producer's semconv version is not this
// exporter's to control.
const GEN_AI_PROVIDER_NAME = 'gen_ai.provider.name';
const GEN_AI_SYSTEM = 'gen_ai.system';

const SESSION_ID = 'session.id';
const USER_ID = 'user.id';

const MASTRA_PREFIX = 'mastra.';
const MASTRA_METADATA_PREFIX = 'mastra.metadata.';
const MASTRA_SPAN_TYPE = 'mastra.span.type';

const MASTRA_METADATA_SESSION_ID = 'mastra.metadata.sessionId';
const MASTRA_METADATA_THREAD_ID = 'mastra.metadata.threadId';
const MASTRA_METADATA_USER_ID = 'mastra.metadata.userId';

/**
 * Span types whose payload maps natively via `gen_ai.tool.call.*` and must
 * never be synthesized from `mastra.<type>.input` / `.output`. Today's
 * `@mastra/otel-exporter` only reaches the `mastra.*` fallback branch for
 * non-tool span types, so this guard is unreachable in practice — it exists
 * as defense in depth rather than to fix an observed failure, since the
 * "never rewrite tool spans" rule must not depend on a third-party package's
 * private branch structure holding across future Mastra versions.
 *
 * `client_tool_call` is deliberately absent from this set. Mastra's own tool
 * branch in `@mastra/otel-exporter` omits it too, so a `client_tool_call`
 * span never gets `gen_ai.tool.call.*` in the first place — it carries
 * `mastra.client_tool_call.input` / `.output` like any non-tool span. There is
 * nothing native to protect there, so the capability guard in
 * `recoverMessages` below already does the right thing for it unassisted.
 */
const TOOL_SPAN_TYPES = new Set(['tool_call', 'mcp_tool_call', 'provider_tool_call']);

/**
 * Find the `mastra.<span_type>.input` / `.output` key holding a span's payload.
 *
 * `mastra.metadata.` is excluded so a user's own metadata key that happens to
 * end in `.input` is never mistaken for span input. `@mastra/langfuse`'s
 * equivalent scan lacks this guard; `@mastra/arize` partitions the prefix off
 * separately for the same reason.
 */
function findMastraPayloadKey(attributes: SpanAttributes, suffix: '.input' | '.output'): string | undefined {
  for (const key of Object.keys(attributes)) {
    if (!key.startsWith(MASTRA_PREFIX)) continue;
    if (key.startsWith(MASTRA_METADATA_PREFIX)) continue;
    if (!key.endsWith(suffix)) continue;
    return key;
  }
  return undefined;
}

/** Fill in gen_ai messages for spans where Mastra did not emit them. */
function recoverMessages(attributes: SpanAttributes): void {
  // Tool spans map natively via gen_ai.tool.call.arguments / .result.
  // Synthesizing gen_ai.*.messages for them from mastra.<type>.input / .output
  // was measured to make the Openlayer step strictly worse, so they are
  // skipped outright rather than relying on the arguments/result attributes
  // always being present together.
  if (TOOL_SPAN_TYPES.has(String(attributes[MASTRA_SPAN_TYPE] ?? ''))) {
    return;
  }

  if (!attributes[GEN_AI_INPUT_MESSAGES] && !attributes[GEN_AI_TOOL_CALL_ARGUMENTS]) {
    const key = findMastraPayloadKey(attributes, '.input');
    if (key !== undefined) {
      const messages = toGenAIMessages(attributes[key], 'user');
      if (messages) {
        attributes[GEN_AI_INPUT_MESSAGES] = JSON.stringify(messages);
      }
    }
  }

  if (!attributes[GEN_AI_OUTPUT_MESSAGES] && !attributes[GEN_AI_TOOL_CALL_RESULT]) {
    const key = findMastraPayloadKey(attributes, '.output');
    if (key !== undefined) {
      const messages = toGenAIMessages(attributes[key], 'assistant', 'stop');
      if (messages) {
        attributes[GEN_AI_OUTPUT_MESSAGES] = JSON.stringify(messages);
      }
    }
  }
}

/**
 * Lift Mastra's session and user metadata to the attributes Openlayer reads.
 *
 * `session.id` and `user.id` were verified against the live endpoint;
 * `gen_ai.conversation.id` fills the session but not the user, and
 * `openlayer.session_id` is ignored entirely. These happen to be the exact
 * names `@mastra/langfuse` already emits.
 *
 * Source attributes are deliberately kept — Openlayer preserves them into step
 * metadata, and deleting them (as Langfuse does) would lose information.
 *
 * Both ids accept `string | number`, not just `string`. `SpanConverter.convertSpan`
 * (`@mastra/otel-exporter`) copies `span.metadata` onto attributes verbatim except
 * for objects, which it JSON-stringifies first — so a numeric database id such as
 * `metadata: { userId: 4821 }` arrives here as a genuine `number`, and an
 * object-valued id arrives already stringified (handled by the `string` branch, no
 * special case needed). A `string`-only guard would silently drop the numeric case
 * and leave `user.id` unset.
 */
function liftIdentity(attributes: SpanAttributes): void {
  if (attributes[SESSION_ID] === undefined) {
    const sessionId = attributes[MASTRA_METADATA_SESSION_ID] ?? attributes[MASTRA_METADATA_THREAD_ID];
    if (typeof sessionId === 'number' || (typeof sessionId === 'string' && sessionId !== '')) {
      attributes[SESSION_ID] = String(sessionId);
    }
  }

  if (attributes[USER_ID] === undefined) {
    const userId = attributes[MASTRA_METADATA_USER_ID];
    if (typeof userId === 'number' || (typeof userId === 'string' && userId !== '')) {
      attributes[USER_ID] = String(userId);
    }
  }
}

/**
 * Openlayer's cost lookup (`llm-costs.openlayer.com`) is an exact, lowercased
 * `(provider, model)` match against its cost table, with no server-side
 * aliasing — an unrecognized provider slug silently yields a missing/zero
 * cost, never an error. Mastra (via the AI SDK) reports dotted,
 * API-shape-specific provider slugs — e.g. `openai.responses` for OpenAI's
 * Responses API — that don't match Openlayer's table, even though the bare
 * vendor slug (`openai`) does. `@mastra/otel-exporter`'s own provider
 * normalization does not catch these either: it strips punctuation before
 * comparing (`openai.responses` -> `openairesponses`), which never matches
 * its own `openai` alias, so the dotted slug passes through unchanged.
 *
 * Every key here was verified individually against
 * `https://llm-costs.openlayer.com/v1/costs/<provider>/<model>` before being
 * added: the source slug 404s, the target slug prices. Never add an entry you
 * have not confirmed this way — a wrong alias produces a wrong cost, which is
 * worse than the missing cost it would replace.
 */
const PROVIDER_SLUG_ALIASES: Record<string, string> = {
  'openai.responses': 'openai',
  'openai.chat': 'openai',
  'anthropic.messages': 'anthropic',
  'google.generative-ai': 'gemini',
};

/**
 * Rewrite a known non-canonical provider slug to the one Openlayer's cost
 * table uses. A slug not in {@link PROVIDER_SLUG_ALIASES} is left untouched —
 * guessing a mapping is not an option here, only a verified one.
 *
 * A dotted slug that isn't in the table is exactly the failure this module
 * exists to prevent — it will silently price at zero — so it gets a one-line
 * `console.debug` naming the slug, matching this repo's existing convention
 * (see `src/lib/tracing/tracer.ts`). Bare slugs like `openai` never match
 * `.includes('.')` and so never log; mapped dotted slugs are rewritten above
 * and never reach this branch.
 */
function normalizeProviderSlug(attributes: SpanAttributes): void {
  for (const key of [GEN_AI_PROVIDER_NAME, GEN_AI_SYSTEM]) {
    const value = attributes[key];
    if (typeof value !== 'string') continue;

    if (Object.prototype.hasOwnProperty.call(PROVIDER_SLUG_ALIASES, value)) {
      attributes[key] = PROVIDER_SLUG_ALIASES[value];
    } else if (value.includes('.')) {
      console.debug(
        `${LOG_PREFIX} Unmapped provider slug "${value}" on ${key} — cost will be zero for it. ` +
          'Add a verified entry to PROVIDER_SLUG_ALIASES in spanRewriter.ts if this vendor prices under a bare slug.',
      );
    }
  }
}

/**
 * Apply every Openlayer rewrite rule to a span's attributes.
 *
 * Returns a new object; the input is not mutated.
 */
export function rewriteSpanAttributes(attributes: SpanAttributes): SpanAttributes {
  const rewritten: SpanAttributes = { ...attributes };
  recoverMessages(rewritten);
  liftIdentity(rewritten);
  normalizeProviderSlug(rewritten);
  return rewritten;
}
