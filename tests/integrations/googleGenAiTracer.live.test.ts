/**
 * Live integration test for the Google GenAI Openlayer tracer.
 *
 * Every test exercises the real ``@google/genai`` client, the real Openlayer
 * publish path, and reads the row back to confirm the backend priced it — the
 * assertions run against the stored row, not against local objects.
 *
 * Two independently guarded suites:
 *   - AI Studio, enabled by ``GOOGLE_API_KEY`` / ``GEMINI_API_KEY``
 *   - Vertex AI, enabled by ``GOOGLE_CLOUD_PROJECT`` (needs Application Default
 *     Credentials: ``gcloud auth application-default login``)
 *
 * Env it expects:
 *   GOOGLE_API_KEY / GEMINI_API_KEY — enables the AI Studio suite
 *   GOOGLE_CLOUD_PROJECT           — enables the Vertex suite
 *   GOOGLE_CLOUD_LOCATION          — Vertex region, defaults to us-central1
 *   OPENLAYER_API_KEY               — Openlayer ingest key
 *   OPENLAYER_INFERENCE_PIPELINE_ID — destination pipeline
 *
 * The Vertex suite must be run with ``--experimental-vm-modules``:
 *
 *     NODE_OPTIONS=--experimental-vm-modules npx jest \
 *       tests/integrations/googleGenAiTracer.live.test.ts
 *
 * Without it every Vertex test fails with an opaque ``Unexpected Gaxios Error``.
 * The cause is the harness, not the tracer: refreshing an ADC OAuth token goes
 * through ``gaxios``, which uses a dynamic ``import()``, and Jest's VM context
 * rejects that unless the flag is set. AI Studio is unaffected because an API
 * key is sent as a plain header with no token refresh.
 */
import { GoogleGenAI, Type } from '@google/genai';

import { traceGoogleGenAI } from '../../src/lib/integrations/googleGenAiTracer';
import trace, { getCurrentTrace } from '../../src/lib/tracing/tracer';

// Kept as a plain `string` rather than `string | undefined`: the repo compiles
// with `exactOptionalPropertyTypes`, so `GoogleGenAIOptions.apiKey` rejects
// `undefined` outright. The empty string simply never reaches the client,
// because `itLive` skips every test in that case.
const apiKey = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY'] ?? '';
const itLive = apiKey ? it : it.skip;

// Vertex needs a GCP project plus Application Default Credentials
// (`gcloud auth application-default login`) rather than an API key, so it is
// guarded separately from the AI Studio tests above.
const vertexProject = process.env['GOOGLE_CLOUD_PROJECT'] ?? '';
const vertexLocation = process.env['GOOGLE_CLOUD_LOCATION'] ?? 'us-central1';
const itVertex = vertexProject ? it : it.skip;

const PIPELINE_ID = 'cb47e4f7-15a0-4e70-bd6e-7b1b4b54e434';

/**
 * Poll the row back until it satisfies `isReady`.
 *
 * Waiting only for the row to *exist* is not enough: it can surface before all
 * of its steps and their computed costs are in place, which makes any assertion
 * on step count or cost fail intermittently. Callers therefore state the
 * condition they actually need, and the poll waits for that rather than for
 * mere existence.
 */
