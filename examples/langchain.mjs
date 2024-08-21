/*
 * This example shows how to use Openlayer to monitor your LangChain workflows.
 */

import { ChatOpenAI } from '@langchain/openai';
import Openlayer from 'openlayer';

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

// Instantiate an OpenAI model with your API key
const model = new ChatOpenAI({
  apiKey: openAiApiKey,
});

const inputs = [
  'What is the meaning of life?',
  'What would be a good name for a company that makes colorful socks?',
];

for (let i = 0; i < inputs.length; i++) {
  const input = inputs[i];
  const startTime = Date.now();
  // Call the LLM
  const response = await model.invoke(input);
  const endTime = Date.now();

  const output = response.content;
  const metadata = response.response_metadata;

  const latency = endTime - startTime;
  const { totalTokens } = metadata.tokenUsage ?? {};

  // Stream the results to Openlayer
  await openlayerClient.inferencePipelines.data.stream(openlayerInferencePipelineId, {
    config: {
      latencyColumnName: 'latency',
      inputVariableNames: ['input'],
      numOfTokenColumnName: 'totalTokens',
      // Required: the name of the output column
      outputColumnName: 'output',
      prompt: [
        {
          content: '{{ input }}',
          role: 'user',
        },
      ],
    },
    // A list of rows to send to Openlayer
    rows: [
      // The keys of these columns correspond to the names specified in the config above
      {
        input,
        latency,
        output,
        totalTokens,
        // Any additional columns with arbitrary key names may be added here
      },
    ],
  });
}
