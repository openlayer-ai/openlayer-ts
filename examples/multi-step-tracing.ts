import OpenAI from 'openai';
import { traceOpenAI } from 'openlayer/lib/integrations/openAiTracer';
import trace from 'openlayer/lib/tracing/tracer';

// First, make sure you export your:
// - OPENAI_API_KEY -- or the API key of the model you're using
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.

// Then, wrap the OpenAI client with Openlayer's traceOpenAI
const client = traceOpenAI(new OpenAI() as any);

// Wrap each function you would like to trace with Openlayer's trace
const tracedPreparePrompt = trace(function preparePrompt(input: string): { role: string; content: string }[] {
  return [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: input },
  ];
});

const tracedLlmCall = trace(async function llmCall(messages: any): Promise<string | null> {
  const chatCompletion = await client.chat.completions.create({
    messages: messages,
    model: 'gpt-3.5-turbo',
    stream: false,
  });
  const answer = chatCompletion?.choices[0]?.message?.content ?? null;
  return answer;
});

// Main function that calls the other traced functions
const tracedMain = trace(async function main(input: string): Promise<string> {
  const messages = await tracedPreparePrompt(input);
  const result = await tracedLlmCall(messages);
  return result;
});

// Run the main function
tracedMain('Are you an AI or an actual human?').catch(console.error);
