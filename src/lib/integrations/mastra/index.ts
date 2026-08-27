/**
 * Openlayer exporter for Mastra's observability system.
 *
 * ```ts
 * import { Mastra } from '@mastra/core';
 * import { Observability } from '@mastra/observability';
 * import { OpenlayerExporter } from 'openlayer/lib/integrations/mastra';
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
 *
 * `MODEL_STEP` was measured (see `mastraExporter.live.test.ts`) to be 4 of 7
 * steps (57%) in a single one-tool-call turn, and considered for this list —
 * but dropping it here does not reparent its children to the surviving
 * `MODEL_GENERATION` ancestor: a live run with `MODEL_STEP` dropped lost the
 * nested `tool_call` span (and its `toolResult`) entirely, rather than
 * hoisting it. That is a materially worse outcome than the noise it would
 * remove, so `MODEL_STEP` stays out of this list until the exporter can
 * reparent orphaned children before dropping their parent.
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
  const inferencePipelineId = config.inferencePipelineId ?? process.env['OPENLAYER_INFERENCE_PIPELINE_ID'];
  const endpoint = config.endpoint ?? process.env['OPENLAYER_OTEL_ENDPOINT'] ?? OPENLAYER_OTLP_ENDPOINT;

  const droppedSpanTypes = new Set<string>(
    (config.dropSpanTypes ?? DEFAULT_DROP_SPAN_TYPES).map((type) => String(type)),
  );

  const missing: string[] = [];
  if (!apiKey) missing.push('apiKey (set OPENLAYER_API_KEY or pass apiKey)');
  if (!inferencePipelineId) {
    missing.push('inferencePipelineId (set OPENLAYER_INFERENCE_PIPELINE_ID or pass inferencePipelineId)');
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
      ...config,
      // Placed after `...config`, like `signals`/`resourceAttributes`/`provider`
      // below: the `Omit<OtelExporterConfig, 'provider' | 'exporter'>` type
      // blocks a caller from passing `exporter` at compile time, but nothing
      // stops it in plain JS, and `exporter` spread before `...config` would
      // let a stray key silently replace this rewriting exporter — reintroducing
      // the empty-input/output defect this whole integration exists to fix.
      exporter: new OpenlayerOTLPTraceExporter({ url: endpoint, headers }),
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
