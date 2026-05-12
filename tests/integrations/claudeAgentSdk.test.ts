/**
 * Tests for the @anthropic-ai/claude-agent-sdk Openlayer integration.
 *
 * The unit cases never reach the network: they mock the SDK and the
 * Openlayer publish path. Live tests live alongside in
 * ``claudeAgentSdk.live.test.ts`` and skip unless ``ANTHROPIC_API_KEY``
 * is set.
 */

describe('claudeAgentSdk integration', () => {
  it('module imports cleanly even without the SDK installed', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../src/lib/integrations/claudeAgentSdk');
    expect(mod).toBeDefined();
  });
});
