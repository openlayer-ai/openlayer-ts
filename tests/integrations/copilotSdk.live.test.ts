/**
 * Live end-to-end test for the GitHub Copilot SDK integration.
 *
 * Opt-in is explicit rather than keyed on GITHUB_TOKEN alone: that variable is
 * commonly exported by developers and by CI steps that have nothing to do with
 * Copilot, and an installation token has no Copilot access -- so keying on it
 * would turn a normal test run into a five-minute live session that then fails
 * on auth. Run with:
 *   OPENLAYER_COPILOT_LIVE_TEST=1 GITHUB_TOKEN=$(gh auth token) \
 *     npx jest tests/integrations/copilotSdk.live.test.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ROOT_STEP_NAME, openlayerEventHandler } from '../../src/lib/integrations/copilotSdk';
import { getCurrentTrace } from '../../src/lib/tracing/tracer';

const describeLive = process.env['OPENLAYER_COPILOT_LIVE_TEST'] === '1' ? describe : describe.skip;

describeLive('Copilot SDK live', () => {
  jest.setTimeout(300_000);

  it('produces a trace with priced chat steps and a real tool call', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CopilotClient, approveAll } = require('@github/copilot-sdk');

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-copilot-'));
    fs.writeFileSync(path.join(workspace, 'hello.ts'), "console.log('hello');\n");
    fs.writeFileSync(path.join(workspace, 'notes.txt'), 'some notes\n');

    const client = new CopilotClient({ workingDirectory: workspace, logLevel: 'error' });
    await client.start();
    try {
      const session = await client.createSession({
        workingDirectory: workspace,
        onPermissionRequest: approveAll,
        onEvent: openlayerEventHandler(),
      });
      await session.sendAndWait(
        { prompt: 'Run `ls` with bash and tell me how many files there are, in one sentence.' },
        280_000,
      );
      await session.disconnect();
    } finally {
      await client.stop();
    }

    const trace = getCurrentTrace();
    expect(trace).toBeTruthy();
    const root = trace!.toJSON()[0] as any;

    expect(root.type).toBe('agent');
    expect(root.name).toBe(ROOT_STEP_NAME);
    // The root's output is what becomes the row's output column.
    expect(typeof root.output).toBe('string');
    expect(root.output.trim().length).toBeGreaterThan(0);
    expect(root.inputs.prompt).toMatch(/^Run `ls`/);
    expect(root.metadata['copilot_session_id']).toBeTruthy();

    const chats = root.steps.filter((s: any) => s.type === 'chat_completion');
    expect(chats.length).toBeGreaterThan(0);
    for (const chat of chats) {
      expect(chat.model).toBeTruthy();
      // A real provider slug is what lets Openlayer price the call; "github"
      // would silently yield $0.
      expect(['anthropic', 'openai', 'google', 'xai']).toContain(chat.provider);
      expect(chat.cost).toBeNull();
    }
    expect(chats.some((c: any) => (c.usageDetails?.['output_tokens'] ?? 0) > 0)).toBe(true);

    const tools = root.steps.filter((s: any) => s.type === 'tool');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t: any) => t.name === 'bash')).toBe(true);
  });
});
