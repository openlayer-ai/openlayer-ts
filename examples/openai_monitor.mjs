/*
 * This example shows how to use Openlayer to monitor your OpenAI workflows.
 */

import { OpenAIMonitor } from 'openlayer';

const monitor = new OpenAIMonitor({
  openAiApiKey: 'YOUR_OPENAI_API_KEY',
  openlayerApiKey: 'YOUR_OPENLAYER_API_KEY',
  openlayerProjectName: 'YOUR_PROJECT_NAME',
});

monitor.startMonitoring();

const inputs = [
  {
    promptVersion: 'v1',
    systemMessage:
      'You are an all-knowing assistant. Answer questions thoughtfully.',
    userMessage: 'What is the meaning of life?',
  },
  {
    promptVersion: 'v2',
    systemMessage: 'Be as creative as you can!',
    userMessage:
      'What would be a good name for a company that makes colorful socks?',
  },
];

inputs.map(async ({ promptVersion, systemMessage, userMessage }) => {
  // Stream the results to Openlayer
  const chatCompletion = await monitor.createChatCompletion(
    {
      messages: [
        {
          content: systemMessage,
          role: 'assistant',
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
    }
  );
  console.log(chatCompletion);
});
