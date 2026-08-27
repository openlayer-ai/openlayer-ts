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
        (span as { attributes: Record<string, unknown> }).attributes = rewriteSpanAttributes(span.attributes);
      } catch {
        // A rewrite failure must never cost us the batch — export unchanged.
      }
    }

    super.export(spans, resultCallback);
  }
}
