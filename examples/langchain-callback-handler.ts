import { ChatOpenAI } from '@langchain/openai';
import { OpenlayerHandler } from 'openlayer/lib/integrations/langchainCallback';

// First, make sure you export your:
// - OPENAI_API_KEY -- or the API key of the model you're using via LangChain
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.

export const main = async () => {
  // Then, pass the OpenlayerHandler as a callback to your LLM or chain
  const model = new ChatOpenAI({
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    maxRetries: 5,
    callbacks: [new OpenlayerHandler()],
  });

  // Finally, use the LLM or chain normally.
  // The trace is being streamed to your Openlayer inference pipeline.
  const res = await model.invoke(
    'Question: What would be a good company name a company that makes colorful socks?\nAnswer:',
  );
  console.log({ res });
};

main().catch(console.error);
