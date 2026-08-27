/**
 * Unit tests for the Mastra span attribute rewriter.
 *
 * The rules encoded here were established by probing the live Openlayer OTLP
 * endpoint; see the design spec for the measurements. The negative cases
 * matter as much as the positive ones — rewriting a tool span makes its
 * Openlayer step strictly worse.
 */
import { rewriteSpanAttributes } from '../../src/lib/integrations/mastra/spanRewriter';

// `OpenlayerOTLPTraceExporter` tests below spy on `OTLPTraceExporter.prototype.export`,
// a shared prototype. Restoring in `afterEach` (rather than as the last line of each
// test body) ensures a failing assertion mid-test can't leak the spy into a later,
// unrelated test.
afterEach(() => {
  jest.restoreAllMocks();
});

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

  it('never overwrites an existing gen_ai.output.messages', () => {
    const original = JSON.stringify([{ role: 'assistant', parts: [{ type: 'text', content: 'hi back' }] }]);
    const result = rewriteSpanAttributes({
      'mastra.span.type': 'model_generation',
      'gen_ai.output.messages': original,
      'mastra.model_generation.output': 'SHOULD NOT BE USED',
    });
    expect(result['gen_ai.output.messages']).toBe(original);
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

  it('leaves a tool span untouched even when gen_ai.tool.call.result is missing', () => {
    const result = rewriteSpanAttributes({
      'mastra.span.type': 'tool_call',
      'gen_ai.tool.call.arguments': '{"city":"Lisbon"}',
      'mastra.tool_call.output': 'Error: upstream 500',
    });
    expect(result['gen_ai.input.messages']).toBeUndefined();
    expect(result['gen_ai.output.messages']).toBeUndefined();
  });

  it('leaves mcp_tool_call and provider_tool_call spans untouched', () => {
    const mcpResult = rewriteSpanAttributes({
      'mastra.span.type': 'mcp_tool_call',
      'mastra.mcp_tool_call.input': 'SHOULD NOT BE USED',
      'mastra.mcp_tool_call.output': 'SHOULD NOT BE USED',
    });
    expect(mcpResult['gen_ai.input.messages']).toBeUndefined();
    expect(mcpResult['gen_ai.output.messages']).toBeUndefined();

    const providerResult = rewriteSpanAttributes({
      'mastra.span.type': 'provider_tool_call',
      'mastra.provider_tool_call.input': 'SHOULD NOT BE USED',
      'mastra.provider_tool_call.output': 'SHOULD NOT BE USED',
    });
    expect(providerResult['gen_ai.input.messages']).toBeUndefined();
    expect(providerResult['gen_ai.output.messages']).toBeUndefined();
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
    expect(rewriteSpanAttributes({ 'mastra.metadata.threadId': 'thread-1' })['session.id']).toBe('thread-1');
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

  it('lifts a numeric sessionId and userId, coercing them to strings', () => {
    // @mastra/otel-exporter's SpanConverter copies span.metadata onto attributes
    // verbatim for non-object values, so a numeric database id (e.g.
    // `metadata: { userId: 4821 }`) arrives here as a genuine number, not a string.
    const result = rewriteSpanAttributes({
      'mastra.metadata.sessionId': 4821,
      'mastra.metadata.userId': 90210,
    });
    expect(result['session.id']).toBe('4821');
    expect(result['user.id']).toBe('90210');
  });

  it('still does not lift an empty-string sessionId or userId', () => {
    const result = rewriteSpanAttributes({
      'mastra.metadata.sessionId': '',
      'mastra.metadata.userId': '',
    });
    expect(result['session.id']).toBeUndefined();
    expect(result['user.id']).toBeUndefined();
  });

  it('lifts an object-valued id, which Mastra pre-stringifies before it reaches the rewriter', () => {
    // Mastra's SpanConverter does `typeof v === 'object' ? JSON.stringify(v) : v`
    // before setting the attribute, so an object-valued id never arrives here as
    // an object — it arrives as the JSON string, which the existing string branch
    // already handles correctly.
    const result = rewriteSpanAttributes({
      'mastra.metadata.userId': JSON.stringify({ id: 4821, tenant: 'acme' }),
    });
    expect(result['user.id']).toBe('{"id":4821,"tenant":"acme"}');
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

describe('OpenlayerOTLPTraceExporter', () => {
  it('rewrites span attributes before delegating to the OTLP exporter', () => {
    // Required lazily so the suite above still runs if the optional peers are absent.
    const { OpenlayerOTLPTraceExporter } = require('../../src/lib/integrations/mastra/otlpExporter');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');

    const superExport = jest.spyOn(OTLPTraceExporter.prototype, 'export').mockImplementation(() => undefined);

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
  });

  it('exports the span unchanged rather than dropping the batch if rewriting throws', () => {
    const { OpenlayerOTLPTraceExporter } = require('../../src/lib/integrations/mastra/otlpExporter');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');

    const superExport = jest.spyOn(OTLPTraceExporter.prototype, 'export').mockImplementation(() => undefined);

    const exporter = new OpenlayerOTLPTraceExporter({ url: 'https://example.invalid/v1/traces' });
    // A getter that throws simulates a hostile span object.
    const span = {
      get attributes(): Record<string, unknown> {
        throw new Error('boom');
      },
    };

    expect(() => exporter.export([span] as any, () => undefined)).not.toThrow();
    expect(superExport).toHaveBeenCalledTimes(1);
  });
});

/**
 * `rewriteSpanAttributes` also normalizes a known set of non-canonical
 * `gen_ai.provider.name` values so Openlayer's cost lookup — an exact,
 * lowercased `(provider, model)` match with no server-side aliasing — can
 * find them. Confirmed live: Mastra's OpenAI Responses API calls report
 * `openai.responses`, which 404s against `llm-costs.openlayer.com`, while the
 * bare `openai` slug prices the same model.
 */
describe('rewriteSpanAttributes provider slug normalization', () => {
  it('rewrites a known non-canonical provider slug to the one Openlayer prices', () => {
    const result = rewriteSpanAttributes({
      'gen_ai.provider.name': 'openai.responses',
    });

    expect(result['gen_ai.provider.name']).toBe('openai');
  });

  it('leaves an unrecognized dotted provider slug unchanged', () => {
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);

    const result = rewriteSpanAttributes({
      'gen_ai.provider.name': 'somevendor.someapi',
    });

    expect(result['gen_ai.provider.name']).toBe('somevendor.someapi');
  });

  it('leaves an already-canonical provider slug unchanged', () => {
    const result = rewriteSpanAttributes({
      'gen_ai.provider.name': 'openai',
    });

    expect(result['gen_ai.provider.name']).toBe('openai');
  });

  it('rewrites the provider slug without disturbing other attributes on the span', () => {
    const result = rewriteSpanAttributes({
      'gen_ai.provider.name': 'anthropic.messages',
      'gen_ai.request.model': 'claude-sonnet-4-20250514',
      'mastra.span.type': 'model_generation',
    });

    expect(result['gen_ai.provider.name']).toBe('anthropic');
    expect(result['gen_ai.request.model']).toBe('claude-sonnet-4-20250514');
    expect(result['mastra.span.type']).toBe('model_generation');
  });

  it('logs a debug miss signal for an unrecognized dotted provider slug', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);

    rewriteSpanAttributes({ 'gen_ai.provider.name': 'somevendor.someapi' });

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0]![0]).toContain('somevendor.someapi');
  });

  it('does not log a miss signal for a bare (non-dotted) provider slug', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);

    rewriteSpanAttributes({ 'gen_ai.provider.name': 'openai' });

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('does not log a miss signal for a dotted slug that has a verified alias', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);

    rewriteSpanAttributes({ 'gen_ai.provider.name': 'openai.responses' });

    expect(debugSpy).not.toHaveBeenCalled();
  });
});
