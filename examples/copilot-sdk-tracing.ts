#!/usr/bin/env -S npx ts-node
/**
 * Openlayer tracing for the GitHub Copilot SDK.
 *
 * Run with:
 *   OPENLAYER_API_KEY=... \
 *   OPENLAYER_INFERENCE_PIPELINE_ID=... \
 *   GITHUB_TOKEN=$(gh auth token) \
 *   npx ts-node examples/copilot-sdk-tracing.ts
 *
 * Requires `@github/copilot-sdk` and a GitHub account with Copilot access.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { openlayerEventHandler, traceCopilot } from '../src/lib/integrations/copilotSdk';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CopilotClient, approveAll, defineTool } = require('@github/copilot-sdk');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { z } = require('zod');

/** A throwaway workspace so the agent has something real to look at. */
function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlayer-copilot-'));
  fs.writeFileSync(path.join(dir, 'app.ts'), 'export const greet = (n: string) => `hi ${n}`;\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# Demo\n\nA tiny example project.\n');
  return dir;
}

/**
 * Scenario 1 — one line of setup traces every session.
 *
 * `traceCopilot()` patches `CopilotClient.prototype.createSession`, so you do
 * not have to touch the code that builds sessions.
 */
async function basicSession() {
  console.log('\n=== Scenario 1: one-line setup ===');
  traceCopilot();

  const workspace = makeWorkspace();
  const client = new CopilotClient({ workingDirectory: workspace, logLevel: 'error' });
  await client.start();
  try {
    const session = await client.createSession({
      workingDirectory: workspace,
      onPermissionRequest: approveAll,
    });
    const reply = await session.sendAndWait(
      { prompt: 'List the files here with bash, then summarize the project in one sentence.' },
      280_000,
    );
    console.log('Assistant:', reply?.data?.content);
    await session.disconnect();
  } finally {
    await client.stop();
  }
}

/**
 * Scenario 2 — an explicit handler, a client-side tool, and a subagent.
 *
 * Use `openlayerEventHandler()` when you build sessions yourself and want to
 * be explicit about which ones are traced. It composes with your own
 * `onEvent`: pass both and each still receives every event.
 */
async function toolsAndSubagent() {
  console.log('\n=== Scenario 2: custom tool + subagent dispatch ===');

  const getWeather = defineTool('get_weather', {
    description: 'Get the current weather for a city.',
    parameters: z.object({ city: z.string() }),
    handler: ({ city }: { city: string }) => `It is 22C and sunny in ${city}.`,
  });

  const workspace = makeWorkspace();
  const client = new CopilotClient({ workingDirectory: workspace, logLevel: 'error' });
  await client.start();
  try {
    const session = await client.createSession({
      workingDirectory: workspace,
      onPermissionRequest: approveAll,
      tools: [getWeather],
      // An explicit handler instead of the global patch. Passing both is safe --
      // traceCopilot() defers to a handler you supply rather than adding a
      // second collector -- but one or the other is clearer.
      onEvent: openlayerEventHandler({ truncateToolOutputChars: 4096 }),
    });
    const reply = await session.sendAndWait(
      {
        prompt:
          'Do two things: call get_weather for Lisbon, and delegate to a subagent to ' +
          'read app.ts and summarize it.',
      },
      280_000,
    );
    console.log('Assistant:', reply?.data?.content);
    await session.disconnect();
  } finally {
    await client.stop();
  }
}

/**
 * Scenario 3 — several sends on one session.
 *
 * Each `send()` becomes its own Openlayer trace, and all of them share the
 * Copilot session id, so they group into a single session in the UI.
 */
async function multiTurnSession() {
  console.log('\n=== Scenario 3: multi-turn session grouping ===');

  const workspace = makeWorkspace();
  const client = new CopilotClient({ workingDirectory: workspace, logLevel: 'error' });
  await client.start();
  try {
    const session = await client.createSession({
      workingDirectory: workspace,
      onPermissionRequest: approveAll,
      onEvent: openlayerEventHandler(),
    });
    for (const prompt of ['What files are in this directory?', 'What does app.ts export?']) {
      const reply = await session.sendAndWait({ prompt }, 280_000);
      console.log(`Q: ${prompt}\nA: ${reply?.data?.content}\n`);
    }
    await session.disconnect();
  } finally {
    await client.stop();
  }
}

async function main() {
  for (const key of ['OPENLAYER_API_KEY', 'OPENLAYER_INFERENCE_PIPELINE_ID']) {
    if (!process.env[key]) {
      console.error(`Missing ${key}. Traces will not be published.`);
    }
  }
  await basicSession();
  await toolsAndSubagent();
  await multiTurnSession();
  console.log('\nDone — check your Openlayer inference pipeline for the traces.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
