/*
 * This example shows how to use Openlayer to monitor your LangChain workflows.
 */

import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenlayerClient } from 'openlayer';

// Instantiate the Openlayer client with your API key
const openlayer = new OpenlayerClient({
  openlayerApiKey: 'YOUR_OPENLAYER_API_KEY',
});

// Create or load your project
const project = await openlayer.createProject('YOUR_PROJECT_NAME', 'llm-base');

/*
 * Create or load an inference pipeline from your project.
 * If no name is specified, it will default to 'production'
 */
const inferencePipeline = await openlayer.createInferencePipeline(project.id);
const chatModel = new ChatOpenAI();
const inputs = [
  'What is the meaning of life?',
  'What would be a good name for a company that makes colorful socks?',
];

for (let i = 0; i < inputs.length; i++) {
  const input = inputs[i];
  // Call the LLM
  const output = await chatModel.predict(input);

  // Stream the results to Openlayer
  await openlayer.streamData(
    {
      input,
      output,
    },
    {
      ...openlayer.defaultConfig,
      inputVariableNames: ['input'],
      prompt: [
        {
          content: '{{ input }}',
          role: 'user',
        },
      ],
    },
    inferencePipeline.id
  );
}
