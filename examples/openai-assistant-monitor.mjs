/*
 * This example shows how to use Openlayer to monitor runs from OpenAI assistants.
 */

import OpenAI from 'openai';
import Openlayer from 'openlayer';
import OpenAIMonitor from 'openlayer/lib/core/openai-monitor';

const openAiApiKey = 'YOUR_OPENAI_API_KEY';
const openlayerApiKey = 'YOUR_OPENLAYER_API_KEY';
/*
 * Specify the inference pipeline ID you want to stream the results to
 * You can create an inference pipeline in the Openlayer UI
 */
const openlayerInferencePipelineId = 'YOUR_OPENLAYER_INFERENCE_PIPELINE_ID';

// Instantiate the OpenAI client with your API key
const openai = new OpenAI({
  apiKey: openAiApiKey,
});

// Instantiate the Openlayer client with your API key
const openlayerClient = new Openlayer({
  apiKey: openlayerApiKey,
});

// Create monitor with your credentials
const monitor = new OpenAIMonitor({
  openAiApiKey,
  openlayerClient,
  openlayerInferencePipelineId,
});

// Create the assistant
const assistant = await openai.beta.assistants.create({
  description: 'You are great at creating and explaining beautiful data visualizations.',
  model: 'gpt-4',
  name: 'Data visualizer',
  tools: [{ type: 'code_interpreter' }],
});

// Create a thread
const thread = await openai.beta.threads.create({
  messages: [
    {
      content: 'Create a data visualization of the American GDP.',
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
while (!['cancelled', 'expired', 'failed', 'completed'].includes(runStatus.status)) {
  runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

  // Monitor the run. If complete, it will be sent to Openlayer
  await monitor.monitorThreadRun(runStatus);
}
