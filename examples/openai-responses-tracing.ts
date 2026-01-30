import OpenAI from 'openai';
import { traceOpenAI } from 'openlayer/lib/integrations/openAiTracer';

// First, make sure you export your:
// - OPENAI_API_KEY
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.

// Then, wrap the OpenAI client with Openlayer's traceOpenAI
const client = traceOpenAI(new OpenAI() as any);

// Example 1: Non-streaming response with the Responses API
async function basicResponseExample(input: string): Promise<string> {
  const response = await client.responses.create({
    model: 'gpt-4o',
    input: input,
  });
  return response?.output_text ?? '';
}

// Example 2: Streaming response with the Responses API
async function streamingResponseExample(input: string): Promise<void> {
  const stream = await client.responses.create({
    model: 'gpt-4o',
    input: input,
    stream: true,
  });

  for await (const chunk of stream) {
    if (chunk.type === 'response.output_text.delta' && 'delta' in chunk) {
      process.stdout.write(chunk.delta);
    }
  }
  console.log('\n');
}

// Example 3: Response with tool calls (function calling)
async function toolCallExample(input: string): Promise<void> {
  const response = await client.responses.create({
    model: 'gpt-4o',
    input: input,
    tools: [
      {
        type: 'function',
        name: 'get_weather',
        description: 'Get the current weather for a location',
        strict: false,
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'The temperature unit',
            },
          },
          required: ['location'],
        },
      },
    ],
  });

  console.log('Response:', response.output_text);
  console.log('Output items:', response.output);
}

// Example 4: Multi-turn conversation using previous_response_id
async function multiTurnExample(): Promise<void> {
  // First turn
  const response1 = await client.responses.create({
    model: 'gpt-4o',
    input: 'My name is Alice. What is my name?',
  });
  console.log('First response:', response1.output_text);

  // Second turn - continues the conversation
  const response2 = await client.responses.create({
    model: 'gpt-4o',
    input: 'What did I just tell you?',
    previous_response_id: response1.id,
  });
  console.log('Second response:', response2.output_text);
}

// Example 5: Backwards compatibility - Chat Completions API still works
async function chatCompletionExample(input: string): Promise<string | null> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: input }],
  });
  return response?.choices[0]?.message?.content ?? null;
}

// Run examples
async function main() {
  console.log('=== Example 1: Basic Response ===');
  const result1 = await basicResponseExample('Hello, how are you?');
  console.log('Result:', result1);

  console.log('\n=== Example 2: Streaming Response ===');
  await streamingResponseExample('Tell me a short joke.');

  console.log('\n=== Example 3: Tool Call Example ===');
  await toolCallExample("What's the weather like in San Francisco?");

  console.log('\n=== Example 4: Multi-turn Conversation ===');
  await multiTurnExample();

  console.log('\n=== Example 5: Chat Completions (Backwards Compatibility) ===');
  const result5 = await chatCompletionExample('Say hello!');
  console.log('Result:', result5);
}

main().catch(console.error);
