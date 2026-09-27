/**
 * Live integration test for the Claude Agent SDK Openlayer wrapper.
 *
 * Skipped unless every variable below is set. When run, it exercises the full
 * real-world path: the actual ``@anthropic-ai/claude-agent-sdk`` (which boots
 * its bundled Claude Code subprocess), the actual Openlayer publish path, and
 * the entire wrapper end-to-end.
 *
 * Env it expects (all required):
 *   OPENLAYER_LIVE_TESTS=1          — explicit opt-in, so a stray key can't enable it
 *   ANTHROPIC_API_KEY               — Anthropic credentials
 *   OPENLAYER_API_KEY               — Openlayer ingest key
 *   OPENLAYER_BASE_URL              — e.g. https://api.openlayer.com/v1; no default,
 *                                     so the target is always a deliberate choice
 *   OPENLAYER_INFERENCE_PIPELINE_ID — destination pipeline
 *
 * Run this file on its own (e.g. ``yarn test tests/integrations/claudeAgentSdk.live.test.ts``): the
 * generated tests in tests/index.test.ts expect OPENLAYER_BASE_URL to be unset.
 */

import { tracedQuery } from '../../src/lib/integrations/claudeAgentSdk';

// Trimmed like the client's readEnv: a blank OPENLAYER_BASE_URL must not pass the
// gate, or the client would fall back to its production default.
const env = (name: string) => process.env[name]?.trim();
const itLive =
  (
    env('OPENLAYER_LIVE_TESTS') === '1' &&
    env('ANTHROPIC_API_KEY') &&
    env('OPENLAYER_API_KEY') &&
    env('OPENLAYER_BASE_URL') &&
    env('OPENLAYER_INFERENCE_PIPELINE_ID')
  ) ?
    it
  : it.skip;

describe('claudeAgentSdk live integration', () => {
  itLive(
    'produces a valid trace for a one-turn query against claude-haiku-4-5',
    async () => {
      // Don't disable publish — this test wants to publish.
      delete process.env['OPENLAYER_DISABLE_PUBLISH'];

      const messages: any[] = [];
      for await (const m of tracedQuery({
        prompt: "Say the word 'banana' and nothing else.",
        options: {
          model: 'claude-haiku-4-5',
          allowedTools: [],
          systemPrompt:
            'You are a terse assistant that follows instructions exactly. ' +
            'Never add filler words, never apologize, and never add quotes ' +
            'around your answer.',
          maxTurns: 2,
        },
      })) {
        messages.push(m);
      }

      // Must terminate with a result message.
      const final = messages.find((m: any) => m.type === 'result');
      expect(final).toBeDefined();
      expect(final.subtype).toBe('success');
      // And the response must contain the word we asked for.
      expect(String(final.result ?? '').toLowerCase()).toContain('banana');

      // The tracer publishes the trace via a fire-and-forget `.then()` after
      // the root step ends. Give it a beat to flush before Jest tears down,
      // otherwise late `console.debug` from the publish callback trips Jest's
      // "Cannot log after tests are done" guard and the run exits non-zero.
      await new Promise((resolve) => setTimeout(resolve, 3000));
    },
    120_000,
  );
});