async function fetchRow(inferenceId: string, isReady: (row: any) => boolean = () => true): Promise<any> {
  const url = `https://api.openlayer.com/v1/inference-pipelines/${process.env['OPENLAYER_INFERENCE_PIPELINE_ID']}/rows?inferenceId=${inferenceId}`;
  let lastSeen: any;
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env['OPENLAYER_API_KEY']}` },
    });
    if (res.ok) {
      const body: any = await res.json();
      if (body?.row) {
        lastSeen = body.row;
        if (isReady(body.row)) {
          return body.row;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (lastSeen) {
    throw new Error(
      `row ${inferenceId} appeared but never became ready; last seen: ` +
        JSON.stringify(chatCompletionSteps(lastSeen).map((s: any) => ({ cost: s.cost }))),
    );
  }
  throw new Error(`row ${inferenceId} never appeared`);
}

/** Every chat-completion step in a published row, at any nesting depth. */
function chatCompletionSteps(row: any): any[] {
  const flatten = (steps: any[]): any[] =>
    (steps ?? []).flatMap((step: any) => [step, ...flatten(step.steps)]);
  return flatten(row?.steps).filter((step: any) => step.type === 'chat_completion');
}

/** Readiness predicate: `count` priced chat-completion steps are present. */
function pricedSteps(count: number): (row: any) => boolean {
  return (row: any) => {
    const steps = chatCompletionSteps(row);
    return steps.length === count && steps.every((step) => typeof step.cost === 'number' && step.cost > 0);
  };
}

/**
 * Pull the chat-completion step out of a published row, at any nesting depth.
 *
 * The API serializes the discriminator as ``type``; ``stepType`` is the
 * client-side field name and is absent on the read side.
 */
function findChatCompletionStep(row: any): any {
  return chatCompletionSteps(row)[0];
}

describe('googleGenAiTracer live integration', () => {
  itLive(
    'publishes a priced row for a real gemini-2.5-flash call',
    async () => {
      process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] ??= PIPELINE_ID;
      delete process.env['OPENLAYER_DISABLE_PUBLISH'];

      const client = traceGoogleGenAI(new GoogleGenAI({ apiKey }));
      expect(client.vertexai).toBe(false);

      let inferenceId = '';
      const traced = trace(async function geminiLiveCall() {
        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'Say hello in exactly three words.',
          config: { temperature: 0.2, maxOutputTokens: 200 },
        });
        inferenceId = String(getCurrentTrace()?.steps[0]?.id ?? '');
        return response.text;
      });

      const answer = await traced();
      expect(typeof answer).toBe('string');
      expect(inferenceId).not.toBe('');

      const row = await fetchRow(inferenceId, pricedSteps(1));
      const step = findChatCompletionStep(row);

      expect(step).toBeDefined();
      expect(step.provider).toBe('Google');
      expect(step.model).toBe('gemini-2.5-flash');
      // The whole point of the issue: real money, correctly attributed.
      expect(step.cost).toBeGreaterThan(0);
      expect(step.promptTokens + step.completionTokens).toBe(step.tokens);
    },
    120000,
  );

  itLive(
    'publishes a priced row for a real streaming call',
    async () => {
      process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] ??= PIPELINE_ID;
      delete process.env['OPENLAYER_DISABLE_PUBLISH'];

      const client = traceGoogleGenAI(new GoogleGenAI({ apiKey }));

      let inferenceId = '';
      const traced = trace(async function geminiLiveStream() {
        const stream = await client.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: 'Count to five, one number per line.',
          config: { maxOutputTokens: 400 },
        });
        let text = '';
        for await (const chunk of stream) {
          text += chunk.text ?? '';
        }
        inferenceId = String(getCurrentTrace()?.steps[0]?.id ?? '');
        return text;
      });

      const answer = await traced();
      expect(answer.length).toBeGreaterThan(0);

      const row = await fetchRow(inferenceId, pricedSteps(1));
      const step = findChatCompletionStep(row);

      expect(step).toBeDefined();
      expect(step.provider).toBe('Google');
      expect(step.cost).toBeGreaterThan(0);
    },
    120000,
  );

  itLive(
    'publishes a priced row carrying the function call as output',
    async () => {
      process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] ??= PIPELINE_ID;
      delete process.env['OPENLAYER_DISABLE_PUBLISH'];

      const client = traceGoogleGenAI(new GoogleGenAI({ apiKey }));

      let inferenceId = '';
      const traced = trace(async function geminiLiveToolCall() {
        await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'Use the get_weather tool to look up the weather in San Francisco.',
          config: {
            tools: [
              {
                functionDeclarations: [
                  {
                    name: 'get_weather',
                    description: 'Get the current weather for a city.',
                    parameters: {
                      type: Type.OBJECT,
                      properties: { city: { type: Type.STRING } },
                      required: ['city'],
                    },
                  },
                ],
              },
            ],
          },
        });
        inferenceId = String(getCurrentTrace()?.steps[0]?.id ?? '');
        return 'ok';
      });

      await traced();

      const row = await fetchRow(inferenceId, pricedSteps(1));
      const step = findChatCompletionStep(row);

      expect(step).toBeDefined();
      expect(step.provider).toBe('Google');
      expect(step.cost).toBeGreaterThan(0);
      // The tracer serializes function calls to a JSON string; the backend
      // parses it, so the stored output comes back as structured JSON rather
      // than the string that was sent. Compare against the parsed form.
      const output = typeof step.output === 'string' ? JSON.parse(step.output) : step.output;
      expect(output).toEqual([
        expect.objectContaining({ name: 'get_weather', args: { city: 'San Francisco' } }),
      ]);
    },
    120000,
  );

  itLive(
    'publishes a chat session as one priced step per turn',
    async () => {
      // `client.chats` is built on the same `Models` instance the tracer patched
      // and dispatches through `models.generateContent` at call time, so every
      // turn should become its own step. Only the real SDK can prove that
      // coupling still holds, hence a live test rather than a unit test.
      process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] ??= PIPELINE_ID;
      delete process.env['OPENLAYER_DISABLE_PUBLISH'];

      const client = traceGoogleGenAI(new GoogleGenAI({ apiKey }));

      let inferenceId = '';
      const traced = trace(async function geminiLiveChat() {
        const chat = client.chats.create({
          model: 'gemini-2.5-flash',
          config: { maxOutputTokens: 100 },
        });
        await chat.sendMessage({ message: 'My favorite color is blue.' });
        await chat.sendMessage({ message: 'What did I just tell you?' });
        inferenceId = String(getCurrentTrace()?.steps[0]?.id ?? '');
        return 'done';
      });

      await traced();

      const row = await fetchRow(inferenceId, pricedSteps(2));
      const steps = chatCompletionSteps(row);

      expect(steps).toHaveLength(2);
      for (const step of steps) {
        expect(step.name).toBe('Gemini Generation');
        expect(step.provider).toBe('Google');
        expect(step.model).toBe('gemini-2.5-flash');
        expect(step.cost).toBeGreaterThan(0);
        expect(step.promptTokens + step.completionTokens).toBe(step.tokens);
      }

      // The second turn resends the history, so its prompt is strictly larger.
      expect(steps[1].promptTokens).toBeGreaterThan(steps[0].promptTokens);

      // Row-level cost is the sum of the per-step costs.
      const summed = steps.reduce((total: number, step: any) => total + step.cost, 0);
      expect(row.openlayer_cost).toBeCloseTo(summed, 10);
    },
    120000,
  );
});

describe('googleGenAiTracer live integration (Vertex AI)', () => {
  /** Vertex client for `unbox-ai`-style projects, driven by ADC. */
  function vertexClient() {
    return traceGoogleGenAI(
      new GoogleGenAI({ vertexai: true, project: vertexProject, location: vertexLocation }),
    );
  }

  /**
   * Read `llm_system` off a stored step.
   *
   * Step metadata is flattened onto the step by the backend, so the key can
   * surface either at the top level or under `metadata`.
   */
  function llmSystemOf(step: any): string | undefined {
    return step?.llm_system ?? step?.metadata?.llm_system;
  }

  /** Run one traced Vertex call and return its stored chat-completion step. */
  async function tracedVertexStep(model: string, options: { streaming?: boolean } = {}): Promise<any> {
    process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] ??= PIPELINE_ID;
    delete process.env['OPENLAYER_DISABLE_PUBLISH'];

    const client = vertexClient();
    expect(client.vertexai).toBe(true);

    let inferenceId = '';
    const traced = trace(async function vertexLiveCall() {
      if (options.streaming) {
        const stream = await client.models.generateContentStream({
          model,
          contents: 'Count to three.',
          config: { maxOutputTokens: 400 },
        });
        for await (const _chunk of stream) {
          // Drain so the step is emitted.
        }
      } else {
        await client.models.generateContent({
          model,
          contents: 'Say hello in exactly three words.',
          config: { temperature: 0.2, maxOutputTokens: 200 },
        });
      }
      inferenceId = String(getCurrentTrace()?.steps[0]?.id ?? '');
      return 'ok';
    });

    await traced();
    return findChatCompletionStep(await fetchRow(inferenceId, pricedSteps(1)));
  }

  itVertex(
    'publishes a priced row tagged as google_vertex',
    async () => {
      const step = await tracedVertexStep('gemini-2.5-flash');

      expect(step).toBeDefined();
      expect(step.provider).toBe('Google');
      expect(step.model).toBe('gemini-2.5-flash');
      expect(step.cost).toBeGreaterThan(0);
      expect(step.promptTokens + step.completionTokens).toBe(step.tokens);
      // Matches what the Python ADK tracer emits for Vertex.
      expect(llmSystemOf(step)).toBe('google_vertex');
    },
    180000,
  );

  itVertex(
    'publishes a priced row tagged as google_vertex when streaming',
    async () => {
      const step = await tracedVertexStep('gemini-2.5-flash', { streaming: true });

      expect(step).toBeDefined();
      expect(step.provider).toBe('Google');
      expect(step.cost).toBeGreaterThan(0);
      expect(step.promptTokens + step.completionTokens).toBe(step.tokens);
      expect(llmSystemOf(step)).toBe('google_vertex');
    },
    180000,
  );

  itVertex(
    'still prices the row when the caller passes a fully-qualified model name',
    async () => {
      // The regression this whole normalization exists for. Vertex accepts
      // `projects/…/publishers/google/models/<name>`, and storing that verbatim
      // makes the Openlayer cost table miss and return $0.00 with no error
      // anywhere — the same silent failure as OPEN-11695 and OPEN-9928.
      const fqn = `projects/${vertexProject}/locations/${vertexLocation}/publishers/google/models/gemini-2.5-flash`;
      const step = await tracedVertexStep(fqn);

      expect(step).toBeDefined();
      expect(step.model).toBe('gemini-2.5-flash');
      expect(step.cost).toBeGreaterThan(0);
      expect(step.promptTokens + step.completionTokens).toBe(step.tokens);
      expect(llmSystemOf(step)).toBe('google_vertex');
    },
    180000,
  );
});
