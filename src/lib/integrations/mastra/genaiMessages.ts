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
  const resolvedFinishReason = typeof existingFinishReason === 'string' ? existingFinishReason : finishReason;

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
    return parsed.length === 0 ?
        undefined
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
