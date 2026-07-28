import { AIMessage, HumanMessage } from '@langchain/core/messages';
import type { UsageMetadata } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';
import type { Serialized } from '@langchain/core/load/serializable';
import {
  OpenlayerHandler,
  LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP,
  PROVIDER_COST_SLUG,
} from '../src/lib/integrations/langchainCallback';
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

describe('OpenlayerHandler - OPEN-11695 Gemini provider/model + usageDetails', () => {
  async function geminiRun(
    model: string,
    usage: UsageMetadata,
    metadata: Record<string, unknown> = { ls_provider: 'google_genai' },
  ) {
    const handler = new OpenlayerHandler();
    const runId = `gem-${Math.round(performance.now())}-${Math.random()}`;
    await handler.handleChatModelStart(
      llmSerialized,
      [[new HumanMessage('q')]],
      runId,
      undefined,
      { invocation_params: { model } },
      [],
      metadata,
    );
    await handler.handleLLMEnd(makeLLMResult(makeAIMessage('a', usage), 'a'), runId);
    return lastTrace().steps[0];
  }

  const basicUsage: UsageMetadata = { input_tokens: 5, output_tokens: 3, total_tokens: 8 };

  it('maps ls_provider=google_genai to Google', async () => {
    const step = await geminiRun('models/gemini-3.5-flash', basicUsage);
    expect(step.provider).toBe('Google');
  });

  it('strips the Gemini models/ prefix from the model name', async () => {
    const step = await geminiRun('models/gemini-3.5-flash', basicUsage);
    expect(step.model).toBe('gemini-3.5-flash');
  });

  it('emits an input/output usageDetails partition when no token details', async () => {
    const step = await geminiRun('gemini-2.5-flash', {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    });
    expect(step.usageDetails).toEqual({ input_tokens: 100, output_tokens: 50 });
    expect(step.toJSON().usageDetails).toEqual({ input_tokens: 100, output_tokens: 50 });
  });

  it('partitions cached tokens into non-overlapping backend keys; scalar tokens stay full', async () => {
    const usage = {
      input_tokens: 27131,
      output_tokens: 17739,
      total_tokens: 44870,
      input_token_details: { cache_read: 10000 },
    } as unknown as UsageMetadata;
    const step = await geminiRun('gemini-3.5-flash', usage);
    expect(step.usageDetails).toEqual({ input_tokens: 17131, cached_tokens: 10000, output_tokens: 17739 });
    expect(step.promptTokens).toBe(27131);
    expect(step.completionTokens).toBe(17739);
  });

  it('breaks out audio and folds reasoning into output', async () => {
    const usage = {
      input_tokens: 300,
      output_tokens: 120,
      total_tokens: 420,
      input_token_details: { audio: 30 },
      output_token_details: { audio: 20, reasoning: 50 },
    } as unknown as UsageMetadata;
    const step = await geminiRun('gemini-2.5-flash', usage);
    expect(step.usageDetails).toEqual({
      input_tokens: 270,
      output_tokens: 100,
      audio_input_tokens: 30,
      audio_output_tokens: 20,
    });
  });
});

