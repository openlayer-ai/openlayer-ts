/*
 * This example shows how to use Openlayer to monitor your OpenAI workflows.
 */
import Openlayer from 'openlayer';
import OpenAIMonitor from 'openlayer/lib/core/openai-monitor';

const openAiApiKey = 'YOUR_OPENAI_API_KEY';
const openlayerApiKey = 'YOUR_OPENLAYER_API_KEY';
/*
 * Specify the inference pipeline ID you want to stream the results to
 * You can create an inference pipeline in the Openlayer UI
 */
const openlayerInferencePipelineId = 'YOUR_OPENLAYER_INFERENCE_PIPELINE_ID';

// Instantiate the Openlayer client with your API key
const openlayerClient = new Openlayer({
  apiKey: openlayerApiKey,
});

// Create monitor with your credentials
const monitor = new OpenAIMonitor({
  openAiApiKey,
  openlayerClient,
  /*
   * Specify the inference pipeline ID you want to stream the results to
   * You can create an inference pipeline in the Openlayer UI
   */
  openlayerInferencePipelineId,
});

const inputs = [
  {
    promptVersion: 'v1',
    systemMessage: 'You are an all-knowing assistant. Answer questions thoughtfully.',
    userMessage: 'What is the meaning of life?',
  },
  {
    promptVersion: 'v2',
    systemMessage: 'Be as creative as you can!',
    userMessage: 'What would be a good name for a company that makes colorful socks?',
  },
];

for (let i = 0; i < inputs.length; i++) {
  const { promptVersion, systemMessage, userMessage } = inputs[i];
  // Stream the results to Openlayer
  await monitor.createChatCompletion(
    {
      messages: [
        {
          content: systemMessage,
          role: 'system',
        },
        {
          content: userMessage,
          role: 'user',
        },
      ],
      model: 'gpt-3.5-turbo',
    },
    undefined,
    {
      // Add any additional columns you want to track here
      promptVersion,
    },
  );
}
