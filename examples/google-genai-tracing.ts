import { GoogleGenAI, Type } from '@google/genai';
import { traceGoogleGenAI } from 'openlayer/lib/integrations/googleGenAiTracer';

// First, make sure you export your:
// - GOOGLE_API_KEY -- for AI Studio; omit it and set the Vertex vars below instead
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.
//
// For Vertex AI instead of AI Studio, export:
// - GOOGLE_GENAI_USE_VERTEXAI=true
// - GOOGLE_CLOUD_PROJECT
// - GOOGLE_CLOUD_LOCATION
// and authenticate with `gcloud auth application-default login`.

const useVertex = process.env['GOOGLE_GENAI_USE_VERTEXAI'] === 'true';

// The same client class serves both backends. The tracer reads `client.vertexai`
// and tags Vertex steps with `llm_system: "google_vertex"`, so you don't have to
// configure anything for the distinction to show up in Openlayer.
const genAI =
  useVertex ?
    new GoogleGenAI({
      vertexai: true,
      project: process.env['GOOGLE_CLOUD_PROJECT'] ?? '',
      location: process.env['GOOGLE_CLOUD_LOCATION'] ?? 'us-central1',
    })
  : new GoogleGenAI({ apiKey: process.env['GOOGLE_API_KEY'] ?? '' });

// Then, wrap the client with Openlayer's traceGoogleGenAI. It patches the client
// in place and hands it back, so calls are traced from here on.
const client = traceGoogleGenAI(genAI);

const MODEL = 'gemini-2.5-flash';

// Finally, use the client normally. Each call is streamed to your Openlayer
// inference pipeline as a chat-completion step.
async function nonStreamingExample(): Promise<void> {
  const response = await client.models.generateContent({
    model: MODEL,
    contents: 'What is the capital of France?',
    config: { temperature: 0.2, maxOutputTokens: 200 },
  });

  console.log('Answer:', response.text);

  // Worth noticing: on Gemini 2.5 models thinking is on by default, and those
  // thinking tokens are billed at the output rate. The tracer folds
  // `thoughtsTokenCount` into the step's completionTokens for exactly this
  // reason — otherwise reported cost would be a fraction of the real cost.
  const usage = response.usageMetadata;
  console.log(
    `Tokens -> prompt: ${usage?.promptTokenCount}, ` +
      `answer: ${usage?.candidatesTokenCount}, ` +
      `thinking: ${usage?.thoughtsTokenCount}, ` +
      `total: ${usage?.totalTokenCount}`,
  );
}

// Streaming works the same way. Chunks are passed through untouched, and a
// single step is recorded once the stream is exhausted.
async function streamingExample(): Promise<void> {
  const stream = await client.models.generateContentStream({
    model: MODEL,
    contents: 'Name three primary colors.',
    config: { maxOutputTokens: 400 },
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.text ?? '');
  }
  console.log();
}

// When the model calls a function instead of answering, the tracer records the
// serialized function calls as the step output.
async function functionCallingExample(): Promise<void> {
  const response = await client.models.generateContent({
    model: MODEL,
    contents: "What's the weather in San Francisco?",
    config: {
      tools: [
        {
          functionDeclarations: [
            {
              name: 'get_weather',
              description: 'Get the current weather for a city.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  city: { type: Type.STRING, description: 'The city to look up.' },
                },
                required: ['city'],
              },
            },
          ],
        },
      ],
    },
  });

  console.log('Function calls:', JSON.stringify(response.functionCalls ?? [], null, 2));
}

// Chat sessions are traced too, without any extra wrapping: `client.chats` is
// built on the very same `models` object this tracer patched, so every turn
// becomes its own chat-completion step.
async function chatSessionExample(): Promise<void> {
  const chat = client.chats.create({ model: MODEL, config: { maxOutputTokens: 200 } });

  const first = await chat.sendMessage({ message: 'My favorite color is blue.' });
  console.log('Turn 1:', first.text);

  const second = await chat.sendMessage({ message: 'What did I just tell you?' });
  console.log('Turn 2:', second.text);
}

async function main(): Promise<void> {
  console.log(`=== Mode: ${useVertex ? 'Vertex AI' : 'AI Studio'} ===\n`);

  console.log('=== Example 1: Non-streaming ===');
  await nonStreamingExample();

  console.log('\n=== Example 2: Streaming ===');
  await streamingExample();

  console.log('\n=== Example 3: Function calling ===');
  await functionCallingExample();

  console.log('\n=== Example 4: Chat session (traced automatically) ===');
  await chatSessionExample();
}

main().catch(console.error);
