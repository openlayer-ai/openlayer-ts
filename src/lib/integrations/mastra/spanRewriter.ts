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
 */
import { toGenAIMessages } from './genaiMessages';

/** OTel span attributes. Values must stay primitives on the wire. */
export type SpanAttributes = Record<string, any>;

const GEN_AI_INPUT_MESSAGES = 'gen_ai.input.messages';
const GEN_AI_OUTPUT_MESSAGES = 'gen_ai.output.messages';
const GEN_AI_TOOL_CALL_ARGUMENTS = 'gen_ai.tool.call.arguments';
const GEN_AI_TOOL_CALL_RESULT = 'gen_ai.tool.call.result';

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
 */
function liftIdentity(attributes: SpanAttributes): void {
  if (attributes[SESSION_ID] === undefined) {
    const sessionId = attributes[MASTRA_METADATA_SESSION_ID] ?? attributes[MASTRA_METADATA_THREAD_ID];
    if (typeof sessionId === 'string' && sessionId !== '') {
      attributes[SESSION_ID] = sessionId;
    }
  }

  if (attributes[USER_ID] === undefined) {
    const userId = attributes[MASTRA_METADATA_USER_ID];
    if (typeof userId === 'string' && userId !== '') {
      attributes[USER_ID] = userId;
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
  return rewritten;
}
