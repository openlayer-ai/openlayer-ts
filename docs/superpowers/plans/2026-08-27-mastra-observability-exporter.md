# Mastra Observability Exporter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `OpenlayerExporter`, a Mastra observability exporter that sends agent, workflow, model, and tool traces to Openlayer, exposed as the `openlayer/integrations/mastra` subpath export.

**Architecture:** `OpenlayerExporter extends OtelExporter` (from `@mastra/otel-exporter`), configured with a `custom` OTLP provider pointing at Openlayer and an injected `SpanExporter` subclass that rewrites span attributes in `export()` before they hit the wire. This mirrors how `@mastra/arize` injects `OpenInferenceOTLPTraceExporter`. Mastra already emits OTel GenAI semconv v1.38, which is exactly what Openlayer's ingest reads — so the exporter is a *gap-filler*, not a translator. The only gap: Mastra puts `gen_ai.input.messages` / `gen_ai.output.messages` on `MODEL_GENERATION` spans only, while Openlayer builds a row's input and output from the **root** span, which carries `mastra.<type>.input` / `.output` instead.

**Tech Stack:** TypeScript 5.8, Jest + `@swc/jest`, `@mastra/core` / `@mastra/otel-exporter` / `@opentelemetry/exporter-trace-otlp-proto` as optional peer dependencies.

**Spec:** `docs/superpowers/specs/2026-08-27-mastra-observability-integration-design.md` — read it before starting. Every mapping rule below was verified against the live Openlayer OTLP endpoint; the spec records what was measured and what was ruled out.

## Global Constraints

- **Protocol is `http/protobuf` and is not configurable.** Openlayer's OTLP endpoint returns `400 Failed to parse OpenTelemetry protobuf data` for an OTLP/JSON body regardless of `Content-Type`.
- **Default endpoint:** `https://api.openlayer.com/v1/otel/v1/traces`.
- **Required headers:** `Authorization: Bearer <apiKey>` and `x-bt-parent: pipeline_id:<inferencePipelineId>`.
- **Environment variables:** `OPENLAYER_API_KEY`, `OPENLAYER_INFERENCE_PIPELINE_ID`, `OPENLAYER_OTEL_ENDPOINT` (optional).
- **Openlayer reads only `gen_ai.input.messages` / `gen_ai.output.messages`** in semconv v1.38 `parts` shape for row I/O. OpenInference, traceloop, gen_ai span events, and `gen_ai.prompt`/`gen_ai.completion` were all measured to produce empty I/O. Do not add them.
- **Never rewrite tool spans.** `gen_ai.tool.call.arguments` / `.result` map natively; adding `gen_ai.input.messages` to a tool span does not populate `inputs`.
- **Never overwrite an existing `gen_ai.*.messages` attribute.**
- **OTel attribute values must be primitives.** Message arrays are written as JSON strings, never as objects.
- **A misconfigured exporter must never throw.** Missing credentials → `setDisabled(reason)` and a no-op exporter.
- **Do not add `export * from './mastra'` to `src/lib/integrations/index.ts`.** That barrel is reachable from the root entry point; re-exporting would force the optional Mastra peers to resolve for every consumer of `openlayer`.
- **New dependencies go in `peerDependencies` (optional) + `devDependencies` only.** Nothing is added to `dependencies`.
- Existing repo conventions: 2-space indent, single quotes, semicolons, `process.env['KEY']` bracket access (required by `noPropertyAccessFromIndexSignature`), and live tests in `tests/integrations/*.live.test.ts` gated on an env var.
- **Corrected during execution — public import path.** This plan's code snippets below (e.g. the Goal line and the `import { OpenlayerExporter } from 'openlayer/integrations/mastra'` examples) show the subpath as originally dispatched, but the shipped path is `openlayer/lib/integrations/mastra`. The build regenerates `dist/package.json`'s `exports` map from a directory scan and discards a hand-authored `./integrations/mastra` subpath, so the snippets below are superseded by this line, not by editing them — this plan is a historical record of what was actually dispatched to implementers and is left as-is. See `README.md`, `examples/mastra-tracing.ts`, and `src/lib/integrations/mastra/index.ts` for the correct, shipped path.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/integrations/mastra/genaiMessages.ts` | **Create.** Pure. Coerce any Mastra input/output value into semconv v1.38 message arrays. No imports. |
| `src/lib/integrations/mastra/spanRewriter.ts` | **Create.** Pure. Attributes in → attributes out. Holds every mapping rule. Imports only `genaiMessages`. |
| `src/lib/integrations/mastra/otlpExporter.ts` | **Create.** `OpenlayerOTLPTraceExporter extends OTLPTraceExporter`; applies the rewriter in `export()`. |
| `src/lib/integrations/mastra/index.ts` | **Create.** `OpenlayerExporter extends OtelExporter`, config resolution, public types and re-exports. |
| `tests/integrations/mastraGenaiMessages.test.ts` | **Create.** Unit tests for message coercion. |
| `tests/integrations/mastraSpanRewriter.test.ts` | **Create.** Unit tests for the rewrite rules, including the negative cases. |
| `tests/integrations/mastraExporter.test.ts` | **Create.** Config resolution, header construction, span-type filtering, `export()` delegation. |
| `tests/integrations/mastraExporter.live.test.ts` | **Create.** Live end-to-end against a real pipeline, gated on `OPENLAYER_API_KEY`. |
| `examples/mastra-tracing.ts` | **Create.** Runnable agent + workflow example. |
| `package.json` | **Modify.** Add the `./integrations/mastra` export, optional peers, devDependencies. |
| `README.md` | **Modify.** Add the Mastra integration section. |

The two pure modules carry all the behaviour worth testing and need no network, no OTel runtime, and no Mastra runtime — which is why they come first and why their tasks have no dependency-install step.

---

### Task 1: GenAI message coercion

**Files:**
- Create: `src/lib/integrations/mastra/genaiMessages.ts`
- Test: `tests/integrations/mastraGenaiMessages.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface GenAITextPart { type: 'text'; content: string }`
  - `interface GenAIMessage { role: string; parts: GenAITextPart[]; finish_reason?: string }`
  - `function toGenAIMessages(value: unknown, defaultRole: string, finishReason?: string): GenAIMessage[] | undefined`

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/mastraGenaiMessages.test.ts`:

