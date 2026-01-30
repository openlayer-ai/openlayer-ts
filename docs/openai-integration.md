# OpenAI Integration Guide

Openlayer provides seamless integration with OpenAI's APIs through automatic tracing. This guide covers how to use Openlayer with both the **Chat Completions API** (legacy) and the new **Responses API**.

## Table of Contents

- [Getting Started](#getting-started)
- [Chat Completions API (Legacy)](#chat-completions-api-legacy)
- [Responses API (New)](#responses-api-new)
- [Streaming Support](#streaming-support)
- [Function/Tool Calling](#functiontool-calling)
- [Migration Guide](#migration-guide)
- [API Reference](#api-reference)

## Getting Started

First, install the Openlayer SDK and OpenAI SDK:

```bash
npm install openlayer openai
```

Set up your environment variables:

```bash
export OPENAI_API_KEY="your-openai-api-key"
export OPENLAYER_API_KEY="your-openlayer-api-key"
export OPENLAYER_INFERENCE_PIPELINE_ID="your-inference-pipeline-id"
```

Wrap your OpenAI client with Openlayer's tracer:

```typescript
import OpenAI from 'openai';
import { traceOpenAI } from 'openlayer/lib/integrations/openAiTracer';

const client = traceOpenAI(new OpenAI());
```

That's it! All requests to both `chat.completions` and `responses` endpoints will now be automatically traced and sent to your Openlayer inference pipeline.

## Chat Completions API (Legacy)

The Chat Completions API continues to work exactly as before, with full backward compatibility.

### Basic Usage

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello, how are you?' }],
});

console.log(response.choices[0].message.content);
```

### With Streaming

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### With Function Calling

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: "What's the weather in San Francisco?" }],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City and state' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          },
          required: ['location'],
        },
      },
    },
  ],
});
```

## Responses API (New)

The Responses API is OpenAI's new unified interface that combines chat, text generation, tool use, and structured outputs under a single endpoint.

### Basic Usage

```typescript
const response = await client.responses.create({
  model: 'gpt-4o',
  input: 'Hello, how are you?',
});

console.log(response.output_text);
```

### Key Differences from Chat Completions

| Feature            | Chat Completions API               | Responses API                     |
| ------------------ | ---------------------------------- | --------------------------------- |
| Input parameter    | `messages` (array)                 | `input` (string or object)        |
| Output field       | `choices[0].message.content`       | `output_text` or `output`         |
| Token usage        | `usage.{prompt,completion}_tokens` | `usage.{input,output}_tokens`     |
| Model parameter    | `max_tokens`                       | `max_output_tokens`               |
| Streaming endpoint | Same endpoint with `stream: true`  | Same endpoint with `stream: true` |

### With Streaming

```typescript
const stream = await client.responses.create({
  model: 'gpt-4o',
  input: 'Tell me a story',
  stream: true,
});

for await (const event of stream) {
  if (event.type === 'response.output_text.delta' && 'delta' in event) {
    process.stdout.write(event.delta);
  }
}
```

### Multi-turn Conversations

The Responses API supports stateful conversations using `previous_response_id`:

```typescript
// First turn
const response1 = await client.responses.create({
  model: 'gpt-4o',
  input: 'My name is Alice.',
});

// Second turn - continues the conversation
const response2 = await client.responses.create({
  model: 'gpt-4o',
  input: 'What is my name?',
  previous_response_id: response1.id,
});

console.log(response2.output_text); // "Your name is Alice."
```

### With Tool Calling

```typescript
const response = await client.responses.create({
  model: 'gpt-4o',
  input: "What's the weather in San Francisco?",
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City and state' },
          },
          required: ['location'],
        },
      },
    },
  ],
});

// Check if the model called a function
const functionCall = response.output.find((item: any) => item.type === 'function_call');
if (functionCall) {
  console.log('Function:', functionCall.function.name);
  console.log('Arguments:', functionCall.function.arguments);
}
```

## Streaming Support

Both APIs support streaming with automatic trace collection:

### Chat Completions Streaming

Openlayer automatically:

- Collects all streamed chunks
- Assembles the complete output
- Tracks time to first token
- Records token usage
- Sends the trace to your inference pipeline

### Responses API Streaming

Openlayer handles various event types:

- `response.output_text.delta` - Text content chunks
- `response.function_call_arguments.delta` - Function argument chunks
- `response.completed` - Final response with usage statistics

## Function/Tool Calling

Both APIs support function calling with automatic tracing:

### What Gets Traced

- **Function name**: The name of the called function
- **Function arguments**: The arguments passed to the function
- **Model parameters**: Tool choice, parallel tool calls settings
- **Execution metadata**: Latency, token usage

### Tool Call Output Format

When a tool/function is called, Openlayer formats the output as a JSON string containing:

- Function name
- Function arguments
- Execution status (if available)

## Migration Guide

### Migrating from Chat Completions to Responses API

If you're using the Chat Completions API and want to migrate to the Responses API:

1. **Update the endpoint**: Change `client.chat.completions.create()` to `client.responses.create()`

2. **Update input parameter**: Convert `messages` array to `input` string or object

   ```typescript
   // Before (Chat Completions)
   const response = await client.chat.completions.create({
     model: 'gpt-4o',
     messages: [{ role: 'user', content: 'Hello' }],
   });

   // After (Responses API)
   const response = await client.responses.create({
     model: 'gpt-4o',
     input: 'Hello',
   });
   ```

3. **Update output access**: Change from `choices[0].message.content` to `output_text`

   ```typescript
   // Before
   const text = response.choices[0].message.content;

   // After
   const text = response.output_text;
   ```

4. **Update token field names**: Change `prompt_tokens`/`completion_tokens` to `input_tokens`/`output_tokens`

   ```typescript
   // Before
   const tokens = response.usage.prompt_tokens + response.usage.completion_tokens;

   // After
   const tokens = response.usage.input_tokens + response.usage.output_tokens;
   // or simply
   const tokens = response.usage.total_tokens;
   ```

### Why Migrate?

The Responses API provides:

- **Unified interface**: Single endpoint for all use cases
- **Better metadata**: Enhanced traceability and structured responses
- **Stateful conversations**: Native support via `previous_response_id`
- **Improved tool support**: Better function calling with detailed execution info
- **Future-proof**: OpenAI's recommended approach going forward

## API Reference

### `traceOpenAI(client: OpenAI): OpenAI`

Wraps an OpenAI client instance to enable automatic tracing for both Chat Completions and Responses APIs.

**Parameters:**

- `client`: An initialized OpenAI client instance

**Returns:**

- The same OpenAI client with tracing enabled

**Example:**

```typescript
import OpenAI from 'openai';
import { traceOpenAI } from 'openlayer/lib/integrations/openAiTracer';

const client = traceOpenAI(new OpenAI());
```

### Traced Data

For both APIs, Openlayer automatically captures:

- **Inputs**: The prompt/messages sent to the model
- **Output**: The generated response
- **Model**: The model name used (e.g., `gpt-4o`)
- **Latency**: Total request duration in milliseconds
- **Token usage**: Input tokens, output tokens, and total tokens
- **Model parameters**: Temperature, top_p, max_tokens, etc.
- **Metadata**: Additional context like time to first token (streaming)
- **Provider**: Set to "OpenAI"

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required by OpenAI SDK)
- `OPENLAYER_API_KEY`: Your Openlayer API key (required)
- `OPENLAYER_INFERENCE_PIPELINE_ID`: Your inference pipeline ID (required)
- `OPENLAYER_DISABLE_PUBLISH`: Set to `"true"` to disable trace publishing (optional)

## Examples

See the `examples/` directory for complete working examples:

- `examples/openai-tracing.ts` - Chat Completions API examples
- `examples/openai-responses-tracing.ts` - Responses API examples

## Support

For issues, questions, or feature requests:

- GitHub: [openlayer-ai/openlayer-ts](https://github.com/openlayer-ai/openlayer-ts)
- Email: support@openlayer.com
- Documentation: [https://docs.openlayer.com](https://docs.openlayer.com)