describe('OpenlayerHandler - OPEN-11901 ls_provider vocabulary', () => {
  /** Drive one chat-model run and return the recorded step. */
  async function run(metadata: Record<string, unknown>, model = 'some-model') {
    const handler = new OpenlayerHandler();
    const runId = `p-${Math.round(performance.now())}-${Math.random()}`;
    await handler.handleChatModelStart(
      llmSerialized,
      [[new HumanMessage('q')]],
      runId,
      undefined,
      { invocation_params: { model } },
      [],
      metadata,
    );
    await handler.handleLLMEnd(makeLLMResult(makeAIMessage('a'), 'a'), runId);
    return lastTrace().steps[0];
  }

  /**
   * `ls_provider` values emitted by LangChain JS, verified by grepping the
   * installed packages rather than inferred from Python's `_llm_type`.
   */
  const GROUND_TRUTH: [lsProvider: string, expected: string, pkg: string][] = [
    ['openai', 'OpenAI', '@langchain/openai'],
    ['azure', 'Azure', '@langchain/openai AzureChatOpenAI'],
    ['anthropic', 'Anthropic', '@langchain/anthropic'],
    ['cohere', 'Cohere', '@langchain/cohere'],
    ['google_vertexai', 'Google', '@langchain/google-common'],
    ['google_genai', 'Google', '@langchain/google-genai'],
    ['ollama', 'Ollama', '@langchain/ollama'],
    ['amazon_bedrock', 'Bedrock', '@langchain/aws'],
    ['bedrock', 'Bedrock', '@langchain/community'],
    ['watsonx', 'Watsonx', '@langchain/community'],
    ['mistral', 'Mistral', '@langchain/mistralai'],
    ['groq', 'Groq', '@langchain/groq'],
    ['xai', 'xAI', '@langchain/xai'],
    ['cerebras', 'Cerebras', '@langchain/cerebras'],
  ];

  it.each(GROUND_TRUTH)('maps ls_provider=%s to %s (%s)', async (lsProvider, expected) => {
    const step = await run({ ls_provider: lsProvider });
    expect(step.provider).toBe(expected);
  });

  /**
   * `@langchain/core`'s BaseChatModel.getLsParams() default is
   * `getName().replace('Chat','')`, so any model not overriding it emits a
   * PascalCase class name. A case-sensitive lookup can never match those.
   */
  it.each([
    ['Ollama', 'Ollama'],
    ['VertexAI', 'Google'],
    ['MistralAI', 'Mistral'],
    ['OpenAI', 'OpenAI'],
  ])('normalizes the PascalCase getLsParams() default %s to %s', async (lsProvider, expected) => {
    const step = await run({ ls_provider: lsProvider });
    expect(step.provider).toBe(expected);
  });

  // Legacy Python `_llm_type` keys the map used to be built from. They must keep
  // resolving so nothing that works today regresses.
  it.each([
    ['openai-chat', 'OpenAI'],
    ['chat-ollama', 'Ollama'],
    ['vertexai', 'Google'],
    ['azure-openai', 'Azure'],
    ['huggingface', 'Hugging Face'],
  ])('still resolves the legacy _llm_type key %s to %s', async (lsProvider, expected) => {
    const step = await run({ ls_provider: lsProvider });
    expect(step.provider).toBe(expected);
  });

  it('names a Vertex step distinctly from a Gemini Developer API step', async () => {
    expect((await run({ ls_provider: 'google_vertexai' })).name).toBe('Google Vertex AI Chat Completion');
    expect((await run({ ls_provider: 'google_genai' })).name).toBe('Google Gemini Chat Completion');
  });

  it('keeps the Azure OpenAI step name while recording provider Azure', async () => {
    const step = await run({ ls_provider: 'azure' });
    expect(step.provider).toBe('Azure');
    expect(step.name).toBe('Azure OpenAI Chat Completion');
  });

  it('records the Gemini model under the exact key the cost table stores', async () => {
    // ("google","models/gemini-2.5-flash") misses; ("google","gemini-2.5-flash") hits.
    const step = await run({ ls_provider: 'google_vertexai' }, 'models/gemini-2.5-flash');
    expect(step.model).toBe('gemini-2.5-flash');
  });

  describe('unmapped providers', () => {
    it('records Unknown and warns, so the miss is not silent', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const step = await run({ ls_provider: 'totally-made-up-vendor' });

      expect(step.provider).toBe('Unknown');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('totally-made-up-vendor');
    });

    it('warns only once for a repeated unmapped provider', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await run({ ls_provider: 'another-made-up-vendor' });
      await run({ ls_provider: 'another-made-up-vendor' });

      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('heuristic fallback when ls_provider is absent', () => {
    it('infers OpenAI from a gpt model name', async () => {
      expect((await run({}, 'gpt-4o')).provider).toBe('OpenAI');
    });

    it('infers Anthropic from a claude model name', async () => {
      expect((await run({}, 'claude-sonnet-4-5')).provider).toBe('Anthropic');
    });

    it('infers Google from a gemini model name', async () => {
      expect((await run({}, 'gemini-2.5-flash')).provider).toBe('Google');
    });

    it('does not guess a vendor from a llama model name', async () => {
      // Llama is served by Groq, Bedrock, Together and others; the old code
      // guessed 'meta', which is not a cost-table slug and priced at $0 anyway.
      expect((await run({}, 'llama-3.3-70b-versatile')).provider).toBe('Unknown');
    });
  });

  /**
   * These are the regression tests OPEN-11901 asks for. The one-off corrections
   * above fix today's vocabulary; these constrain the tables so the next
   * provider added cannot reintroduce the same class of bug.
   */
  describe('table invariants', () => {
    /**
     * Provider slugs confirmed present in https://llm-costs.openlayer.com/v1/costs
     * on 2026-07-27. The backend lowercases the SDK's provider and does an exact
     * match with no aliasing, so a canonical name outside this set prices at $0.
     */
    const VERIFIED_COST_SLUGS = new Set([
      'openai',
      'azure',
      'anthropic',
      'google',
      'bedrock',
      'cohere',
      'ollama',
      'mistral',
      'groq',
      'xai',
      'cerebras',
      'watsonx',
    ]);

    const canonicalProviders = [...new Set(Object.values(LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP))];

    it('declares a cost slug for every canonical provider', () => {
      const undeclared = canonicalProviders.filter((p) => !(p in PROVIDER_COST_SLUG));
      expect(undeclared).toEqual([]);
    });

    it('only uses canonical names that lowercase to their declared cost slug', () => {
      const mismatched = canonicalProviders.filter((p) => {
        const slug = PROVIDER_COST_SLUG[p];
        return slug !== null && slug !== undefined && p.toLowerCase() !== slug;
      });
      expect(mismatched).toEqual([]);
    });

    it('only declares cost slugs that exist in the cost table', () => {
      const unverified = Object.values(PROVIDER_COST_SLUG).filter(
        (slug) => slug !== null && !VERIFIED_COST_SLUGS.has(slug),
      );
      expect(unverified).toEqual([]);
    });

    it('keys the map on normalized lookup keys only', () => {
      // A key containing an uppercase letter, space, hyphen or underscore can
      // never be produced by the normalizer, so it would be dead on arrival.
      const unreachable = Object.keys(LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP).filter(
        (key) => !/^[a-z0-9.]+$/.test(key),
      );
      expect(unreachable).toEqual([]);
    });

    it('gives every mapped provider a real step name, never the raw run name', async () => {
      const entries = Object.keys(LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP);
      const degraded: string[] = [];
      for (const lsProvider of entries) {
        const step = await run({ ls_provider: lsProvider });
        if (step.name === 'ChatOpenAI' || !/Chat Completion$/.test(step.name)) {
          degraded.push(`${lsProvider} -> ${step.name}`);
        }
      }
      expect(degraded).toEqual([]);
    });
  });
});
