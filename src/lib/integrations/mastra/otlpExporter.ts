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
        // ReadableSpan.attributes is readonly by type but mutable in practice.
        // Mutating it in place is safe — not merely "additive, so it's fine" —
        // because each `OtelExporter` instance owns an exclusive `SpanConverter`
        // and calls `convertSpan()` per tracing event
        // (@mastra/otel-exporter dist/index.cjs:973-974), and `convertSpan()`
        // returns a freshly built `ReadableSpan` with a freshly built
        // `attributes` object every time (ibid. getAttributes() at :419,
        // convertSpan() at :601-647). No two exporters — e.g. this one and
        // `@mastra/arize`'s — ever see the same span object, so this rewrite
        // cannot leak into a sibling exporter's copy. That guarantee holds even
        // for a rewrite that *replaces* a value, as `PROVIDER_SLUG_ALIASES`
        // does, not just for additive ones.
        (span as { attributes: Record<string, unknown> }).attributes = rewriteSpanAttributes(span.attributes);
      } catch {
        // A rewrite failure must never cost us the batch — export unchanged.
      }
    }

    super.export(spans, resultCallback);
  }
}
