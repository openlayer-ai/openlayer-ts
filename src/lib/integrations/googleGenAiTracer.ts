/**
 * Openlayer tracing integration for the unified Google Gen AI SDK
 * (``@google/genai``).
 *
 * Wraps ``client.models.generateContent`` and
 * ``client.models.generateContentStream`` so each call becomes a
 * CHAT_COMPLETION step on the current Openlayer trace.
 *
 * The same client class serves both Vertex AI and AI Studio; ``client.vertexai``
 * distinguishes them and Vertex calls carry ``llm_system: "google_vertex"`` in
 * metadata, matching the Python ADK tracer.
 *
 * Note: ``client.chats`` is constructed with the very same ``Models`` instance
 * and dispatches through ``models.generateContent`` at call time, so chat
 * sessions are traced by this patch as well.
 *
 * Two details below are cost-correctness requirements rather than style choices,
 * and both fail silently if changed — see the comments on ``PROVIDER``,
 * ``normalizeModelName`` and ``extractUsage``. Design notes and the end-to-end
 * cost verification live on OPEN-11903.
 */
import performanceNow from 'performance-now';

import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from '@google/genai';

import { addChatCompletionStepToTrace } from '../tracing/tracer';

/** Step name, matching the Python ``gemini_tracer``. */
const STEP_NAME = 'Gemini Generation';

/**
 * Provider string. Load-bearing: the Openlayer cost table keys on this exact
 * value, and an unrecognized provider yields a silent $0 cost.
 */
const PROVIDER = 'Google';

/**
 * Patch a ``GoogleGenAI`` client to trace its content-generation calls.
 *
 * @param client - The client to patch. Mutated in place.
 * @returns The same client, for convenient inline use.
 */
