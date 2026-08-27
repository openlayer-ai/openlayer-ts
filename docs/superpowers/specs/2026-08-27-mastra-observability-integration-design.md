# Mastra observability integration — design

**Issue:** OPEN-12306 · **Date:** 2026-08-27 · **Branch:** `vini/open-12306-integration-add-mastra-observability-integration`

## Goal

Let a Mastra application send agent, workflow, model, and tool traces to Openlayer by
adding one exporter to its observability config:

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

With `OPENLAYER_API_KEY` and `OPENLAYER_INFERENCE_PIPELINE_ID` set, that snippet is the
entire integration.

## Background: what was measured

Every claim below was verified against the live Openlayer OTLP endpoint on 2026-08-27 by
posting hand-built protobuf `ExportTraceServiceRequest` payloads and reading the resulting
rows back through `POST /v1/inference-pipelines/{id}/rows`. Probe scripts are in the session
scratchpad (`otel_probe2.py` … `otel_probe5.py`).

### Openlayer's OTLP ingest

- Endpoint `https://api.openlayer.com/v1/otel/v1/traces`, headers
  `Authorization: Bearer <key>` and `x-bt-parent: pipeline_id:<id>`.
- **Protobuf only.** An OTLP/JSON body returns
  `400 Failed to parse OpenTelemetry protobuf data` regardless of `Content-Type`.
  `http/protobuf` is therefore forced, not configurable.
- A row's input and output are built **only** from `gen_ai.input.messages` /
  `gen_ai.output.messages` on the span, in the OTel semconv 1.38 `parts` shape. Five
  conventions were tested:

  | Root-span shape | Row input / output |
  |---|---|
  | `gen_ai.input.messages` + `gen_ai.output.messages` (1.38 `parts`) | ✅ `["prompt"]` + `[{role, content}]` |
  | `gen_ai.prompt` + `gen_ai.completion` | ❌ empty |
  | gen_ai span **events** (`gen_ai.user.message`, `gen_ai.choice`) | ❌ empty |
  | OpenInference `input.value` / `output.value` | ❌ empty |
  | Traceloop `traceloop.entity.input` / `.output` | ❌ empty |
  | Indexed `gen_ai.prompt.N.role` / `.content` | ❌ empty |

  The server flattens the `parts` array back to `{role, content}` and names the input column
  `prompt`. The same rule applies to child steps, not just roots.
- **Tool spans are mapped natively and must not be rewritten.**
  `gen_ai.tool.call.arguments` → `arguments`, `gen_ai.tool.call.result` → `toolResult`,
  `gen_ai.tool.name` → `functionName`, step `type: "tool"`. Adding `gen_ai.input.messages`
  to a tool span does *not* populate `inputs` — it only leaves a redundant blob in metadata.
- **Session and user** come from `session.id` and `user.id`. `gen_ai.conversation.id` also
  fills session but not user; `openlayer.session_id` / `openlayer.sessionId` do nothing.
- **Cost, provider, and tokens are normalized server-side on this path.**
  `gen_ai.system=openai` came back as `provider: "OpenAI"` with a real `openlayer_cost`, so
  the exact-lowercase-slug requirement that applies to the data-stream API does not apply here.
- Unrecognized attributes are preserved into step `metadata` as nested objects rather than
  dropped, so `mastra.metadata.*` needs no special handling to satisfy the custom-metadata
  requirement.
- The historical ingest bug where an `error.message` attribute discarded an entire export
  request **no longer reproduces**: a batch mixing a healthy trace with an `error.message`
  trace landed both rows, the latter with `status: "error"`.

### What Mastra already emits

`@mastra/otel-exporter` converts Mastra spans to OTel using GenAI semconv v1.38. It already
emits `gen_ai.input.messages` / `gen_ai.output.messages` — but only for `MODEL_GENERATION`
spans. For every other type, including the `AGENT_RUN` and `WORKFLOW_RUN` roots, input and
output land under `mastra.<type>.input` / `mastra.<type>.output`.

**This is the entire defect.** A Mastra-shaped trace posted as-is produced correct hierarchy,
cost (`5.85e-06`), tokens, latency, model, and error status — and `openlayer_output: {}` with
`openlayer_inputs: []`.

## Approach

`OpenlayerExporter extends OtelExporter` from `@mastra/otel-exporter`, configured with
`provider: { custom: { endpoint, headers, protocol: 'http/protobuf' } }` and an injected
`SpanExporter` that rewrites attributes in `export()` before they reach the wire. This mirrors
`@mastra/arize`, which injects `OpenInferenceOTLPTraceExporter extends OTLPTraceExporter` the
same way.

