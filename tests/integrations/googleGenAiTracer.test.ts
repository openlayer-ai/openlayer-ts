import { traceGoogleGenAI } from '../../src/lib/integrations/googleGenAiTracer';
import { addChatCompletionStepToTrace } from '../../src/lib/tracing/tracer';

jest.mock('../../src/lib/tracing/tracer', () => ({
  addChatCompletionStepToTrace: jest.fn(),
}));

/** Minimal stand-in for a GoogleGenAI client. */
function makeClient(overrides: { vertexai?: boolean } = {}) {
  return {
    vertexai: overrides.vertexai ?? false,
    models: {
      generateContent: jest.fn(),
      generateContentStream: jest.fn(),
    },
  };
}

describe('traceGoogleGenAI', () => {
  let addStepMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    addStepMock = addChatCompletionStepToTrace as jest.Mock;
  });

  describe('patching', () => {
    it('returns the same client instance and replaces both methods', () => {
      const client = makeClient();
      const originalGenerate = client.models.generateContent;
      const originalStream = client.models.generateContentStream;

      const traced = traceGoogleGenAI(client as any);

      expect(traced).toBe(client);
      expect(client.models.generateContent).not.toBe(originalGenerate);
      expect(client.models.generateContentStream).not.toBe(originalStream);
    });

    it('passes params through and returns the original response unchanged', async () => {
      const client = makeClient();
      const response = { text: 'hi', usageMetadata: { promptTokenCount: 1 } };
      client.models.generateContent.mockResolvedValue(response);
      // Captured before patching: after it, `client.models.generateContent` is
      // the wrapper, not the jest mock.
      const underlying = client.models.generateContent;
      traceGoogleGenAI(client as any);

      const params = { model: 'gemini-2.5-flash', contents: 'hello' };
      const result = await (client.models.generateContent as any)(params);

      expect(result).toBe(response);
      expect(underlying).toHaveBeenCalledTimes(1);
      expect(underlying).toHaveBeenCalledWith(params);
    });

    it('yields every stream chunk unchanged and in order', async () => {
      const client = makeClient();
      const chunks = [{ text: 'a' }, { text: 'b' }, { text: 'c' }];
      client.models.generateContentStream.mockResolvedValue(
        (async function* () {
          for (const c of chunks) yield c;
        })(),
      );
      traceGoogleGenAI(client as any);

      const stream = await (client.models.generateContentStream as any)({
        model: 'gemini-2.5-flash',
        contents: 'hello',
      });
      const seen = [];
      for await (const c of stream) seen.push(c);

      expect(seen).toEqual(chunks);
    });
  });

  /**
   * Build a candidate the way the API actually sends one.
   *
   * Content lives in `candidates[0].content.parts` — `text` and `functionCalls`
   * are computed getters on the real response class, never wire fields, so
   * fixtures must not fake them as plain properties.
   */
  function makeCandidate(
    parts: Array<Record<string, any>>,
    overrides: Record<string, any> = {},
  ): Record<string, any> {
    return { content: { role: 'model', parts }, finishReason: 'STOP', ...overrides };
  }

  /** A realistic AI Studio response, shaped from a live gemini-2.5-flash call. */
  function makeResponse(overrides: Record<string, any> = {}) {
    return {
      modelVersion: 'gemini-2.5-flash',
      responseId: 'wABoauXrDcmGz7IPv_GAoA4',
      candidates: [makeCandidate([{ text: 'Hello there, friend.' }])],
      usageMetadata: {
        promptTokenCount: 8,
        candidatesTokenCount: 5,
        thoughtsTokenCount: 190,
        totalTokenCount: 203,
      },
      ...overrides,
    };
  }

  async function callTraced(client: any, params: any) {
    return (client.models.generateContent as any)(params);
  }

  describe('non-streaming', () => {
    it('emits a complete chat-completion step', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse());
      traceGoogleGenAI(client as any);

      await callTraced(client, {
        model: 'gemini-2.5-flash',
        contents: 'Say hello in exactly three words.',
        config: { temperature: 0.2, maxOutputTokens: 200 },
      });

      expect(addStepMock).toHaveBeenCalledTimes(1);
      const step = addStepMock.mock.calls[0][0];
      expect(step).toEqual(
        expect.objectContaining({
          name: 'Gemini Generation',
          provider: 'Google',
          model: 'gemini-2.5-flash',
          output: 'Hello there, friend.',
          inputs: { prompt: [{ role: 'user', content: 'Say hello in exactly three words.' }] },
        }),
      );
      expect(step.latency).toBeGreaterThanOrEqual(0);
      expect(step.startTime).toBeLessThanOrEqual(step.endTime);
    });

    it('folds thinking tokens into completionTokens', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse());
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      const step = addStepMock.mock.calls[0][0];
      // 5 answer tokens + 190 thinking tokens. Using 5 alone under-reports
      // billable output by 39x and cost by ~33x, silently.
      expect(step.completionTokens).toBe(195);
      expect(step.promptTokens).toBe(8);
      expect(step.tokens).toBe(203);
      expect(step.promptTokens + step.completionTokens).toBe(step.tokens);
    });

    it('counts tool-use prompt tokens as input', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(
        makeResponse({
          usageMetadata: {
            promptTokenCount: 10,
            toolUsePromptTokenCount: 4,
            candidatesTokenCount: 6,
            thoughtsTokenCount: 0,
            totalTokenCount: 20,
          },
        }),
      );
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      const step = addStepMock.mock.calls[0][0];
      expect(step.promptTokens).toBe(14);
      expect(step.completionTokens).toBe(6);
      expect(step.tokens).toBe(20);
    });

    it('falls back to the sum when totalTokenCount is absent', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(
        makeResponse({ usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 } }),
      );
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].tokens).toBe(7);
    });

    it('nulls token fields when usageMetadata is missing entirely', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse({ usageMetadata: undefined }));
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      const step = addStepMock.mock.calls[0][0];
      expect(step.promptTokens).toBeNull();
      expect(step.completionTokens).toBeNull();
      expect(step.tokens).toBeNull();
    });

    // Cost regression guard. Every unnormalized form below prices at $0.00 on
    // the Openlayer backend, with no error surfaced anywhere.
    it.each([
      ['gemini-2.5-flash', 'gemini-2.5-flash'],
      ['models/gemini-2.5-flash', 'gemini-2.5-flash'],
      ['projects/p/locations/us-central1/publishers/google/models/gemini-2.5-flash', 'gemini-2.5-flash'],
    ])('normalizes model name %s -> %s', async (raw, expected) => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse({ modelVersion: raw }));
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: raw, contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].model).toBe(expected);
    });

    it('falls back to params.model when modelVersion is absent', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse({ modelVersion: undefined }));
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'models/gemini-2.5-pro', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].model).toBe('gemini-2.5-pro');
    });

    it('sets llm_system only in Vertex mode', async () => {
      const vertex = makeClient({ vertexai: true });
      vertex.models.generateContent.mockResolvedValue(makeResponse());
      traceGoogleGenAI(vertex as any);
      await callTraced(vertex, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].metadata).toEqual(
        expect.objectContaining({ llm_system: 'google_vertex' }),
      );
    });

    it('omits llm_system in AI Studio mode', async () => {
      const studio = makeClient({ vertexai: false });
      studio.models.generateContent.mockResolvedValue(makeResponse());
      traceGoogleGenAI(studio as any);
      await callTraced(studio, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].metadata).not.toHaveProperty('llm_system');
    });

    it('records finishReason, responseId and modelVersion in metadata', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse());
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].metadata).toEqual({
        finishReason: 'STOP',
        responseId: 'wABoauXrDcmGz7IPv_GAoA4',
        modelVersion: 'gemini-2.5-flash',
      });
    });

    it('extracts model parameters from config as snake_case', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse());
      traceGoogleGenAI(client as any);

      await callTraced(client, {
        model: 'gemini-2.5-flash',
        contents: 'hi',
        config: {
          temperature: 0.2,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 200,
          candidateCount: 1,
          stopSequences: ['STOP'],
          seed: 7,
          presencePenalty: 0.1,
          frequencyPenalty: 0.2,
          responseMimeType: 'application/json',
        },
      });

      expect(addStepMock.mock.calls[0][0].modelParameters).toEqual({
        temperature: 0.2,
        top_p: 0.9,
        top_k: 40,
        max_output_tokens: 200,
        candidate_count: 1,
        stop_sequences: ['STOP'],
        seed: 7,
        presence_penalty: 0.1,
        frequency_penalty: 0.2,
        response_mime_type: 'application/json',
      });
    });

    it('nulls every model parameter when config is absent', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse());
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(Object.values(addStepMock.mock.calls[0][0].modelParameters)).toEqual(Array(10).fill(null));
    });

    it('serializes function calls when there is no text', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(
        makeResponse({
          candidates: [makeCandidate([{ functionCall: { name: 'get_weather', args: { city: 'SF' } } }])],
        }),
      );
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      const output = addStepMock.mock.calls[0][0].output;
      expect(output).toContain('get_weather');
      expect(JSON.parse(output)).toEqual([{ name: 'get_weather', args: { city: 'SF' } }]);
    });

    it('keeps both the preamble text and the function call when both are present', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(
        makeResponse({
          candidates: [
            makeCandidate([
              { text: 'Let me look that up.' },
              { functionCall: { name: 'get_weather', args: { city: 'SF' } } },
            ]),
          ],
        }),
      );
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      const output = addStepMock.mock.calls[0][0].output;
      expect(output).toContain('Let me look that up.');
      expect(output).toContain('get_weather');
    });

    it('excludes thought parts from the output text', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(
        makeResponse({
          candidates: [
            makeCandidate([{ text: 'internal reasoning', thought: true }, { text: 'the actual answer' }]),
          ],
        }),
      );
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      // Thinking tokens are still billed and counted, but the reasoning text is
      // not the model's answer — the SDK's own `.text` getter omits it too.
      expect(addStepMock.mock.calls[0][0].output).toBe('the actual answer');
    });

    it('reads content without tripping the SDK getter warnings', async () => {
      // The `.text` / `.functionCalls` getters console.warn on every tool call.
      // The tracer must not add noise the caller did not cause, so it reads the
      // candidate parts directly. Defining the getters here proves they are
      // never touched.
      const client = makeClient();
      const textGetter = jest.fn(() => 'from getter');
      const callsGetter = jest.fn(() => []);
      const response = makeResponse();
      Object.defineProperty(response, 'text', { get: textGetter });
      Object.defineProperty(response, 'functionCalls', { get: callsGetter });
      client.models.generateContent.mockResolvedValue(response);
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(textGetter).not.toHaveBeenCalled();
      expect(callsGetter).not.toHaveBeenCalled();
      expect(addStepMock.mock.calls[0][0].output).toBe('Hello there, friend.');
    });

    it('produces an empty output when there is neither text nor function calls', async () => {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse({ candidates: [] }));
      traceGoogleGenAI(client as any);

      await callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].output).toBe('');
    });
  });

  describe('input normalization', () => {
    async function promptFor(contents: any, config?: any) {
      const client = makeClient();
      client.models.generateContent.mockResolvedValue(makeResponse());
      traceGoogleGenAI(client as any);
      await callTraced(client, { model: 'gemini-2.5-flash', contents, config });
      return addStepMock.mock.calls[0][0].inputs.prompt;
    }

    it('wraps a bare string as a user message', async () => {
      expect(await promptFor('hello')).toEqual([{ role: 'user', content: 'hello' }]);
    });

    it('reads role and text parts off a Content object', async () => {
      expect(await promptFor({ role: 'model', parts: [{ text: 'a' }, { text: 'b' }] })).toEqual([
        { role: 'model', content: 'a b' },
      ]);
    });

    it('maps an array of mixed contents', async () => {
      expect(await promptFor(['first', { role: 'model', parts: [{ text: 'second' }] }])).toEqual([
        { role: 'user', content: 'first' },
        { role: 'model', content: 'second' },
      ]);
    });

    it('treats a bare Part as a user message', async () => {
      expect(await promptFor({ text: 'just a part' })).toEqual([{ role: 'user', content: 'just a part' }]);
    });

    it('prepends systemInstruction as a system message', async () => {
      expect(await promptFor('hello', { systemInstruction: 'Be terse.' })).toEqual([
        { role: 'system', content: 'Be terse.' },
        { role: 'user', content: 'hello' },
      ]);
    });

    it('handles a Content-shaped systemInstruction', async () => {
      expect(await promptFor('hello', { systemInstruction: { parts: [{ text: 'Be terse.' }] } })).toEqual([
        { role: 'system', content: 'Be terse.' },
        { role: 'user', content: 'hello' },
      ]);
    });

    it('produces an empty prompt for null contents', async () => {
      expect(await promptFor(null)).toEqual([]);
    });
  });

  describe('streaming', () => {
    /** A stream chunk carrying text, shaped the way the API sends it. */
    function textChunk(text: string, overrides: Record<string, any> = {}) {
      return { candidates: [makeCandidate([{ text }])], ...overrides };
    }

    function makeStreamingClient(chunks: any[], overrides: { vertexai?: boolean } = {}) {
      const client = makeClient(overrides);
      client.models.generateContentStream.mockResolvedValue(
        (async function* () {
          for (const chunk of chunks) yield chunk;
        })(),
      );
      traceGoogleGenAI(client as any);
      return client;
    }

    async function drain(client: any, params: any) {
      const stream = await (client.models.generateContentStream as any)(params);
      const seen = [];
      for await (const chunk of stream) seen.push(chunk);
      return seen;
    }

    it('concatenates chunk text and emits one step', async () => {
      const client = makeStreamingClient([
        textChunk('One, ', { modelVersion: 'gemini-2.5-flash' }),
        textChunk('Two, ', { modelVersion: 'gemini-2.5-flash' }),
        textChunk('Three.', {
          modelVersion: 'gemini-2.5-flash',
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 6,
            thoughtsTokenCount: 19,
            totalTokenCount: 30,
          },
        }),
      ]);

      await drain(client, { model: 'gemini-2.5-flash', contents: 'Count to three.' });

      expect(addStepMock).toHaveBeenCalledTimes(1);
      const step = addStepMock.mock.calls[0][0];
      expect(step.name).toBe('Gemini Generation');
      expect(step.provider).toBe('Google');
      expect(step.output).toBe('One, Two, Three.');
      expect(step.model).toBe('gemini-2.5-flash');
    });

    it('takes the last reported usage rather than summing', async () => {
      // Gemini reports cumulative usage per chunk. Summing would triple-count.
      const client = makeStreamingClient([
        textChunk('a', {
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1, totalTokenCount: 6 },
        }),
        textChunk('b', {
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
        }),
        textChunk('c', {
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 6,
            thoughtsTokenCount: 19,
            totalTokenCount: 30,
          },
        }),
      ]);

      await drain(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      const step = addStepMock.mock.calls[0][0];
      expect(step.promptTokens).toBe(5);
      expect(step.completionTokens).toBe(25);
      expect(step.tokens).toBe(30);
      expect(step.promptTokens + step.completionTokens).toBe(step.tokens);
    });

    it('keeps usage from an earlier chunk when the final chunk reports none', async () => {
      const client = makeStreamingClient([
        textChunk('a', {
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 6, totalTokenCount: 11 },
        }),
        textChunk('b'),
      ]);

      await drain(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].tokens).toBe(11);
    });

    it('records timeToFirstToken', async () => {
      const client = makeStreamingClient([textChunk('a'), textChunk('b')]);

      await drain(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      const metadata = addStepMock.mock.calls[0][0].metadata;
      expect(metadata).toHaveProperty('timeToFirstToken');
      expect(metadata.timeToFirstToken).toBeGreaterThanOrEqual(0);
    });

    it('sets llm_system in Vertex mode', async () => {
      const client = makeStreamingClient([textChunk('a')], { vertexai: true });

      await drain(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].metadata).toEqual(
        expect.objectContaining({ llm_system: 'google_vertex' }),
      );
    });

    it('normalizes a Vertex fully-qualified model name', async () => {
      const fqn = 'projects/p/locations/us-central1/publishers/google/models/gemini-2.5-flash';
      const client = makeStreamingClient([textChunk('a', { modelVersion: fqn })], {
        vertexai: true,
      });

      await drain(client, { model: fqn, contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].model).toBe('gemini-2.5-flash');
    });

    it('serializes streamed function calls when no text arrives', async () => {
      const client = makeStreamingClient([
        { candidates: [makeCandidate([{ functionCall: { name: 'get_weather', args: { city: 'SF' } } }])] },
      ]);

      await drain(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      expect(addStepMock.mock.calls[0][0].output).toContain('get_weather');
    });

    it('accumulates function calls arriving across separate chunks', async () => {
      const client = makeStreamingClient([
        { candidates: [makeCandidate([{ functionCall: { name: 'get_weather', args: { city: 'SF' } } }])] },
        { candidates: [makeCandidate([{ functionCall: { name: 'get_time', args: { tz: 'PT' } } }])] },
      ]);

      await drain(client, { model: 'gemini-2.5-flash', contents: 'hi' });

      const output = addStepMock.mock.calls[0][0].output;
      expect(JSON.parse(output)).toEqual([
        { name: 'get_weather', args: { city: 'SF' } },
        { name: 'get_time', args: { tz: 'PT' } },
      ]);
    });

    it('records no step when the consumer abandons the stream early', async () => {
      const client = makeStreamingClient([textChunk('a'), textChunk('b'), textChunk('c')]);

      const stream = await (client.models.generateContentStream as any)({
        model: 'gemini-2.5-flash',
        contents: 'hi',
      });
      for await (const _chunk of stream) {
        break;
      }

      expect(addStepMock).not.toHaveBeenCalled();
    });

    it('propagates a stream-open error unchanged', async () => {
      const client = makeClient();
      const boom = new Error('503 Service unavailable');
      client.models.generateContentStream.mockRejectedValue(boom);
      traceGoogleGenAI(client as any);

      await expect(
        (client.models.generateContentStream as any)({ model: 'gemini-2.5-flash', contents: 'hi' }),
      ).rejects.toBe(boom);
      expect(addStepMock).not.toHaveBeenCalled();
    });
  });

  describe('error isolation', () => {
    it('propagates an API error unchanged and records no step', async () => {
      const client = makeClient();
      const boom = new Error('429 Resource exhausted');
      client.models.generateContent.mockRejectedValue(boom);
      traceGoogleGenAI(client as any);

      await expect(callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' })).rejects.toBe(boom);
      expect(addStepMock).not.toHaveBeenCalled();
    });

    it('still returns the response when tracing itself throws', async () => {
      const client = makeClient();
      const response = makeResponse();
      client.models.generateContent.mockResolvedValue(response);
      addStepMock.mockImplementation(() => {
        throw new Error('tracer exploded');
      });
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      traceGoogleGenAI(client as any);

      await expect(callTraced(client, { model: 'gemini-2.5-flash', contents: 'hi' })).resolves.toBe(response);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