export function traceGoogleGenAI(client: GoogleGenAI): GoogleGenAI {
  const models = client.models;
  const originalGenerateContent = models.generateContent;
  const originalGenerateContentStream = models.generateContentStream;

  models.generateContent = async (params: GenerateContentParameters): Promise<GenerateContentResponse> => {
    const startTime = performanceNow();
    // `.call` is belt-and-braces: these are pre-bound arrow properties today,
    // but this keeps working if they ever become prototype methods.
    //
    // Deliberately outside the try/catch below: an API error must propagate
    // untouched rather than be reported as a tracing failure.
    const response = await originalGenerateContent.call(models, params);
    const endTime = performanceNow();

    try {
      const usage = extractUsage(response.usageMetadata);
      addChatCompletionStepToTrace({
        name: STEP_NAME,
        inputs: { prompt: formatInputMessages(params) },
        output: extractOutput(readCandidateContent(response)),
        latency: endTime - startTime,
        tokens: usage.tokens,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        model: normalizeModelName(response.modelVersion ?? params.model),
        modelParameters: getModelParameters(params),
        metadata: buildMetadata(response, client.vertexai, null),
        provider: PROVIDER,
        startTime,
        endTime,
      });
    } catch (error) {
      // Never let a tracing bug break the caller's LLM call.
      console.error('Failed to trace the Google GenAI request with Openlayer', error);
    }

    return response;
  };

  models.generateContentStream = async (
    params: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> => {
    const startTime = performanceNow();
    // Outside the generator so a failure to open the stream propagates as-is.
    const stream = await originalGenerateContentStream.call(models, params);
    return traceStream(stream, params, startTime, client.vertexai);
  };

  return client;
}

/**
 * Wrap a Gemini content stream, yielding every chunk through untouched and
 * emitting one step once the stream is exhausted.
 *
 * If the consumer abandons the stream early the step is not emitted, matching
 * the behavior of the OpenAI tracer.
 */
async function* traceStream(
  stream: AsyncGenerator<GenerateContentResponse>,
  params: GenerateContentParameters,
  startTime: number,
  vertexai: boolean,
): AsyncGenerator<GenerateContentResponse> {
  const textParts: string[] = [];
  const functionCalls: any[] = [];
  let firstTokenTime: number | null = null;
  let lastChunk: GenerateContentResponse | undefined;
  let lastUsage: GenerateContentResponse['usageMetadata'];

  for await (const chunk of stream) {
    if (firstTokenTime === null) {
      firstTokenTime = performanceNow();
    }
    lastChunk = chunk;
    // Gemini's per-chunk usage is cumulative, so the last report wins.
    // Summing would multiply-count the prompt on every chunk.
    if (chunk.usageMetadata) {
      lastUsage = chunk.usageMetadata;
    }
    // Text is per-chunk and must be concatenated; function-call parts arrive
    // whole, so they accumulate across chunks.
    const content = readCandidateContent(chunk);
    if (content.text) {
      textParts.push(content.text);
    }
    functionCalls.push(...content.functionCalls);
    yield chunk;
  }

  const endTime = performanceNow();

  try {
    const usage = extractUsage(lastUsage);
    const output = extractOutput({ text: textParts.join(''), functionCalls });

    addChatCompletionStepToTrace({
      name: STEP_NAME,
      inputs: { prompt: formatInputMessages(params) },
      output,
      latency: endTime - startTime,
      tokens: usage.tokens,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      model: normalizeModelName(lastChunk?.modelVersion ?? params.model),
      modelParameters: getModelParameters(params),
      metadata: buildMetadata(
        lastChunk,
        vertexai,
        firstTokenTime === null ? null : firstTokenTime - startTime,
      ),
      provider: PROVIDER,
      startTime,
      endTime,
    });
  } catch (error) {
    console.error('Failed to trace the Google GenAI streaming request with Openlayer', error);
  }
}

/** One normalized prompt message. */
interface PromptMessage {
  role: string;
  content: string;
}

/**
 * Reduce a model identifier to its bare name.
 *
 * Vertex callers get fully-qualified names back
 * (``projects/…/publishers/google/models/gemini-2.5-flash``) and AI Studio
 * accepts a ``models/`` prefix. Either form prices at $0.00 on the Openlayer
 * backend, so this normalization is load-bearing rather than cosmetic.
 */
function normalizeModelName(model?: string | null): string | null {
  if (!model) {
    return null;
  }
  const segments = model.split('/');
  return segments[segments.length - 1] || model;
}

/** Join the text of a ``Content.parts`` array, mirroring the Python tracer. */
function partsToText(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return '';
  }
  return parts
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      const text = (part as { text?: unknown } | null)?.text;
      return typeof text === 'string' ? text : '';
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Normalize a ``ContentListUnion`` into ``{ role, content }`` messages.
 *
 * Accepts a string, a ``Content``, a ``Part``, or an array of any of those.
 */
function toMessages(contents: unknown): PromptMessage[] {
  if (contents === null || contents === undefined) {
    return [];
  }
  if (typeof contents === 'string') {
    return [{ role: 'user', content: contents }];
  }
  if (Array.isArray(contents)) {
    return contents.flatMap((item) => toMessages(item));
  }
  const item = contents as { role?: unknown; parts?: unknown; text?: unknown };
  if (Array.isArray(item.parts)) {
    return [{ role: typeof item.role === 'string' ? item.role : 'user', content: partsToText(item.parts) }];
  }
  if (typeof item.text === 'string') {
    return [{ role: 'user', content: item.text }];
  }
  return [{ role: 'user', content: String(contents) }];
}

/**
 * Build the prompt recorded on the step.
 *
 * Gemini carries the system prompt outside ``contents``, so a configured
 * ``systemInstruction`` is prepended as a system message — otherwise the
 * recorded input would misrepresent what the model actually saw.
 */
function formatInputMessages(params: GenerateContentParameters): PromptMessage[] {
  const systemInstruction = (params.config as { systemInstruction?: unknown } | undefined)?.systemInstruction;
  const system = toMessages(systemInstruction).map((message) => ({ ...message, role: 'system' }));
  return [...system, ...toMessages(params.contents)];
}

/** What a response (or stream chunk) actually carries in its first candidate. */
interface CandidateContent {
  text: string;
  functionCalls: any[];
}

/**
 * Read text and function calls straight off the first candidate's parts.
 *
 * The SDK's ``.text`` and ``.functionCalls`` getters compute the same thing, but
 * they ``console.warn`` whenever the response holds non-text parts (every tool
 * call) or several candidates. Instrumentation must not put noise in the
 * caller's output that the caller did not cause, so we mirror their logic —
 * including skipping ``thought`` parts, which are excluded from text — rather
 * than invoking them. Both getters read exclusively from
 * ``candidates[0].content.parts``, so this sees exactly what they would.
 */
function readCandidateContent(response: GenerateContentResponse): CandidateContent {
  const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<Record<string, any>>;
  const textSegments: string[] = [];
  const functionCalls: any[] = [];

  for (const part of parts) {
    if (part['functionCall']) {
      functionCalls.push(part['functionCall']);
    }
    // `thought: true` parts are the model's reasoning, which the SDK omits from
    // text; their tokens are still counted in `thoughtsTokenCount`.
    if (typeof part['text'] === 'string' && part['thought'] !== true) {
      textSegments.push(part['text']);
    }
  }

  return { text: textSegments.join(''), functionCalls };
}

/**
 * The step's output: the answer text, the serialized function calls, or both.
 *
 * Both are kept when both are present — a thinking model can emit a preamble
 * alongside a tool call, and dropping either half would lose information the
 * trace exists to capture.
 */
function extractOutput(content: CandidateContent): string {
  const segments: string[] = [];
  if (content.text) {
    segments.push(content.text);
  }
  if (content.functionCalls.length > 0) {
    segments.push(JSON.stringify(content.functionCalls, null, 2));
  }
  return segments.join('\n');
}

/** Token counts, or all-null when the response carries no usage. */
function extractUsage(usage: GenerateContentResponse['usageMetadata']): {
  promptTokens: number | null;
  completionTokens: number | null;
  tokens: number | null;
} {
  if (!usage) {
    return { promptTokens: null, completionTokens: null, tokens: null };
  }
  // Tool-use prompt tokens are input-side; thinking tokens are billed as
  // output. Gemini 2.5 thinks by default and thoughts routinely dominate the
  // billable output, so folding them in is what keeps cost correct.
  const promptTokens = (usage.promptTokenCount ?? 0) + (usage.toolUsePromptTokenCount ?? 0);
  const completionTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const tokens = usage.totalTokenCount ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, tokens };
}