Two alternatives were considered and rejected:

- **Plain OTLP with no rewrite** — measured to produce rows with empty input and output.
- **Native `Step` tree via `processAndUploadTrace`** (the `langchainCallback` pattern) — full
  control over row shape and reuse of the offline buffer, but it re-derives batching, lifecycle,
  and span-tree assembly that `@mastra/otel-exporter` already ships, and it moves onto the
  data-stream path where the provider cost-slug trap applies. Its advantages (offline replay,
  `inputVariableNames` control) sit outside the issue's acceptance criteria.

### Comparison with the reference integrations

| | `@mastra/arize` 1.3.11 | `@mastra/langfuse` 1.5.2 | Openlayer |
|---|---|---|---|
| Base class | `OtelExporter` | `BaseExporter` | `OtelExporter` |
| Transport | OTLP/protobuf via injected `exporter` | vendor `LangfuseSpanProcessor` | OTLP/protobuf via injected `exporter` |
| gen_ai conversion | inherited | calls `SpanConverter` directly | inherited |
| Rewrite hook | `SpanExporter.export()` | `mapMastraToLangfuseAttributes()` | `SpanExporter.export()` |
| Target vocabulary | OpenInference | `langfuse.*` | gen_ai — no translation |
| Session / user | `SESSION_ID` / `USER_ID` | `session.id` / `user.id` | `session.id` / `user.id` |
| Scores | — | `onScoreEvent` | deferred (see below) |

Openlayer is the only one of the three that needs no vocabulary translation: its ingester reads
gen_ai natively. The exporter is therefore a gap-filler, not a translator — which is also why
"leave tool spans alone" is correct here but wrong for Arize.

**OpenInference is explicitly not targeted.** The issue lists it as a reference, but it was
measured to produce empty input/output against Openlayer. The docs will say so.

## Module layout

`src/lib/integrations/mastra/` — a directory rather than the repo's usual flat integration
file, because the logic worth testing is separable from the transport.

| File | Purpose | Depends on |
|---|---|---|
| `genaiMessages.ts` | Pure. Coerce any Mastra `input`/`output` value into semconv 1.38 `parts` messages. | — |
| `spanRewriter.ts` | Pure. `attributes` in → rewritten `attributes` out. Holds every mapping rule. | `genaiMessages` |
| `otlpExporter.ts` | `OpenlayerOTLPTraceExporter extends OTLPTraceExporter`, applies the rewriter in `export()`. | `spanRewriter`, `@opentelemetry/exporter-trace-otlp-proto` |
| `index.ts` | `OpenlayerExporter extends OtelExporter`, config resolution, public types. | the above, `@mastra/otel-exporter` |

The two pure modules carry all the behaviour and need no network, no OTel runtime, and no
Mastra runtime to test.

## The rewriter

Applied to every span, in this order.

### 1. Recover input and output

Guarded on the gen_ai attributes being absent, matching what both `@mastra/arize` and
`@mastra/langfuse` do:

```
if no gen_ai.input.messages and no gen_ai.tool.call.arguments:
    find the first attribute key that starts with "mastra." (but NOT "mastra.metadata.")
      and ends with ".input"
    → gen_ai.input.messages = toGenAIMessages(value, defaultRole: 'user')

if no gen_ai.output.messages and no gen_ai.tool.call.result:
    same scan for ".output"
    → gen_ai.output.messages = toGenAIMessages(value, defaultRole: 'assistant')
```

A capability guard rather than a span-type allowlist. It degrades gracefully as Mastra adds
span types, and it produces the required "leave model and tool spans untouched" behaviour for
free — model spans already have `gen_ai.*.messages`, tool spans already have
`gen_ai.tool.call.*`.

Excluding the `mastra.metadata.` prefix from the scan is a deliberate improvement over
`@mastra/langfuse`, whose scan can false-positive on a user's own
`mastra.metadata.<key>.input`. `@mastra/arize` already partitions that prefix off separately.

Original `mastra.*` attributes are left in place; they land in step metadata at no cost.

### 2. Lift session and user

| Source | Target | Notes |
|---|---|---|
| `mastra.metadata.sessionId` ?? `mastra.metadata.threadId` | `session.id` | Only if `session.id` unset |
| `mastra.metadata.userId` | `user.id` | Only if `user.id` unset |

Source attributes are **not** deleted — unlike Langfuse, which deletes them. Openlayer
preserves them into step metadata, which is useful, and deleting would lose information.

