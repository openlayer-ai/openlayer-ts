/**
 * Live integration test for the Claude Agent SDK Openlayer wrapper.
 *
 * Skipped unless ``ANTHROPIC_API_KEY`` is set in the environment. When run,
 * it exercises the full real-world path: the actual ``@anthropic-ai/claude-agent-sdk``
 * (which boots its bundled Claude Code subprocess), the actual Openlayer
 * publish path, and the entire wrapper end-to-end.
 *
 * Env it expects:
 *   ANTHROPIC_API_KEY               — required to enable the test
 *   OPENLAYER_API_KEY               — Openlayer ingest key
 *   OPENLAYER_INFERENCE_PIPELINE_ID — destination pipeline
 */

import { tracedQuery } from '../../src/lib/integrations/claudeAgentSdk';

const itLive = process.env['ANTHROPIC_API_KEY'] ? it : it.skip;

describe('claudeAgentSdk live integration', () => {
  itLive(
    'produces a valid trace for a one-turn query against claude-haiku-4-5',
    async () => {
      // Defaults — only the API key is required from the caller; everything
      // else has a sensible value for the project's test pipeline.
      process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] ??= 'cb47e4f7-15a0-4e70-bd6e-7b1b4b54e434';
      // Don't disable publish — this test wants to publish.
      delete process.env['OPENLAYER_DISABLE_PUBLISH'];

      const messages: any[] = [];
      for await (const m of tracedQuery({
        prompt: "Say the word 'banana' and nothing else.",
        options: {
          model: 'claude-haiku-4-5',
          allowedTools: [],
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
