import OpenAI from 'openai';
import { traceOpenAI } from 'openlayer/lib/integrations/openAiTracer';

// First, make sure you export your:
// - OPENAI_API_KEY
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.

// Then, wrap the OpenAI client with Openlayer's traceOpenAI
const client = traceOpenAI(new OpenAI() as any);

// Finally, use the wrapped OpenAI client normally.
// The trace is being streamed to your Openlayer inference pipeline.
async function main(input: string): Promise<string | null> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: input }],
  });
  return response?.choices[0]?.message?.content ?? null;
}

main('How are you doing today?').catch(console.error);
