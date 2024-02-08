/*
 * This example shows how to use Openlayer to monitor runs from OpenAI assistants.
 */

import { OpenAIMonitor } from 'openlayer';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'sk-...',
});

// Create monitor with your credentials
const monitor = new OpenAIMonitor({
  openAiApiKey: 'sk-..',
  openlayerApiKey: 'YOUR_OPENLAYER_API_KEY',
  openlayerInferencePipelineName: 'production',
  openlayerProjectName: 'YOUR_OPENLAYER_PROJECT_NAME',
});

await monitor.startMonitoring();

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
  await monitor.logThreadRun(runStatus);
}
