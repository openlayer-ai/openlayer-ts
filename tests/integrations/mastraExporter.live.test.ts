/**
 * Live end-to-end test for the Mastra Openlayer exporter.
 *
 * Skipped unless ``OPENLAYER_API_KEY`` is set. When it runs it exercises the
 * real path: a real Mastra agent, the real OTLP export, the real Openlayer
 * ingest, and a read-back of the resulting row.
 *
 * Every other test in this integration runs against mocked or synthetic
 * data. The defect this integration exists to fix — a row arriving with
 * correct hierarchy, cost, tokens and latency but empty input and output —
 * is invisible to all of them. It only shows up in a row fetched back from
 * the real API, which is what this test does.
 *
 * Env it expects:
 *   OPENLAYER_API_KEY               — required to enable the test
 *   OPENLAYER_INFERENCE_PIPELINE_ID — destination pipeline (defaults below)
 *   OPENAI_API_KEY                  — required by the agent's model
 *
 * Must be run with ``--experimental-vm-modules``:
 *
 *     NODE_OPTIONS=--experimental-vm-modules npx jest \
 *       tests/integrations/mastraExporter.live.test.ts
 *
 * `@ai-sdk/openai` ships ESM-only (`"type": "module"`, no `require` export),
 * unlike `@mastra/core` and `@mastra/observability`, which both ship dual
 * CJS/ESM builds and load fine under plain Jest. Without the flag, Jest's own
 * module registry rejects the ESM syntax outright — even a lazy `import()`
 * inside the test body hits the same wall — so the flag is needed just to
 * load this file, for the skip path as much as the live one. Same root cause
 * as the Vertex suite's flag requirement in `googleGenAiTracer.live.test.ts`.
 */
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { createTool } from '@mastra/core/tools';
import { Observability } from '@mastra/observability';
import { z } from 'zod';

import { OpenlayerExporter } from '../../src/lib/integrations/mastra';

const itLive = process.env['OPENLAYER_API_KEY'] && process.env['OPENAI_API_KEY'] ? it : it.skip;

const PIPELINE_ID = process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] ?? 'cb47e4f7-15a0-4e70-bd6e-7b1b4b54e434';

/**
 * A row appears in the listing as soon as it is ingested, but token counts
 * (and cost, computed alongside them) are filled in by a server-side pass
 * afterward. Polling only for existence (as the original draft did) caught
 * the row mid-flight, before `openlayer_num_of_tokens` was populated — found
 * empirically by running this test. Callers state the condition they
 * actually need.
 *
 * Deliberately gated on tokens only, not `openlayer_cost` directly: while the
 * `openai.responses` provider-slug gap was still unfixed, cost never arrived
 * at all, and gating on it made every assertion below unreachable — `findRow`
 * would just time out and throw before the test could tell the caller which
 * other claims still held. Tokens turned out to be a reliable, always-present
 * proxy for "the server-side pass has run" — confirmed live, cost is present
 * by the same poll tokens are.
 */
function isSettled(row: any): boolean {
  return typeof row?.['openlayer_num_of_tokens'] === 'number' && row['openlayer_num_of_tokens'] > 0;
}