**Tags get no rule.** `openlayer.tags`, `tags`, and `mastra.tags` were all tested: none is
promoted to a row column, and all three survive into step metadata verbatim. Both reference
integrations map `mastra.tags` to a vendor tag field, but Openlayer has no such field on this
path, so a rewrite would add nothing. Mastra's own `mastra.tags` passes through untouched.

### 3. `toGenAIMessages(value, defaultRole)`

| Input shape | Result |
|---|---|
| `string` | one message, role = `defaultRole` |
| `Array<{role, content}>` | 1:1; non-string `content` is JSON-stringified |
| `Array<{role, parts}>` | passed through unchanged |
| `Array<string>` | one message per element, role = `defaultRole` |
| any object | one message whose content is `JSON.stringify(value)` |
| `null` / `undefined` / `''` | attribute not written |

Output messages get `finish_reason: 'stop'` when Mastra supplies none. Serialization is wrapped
so a circular reference degrades to a placeholder rather than throwing inside `export()` — a
throw there would drop the batch.

Values arriving as pre-serialized JSON strings (Mastra stringifies before setting the attribute)
are parsed first, falling back to treating the string as literal text.

## Configuration

```ts
export interface OpenlayerExporterConfig
  extends Omit<OtelExporterConfig, 'provider' | 'exporter'> {
  apiKey?: string;               // OPENLAYER_API_KEY
  inferencePipelineId?: string;  // OPENLAYER_INFERENCE_PIPELINE_ID
  endpoint?: string;             // OPENLAYER_OTEL_ENDPOINT
  projectName?: string;          // → service.name resource attribute
  headers?: Record<string, string>;
  /** Span types this exporter drops before export. Defaults to [SpanType.MODEL_CHUNK].
   *  Pass [] to export everything. Deliberately NOT named `excludeSpanTypes` — see below. */
  dropSpanTypes?: SpanType[];
  // inherited and supported: batchSize, timeout, logLevel, resourceAttributes,
  //                          customSpanFormatter, logger
}
```

- Default endpoint `https://api.openlayer.com/v1/otel/v1/traces`.
- Headers built as `Authorization: Bearer <apiKey>` plus
  `x-bt-parent: pipeline_id:<inferencePipelineId>`, then merged with `config.headers`.
- Explicit config wins over environment; environment alone is a complete configuration.
- **Missing credentials never throw.** Following both references, the constructor calls
  `super()` with a dummy `http://disabled` provider, then `setDisabled(reason)` with a message
  naming which value was missing and where it was looked for. A misconfigured exporter must not
  take down the host application.

Two defaults that are decisions rather than accidents:

- **`signals: { logs: false }`.** The Openlayer OTLP endpoint is traces-only; leaving logs
  enabled would demand an `@opentelemetry/exporter-logs-otlp-proto` nobody installed.
- **`MODEL_CHUNK` spans dropped**, via `dropSpanTypes` defaulting to `[SpanType.MODEL_CHUNK]`
  and enforced in an `_exportTracingEvent` override that returns early before delegating to
  `super`. Mastra emits one span per streaming chunk, so an unfiltered streamed reply becomes
  hundreds of steps. Passing `[]` disables it.

  **Filtering has two layers and they must not share a name.**
  `ObservabilityInstanceConfig.excludeSpanTypes` already exists at the Mastra config level and
  drops spans before *any* exporter sees them. The exporter-level knob is therefore named
  `dropSpanTypes`, not `excludeSpanTypes`, so a reader can never be unsure which layer a given
  setting belongs to. Docs will state the rule plainly: **use Mastra's `excludeSpanTypes` to
  filter for every exporter; use `dropSpanTypes` only to change what Openlayer alone receives.**
  The exporter default exists solely so the zero-config path is safe under streaming.

## Packaging

- `exports["./integrations/mastra"]` → `dist/lib/integrations/mastra/index.{js,mjs,d.ts}`,
  matching the existing `./integrations/claude-agent-sdk` entry.
- New **optional** peer dependencies: `@mastra/core`, `@mastra/otel-exporter`,
  `@opentelemetry/exporter-trace-otlp-proto`. All three also added as devDependencies so tests
  run. `@mastra/otel-exporter` carries the rest of the OTel SDK tree as real dependencies, and
  its protocol exporters are optional peers, so this is the minimum set.
- Nothing is added to `dependencies`; consumers who do not use Mastra pay nothing.
- `src/lib/integrations/index.ts` is **not** extended with `export * from './mastra'` — that
  barrel is loaded by the root entry point, and re-exporting would make the optional Mastra
  peers load for every consumer of `openlayer`.

