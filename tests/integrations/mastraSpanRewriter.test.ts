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
