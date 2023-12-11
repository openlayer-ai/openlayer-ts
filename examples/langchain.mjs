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

await Promise.all(
  inputs.map(async (input) => {
    // Call the LLM
    const llmResult = await chatModel.predict(text);

    // Stream the results to Openlayer
    await openlayer.streamData(
      {
        input,
        output: llmResult,
      },
      inferencePipeline.id
    );
  })
);