/** Poll the pipeline until a row named `name` shows up and satisfies `isReady`, or time out. */
async function findRow(
  name: string,
  isReady: (row: any) => boolean = () => true,
  timeoutMs = 90_000,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let lastSeen: any;
  while (Date.now() < deadline) {
    const response = await fetch(
      `https://api.openlayer.com/v1/inference-pipelines/${PIPELINE_ID}/rows?page=1&perPage=25&asc=false`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env['OPENLAYER_API_KEY']}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );
    const body = (await response.json()) as { items?: any[] };
    const match = body.items?.find((item) => String(item?.name ?? '').includes(name));
    if (match) {
      lastSeen = match;
      if (isReady(match)) return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  if (lastSeen) {
    throw new Error(
      `row matching "${name}" appeared but never became ready; last seen ` +
        `cost=${lastSeen['openlayer_cost']}, tokens=${lastSeen['openlayer_num_of_tokens']}, ` +
        `model=${lastSeen['model']}, provider=${lastSeen['provider']}, ` +
        `costDetails=${JSON.stringify(lastSeen['costDetails'])}`,
    );
  }
  throw new Error(`No Openlayer row matching "${name}" arrived within ${timeoutMs}ms`);
}

describe('Mastra OpenlayerExporter live integration', () => {
  itLive(
    'publishes a trace with usable input, output, cost, tokens and nested tool steps',
    async () => {
      const marker = `live-${Date.now()}`;

      const getWeather = createTool({
        id: 'get_weather',
        description: 'Get the current weather for a city.',
        inputSchema: z.object({ city: z.string() }),
        outputSchema: z.object({ tempC: z.number() }),
        execute: async () => ({ tempC: 24 }),
      });

      // `id` is required by the installed @mastra/core (1.63.0) AgentConfig,
      // unlike the brief this test was drafted from. `mastra.getAgent('agent')`
      // below resolves through the `agents: { agent }` map key, not this id.
      const agent = new Agent({
        id: `live-weather-agent-${marker}`,
        name: `LiveWeatherAgent-${marker}`,
        instructions: 'You are a concise weather assistant. Always use the get_weather tool.',
        model: openai('gpt-4o-mini'),
        tools: { getWeather },
      });

      const mastra = new Mastra({
        agents: { agent },
        observability: new Observability({
          configs: {
            openlayer: {
              serviceName: 'mastra-live-test',
              exporters: [new OpenlayerExporter()],
            },
          },
        }),
      });

      await mastra.getAgent('agent').generate('What is the weather in Lisbon?', {
        tracingOptions: { metadata: { sessionId: `session-${marker}` } },
      });
      await mastra.observability.shutdown();

      const row = await findRow(marker, isSettled);

      // The defect this integration exists to fix: root I/O must not be empty.
      // Content, not just shape: `{}` and `[]` are both truthy in JS and both
      // `!== '{}'` once stringified, so a bare truthy/non-`{}` check would
      // still pass against an empty array — assert on the actual text.
      expect(Array.isArray(row['openlayer_output'])).toBe(true);
      expect(row['openlayer_output'].length).toBeGreaterThan(0);
      // `content` is itself a JSON-stringified envelope (`{"text":...,"files":[]}`),
      // not the answer — checking only that the envelope string is non-empty
      // still passes against `'{"text":"","files":[]}'` (22 characters), which
      // is exactly the empty-output shape this test exists to catch. Parse it
      // and assert on the real text. Fail loudly rather than silently skipping
      // the check if the content is ever not JSON — a swallowed parse failure
      // here would recreate the same bug this assertion is meant to prevent.
      const outputContent = row['openlayer_output'][0]?.content;
      let outputEnvelope: any;
      try {
        outputEnvelope = JSON.parse(outputContent);
      } catch (error) {
        throw new Error(
          `openlayer_output[0].content was not the expected JSON envelope: ` +
            `${JSON.stringify(outputContent)} (${error})`,
        );
      }
      expect(typeof outputEnvelope.text).toBe('string');
      expect(outputEnvelope.text.length).toBeGreaterThan(0);
      // The tool always returns tempC: 24, so a real answer must mention it —
      // same robustness class as the `tempC` check on `steps` below.
      expect(outputEnvelope.text).toContain('24');

      // `openlayer_inputs` is a list of declared input-variable *names*
      // (`["prompt"]`), not content — it is `true` whether or not the
      // variable it names carries anything, so `toContain('prompt')` alone is
      // a false positive against the exact defect this test exists to catch
      // (same bug class as the `get_weather` string below). Keep it as a
      // valid structural check, but assert on the actual content in the
      // `prompt` column too: the real user message we sent, verified present
      // on a live row.
      expect(row['openlayer_inputs']).toContain('prompt');
      expect(Array.isArray(row['prompt'])).toBe(true);
      const userMessage = row['prompt'].find((message: any) => message.role === 'user');
      expect(userMessage?.content).toBe('What is the weather in Lisbon?');

      // Session metadata is lifted to session.id, which Openlayer reads.
      expect(row['openlayer_session_id']).toBe(`session-${marker}`);

      // Hierarchy: the tool call is nested and mapped natively. Checking for
      // the field *names* `functionName` / `toolResult` alone is the same
      // false-positive shape as `openlayer_inputs` above — `"toolResult":""`
      // would still contain the substring `toolResult`. Assert on the actual
      // values instead: `functionName` is the `tools` map key (`getWeather`,
      // not the tool's `id`), and `tempC` is the tool's real return value —
      // it does not appear anywhere else in the trace (unlike `get_weather`,
      // which the agent's system prompt text also contains), so its presence
      // specifically confirms the tool's real output reached the row.
      const steps = JSON.stringify(row['steps']);
      expect(steps).toContain('"functionName":"getWeather"');
      expect(steps).toContain('tempC');

      // Documented but unmeasured: MODEL_STEP spans carry mastra.model_step.input
      // but no gen_ai messages, so the capability guard fires on them. Measured
      // live: a single one-tool-call turn produced 7 steps, 4 of which (57%)
      // were MODEL_STEP (and the MODEL_INFERENCE nested under them) — a real
      // majority, and SpanType.MODEL_STEP was tried in DEFAULT_DROP_SPAN_TYPES
      // to filter it. That was reverted: dropping a span here does not reparent
      // its children, so a live run with MODEL_STEP dropped lost the nested
      // tool_call span (and its toolResult) entirely rather than hoisting it to
      // the surviving MODEL_GENERATION ancestor — worse than the noise it would
      // remove. Left as a measurement rather than a filter until the exporter
      // can reparent orphaned children before dropping their parent.
      const modelStepCount = (steps.match(/model_step/g) ?? []).length;
      console.log(`[live] model_step occurrences in trace: ${modelStepCount}`);

      // Model metadata and tokens are normalized server-side on this path.
      // `model`/`provider` stay truthy-only rather than exact-matched: audited
      // for the same false-positive shape as the assertions above, but nothing
      // in this path rewrites either field to a wrong-but-truthy value (unlike
      // `openlayer_cost`, which silently drops to a falsy value on a bad
      // provider slug — that path already has its own exact-value regression
      // guard below). `provider` specifically is also server-prettified
      // (`"OpenAI"`, not the raw `openai` slug), so pinning it to a literal
      // would break on a legitimate display-string change rather than a
      // real regression.
      expect(row['openlayer_num_of_tokens']).toBeGreaterThan(0);
      expect(row['model']).toBeTruthy();
      expect(row['provider']).toBeTruthy();

      // Regression guard for a real defect found by this test: Mastra's
      // OpenAI Responses API calls report `gen_ai.provider.name` as
      // `openai.responses`, and Openlayer's cost lookup is an exact lowercased
      // (provider, model) match with no aliasing — confirmed directly against
      // the live cost API, `openai/gpt-4o-mini-2024-07-18` prices while
      // `openai.responses/gpt-4o-mini-2024-07-18` 404s. `rewriteSpanAttributes`
      // now normalizes `gen_ai.provider.name` (and `gen_ai.system`) through a
      // verified alias table (`PROVIDER_SLUG_ALIASES` in `spanRewriter.ts`)
      // before export, so this should pass; if it starts failing again, check
      // that table before assuming this assertion is wrong.
      expect(row['openlayer_cost']).toBeGreaterThan(0);
    },
    180_000,
  );
});
