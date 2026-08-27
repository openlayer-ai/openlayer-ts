/**
 * Mastra → Openlayer tracing example.
 *
 * Exercises both root span types — an agent run and a workflow run — plus a
 * tool call, session/user metadata, and an explicit shutdown so the batch is
 * flushed before the process exits.
 *
 * Run with:
 *   OPENLAYER_API_KEY=... OPENLAYER_INFERENCE_PIPELINE_ID=... OPENAI_API_KEY=... \
 *     npx tsx mastra-tracing.ts
 */
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Observability } from '@mastra/observability';
import { OpenlayerExporter } from 'openlayer/lib/integrations/mastra';
import { z } from 'zod';

const getWeather = createTool({
  id: 'get_weather',
  description: 'Get the current weather for a city.',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ tempC: z.number(), sky: z.string() }),
  execute: async ({ city }) => {
    // A real tool would call a weather API here.
    return { tempC: 24, sky: `sunny in ${city}` };
  },
});

const weatherAgent = new Agent({
  id: 'weatherAgent',
  name: 'WeatherAgent',
  instructions: 'You are a concise weather assistant. Always use the get_weather tool.',
  model: openai('gpt-4o-mini'),
  tools: { getWeather },
});

// createStep(agent) wraps the agent as a step that runs *inside* the
// workflow's own trace, instead of a hand-written step that calls
// `agent.generate()` and would start an unrelated, sibling trace.
const weatherAgentStep = createStep(weatherAgent);

const weatherWorkflow = createWorkflow({
  id: 'weatherWorkflow',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ text: z.string() }),
})
  .map(async ({ inputData }) => ({ prompt: `What is the weather in ${inputData.city}?` }))
  .then(weatherAgentStep)
  .commit();

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
  observability: new Observability({
    configs: {
      openlayer: {
        serviceName: 'mastra-openlayer-example',
        // Zero-config: reads OPENLAYER_API_KEY and OPENLAYER_INFERENCE_PIPELINE_ID.
        exporters: [new OpenlayerExporter()],
      },
    },
  }),
});

async function main(): Promise<void> {
  // 1. A bare agent run — the root span is AGENT_RUN.
  const agentResult = await mastra.getAgent('weatherAgent').generate('What is the weather in Lisbon?', {
    // Lifted by the exporter to session.id / user.id, which Openlayer reads.
    tracingOptions: { metadata: { sessionId: 'demo-session-1', userId: 'demo-user-1' } },
  });
  console.log('agent:', agentResult.text);

  // 2. A workflow run — the root span is WORKFLOW_RUN.
  const run = await mastra.getWorkflow('weatherWorkflow').createRun();
  const workflowResult = await run.start({ inputData: { city: 'Madrid' } });
  if (workflowResult.status === 'success') {
    console.log('workflow:', JSON.stringify(workflowResult.result));
  } else {
    console.log('workflow ended with status:', workflowResult.status);
  }

  // 3. Flush before exit, or the last batch is lost.
  await mastra.observability.shutdown();
  console.log('Traces flushed to Openlayer.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
