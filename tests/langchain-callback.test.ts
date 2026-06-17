import { AIMessage, HumanMessage } from '@langchain/core/messages';
import type { UsageMetadata } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';
import type { Serialized } from '@langchain/core/load/serializable';
import { OpenlayerHandler } from '../src/lib/integrations/langchainCallback';
import { processAndUploadTrace, getCurrentStep } from '../src/lib/tracing/tracer';

// The handler imports only these two symbols from the tracer; mock them so we
// can capture the trace it would upload and keep the handler as the trace owner.
jest.mock('../src/lib/tracing/tracer', () => ({
  getCurrentStep: jest.fn(() => undefined),
  processAndUploadTrace: jest.fn(),
}));

const uploadMock = processAndUploadTrace as jest.Mock;
const getCurrentStepMock = getCurrentStep as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  getCurrentStepMock.mockReturnValue(undefined);
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const llmSerialized = {
  lc: 1,
  type: 'constructor',
  id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
  kwargs: {},
} as unknown as Serialized;

const chainSerialized = {
  lc: 1,
  type: 'constructor',
  id: ['langchain', 'chains', 'SomeChain'],
  kwargs: {},
} as unknown as Serialized;

/** Real @langchain/core AIMessage carrying usage metadata (cast through unknown
 * because the 1.x generic types collapse usage_metadata in fixtures). */
function makeAIMessage(content: string, usage?: UsageMetadata, toolCalls?: unknown[]): AIMessage {
  return new AIMessage({ content, usage_metadata: usage, tool_calls: toolCalls } as unknown as {
    content: string;
  });
}

function makeLLMResult(message: unknown, text = ''): LLMResult {
  return { generations: [[{ text, message } as any]] } as LLMResult;
}

/** The trace the handler last tried to upload. */
function lastTrace(): any {
  return uploadMock.mock.calls.at(-1)?.[0];
}

describe('OpenlayerHandler - real @langchain/core (1.x) messages', () => {
  it('captures role + content for chat-model-start prompts', async () => {
    const handler = new OpenlayerHandler();
    const runId = 'run-1';
    await handler.handleChatModelStart(
      llmSerialized,
      [[new HumanMessage('Hello there')]],
      runId,
      undefined,
      { invocation_params: { model: 'gpt-4o' } },
      [],
      { ls_provider: 'openai' },
    );
    await handler.handleLLMEnd(makeLLMResult(makeAIMessage('Hi!'), 'Hi!'), runId);

    const prompt = lastTrace().steps[0].inputs.prompt;
    expect(prompt[0]).toMatchObject({ role: 'user', content: 'Hello there' });
  });

  it('extracts token usage from a real AIMessage usage_metadata', async () => {
    const handler = new OpenlayerHandler();
    const runId = 'run-2';
    await handler.handleChatModelStart(llmSerialized, [[new HumanMessage('q')]], runId);
    const usage: UsageMetadata = { input_tokens: 11, output_tokens: 7, total_tokens: 18 };
    await handler.handleLLMEnd(makeLLMResult(makeAIMessage('a', usage), 'a'), runId);

    const step = lastTrace().steps[0];
    expect(step.promptTokens).toBe(11);
    expect(step.completionTokens).toBe(7);
    expect(step.tokens).toBe(18);
  });
});

describe('OpenlayerHandler - foreign core (duplicate copy) regression', () => {
  // A message from a *different* @langchain/core copy: not an instance of the
  // imported classes, only the duck-typed surface.
  const foreignAI = (content: string, usage?: UsageMetadata, toolCalls?: unknown[]) => ({
    _getType: () => 'ai',
    getType: () => 'ai',
    content,
    usage_metadata: usage,
    tool_calls: toolCalls,
    additional_kwargs: {},
    response_metadata: {},
  });

  it('extracts usage_metadata from a foreign-core AI message', async () => {
    const handler = new OpenlayerHandler();
    const runId = 'run-3';
    await handler.handleChatModelStart(llmSerialized, [[new HumanMessage('q')]], runId);
    await handler.handleLLMEnd(
      makeLLMResult(foreignAI('a', { input_tokens: 3, output_tokens: 5, total_tokens: 8 }), 'a'),
      runId,
    );

    const step = lastTrace().steps[0];
    expect(step.tokens).toBe(8);
    expect(step.promptTokens).toBe(3);
  });

  it('classifies a foreign-core human message by its duck-typed role', async () => {
    const handler = new OpenlayerHandler();
    const runId = 'run-4';
    const foreignHuman = { _getType: () => 'human', getType: () => 'human', content: 'hey' };
    await handler.handleChatModelStart(llmSerialized, [[foreignHuman as any]], runId);
    await handler.handleLLMEnd(makeLLMResult(makeAIMessage('hi'), 'hi'), runId);

    expect(lastTrace().steps[0].inputs.prompt[0]).toMatchObject({ role: 'user', content: 'hey' });
  });
});

describe('OpenlayerHandler - LangGraph metadata', () => {
  async function chainRun(
    metadata: Record<string, unknown>,
    params?: ConstructorParameters<typeof OpenlayerHandler>[0],
  ) {
    const handler = new OpenlayerHandler(params);
    const runId = `chain-${Math.round(performance.now())}-${Object.keys(metadata).join('-')}`;
    await handler.handleChainStart(chainSerialized, { input: 'x' }, runId, undefined, [], metadata);
    await handler.handleChainEnd({ output: 'y' }, runId);
    return lastTrace().steps[0];
  }

  it('names a chain step after metadata.langgraph_node', async () => {
    const step = await chainRun({ langgraph_node: 'agent' });
    expect(step.name).toBe('agent');
  });

  it('maps metadata.thread_id to the session id by default', async () => {
    const step = await chainRun({ thread_id: 't-123' });
    expect(step.metadata.session_id).toBe('t-123');
  });

  it('does not map thread_id when mapThreadIdToSession is false', async () => {
    const step = await chainRun({ thread_id: 't-123' }, { mapThreadIdToSession: false });
    expect(step.metadata.session_id).toBeUndefined();
  });

  it('does not clobber an explicit sessionId with thread_id', async () => {
    const step = await chainRun({ thread_id: 't-123' }, { sessionId: 'explicit-session' });
    expect(step.metadata.session_id).toBe('explicit-session');
  });
});
