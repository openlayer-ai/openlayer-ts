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
    // `role: 'tool'` is deliberately not the `defaultRole` ('user'), so an
    // implementation that ignored `record['role']` and always substituted the
    // default would fail here. The expectation is a fresh literal rather than
    // `input` itself, so in-place mutation of the caller's array — e.g. via
    // `coerceEntry` returning `record['parts']` unchanged — would also fail.
    const input = [{ role: 'tool', parts: [{ type: 'text', content: '4' }] }];
    expect(toGenAIMessages(input, 'user')).toEqual([
      { role: 'tool', parts: [{ type: 'text', content: '4' }] },
    ]);
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
    ).toEqual([{ role: 'assistant', parts: [{ type: 'text', content: 'x' }], finish_reason: 'length' }]);
  });

  it('degrades to a placeholder instead of throwing on a circular reference', () => {
    const circular: Record<string, unknown> = { role: 'user' };
    circular['self'] = circular;
    const result = toGenAIMessages([{ role: 'user', content: circular }], 'user');
    expect(result).toEqual([{ role: 'user', parts: [{ type: 'text', content: '[unserializable]' }] }]);
  });

  it('returns undefined for empty, null and undefined values', () => {
    expect(toGenAIMessages(undefined, 'user')).toBeUndefined();
    expect(toGenAIMessages(null, 'user')).toBeUndefined();
    expect(toGenAIMessages('', 'user')).toBeUndefined();
    expect(toGenAIMessages([], 'user')).toBeUndefined();
  });
});