```ts
/**
 * Unit tests for the Mastra → GenAI semconv v1.38 message coercion.
 *
 * Openlayer's OTLP ingest builds a row's input and output only from
 * `gen_ai.input.messages` / `gen_ai.output.messages` in the `parts` shape
 * produced here, so these cases pin the exact wire format.
 */
import { toGenAIMessages } from '../../src/lib/integrations/mastra/genaiMessages';

describe('toGenAIMessages', () => {
  it('wraps a bare string in a single message using the default role', () => {
    expect(toGenAIMessages('what is 2+2?', 'user')).toEqual([
      { role: 'user', parts: [{ type: 'text', content: 'what is 2+2?' }] },
    ]);
  });

  it('maps an array of {role, content} messages one-to-one', () => {
    const input = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'hi' },
    ];
    expect(toGenAIMessages(input, 'user')).toEqual([
      { role: 'system', parts: [{ type: 'text', content: 'You are helpful.' }] },
      { role: 'user', parts: [{ type: 'text', content: 'hi' }] },
    ]);
  });

  it('JSON-stringifies non-string content', () => {
    expect(toGenAIMessages([{ role: 'user', content: { city: 'Lisbon' } }], 'user')).toEqual([
      { role: 'user', parts: [{ type: 'text', content: '{"city":"Lisbon"}' }] },
    ]);
  });

  it('passes through messages already in the parts shape', () => {
    const input = [{ role: 'assistant', parts: [{ type: 'text', content: '4' }] }];
    expect(toGenAIMessages(input, 'assistant')).toEqual(input);
  });

  it('parses a pre-serialized JSON string before coercing', () => {
    const raw = JSON.stringify([{ role: 'user', content: 'hello' }]);
    expect(toGenAIMessages(raw, 'user')).toEqual([
      { role: 'user', parts: [{ type: 'text', content: 'hello' }] },
    ]);
  });

  it('treats a non-JSON string that merely starts with a brace as literal text', () => {
    expect(toGenAIMessages('{not json', 'user')).toEqual([
      { role: 'user', parts: [{ type: 'text', content: '{not json' }] },
    ]);
  });

  it('wraps a plain object with no role as a single stringified message', () => {
    expect(toGenAIMessages({ text: '4' }, 'assistant')).toEqual([
      { role: 'assistant', parts: [{ type: 'text', content: '{"text":"4"}' }] },
    ]);
  });

  it('keeps the role of a single message-like object', () => {
    expect(toGenAIMessages({ role: 'tool', content: 'sunny' }, 'assistant')).toEqual([
      { role: 'tool', parts: [{ type: 'text', content: 'sunny' }] },
    ]);
  });

  it('applies the supplied finish_reason only when the entry has none', () => {
    expect(toGenAIMessages([{ role: 'assistant', content: 'done' }], 'assistant', 'stop')).toEqual([
      { role: 'assistant', parts: [{ type: 'text', content: 'done' }], finish_reason: 'stop' },
    ]);
    expect(
      toGenAIMessages([{ role: 'assistant', content: 'x', finish_reason: 'length' }], 'assistant', 'stop'),
    ).toEqual([
      { role: 'assistant', parts: [{ type: 'text', content: 'x' }], finish_reason: 'length' },
    ]);
  });

  it('degrades to a placeholder instead of throwing on a circular reference', () => {
    const circular: Record<string, unknown> = { role: 'user' };
    circular['self'] = circular;
    const result = toGenAIMessages([{ role: 'user', content: circular }], 'user');
    expect(result).toEqual([
      { role: 'user', parts: [{ type: 'text', content: '[unserializable]' }] },
    ]);
  });

  it('returns undefined for empty, null and undefined values', () => {
    expect(toGenAIMessages(undefined, 'user')).toBeUndefined();
    expect(toGenAIMessages(null, 'user')).toBeUndefined();
    expect(toGenAIMessages('', 'user')).toBeUndefined();
    expect(toGenAIMessages([], 'user')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/integrations/mastraGenaiMessages.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/integrations/mastra/genaiMessages'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/integrations/mastra/genaiMessages.ts`:

```ts
/**
 * Coercion of arbitrary Mastra span input/output values into OpenTelemetry
 * GenAI semantic-convention v1.38 message arrays.
 *
 * Openlayer's OTLP ingest builds a row's input and output *only* from
 * `gen_ai.input.messages` / `gen_ai.output.messages` in this shape. Every
 * other convention that was tested — OpenInference `input.value`, traceloop
 * `traceloop.entity.input`, gen_ai span events, `gen_ai.prompt` — produced an
 * empty row. This module is therefore what makes a Mastra trace legible to
 * Openlayer at all.
 */

/** A single content part of a GenAI message. Only text parts are produced. */
export interface GenAITextPart {
  type: 'text';
  content: string;
}

/** A GenAI semconv v1.38 message. */
export interface GenAIMessage {
  role: string;
  parts: GenAITextPart[];
  finish_reason?: string;
}

const UNSERIALIZABLE = '[unserializable]';

/**
 * JSON.stringify that degrades instead of throwing. A throw inside the
 * exporter's `export()` would drop the whole batch, so nothing in this module
 * is allowed to raise.
 */
function safeStringify(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return UNSERIALIZABLE;
  }
}

function textMessage(role: string, content: string, finishReason?: string): GenAIMessage {
  const message: GenAIMessage = { role, parts: [{ type: 'text', content }] };
  if (finishReason) {
    message.finish_reason = finishReason;
  }
  return message;
}

/**
 * Mastra stringifies span input/output before setting the attribute, so a
 * value arriving here is often JSON in a string. Parse it when it plausibly
 * is, and fall back to treating it as literal text when it is not.
 */
function maybeParseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (content === undefined || content === null) {
    return '';
  }
  return safeStringify(content);
}

function coerceEntry(entry: unknown, defaultRole: string, finishReason?: string): GenAIMessage {
  if (typeof entry === 'string') {
    return textMessage(defaultRole, entry, finishReason);
  }
  if (entry === null || typeof entry !== 'object') {
    return textMessage(defaultRole, String(entry), finishReason);
  }

  const record = entry as Record<string, unknown>;
  const role = typeof record['role'] === 'string' ? record['role'] : defaultRole;
  const existingFinishReason = record['finish_reason'];
  const resolvedFinishReason =
    typeof existingFinishReason === 'string' ? existingFinishReason : finishReason;

  // Already in the v1.38 `parts` shape — pass it through untouched.
  if (Array.isArray(record['parts'])) {
    const message: GenAIMessage = { role, parts: record['parts'] as GenAITextPart[] };
    if (resolvedFinishReason) {
      message.finish_reason = resolvedFinishReason;
    }
    return message;
  }

  return textMessage(role, contentToText(record['content']), resolvedFinishReason);
}

/**
 * Coerce a Mastra span input/output value into GenAI v1.38 messages.
 *
 * @param value        Whatever Mastra put on the span.
 * @param defaultRole  Role for content that carries none — 'user' for input,
 *                     'assistant' for output.
 * @param finishReason Applied only to entries that do not specify their own.
 * @returns            The messages, or `undefined` when there is nothing to
 *                     report — callers must not write the attribute then.
 */
export function toGenAIMessages(
  value: unknown,
  defaultRole: string,
  finishReason?: string,
): GenAIMessage[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = maybeParseJson(value);

  if (typeof parsed === 'string') {
    return parsed === '' ? undefined : [textMessage(defaultRole, parsed, finishReason)];
  }

  if (Array.isArray(parsed)) {
    return parsed.length === 0
      ? undefined
      : parsed.map((entry) => coerceEntry(entry, defaultRole, finishReason));
  }

  if (typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (typeof record['role'] === 'string') {
      return [coerceEntry(record, defaultRole, finishReason)];
    }
    return [textMessage(defaultRole, safeStringify(parsed), finishReason)];
  }

  return [textMessage(defaultRole, String(parsed), finishReason)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/integrations/mastraGenaiMessages.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Lint**

Run: `npx eslint src/lib/integrations/mastra/genaiMessages.ts tests/integrations/mastraGenaiMessages.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/integrations/mastra/genaiMessages.ts tests/integrations/mastraGenaiMessages.test.ts
git commit -m "feat(mastra): add GenAI semconv v1.38 message coercion"
```

---

### Task 2: Span attribute rewriter

**Files:**
- Create: `src/lib/integrations/mastra/spanRewriter.ts`
- Test: `tests/integrations/mastraSpanRewriter.test.ts`

**Interfaces:**
- Consumes: `toGenAIMessages` from Task 1.
- Produces:
  - `type SpanAttributes = Record<string, any>`
  - `function rewriteSpanAttributes(attributes: SpanAttributes): SpanAttributes` — returns a **new** object; does not mutate its argument.

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/mastraSpanRewriter.test.ts`:

