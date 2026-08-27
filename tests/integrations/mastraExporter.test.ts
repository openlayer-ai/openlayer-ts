/**
 * Tests for the Mastra `OpenlayerExporter`.
 *
 * These never reach the network: the exporter is constructed and inspected,
 * and the span-type filter is driven through the protected
 * `_exportTracingEvent` hook with `super` stubbed out.
 */
import { SpanType, TracingEventType } from '@mastra/core/observability';

import { OPENLAYER_OTLP_ENDPOINT, OpenlayerExporter } from '../../src/lib/integrations/mastra';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  delete process.env['OPENLAYER_API_KEY'];
  delete process.env['OPENLAYER_INFERENCE_PIPELINE_ID'];
  delete process.env['OPENLAYER_OTEL_ENDPOINT'];
}

/**
 * Reach the resolved OTLP url/headers the exporter handed to its span exporter.
 *
 * The installed `@opentelemetry/exporter-trace-otlp-proto` (0.221.0) wraps the
 * real HTTP exporter behind `OTLPTraceExporter#_delegate._transport._transport`,
 * not `_transport` directly as in older versions — and its `headers` parameter
 * is itself an async function (`mergeHeaders` in
 * `otlp-exporter-base/configuration/otlp-http-configuration.js`), not a plain
 * object, because header merging can await user-provided async header
 * providers. Both details were confirmed by constructing an exporter and
 * logging its shape, not from documentation.
 */
async function exporterConfig(exporter: OpenlayerExporter): Promise<{ url?: string; headers?: any }> {
  const injected = (exporter as any).config?.exporter;
  const params = injected?._delegate?._transport?._transport?._parameters;
  return { url: params?.url, headers: params ? await params.headers() : undefined };
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

  it('prefers explicit configuration over the environment', async () => {
    process.env['OPENLAYER_API_KEY'] = 'sk-ol-env';
    process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] = 'pipeline-env';

    const exporter = new OpenlayerExporter({
      apiKey: 'sk-ol-explicit',
      inferencePipelineId: 'pipeline-explicit',
    });

    const { headers } = await exporterConfig(exporter);
    expect(headers?.['Authorization']).toBe('Bearer sk-ol-explicit');
    expect(headers?.['x-bt-parent']).toBe('pipeline_id:pipeline-explicit');
  });

  it('builds the Openlayer auth headers and defaults the endpoint', async () => {
    const exporter = new OpenlayerExporter({ apiKey: 'sk-ol', inferencePipelineId: 'pipe-1' });
    const { url, headers } = await exporterConfig(exporter);

    expect(url).toBe(OPENLAYER_OTLP_ENDPOINT);
    expect(headers?.['Authorization']).toBe('Bearer sk-ol');
    expect(headers?.['x-bt-parent']).toBe('pipeline_id:pipe-1');
  });

  it('honours a custom endpoint and merges user headers', async () => {
    const exporter = new OpenlayerExporter({
      apiKey: 'sk-ol',
      inferencePipelineId: 'pipe-1',
      endpoint: 'https://self-hosted.example.com/v1/traces',
      headers: { 'x-custom': 'value' },
    });
    const { url, headers } = await exporterConfig(exporter);

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
      exportedSpan: {
        type,
        id: 'a',
        traceId: 'b',
        name: 'n',
        startTime: new Date(),
        isEvent: false,
        isRootSpan: true,
      },
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
      exportedSpan: {
        type: SpanType.MODEL_CHUNK,
        id: 'a',
        traceId: 'b',
        name: 'n',
        startTime: new Date(),
        isEvent: false,
        isRootSpan: false,
      },
    });

    expect(forwarded).toEqual([SpanType.MODEL_CHUNK]);
    jest.restoreAllMocks();
  });
});