/** Model parameters, snake_cased to match the other Openlayer tracers. */
function getModelParameters(params: GenerateContentParameters): Record<string, any> {
  const config = (params.config ?? {}) as Record<string, any>;
  return {
    temperature: config['temperature'] ?? null,
    top_p: config['topP'] ?? null,
    top_k: config['topK'] ?? null,
    max_output_tokens: config['maxOutputTokens'] ?? null,
    candidate_count: config['candidateCount'] ?? null,
    stop_sequences: config['stopSequences'] ?? null,
    seed: config['seed'] ?? null,
    presence_penalty: config['presencePenalty'] ?? null,
    frequency_penalty: config['frequencyPenalty'] ?? null,
    response_mime_type: config['responseMimeType'] ?? null,
  };
}

/**
 * Compact step metadata.
 *
 * Deliberately excludes the raw response: trace payload size is a known problem
 * in this SDK and multimodal replies can be very large.
 */
function buildMetadata(
  response: GenerateContentResponse | undefined,
  vertexai: boolean,
  timeToFirstToken: number | null,
): Record<string, any> {
  const metadata: Record<string, any> = {};
  // Only ever `google_vertex`, and only for Vertex. Matches the Python ADK
  // tracer; inventing an AI Studio value would repeat OPEN-11695/OPEN-9928.
  if (vertexai) {
    metadata['llm_system'] = 'google_vertex';
  }
  const finishReason = response?.candidates?.[0]?.finishReason;
  if (finishReason) {
    metadata['finishReason'] = finishReason;
  }
  if (response?.responseId) {
    metadata['responseId'] = response.responseId;
  }
  if (response?.modelVersion) {
    metadata['modelVersion'] = response.modelVersion;
  }
  if (timeToFirstToken !== null) {
    metadata['timeToFirstToken'] = timeToFirstToken;
  }
  return metadata;
}