```ts
/**
 * Unit tests for the Mastra span attribute rewriter.
 *
 * The rules encoded here were established by probing the live Openlayer OTLP
 * endpoint; see the design spec for the measurements. The negative cases
 * matter as much as the positive ones — rewriting a tool span makes its
 * Openlayer step strictly worse.
 */
import { rewriteSpanAttributes } from '../../src/lib/integrations/mastra/spanRewriter';

describe('rewriteSpanAttributes', () => {
  it('recovers root agent_run input and output into gen_ai messages', () => {
    const result = rewriteSpanAttributes({
      'mastra.span.type': 'agent_run',
      'mastra.agent_run.input': JSON.stringify([{ role: 'user', content: 'what is 2+2?' }]),
      'mastra.agent_run.output': JSON.stringify({ text: '4' }),
    });

    expect(JSON.parse(result['gen_ai.input.messages'])).toEqual([
      { role: 'user', parts: [{ type: 'text', content: 'what is 2+2?' }] },
    ]);
    expect(JSON.parse(result['gen_ai.output.messages'])).toEqual([
      { role: 'assistant', parts: [{ type: 'text', content: '{"text":"4"}' }], finish_reason: 'stop' },
    ]);
  });

  it('recovers workflow_run spans the same way', () => {
    const result = rewriteSpanAttributes({
      'mastra.span.type': 'workflow_run',
      'mastra.workflow_run.input': 'run the weather flow',
    });
    expect(JSON.parse(result['gen_ai.input.messages'])).toEqual([
      { role: 'user', parts: [{ type: 'text', content: 'run the weather flow' }] },
    ]);
  });

  it('leaves model spans untouched — Mastra already emits gen_ai messages', () => {
    const original = JSON.stringify([{ role: 'user', parts: [{ type: 'text', content: 'hi' }] }]);
    const result = rewriteSpanAttributes({
      'mastra.span.type': 'model_generation',
      'gen_ai.input.messages': original,
      'mastra.model_generation.input': 'SHOULD NOT BE USED',
    });
    expect(result['gen_ai.input.messages']).toBe(original);
  });

  it('leaves tool spans untouched — gen_ai.tool.call.* maps natively', () => {
    const result = rewriteSpanAttributes({
      'mastra.span.type': 'tool_call',
      'gen_ai.tool.call.arguments': '{"city":"Lisbon"}',
      'gen_ai.tool.call.result': '{"tempC":24}',
      'mastra.tool_call.input': 'SHOULD NOT BE USED',
      'mastra.tool_call.output': 'SHOULD NOT BE USED',
    });
    expect(result['gen_ai.input.messages']).toBeUndefined();
    expect(result['gen_ai.output.messages']).toBeUndefined();
  });

  it('does not mistake a user metadata key ending in .input for span input', () => {
    const result = rewriteSpanAttributes({
      'mastra.span.type': 'agent_run',
      'mastra.metadata.formConfig.input': 'a user metadata value',
    });
    expect(result['gen_ai.input.messages']).toBeUndefined();
  });

  it('lifts sessionId and userId into session.id and user.id', () => {
    const result = rewriteSpanAttributes({
      'mastra.metadata.sessionId': 'sess-1',
      'mastra.metadata.userId': 'user-1',
    });
    expect(result['session.id']).toBe('sess-1');
    expect(result['user.id']).toBe('user-1');
  });

  it('falls back to threadId for the session and prefers sessionId when both exist', () => {
    expect(rewriteSpanAttributes({ 'mastra.metadata.threadId': 'thread-1' })['session.id']).toBe(
      'thread-1',
    );
    expect(
      rewriteSpanAttributes({
        'mastra.metadata.sessionId': 'sess-1',
        'mastra.metadata.threadId': 'thread-1',
      })['session.id'],
    ).toBe('sess-1');
  });

  it('never overwrites an existing session.id or user.id', () => {
    const result = rewriteSpanAttributes({
      'session.id': 'already-set',
      'user.id': 'already-set-user',
      'mastra.metadata.sessionId': 'sess-1',
      'mastra.metadata.userId': 'user-1',
    });
    expect(result['session.id']).toBe('already-set');
    expect(result['user.id']).toBe('already-set-user');
  });

  it('preserves the original mastra attributes so they still reach step metadata', () => {
    const result = rewriteSpanAttributes({
      'mastra.span.type': 'agent_run',
      'mastra.agent_run.input': 'hello',
      'mastra.metadata.tenant': 'acme',
      'mastra.tags': ['alpha'],
    });
    expect(result['mastra.agent_run.input']).toBe('hello');
    expect(result['mastra.metadata.tenant']).toBe('acme');
    expect(result['mastra.tags']).toEqual(['alpha']);
  });

  it('does not mutate the attributes object it is given', () => {
    const input = { 'mastra.span.type': 'agent_run', 'mastra.agent_run.input': 'hello' };
    const snapshot = { ...input };
    rewriteSpanAttributes(input);
    expect(input).toEqual(snapshot);
  });

  it('writes nothing when there is no payload to recover', () => {
    const result = rewriteSpanAttributes({ 'mastra.span.type': 'generic' });
    expect(result['gen_ai.input.messages']).toBeUndefined();
    expect(result['gen_ai.output.messages']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/integrations/mastraSpanRewriter.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/integrations/mastra/spanRewriter'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/integrations/mastra/spanRewriter.ts`:

