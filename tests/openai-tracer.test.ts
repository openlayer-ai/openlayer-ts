import OpenAI from 'openai';
import { traceOpenAI } from '../src/lib/integrations/openAiTracer';
import { addChatCompletionStepToTrace } from '../src/lib/tracing/tracer';

// Mock the tracer module
jest.mock('../src/lib/tracing/tracer', () => ({
  addChatCompletionStepToTrace: jest.fn(),
}));

describe('OpenAI Tracer', () => {
  let mockOpenAI: any;
  let addChatCompletionStepToTraceMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    addChatCompletionStepToTraceMock = addChatCompletionStepToTrace as jest.Mock;

    // Create a mock OpenAI client
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      responses: {
        create: jest.fn(),
      },
    };
  });

  describe('Chat Completions API (Backwards Compatibility)', () => {
    it('should trace non-streaming chat completion requests', async () => {
      const mockResponse: OpenAI.Chat.Completions.ChatCompletion = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I assist you today?',
              refusal: null,
            },
            logprobs: null,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
          prompt_tokens_details: { cached_tokens: 0 },
          completion_tokens_details: { reasoning_tokens: 0 },
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const tracedClient = traceOpenAI(mockOpenAI);
      const result = await tracedClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toEqual(mockResponse);
      expect(addChatCompletionStepToTraceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OpenAI Chat Completion',
          output: 'Hello! How can I assist you today?',
          model: 'gpt-4o',
          provider: 'OpenAI',
          tokens: 30,
          promptTokens: 10,
          completionTokens: 20,
        }),
      );
    });

    it('should trace chat completion with tool calls', async () => {
      const mockResponse: OpenAI.Chat.Completions.ChatCompletion = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              refusal: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "San Francisco"}',
                  },
                },
              ],
            },
            logprobs: null,
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40,
          prompt_tokens_details: { cached_tokens: 0 },
          completion_tokens_details: { reasoning_tokens: 0 },
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const tracedClient = traceOpenAI(mockOpenAI);
      await tracedClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: "What's the weather in SF?" }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location'],
              },
            },
          },
        ],
      });

      expect(addChatCompletionStepToTraceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OpenAI Chat Completion',
          provider: 'OpenAI',
          output: expect.stringContaining('get_weather'),
        }),
      );
    });
  });

  describe('Responses API', () => {
    it('should trace non-streaming response requests', async () => {
      const mockResponse: OpenAI.Responses.Response = {
        id: 'resp-123',
        object: 'response',
        created_at: 1677652288,
        model: 'gpt-4o',
        output_text: 'Hello! How can I help you today?',
        output: [
          {
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              {
                type: 'output_text',
                text: 'Hello! How can I help you today?',
              },
            ],
          } as any,
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        instructions: null,
        metadata: null,
        temperature: 1,
        top_p: 1,
        parallel_tool_calls: false,
        tool_choice: 'auto',
        tools: [],
        error: null,
        incomplete_details: null,
      } as any;

      mockOpenAI.responses.create.mockResolvedValue(mockResponse);

      const tracedClient = traceOpenAI(mockOpenAI);
      const result = await tracedClient.responses.create({
        model: 'gpt-4o',
        input: 'Hello',
      });

      expect(result).toEqual(mockResponse);
      expect(addChatCompletionStepToTraceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OpenAI Response',
          output: 'Hello! How can I help you today?',
          model: 'gpt-4o',
          provider: 'OpenAI',
          tokens: 30,
          promptTokens: 10,
          completionTokens: 20,
        }),
      );
    });

    it('should handle streaming response requests', async () => {
      const mockStreamEvents = [
        { type: 'response.created', sequence_number: 0 },
        {
          type: 'response.output_text.delta',
          delta: 'Hello',
          sequence_number: 1,
        },
        {
          type: 'response.output_text.delta',
          delta: ' there!',
          sequence_number: 2,
        },
        {
          type: 'response.completed',
          response: {
            id: 'resp-123',
            model: 'gpt-4o',
            usage: {
              input_tokens: 5,
              output_tokens: 10,
              total_tokens: 15,
            },
          },
          sequence_number: 3,
        },
      ];

      async function* mockStreamGenerator() {
        for (const event of mockStreamEvents) {
          yield event;
        }
      }

      mockOpenAI.responses.create.mockResolvedValue(mockStreamGenerator());

      const tracedClient = traceOpenAI(mockOpenAI);
      const stream = await tracedClient.responses.create({
        model: 'gpt-4o',
        input: 'Hello',
        stream: true,
      });

      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(4);
      expect(addChatCompletionStepToTraceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OpenAI Response',
          output: 'Hello there!',
          provider: 'OpenAI',
          model: 'gpt-4o',
          tokens: 15,
        }),
      );
    });

    it('should handle response with function calls', async () => {
      const mockResponse: OpenAI.Responses.Response = {
        id: 'resp-123',
        object: 'response',
        created_at: 1677652288,
        model: 'gpt-4o',
        output_text: '',
        output: [
          {
            type: 'function_call',
            id: 'call_123',
            status: 'completed',
            function: {
              name: 'get_weather',
              arguments: '{"location": "San Francisco"}',
            },
          } as any,
        ],
        usage: {
          input_tokens: 15,
          output_tokens: 25,
          total_tokens: 40,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        instructions: null,
        metadata: null,
        temperature: 1,
        top_p: 1,
        parallel_tool_calls: false,
        tool_choice: 'auto',
        tools: [],
        error: null,
        incomplete_details: null,
      } as any;

      mockOpenAI.responses.create.mockResolvedValue(mockResponse);

      const tracedClient = traceOpenAI(mockOpenAI);
      await tracedClient.responses.create({
        model: 'gpt-4o',
        input: "What's the weather in San Francisco?",
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location'],
              },
            },
          } as any,
        ],
      });

      expect(addChatCompletionStepToTraceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OpenAI Response',
          provider: 'OpenAI',
          output: expect.stringContaining('get_weather'),
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in chat completions gracefully', async () => {
      const error = new Error('API Error');
      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      const tracedClient = traceOpenAI(mockOpenAI);

      await expect(
        tracedClient.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow('API Error');
    });

    it('should handle errors in responses gracefully', async () => {
      const error = new Error('API Error');
      mockOpenAI.responses.create.mockRejectedValue(error);

      const tracedClient = traceOpenAI(mockOpenAI);

      await expect(
        tracedClient.responses.create({
          model: 'gpt-4o',
          input: 'Hello',
        }),
      ).rejects.toThrow('API Error');
    });
  });
});