## Testing

Unit tests, no network — `tests/integrations/mastraExporter.test.ts`:

- `toGenAIMessages` across every input shape in the table above, including circular references
  and pre-serialized JSON strings.
- `spanRewriter` per span type, including the negative cases that matter: model spans
  untouched, tool spans untouched, existing `gen_ai.*.messages` never overwritten, and
  `mastra.metadata.foo.input` not mistaken for span input.
- Session/user lift, including precedence of `sessionId` over `threadId`.
- Config resolution: env-only, explicit-only, explicit-overrides-env, missing-credentials →
  `isDisabled` with no throw. Header construction.
- `export()` forwards rewritten spans to `super.export()`.

Live end-to-end, gated on `OPENLAYER_API_KEY` following the existing `*.live.test.ts`
convention — `tests/integrations/mastraExporter.live.test.ts`:

Run a real Mastra agent with a tool plus a workflow, `flush()`, poll
`GET /inference-pipelines/{id}/rows`, and assert on the returned row:

- `openlayer_output` non-empty and `openlayer_inputs` contains `prompt` — the assertion that
  catches the defect this whole design exists to fix
- child steps nested under the root, with the tool step carrying `functionName` and `toolResult`
- `openlayer_cost > 0`, `openlayer_num_of_tokens > 0`, `model` and `provider` set
- `openlayer_session_id` populated when `metadata.sessionId` was supplied
- an agent that throws produces `status: "error"` while a sibling healthy trace still lands
- **what `model_step` steps actually look like.** `getAttributes` writes
  `mastra.model_step.input`, and `MODEL_STEP` spans do *not* receive `gen_ai.input.messages` —
  only `MODEL_GENERATION` does. So the capability guard will fire on them and synthesize
  messages. That is likely desirable, but it is unmeasured and `model_step` spans are numerous,
  so the live test asserts their resulting shape rather than leaving it to be discovered in a
  user's trace. If the result is noisy, the fix is adding `MODEL_STEP` to the `dropSpanTypes`
  default, not adding a rule to the rewriter.

## Example and documentation

`examples/mastra-tracing.ts` — an agent with a tool and a two-step workflow, exercising both
root span types, plus `mastra.metadata` carrying `sessionId` / `userId`, and an explicit
`shutdown()` to demonstrate flush-on-exit.

README section covering: installation with the three peer packages, zero-config and explicit
configuration, composing with other Mastra exporters (`exporters: [new OpenlayerExporter(), new
ArizeExporter()]`), and troubleshooting. Troubleshooting must cover the failure modes actually
observed:

- rows arriving with empty output → a `customSpanFormatter` or span processor stripped the
  `mastra.*.input`/`.output` attributes before the rewriter ran
- nothing arriving at all → credentials missing, so the exporter disabled itself; the reason is
  logged at construction
- hundreds of steps per trace → `MODEL_CHUNK` filtering was overridden
- OpenInference attributes are not read by Openlayer

## Deferred

**Score submission (`onScoreEvent` → Openlayer).** `@mastra/langfuse` implements `onScoreEvent`
and exposes a `.client` getter so Mastra scorers land as Langfuse scores. The Openlayer analogue
would post scorer output against the row. It is not in the issue's acceptance criteria and needs
a decision about which Openlayer surface receives it, so it is out of v1. The design does not
foreclose it: `BaseExporter.onScoreEvent` is an optional method that can be added to
`OpenlayerExporter` without touching the rewriter or the transport.

**Prompt-version linking.** Langfuse ships `withLangfusePrompt()`, a `TracingOptionsUpdater`
helper. Equivalent to the above — additive, out of v1.

## Acceptance criteria mapping

| Criterion | Where satisfied |
|---|---|
| Enable tracing with a small config snippet | Zero-config constructor + env vars |
| Correct hierarchy, input/output, model, token, timing, error, metadata | Rewriter §1; the rest verified as already working |
| Env-var and explicit config both documented and tested | Config §; unit tests |
| Composes with other Mastra exporters | Inherent — Mastra takes an exporter array; documented and shown in the example |
| Custom metadata without leaking secrets | `mastra.metadata.*` passthrough; only credentials go in headers, never span attributes |
| Graceful shutdown/flush, production-safe batching | Inherited `BatchSpanProcessor`, `flush()`, `shutdown()` |
| Working example and automated tests | `examples/mastra-tracing.ts`; unit + live tests |
| OpenInference where applicable | Measured not applicable; documented explicitly |