```ts
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

const MASTRA_METADATA_SESSION_ID = 'mastra.metadata.sessionId';
const MASTRA_METADATA_THREAD_ID = 'mastra.metadata.threadId';
const MASTRA_METADATA_USER_ID = 'mastra.metadata.userId';

/**
 * Find the `mastra.<span_type>.input` / `.output` key holding a span's payload.
 *
 * `mastra.metadata.` is excluded so a user's own metadata key that happens to
 * end in `.input` is never mistaken for span input. `@mastra/langfuse`'s
 * equivalent scan lacks this guard; `@mastra/arize` partitions the prefix off
 * separately for the same reason.
 */
function findMastraPayloadKey(
  attributes: SpanAttributes,
  suffix: '.input' | '.output',
): string | undefined {
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
    const sessionId =
      attributes[MASTRA_METADATA_SESSION_ID] ?? attributes[MASTRA_METADATA_THREAD_ID];
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/integrations/mastraSpanRewriter.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run both unit suites together**

Run: `npx jest tests/integrations/mastraGenaiMessages.test.ts tests/integrations/mastraSpanRewriter.test.ts`
Expected: PASS, 22 tests.

- [ ] **Step 6: Lint**

Run: `npx eslint src/lib/integrations/mastra tests/integrations/mastraSpanRewriter.test.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/integrations/mastra/spanRewriter.ts tests/integrations/mastraSpanRewriter.test.ts
git commit -m "feat(mastra): add span attribute rewriter for Openlayer OTLP ingest"
```

---

### Task 3: Dependencies and the OTLP span exporter

**Files:**
- Modify: `package.json` (devDependencies, peerDependencies, peerDependenciesMeta, exports)
- Create: `src/lib/integrations/mastra/otlpExporter.ts`

**Interfaces:**
- Consumes: `rewriteSpanAttributes` from Task 2.
- Produces: `class OpenlayerOTLPTraceExporter extends OTLPTraceExporter` — constructed as `new OpenlayerOTLPTraceExporter({ url, headers })`.

- [ ] **Step 1: Add the dependencies**

Run:

```bash
yarn add --dev @mastra/core@^1.63.0 @mastra/otel-exporter@^1.3.11 @opentelemetry/exporter-trace-otlp-proto@^0.221.0
```

`@mastra/otel-exporter` carries the rest of the OTel SDK tree as real dependencies, and its protocol-specific exporters are optional peers — so these three are the minimum set.

- [ ] **Step 2: Declare them as optional peers and add the subpath export**

Edit `package.json`. Add to `peerDependencies`:

```json
"@mastra/core": ">=1.16.0 <2",
"@mastra/otel-exporter": ">=1.3.0 <2",
"@opentelemetry/exporter-trace-otlp-proto": ">=0.200.0 <1"
```

Add to `peerDependenciesMeta`:

```json
"@mastra/core": { "optional": true },
"@mastra/otel-exporter": { "optional": true },
"@opentelemetry/exporter-trace-otlp-proto": { "optional": true }
```

Add to `exports`, immediately after the `./integrations/claude-agent-sdk` entry:

```json
"./integrations/mastra": {
  "import": "./dist/lib/integrations/mastra/index.mjs",
  "require": "./dist/lib/integrations/mastra/index.js",
  "types": "./dist/lib/integrations/mastra/index.d.ts"
},
```

Do **not** add anything to `dependencies`.

- [ ] **Step 3: Write the failing test**

Append to `tests/integrations/mastraSpanRewriter.test.ts`:

```ts
describe('OpenlayerOTLPTraceExporter', () => {
  it('rewrites span attributes before delegating to the OTLP exporter', () => {
    // Required lazily so the suite above still runs if the optional peers are absent.
    const {
      OpenlayerOTLPTraceExporter,
    } = require('../../src/lib/integrations/mastra/otlpExporter');
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-proto');

    const superExport = jest
      .spyOn(OTLPTraceExporter.prototype, 'export')
      .mockImplementation(() => undefined);

    const exporter = new OpenlayerOTLPTraceExporter({ url: 'https://example.invalid/v1/traces' });
    const span = {
      attributes: {
        'mastra.span.type': 'agent_run',
        'mastra.agent_run.input': 'hello',
      },
    };

    exporter.export([span] as any, () => undefined);

    expect(superExport).toHaveBeenCalledTimes(1);
    const forwarded = superExport.mock.calls[0]![0] as any[];
    expect(JSON.parse(forwarded[0].attributes['gen_ai.input.messages'])).toEqual([
      { role: 'user', parts: [{ type: 'text', content: 'hello' }] },
    ]);

    superExport.mockRestore();
  });

  it('exports the span unchanged rather than dropping the batch if rewriting throws', () => {
    const {
      OpenlayerOTLPTraceExporter,
    } = require('../../src/lib/integrations/mastra/otlpExporter');
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-proto');

    const superExport = jest
      .spyOn(OTLPTraceExporter.prototype, 'export')
      .mockImplementation(() => undefined);

    const exporter = new OpenlayerOTLPTraceExporter({ url: 'https://example.invalid/v1/traces' });
    // A getter that throws simulates a hostile span object.
    const span = {
      get attributes(): Record<string, unknown> {
        throw new Error('boom');
      },
    };

    expect(() => exporter.export([span] as any, () => undefined)).not.toThrow();
    expect(superExport).toHaveBeenCalledTimes(1);

    superExport.mockRestore();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest tests/integrations/mastraSpanRewriter.test.ts -t 'OpenlayerOTLPTraceExporter'`
Expected: FAIL — `Cannot find module '../../src/lib/integrations/mastra/otlpExporter'`.

- [ ] **Step 5: Write the implementation**

Create `src/lib/integrations/mastra/otlpExporter.ts`:

```ts
/**
 * OTLP/protobuf trace exporter that applies Openlayer's attribute rewrites on
 * the way out.
 *
 * Structurally identical to `@mastra/arize`'s `OpenInferenceOTLPTraceExporter`:
 * the vendor-specific mapping belongs in `export()`, because the attribute key
 * a payload lands under is chosen inside `@mastra/otel-exporter`'s
 * `getAttributes()` from the span's type. Mastra's `customSpanFormatter` hook
 * runs earlier and cannot change that decision.
 *
 * Protobuf is not a preference: Openlayer's OTLP endpoint rejects an OTLP/JSON
 * body with `400 Failed to parse OpenTelemetry protobuf data` whatever the
 * Content-Type says.
 */
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

import { rewriteSpanAttributes } from './spanRewriter';

export class OpenlayerOTLPTraceExporter extends OTLPTraceExporter {
  override export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    for (const span of spans) {
      try {
        // ReadableSpan.attributes is readonly by type but mutable in practice;
        // this is the same in-place rewrite @mastra/arize performs.
        (span as { attributes: Record<string, unknown> }).attributes = rewriteSpanAttributes(
          span.attributes,
        );
      } catch {
        // A rewrite failure must never cost us the batch — export unchanged.
      }
    }

    super.export(spans, resultCallback);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest tests/integrations/mastraSpanRewriter.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 7: Verify the package still builds and type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json yarn.lock src/lib/integrations/mastra/otlpExporter.ts tests/integrations/mastraSpanRewriter.test.ts
git commit -m "feat(mastra): add Openlayer OTLP trace exporter and optional peer deps"
```

---

### Task 4: The OpenlayerExporter

**Files:**
- Create: `src/lib/integrations/mastra/index.ts`
- Test: `tests/integrations/mastraExporter.test.ts`

**Interfaces:**
- Consumes: `OpenlayerOTLPTraceExporter` from Task 3.
- Produces:
  - `const OPENLAYER_OTLP_ENDPOINT = 'https://api.openlayer.com/v1/otel/v1/traces'`
  - `interface OpenlayerExporterConfig`
  - `class OpenlayerExporter extends OtelExporter` with `name = 'openlayer'`
  - Re-exports `toGenAIMessages`, `GenAIMessage`, `rewriteSpanAttributes`, `OpenlayerOTLPTraceExporter`

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/mastraExporter.test.ts`:

```ts
/**
 * Tests for the Mastra `OpenlayerExporter`.
 *
 * These never reach the network: the exporter is constructed and inspected,
 * and the span-type filter is driven through the protected
 * `_exportTracingEvent` hook with `super` stubbed out.
 */
import { SpanType, TracingEventType } from '@mastra/core/observability';

import {
  OPENLAYER_OTLP_ENDPOINT,
  OpenlayerExporter,
} from '../../src/lib/integrations/mastra';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  delete process.env['OPENLAYER_API_KEY'];
  delete process.env['OPENLAYER_INFERENCE_PIPELINE_ID'];
  delete process.env['OPENLAYER_OTEL_ENDPOINT'];
}

/** Reach the resolved OTLP url/headers the exporter handed to its span exporter. */
function exporterConfig(exporter: OpenlayerExporter): { url?: string; headers?: any } {
  const injected = (exporter as any).config?.exporter;
  return { url: injected?._transport?._parameters?.url, headers: injected?._transport?._parameters?.headers };
}

describe('OpenlayerExporter', () => {
  beforeEach(resetEnv);
  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('configures itself from environment variables alone', () => {
    process.env['OPENLAYER_API_KEY'] = 'sk-ol-env';
    process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] = 'pipeline-env';

    const exporter = new OpenlayerExporter();

    expect(exporter.isDisabled).toBe(false);
    expect(exporter.name).toBe('openlayer');
  });

  it('accepts explicit configuration with no environment set', () => {
    const exporter = new OpenlayerExporter({
      apiKey: 'sk-ol-explicit',
      inferencePipelineId: 'pipeline-explicit',
    });
    expect(exporter.isDisabled).toBe(false);
  });

  it('prefers explicit configuration over the environment', () => {
    process.env['OPENLAYER_API_KEY'] = 'sk-ol-env';
    process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] = 'pipeline-env';

    const exporter = new OpenlayerExporter({
      apiKey: 'sk-ol-explicit',
      inferencePipelineId: 'pipeline-explicit',
    });

    const { headers } = exporterConfig(exporter);
    expect(headers?.['Authorization']).toBe('Bearer sk-ol-explicit');
    expect(headers?.['x-bt-parent']).toBe('pipeline_id:pipeline-explicit');
  });

  it('builds the Openlayer auth headers and defaults the endpoint', () => {
    const exporter = new OpenlayerExporter({ apiKey: 'sk-ol', inferencePipelineId: 'pipe-1' });
    const { url, headers } = exporterConfig(exporter);

    expect(url).toBe(OPENLAYER_OTLP_ENDPOINT);
    expect(headers?.['Authorization']).toBe('Bearer sk-ol');
    expect(headers?.['x-bt-parent']).toBe('pipeline_id:pipe-1');
  });

  it('honours a custom endpoint and merges user headers', () => {
    const exporter = new OpenlayerExporter({
      apiKey: 'sk-ol',
      inferencePipelineId: 'pipe-1',
      endpoint: 'https://self-hosted.example.com/v1/traces',
      headers: { 'x-custom': 'value' },
    });
    const { url, headers } = exporterConfig(exporter);

    expect(url).toBe('https://self-hosted.example.com/v1/traces');
    expect(headers?.['x-custom']).toBe('value');
    expect(headers?.['Authorization']).toBe('Bearer sk-ol');
  });

  it('disables itself without throwing when credentials are missing', () => {
    let exporter!: OpenlayerExporter;
    expect(() => {
      exporter = new OpenlayerExporter();
    }).not.toThrow();
    expect(exporter.isDisabled).toBe(true);
  });

  it('disables itself when only the api key is present', () => {
    process.env['OPENLAYER_API_KEY'] = 'sk-ol-env';
    expect(new OpenlayerExporter().isDisabled).toBe(true);
  });

  it('drops MODEL_CHUNK spans by default and forwards everything else', async () => {
    const exporter = new OpenlayerExporter({ apiKey: 'sk-ol', inferencePipelineId: 'pipe-1' });
    const forwarded: string[] = [];
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(exporter));
    jest.spyOn(proto, '_exportTracingEvent').mockImplementation(async (event: any) => {
      forwarded.push(event.exportedSpan.type);
    });

    const event = (type: SpanType) => ({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: { type, id: 'a', traceId: 'b', name: 'n', startTime: new Date(), isEvent: false, isRootSpan: true },
    });

    await (exporter as any)._exportTracingEvent(event(SpanType.MODEL_CHUNK));
    await (exporter as any)._exportTracingEvent(event(SpanType.AGENT_RUN));

    expect(forwarded).toEqual([SpanType.AGENT_RUN]);
    jest.restoreAllMocks();
  });

  it('exports MODEL_CHUNK when dropSpanTypes is emptied', async () => {
    const exporter = new OpenlayerExporter({
      apiKey: 'sk-ol',
      inferencePipelineId: 'pipe-1',
      dropSpanTypes: [],
    });
    const forwarded: string[] = [];
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(exporter));
    jest.spyOn(proto, '_exportTracingEvent').mockImplementation(async (event: any) => {
      forwarded.push(event.exportedSpan.type);
    });

    await (exporter as any)._exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: { type: SpanType.MODEL_CHUNK, id: 'a', traceId: 'b', name: 'n', startTime: new Date(), isEvent: false, isRootSpan: false },
    });

    expect(forwarded).toEqual([SpanType.MODEL_CHUNK]);
    jest.restoreAllMocks();
  });
});
```

> **Note for the implementer:** `exporterConfig` reaches into OTLP exporter internals to read the resolved url and headers. If `_transport._parameters` does not exist on the installed `@opentelemetry/exporter-trace-otlp-proto` version, log the constructed object once and adjust the accessor — do **not** change the exporter to expose internals just to satisfy the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/integrations/mastraExporter.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/integrations/mastra'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/integrations/mastra/index.ts`:

```ts
/**
 * Openlayer exporter for Mastra's observability system.
 *
 * ```ts
 * import { Mastra } from '@mastra/core';
 * import { Observability } from '@mastra/observability';
 * import { OpenlayerExporter } from 'openlayer/integrations/mastra';
 *
 * export const mastra = new Mastra({
 *   observability: new Observability({
 *     configs: {
 *       openlayer: {
 *         serviceName: 'my-service',
 *         exporters: [new OpenlayerExporter()],
 *       },
 *     },
 *   }),
 * });
 * ```
 *
 * With `OPENLAYER_API_KEY` and `OPENLAYER_INFERENCE_PIPELINE_ID` set, that is
 * the entire integration.
 */
import { SpanType } from '@mastra/core/observability';
import type { TracingEvent } from '@mastra/core/observability';
import { OtelExporter } from '@mastra/otel-exporter';
import type { OtelExporterConfig } from '@mastra/otel-exporter';

import { OpenlayerOTLPTraceExporter } from './otlpExporter';

export { toGenAIMessages } from './genaiMessages';
export type { GenAIMessage, GenAITextPart } from './genaiMessages';
export { rewriteSpanAttributes } from './spanRewriter';
export type { SpanAttributes } from './spanRewriter';
export { OpenlayerOTLPTraceExporter } from './otlpExporter';

/** Openlayer's OTLP trace endpoint. */
export const OPENLAYER_OTLP_ENDPOINT = 'https://api.openlayer.com/v1/otel/v1/traces';

const LOG_PREFIX = '[OpenlayerExporter]';

/**
 * Mastra emits one span per streaming chunk. Left unfiltered, a single
 * streamed reply becomes hundreds of Openlayer steps.
 */
const DEFAULT_DROP_SPAN_TYPES: SpanType[] = [SpanType.MODEL_CHUNK];

export interface OpenlayerExporterConfig extends Omit<OtelExporterConfig, 'provider' | 'exporter'> {
  /** Openlayer API key. Defaults to `OPENLAYER_API_KEY`. */
  apiKey?: string;
  /** Destination pipeline. Defaults to `OPENLAYER_INFERENCE_PIPELINE_ID`. */
  inferencePipelineId?: string;
  /** OTLP endpoint override. Defaults to `OPENLAYER_OTEL_ENDPOINT`, then {@link OPENLAYER_OTLP_ENDPOINT}. */
  endpoint?: string;
  /** Reported as the `service.name` resource attribute. */
  projectName?: string;
  /** Extra headers merged into every OTLP request. */
  headers?: Record<string, string>;
  /**
   * Span types this exporter drops. Defaults to `[SpanType.MODEL_CHUNK]`;
   * pass `[]` to export everything.
   *
   * Deliberately **not** named `excludeSpanTypes`: Mastra's
   * `ObservabilityInstanceConfig.excludeSpanTypes` already exists one layer up
   * and drops spans before any exporter sees them. Use that one to filter for
   * every exporter; use this one only to change what Openlayer alone receives.
   */
  dropSpanTypes?: SpanType[];
}

interface ResolvedConfig {
  otelConfig: OtelExporterConfig;
  droppedSpanTypes: Set<string>;
  disabledReason?: string;
}

/**
 * Resolve user config plus environment into the shape `OtelExporter` wants.
 *
 * Kept outside the class so the constructor has exactly one `super()` call.
 * Two `super()` calls in different branches would make the emit order of the
 * `name` field initializer depend on TypeScript's downlevel-class behaviour —
 * not something worth relying on.
 *
 * Extra keys (`apiKey`, `projectName`, …) are passed through to `super`
 * untouched; `OtelExporter` ignores what it does not recognise, and
 * `@mastra/arize` does the same.
 */
function resolveExporterConfig(config: OpenlayerExporterConfig): ResolvedConfig {
  const apiKey = config.apiKey ?? process.env['OPENLAYER_API_KEY'];
  const inferencePipelineId =
    config.inferencePipelineId ?? process.env['OPENLAYER_INFERENCE_PIPELINE_ID'];
  const endpoint =
    config.endpoint ?? process.env['OPENLAYER_OTEL_ENDPOINT'] ?? OPENLAYER_OTLP_ENDPOINT;

  const droppedSpanTypes = new Set<string>(
    (config.dropSpanTypes ?? DEFAULT_DROP_SPAN_TYPES).map((type) => String(type)),
  );

  const missing: string[] = [];
  if (!apiKey) missing.push('apiKey (set OPENLAYER_API_KEY or pass apiKey)');
  if (!inferencePipelineId) {
    missing.push(
      'inferencePipelineId (set OPENLAYER_INFERENCE_PIPELINE_ID or pass inferencePipelineId)',
    );
  }

  if (missing.length > 0) {
    // Mirrors @mastra/arize: build a valid-but-inert parent config, then let
    // the constructor disable us. A misconfigured exporter must never take
    // down the host application.
    return {
      droppedSpanTypes,
      disabledReason: `${LOG_PREFIX} Missing required configuration: ${missing.join('; ')}.`,
      otelConfig: {
        ...config,
        signals: { logs: false },
        provider: {
          custom: { endpoint: 'http://disabled', headers: {}, protocol: 'http/protobuf' },
        },
      },
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'x-bt-parent': `pipeline_id:${inferencePipelineId}`,
    ...config.headers,
  };

  return {
    droppedSpanTypes,
    otelConfig: {
      exporter: new OpenlayerOTLPTraceExporter({ url: endpoint, headers }),
      ...config,
      // Openlayer's OTLP endpoint accepts traces only; leaving logs enabled
      // would demand an @opentelemetry/exporter-logs-otlp-proto nobody installed.
      signals: { logs: false, ...config.signals },
      resourceAttributes: {
        ...(config.projectName ? { 'service.name': config.projectName } : {}),
        ...config.resourceAttributes,
      },
      // Protocol is forced: the endpoint parses protobuf only.
      provider: { custom: { endpoint, headers, protocol: 'http/protobuf' } },
    },
  };
}

export class OpenlayerExporter extends OtelExporter {
  override name = 'openlayer';

  private readonly droppedSpanTypes: Set<string>;

  constructor(config: OpenlayerExporterConfig = {}) {
    const resolved = resolveExporterConfig(config);
    super(resolved.otelConfig);

    this.droppedSpanTypes = resolved.droppedSpanTypes;
    if (resolved.disabledReason) {
      this.setDisabled(resolved.disabledReason);
    }
  }

  protected override async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.droppedSpanTypes.has(String(event.exportedSpan.type))) {
      return;
    }
    await super._exportTracingEvent(event);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/integrations/mastraExporter.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the whole Mastra suite and type-check**

Run: `npx jest tests/integrations/mastra` then `npx tsc --noEmit -p tsconfig.json`
Expected: all PASS; no type errors.

- [ ] **Step 6: Verify the build emits the subpath entry**

Run: `yarn build && ls dist/lib/integrations/mastra`
Expected: `index.js`, `index.mjs`, `index.d.ts` present.

- [ ] **Step 7: Commit**

```bash
git add src/lib/integrations/mastra/index.ts tests/integrations/mastraExporter.test.ts
git commit -m "feat(mastra): add OpenlayerExporter with env and explicit configuration"
```

---

### Task 5: Runnable example and documentation

**Files:**
- Create: `examples/mastra-tracing.ts`
- Modify: `examples/package.json` (add Mastra deps)
- Modify: `README.md`

**Interfaces:**
- Consumes: `OpenlayerExporter` from Task 4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the example dependencies**

Run:

```bash
cd examples && yarn add @mastra/core @mastra/observability @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto @ai-sdk/openai zod && cd ..
```

- [ ] **Step 2: Write the example**

Create `examples/mastra-tracing.ts`:

```ts
/**
 * Mastra → Openlayer tracing example.
 *
 * Exercises both root span types — an agent run and a workflow run — plus a
 * tool call, session/user metadata, and an explicit shutdown so the batch is
 * flushed before the process exits.
 *
 * Run with:
 *   OPENLAYER_API_KEY=... OPENLAYER_INFERENCE_PIPELINE_ID=... OPENAI_API_KEY=... \
 *     npx tsx mastra-tracing.ts
 */
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Observability } from '@mastra/observability';
import { OpenlayerExporter } from 'openlayer/integrations/mastra';
import { z } from 'zod';

const getWeather = createTool({
  id: 'get_weather',
  description: 'Get the current weather for a city.',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ tempC: z.number(), sky: z.string() }),
  execute: async ({ context }) => {
    // A real tool would call a weather API here.
    return { tempC: 24, sky: `sunny in ${context.city}` };
  },
});

const weatherAgent = new Agent({
  name: 'WeatherAgent',
  instructions: 'You are a concise weather assistant. Always use the get_weather tool.',
  model: openai('gpt-4o-mini'),
  tools: { getWeather },
});

const summarize = createStep({
  id: 'summarize',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  execute: async ({ inputData }) => {
    const result = await weatherAgent.generate(`What is the weather in ${inputData.city}?`);
    return { summary: result.text };
  },
});

const weatherWorkflow = createWorkflow({
  id: 'weatherWorkflow',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
})
  .then(summarize)
  .commit();

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
  observability: new Observability({
    configs: {
      openlayer: {
        serviceName: 'mastra-openlayer-example',
        // Zero-config: reads OPENLAYER_API_KEY and OPENLAYER_INFERENCE_PIPELINE_ID.
        exporters: [new OpenlayerExporter()],
      },
    },
  }),
});

