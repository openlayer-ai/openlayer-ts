/**
 * Test helpers for the @anthropic-ai/claude-agent-sdk integration.
 *
 * These mocks mirror the SDK's message shapes closely enough that the
 * integration's message dispatchers cannot tell them apart. We use plain
 * objects with a discriminating ``type`` field — the SDK uses tagged
 * unions, not nominal classes, so structural typing is sufficient.
 */

export class FakeTextBlock {
  public readonly type = 'text' as const;
  constructor(public text: string) {}
}

export class FakeThinkingBlock {
  public readonly type = 'thinking' as const;
  constructor(
    public thinking: string,
    public signature: string = 'sig',
  ) {}
}

export class FakeToolUseBlock {
  public readonly type = 'tool_use' as const;
  constructor(
    public id: string,
    public name: string,
    public input: any,
  ) {}
}

export class FakeToolResultBlock {
  public readonly type = 'tool_result' as const;
  constructor(
    public tool_use_id: string,
    public content: any,
    public is_error?: boolean,
  ) {}
}

export const initSystemMessage = (overrides: Partial<Record<string, any>> = {}): Record<string, any> => ({
  type: 'system' as const,
  subtype: 'init' as const,
  session_id: 'sess_test',
  uuid: 'u-init',
  model: 'claude-opus-4-7',
  tools: ['Read', 'Bash'],
  mcp_servers: [],
  skills: [],
  slash_commands: [],
  plugins: [],
  permissionMode: 'default',
  cwd: '/tmp',
  claude_code_version: 'test-0.2.139',
  apiKeySource: 'ANTHROPIC_API_KEY',
  output_style: 'default',
  ...overrides,
});

export const assistantMessage = (
  content: any[],
  overrides: Partial<Record<string, any>> = {},
): Record<string, any> => ({
  type: 'assistant' as const,
  uuid: 'u-asst',
  session_id: 'sess_test',
  message: {
    content,
    model: 'claude-opus-4-7',
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    stop_reason: 'end_turn',
    ...((overrides['message'] as Record<string, any>) || {}),
  },
  parent_tool_use_id: null,
  ...overrides,
});

export const userMessage = (
  content: any[],
  overrides: Partial<Record<string, any>> = {},
): Record<string, any> => ({
  type: 'user' as const,
  uuid: 'u-user',
  session_id: 'sess_test',
  message: { content },
  parent_tool_use_id: null,
  ...overrides,
});

export const resultMessage = (overrides: Partial<Record<string, any>> = {}): Record<string, any> => ({
  type: 'result' as const,
  subtype: 'success' as const,
  uuid: 'u-result',
  session_id: 'sess_test',
  duration_ms: 1000,
  duration_api_ms: 800,
  is_error: false,
  num_turns: 1,
  result: 'Done',
  stop_reason: 'end_turn',
  total_cost_usd: 0.001,
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  },
  modelUsage: { 'claude-opus-4-7': { inputTokens: 100, outputTokens: 50, costUSD: 0.001 } },
  permission_denials: [],
  ...overrides,
});

/** Convert a fixed array of SDK messages to an async iterable shaped like
 * the SDK's ``query()`` return value. */
export async function* makeStream<T>(messages: T[]): AsyncGenerator<T, void, unknown> {
  for (const m of messages) yield m;
}
