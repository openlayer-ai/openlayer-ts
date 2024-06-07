/*
 * This example shows how to use Openlayer to monitor runs from OpenAI assistants.
 */

import OpenAI from 'openai';
import { OpenAIMonitor } from 'openlayer';

const openai = new OpenAI({
  apiKey: 'YOUR_OPENAI_API_KEY',
});

// Create monitor with your credentials
const monitor = new OpenAIMonitor({
  openAiApiKey: 'YOUR_OPENAI_API_KEY',
  openlayerApiKey: 'YOUR_OPENLAYER_API_KEY',
  // EITHER specify an existing inference pipeline ID
  openlayerInferencePipelineId: 'YOUR_OPENLAYER_INFERENCE_PIPELINE_ID',
  // OR the project and inference pipeline names to create or load one
  openlayerInferencePipelineName: 'production',
  openlayerProjectName: 'YOUR_OPENLAYER_PROJECT_NAME',
});

await monitor.initialize();

// Create the assistant
const assistant = await openai.beta.assistants.create({
  description:
    'You are great at creating and explaining beautiful data visualizations.',
  model: 'gpt-4',
  name: 'Data visualizer',
  tools: [{ type: 'code_interpreter' }],
});

// Create a thread
const thread = await openai.beta.threads.create({
  messages: [
    {
      content: 'Create a data visualization of the american GDP.',
      role: 'user',
    },
  ],
});

// Run the assistant on the thread
const run = await openai.beta.threads.runs.create(thread.id, {
  assistant_id: assistant.id,
});

// Keep polling the run results
let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
while (runStatus.status !== 'completed') {
  runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

  // Monitor the run. If complete, it will be sent to Openlayer
  await monitor.monitorThreadRun(runStatus);
}