async function main(): Promise<void> {
  // 1. A bare agent run — the root span is AGENT_RUN.
  const agentResult = await mastra.getAgent('weatherAgent').generate(
    'What is the weather in Lisbon?',
    {
      // Lifted by the exporter to session.id / user.id, which Openlayer reads.
      tracingOptions: { metadata: { sessionId: 'demo-session-1', userId: 'demo-user-1' } },
    },
  );
  console.log('agent:', agentResult.text);

  // 2. A workflow run — the root span is WORKFLOW_RUN.
  const run = await mastra.getWorkflow('weatherWorkflow').createRunAsync();
  const workflowResult = await run.start({ inputData: { city: 'Madrid' } });
  console.log('workflow:', JSON.stringify(workflowResult.result));

  // 3. Flush before exit, or the last batch is lost.
  await mastra.observability?.shutdown();
  console.log('Traces flushed to Openlayer.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

> **Note for the implementer:** the Mastra agent/workflow/tool constructor APIs move between minor versions. If any import or call signature above does not match the installed `@mastra/core`, fix the example to match the installed version and keep the traced behaviour identical — two root span types, one tool call, session/user metadata, explicit shutdown. Confirm the example runs before committing.

- [ ] **Step 3: Run the example end to end**

Run:

```bash
cd examples && OPENLAYER_API_KEY=$OPENLAYER_API_KEY \
  OPENLAYER_INFERENCE_PIPELINE_ID=$OPENLAYER_INFERENCE_PIPELINE_ID \
  OPENAI_API_KEY=$OPENAI_API_KEY npx tsx mastra-tracing.ts && cd ..
```

Expected: agent and workflow output printed, then `Traces flushed to Openlayer.` with no errors.

- [ ] **Step 4: Document the integration**

Add this section to `README.md`, alongside the other integration sections:

````markdown
## Mastra

Send Mastra agent, workflow, model, and tool traces to Openlayer.

### Installation

```sh
npm install openlayer @mastra/otel-exporter @opentelemetry/exporter-trace-otlp-proto
```

`@mastra/core` is already present in any Mastra app. All three packages are declared as
optional peer dependencies, so nothing is pulled in for consumers who do not use Mastra.

### Configuration

Set `OPENLAYER_API_KEY` and `OPENLAYER_INFERENCE_PIPELINE_ID`, then add the exporter:

```ts
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { OpenlayerExporter } from 'openlayer/integrations/mastra';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      openlayer: {
        serviceName: 'my-service',
        exporters: [new OpenlayerExporter()],
      },
    },
  }),
});
```

Every value can also be passed explicitly, which takes precedence over the environment:

```ts
new OpenlayerExporter({
  apiKey: process.env.OPENLAYER_API_KEY,
  inferencePipelineId: process.env.OPENLAYER_INFERENCE_PIPELINE_ID,
  projectName: 'my-service',
  endpoint: 'https://api.openlayer.com/v1/otel/v1/traces',
  headers: { 'x-custom-header': 'value' },
  batchSize: 512,
  timeout: 30000,
  logLevel: 'debug',
});
```

If credentials are missing the exporter disables itself and logs the reason — it never throws.

### Session and user attribution

Metadata named `sessionId` (or `threadId`) and `userId` is lifted onto the trace, so rows are
grouped by session and user in Openlayer:

```ts
await agent.generate('What is the weather in Lisbon?', {
  tracingOptions: { metadata: { sessionId: 'session-123', userId: 'user-456' } },
});
```

Any other metadata is preserved on the step as-is.

### Composing with other exporters

Mastra takes a list, so Openlayer sits alongside anything else:

```ts
exporters: [new OpenlayerExporter(), new ArizeExporter()],
```

### Filtering spans

There are two layers, and they do different jobs:

- **`excludeSpanTypes`** on the Mastra config drops spans before *any* exporter sees them. Use
  this to filter for every exporter at once.
- **`dropSpanTypes`** on `OpenlayerExporter` changes only what Openlayer receives. It defaults
  to `[SpanType.MODEL_CHUNK]`, because Mastra emits one span per streaming chunk and an
  unfiltered streamed reply would become hundreds of steps. Pass `[]` to export everything.

### Troubleshooting

**Nothing arrives at all.** The exporter disabled itself because credentials were missing. Look
for `[OpenlayerExporter] Missing required configuration` in the logs at startup.

**Rows arrive with empty output.** Something stripped the `mastra.*.input` / `.output` span
attributes before the exporter ran — check any `customSpanFormatter` or span output processor
in your observability config. Openlayer builds a row's input and output from the root span, and
the exporter recovers them from those attributes.

**Hundreds of steps in one trace.** `dropSpanTypes` was overridden and `MODEL_CHUNK` is no
longer filtered. Restore the default or add `SpanType.MODEL_CHUNK` back.

**OpenInference attributes are not read.** Openlayer's OTLP ingest maps the GenAI semantic
conventions; OpenInference `input.value` / `output.value` produce empty rows. This exporter
targets gen_ai deliberately — no configuration will change that.
````

- [ ] **Step 5: Commit**

```bash
git add examples/mastra-tracing.ts examples/package.json examples/yarn.lock README.md
git commit -m "docs(mastra): add runnable example and integration documentation"
```

---

### Task 6: Live end-to-end test

**Files:**
- Create: `tests/integrations/mastraExporter.live.test.ts`

**Interfaces:**
- Consumes: `OpenlayerExporter` from Task 4.
- Produces: nothing.

This is the task that proves the integration actually works. Every assertion here corresponds to a claim in the spec that was measured by hand; the test makes those claims permanent.

- [ ] **Step 1: Write the live test**

Create `tests/integrations/mastraExporter.live.test.ts`:

```ts
/**
 * Live end-to-end test for the Mastra Openlayer exporter.
 *
 * Skipped unless ``OPENLAYER_API_KEY`` is set. When it runs it exercises the
 * real path: a real Mastra agent, the real OTLP export, the real Openlayer
 * ingest, and a read-back of the resulting row.
 *
 * Env it expects:
 *   OPENLAYER_API_KEY               — required to enable the test
 *   OPENLAYER_INFERENCE_PIPELINE_ID — destination pipeline (defaults below)
 *   OPENAI_API_KEY                  — required by the agent's model
 */
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { createTool } from '@mastra/core/tools';
import { Observability } from '@mastra/observability';
import { z } from 'zod';

import { OpenlayerExporter } from '../../src/lib/integrations/mastra';

const itLive = process.env['OPENLAYER_API_KEY'] && process.env['OPENAI_API_KEY'] ? it : it.skip;

const PIPELINE_ID =
  process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] ?? 'cb47e4f7-15a0-4e70-bd6e-7b1b4b54e434';

/** Poll the pipeline until a row named `name` shows up, or time out. */
async function findRow(name: string, timeoutMs = 90_000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(
      `https://api.openlayer.com/v1/inference-pipelines/${PIPELINE_ID}/rows?page=1&perPage=25&asc=false`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env['OPENLAYER_API_KEY']}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );
    const body = (await response.json()) as { items?: any[] };
    const match = body.items?.find((item) => String(item?.name ?? '').includes(name));
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`No Openlayer row matching "${name}" arrived within ${timeoutMs}ms`);
}

describe('Mastra OpenlayerExporter live integration', () => {
  itLive(
    'publishes a trace with usable input, output, cost, tokens and nested tool steps',
    async () => {
      const marker = `live-${Date.now()}`;

      const getWeather = createTool({
        id: 'get_weather',
        description: 'Get the current weather for a city.',
        inputSchema: z.object({ city: z.string() }),
        outputSchema: z.object({ tempC: z.number() }),
        execute: async () => ({ tempC: 24 }),
      });

      const agent = new Agent({
        name: `LiveWeatherAgent-${marker}`,
        instructions: 'You are a concise weather assistant. Always use the get_weather tool.',
        model: openai('gpt-4o-mini'),
        tools: { getWeather },
      });

      const mastra = new Mastra({
        agents: { agent },
        observability: new Observability({
          configs: {
            openlayer: {
              serviceName: 'mastra-live-test',
              exporters: [new OpenlayerExporter()],
            },
          },
        }),
      });

      await mastra.getAgent('agent').generate('What is the weather in Lisbon?', {
        tracingOptions: { metadata: { sessionId: `session-${marker}` } },
      });
      await mastra.observability?.shutdown();

      const row = await findRow(marker);

      // The defect this integration exists to fix: root I/O must not be empty.
      expect(row['openlayer_output']).toBeTruthy();
      expect(JSON.stringify(row['openlayer_output'])).not.toBe('{}');
      expect(row['openlayer_inputs']).toContain('prompt');

      // Model metadata, cost and tokens are normalized server-side on this path.
      expect(row['openlayer_cost']).toBeGreaterThan(0);
      expect(row['openlayer_num_of_tokens']).toBeGreaterThan(0);
      expect(row['model']).toBeTruthy();
      expect(row['provider']).toBeTruthy();

      // Session metadata is lifted to session.id, which Openlayer reads.
      expect(row['openlayer_session_id']).toBe(`session-${marker}`);

      // Hierarchy: the tool call is nested and mapped natively.
      const steps = JSON.stringify(row['steps']);
      expect(steps).toContain('get_weather');
      expect(steps).toContain('toolResult');

      // Documented but unmeasured: MODEL_STEP spans carry mastra.model_step.input
      // but no gen_ai messages, so the capability guard fires on them. Record
      // what that produces rather than discovering it in a user's trace. If this
      // proves noisy, add MODEL_STEP to DEFAULT_DROP_SPAN_TYPES — do not add a
      // rule to the rewriter.
      const modelStepCount = (steps.match(/model_step/g) ?? []).length;
      console.log(`[live] model_step occurrences in trace: ${modelStepCount}`);
    },
    180_000,
  );
});
```

- [ ] **Step 2: Confirm it skips cleanly with no credentials**

Run: `env -u OPENLAYER_API_KEY npx jest tests/integrations/mastraExporter.live.test.ts`
Expected: 1 skipped, 0 failed.

- [ ] **Step 3: Run it live**

Run:

```bash
OPENLAYER_API_KEY=$OPENLAYER_API_KEY \
OPENLAYER_INFERENCE_PIPELINE_ID=$OPENLAYER_INFERENCE_PIPELINE_ID \
OPENAI_API_KEY=$OPENAI_API_KEY \
npx jest tests/integrations/mastraExporter.live.test.ts
```

Expected: PASS. Note the logged `model_step occurrences` value.

- [ ] **Step 4: Act on the model_step finding**

If the trace contains an excessive number of `model_step` steps, add `SpanType.MODEL_STEP` to `DEFAULT_DROP_SPAN_TYPES` in `src/lib/integrations/mastra/index.ts`, update the README's filtering section to say so, and re-run the live test. If the count is small, leave it and delete the `console.log`.

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: all suites pass; the live suite skips when credentials are absent.

- [ ] **Step 6: Lint and type-check everything**

Run: `npx eslint src/lib/integrations/mastra tests/integrations && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add tests/integrations/mastraExporter.live.test.ts src/lib/integrations/mastra/index.ts README.md
git commit -m "test(mastra): add live end-to-end test against a real pipeline"
```

---

## Done criteria

- `npx jest` passes with the live suite skipping when credentials are absent, and passing when they are present.
- `yarn build` emits `dist/lib/integrations/mastra/index.{js,mjs,d.ts}`.
- `examples/mastra-tracing.ts` runs to completion and its traces are visible in Openlayer with non-empty input and output.
- `npx eslint src/lib/integrations/mastra tests/integrations` and `npx tsc --noEmit` are clean.
- Nothing was added to `dependencies` in `package.json`.
- `src/lib/integrations/index.ts` is unchanged.
