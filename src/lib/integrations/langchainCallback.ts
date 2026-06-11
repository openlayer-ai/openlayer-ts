import type { AgentAction, AgentFinish } from '@langchain/core/agents';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Document } from '@langchain/core/documents';
import type { Serialized } from '@langchain/core/load/serializable';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  FunctionMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type UsageMetadata,
  type BaseMessageFields,
  type MessageContent,
} from '@langchain/core/messages';
import type { Generation, LLMResult } from '@langchain/core/outputs';
import type { ChainValues } from '@langchain/core/utils/types';
import { getCurrentStep, processAndUploadTrace } from '../tracing/tracer';
import { AgentStep, ChatCompletionStep, HandoffStep, Step, StepType, stepFactory } from '../tracing/steps';
import { Trace } from '../tracing/traces';

const LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP: Record<string, string> = {
  openai: 'OpenAI',
  'openai-chat': 'OpenAI',
  'chat-ollama': 'Ollama',
  vertexai: 'Google',
  anthropic: 'Anthropic',
  'azure-openai': 'Azure OpenAI',
  cohere: 'Cohere',
  huggingface: 'Hugging Face',
};

const PROVIDER_TO_STEP_NAME: Record<string, string> = {
  OpenAI: 'OpenAI Chat Completion',
  Ollama: 'Ollama Chat Completion',
  Google: 'Google Vertex AI Chat Completion',
  Anthropic: 'Anthropic Chat Completion',
  'Azure OpenAI': 'Azure OpenAI Chat Completion',
  Cohere: 'Cohere Chat Completion',
  'Hugging Face': 'Hugging Face Chat Completion',
};

const LANGSMITH_HIDDEN_TAG = 'langsmith:hidden';

type OpenlayerPrompt = {
  name: string;
  version: number;
  isFallback: boolean;
};

export type LlmMessage = {
  role: string;
  content: BaseMessageFields['content'];
  additional_kwargs?: BaseMessageFields['additional_kwargs'];
};

export type AnonymousLlmMessage = {
  content: BaseMessageFields['content'];
  additional_kwargs?: BaseMessageFields['additional_kwargs'];
};

type ConstructorParams = {
  userId?: string | undefined;
  sessionId?: string | undefined;
  tags?: string[] | undefined;
  version?: string | undefined;
  traceMetadata?: Record<string, unknown> | undefined;
};

/**
 * Comprehensive LangChain callback handler for Openlayer tracing.
 *
 * Supports all LangChain components:
 * - LLMs and Chat Models (with streaming support)
 * - Chains
 * - Agents and Tools
 * - Retrievers
 * - Error handling and hierarchical tracking
 *
 * @example
 * ```typescript
 * import { OpenlayerHandler } from 'openlayer/lib/integrations/langchainCallback';
 *
 * const handler = new OpenlayerHandler({
 *   userId: 'user-123',
 *   sessionId: 'session-456',
 *   tags: ['production'],
 *   version: '1.0.0'
 * });
 *
 * const model = new ChatOpenAI({
 *   callbacks: [handler]
 * });
 * ```
 */
export class OpenlayerHandler extends BaseCallbackHandler {
  name = 'OpenlayerHandler';

  private userId?: string | undefined;
  private version?: string | undefined;
  private sessionId?: string | undefined;
  private tags: string[];
  private traceMetadata?: Record<string, unknown> | undefined;

  private completionStartTimes: Record<string, Date> = {};
  private promptToParentRunMap: Map<string, OpenlayerPrompt> = new Map();

  // Steps are assembled per LangChain run (keyed by runId, nested via
  // parentRunId) so concurrent graph executions never share a trace.
  private steps: Map<string, Step> = new Map();
  private rootRuns: Set<string> = new Set();
  private tracesByRoot: Map<string, Trace> = new Map();
  private skippedRuns: Set<string> = new Set();

  constructor(params?: ConstructorParams) {
    super();

    this.sessionId = params?.sessionId;
    this.userId = params?.userId;
    this.tags = params?.tags ?? [];
    this.traceMetadata = params?.traceMetadata;
    this.version = params?.version;
  }

  // ============================================================================
  // LLM Handlers
  // ============================================================================

  override async handleLLMNewToken(
    token: string,
    _idx: any,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    _fields?: any,
  ): Promise<void> {
    try {
      // Track first token timing for streaming
      if (runId && !(runId in this.completionStartTimes)) {
        console.debug(`LLM first streaming token: ${runId}`);
        this.completionStartTimes[runId] = new Date();
      }
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    try {
      console.debug(`LLM start with ID: ${runId}`);

      this.handleGenerationStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name);
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    try {
      console.debug(`Chat model start with ID: ${runId}`);

      const prompts = messages.flatMap((message) => message.map((m) => this.extractChatMessageContent(m)));

      this.handleGenerationStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name);
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`LLM end with ID: ${runId}`);

      if (output.generations.length === 0) {
        console.debug('No generations found in LLM output');
        return;
      }

      const lastGeneration = output.generations[output.generations.length - 1];
      if (!lastGeneration || lastGeneration.length === 0) {
        console.debug('No responses found in last generation');
        return;
      }

      const lastResponse = lastGeneration[lastGeneration.length - 1];

      const llmUsage =
        (lastResponse ? this.extractUsageMetadata(lastResponse) : undefined) ||
        output.llmOutput?.['tokenUsage'];
      const modelName = lastResponse ? this.extractModelNameFromMetadata(lastResponse) : undefined;

      const usageDetails: Record<string, any> = {
        input: llmUsage?.input_tokens ?? llmUsage?.promptTokens,
        output: llmUsage?.output_tokens ?? llmUsage?.completionTokens,
        total: llmUsage?.total_tokens ?? llmUsage?.totalTokens,
      };

      // Handle detailed token usage if available
      if (llmUsage && 'input_token_details' in llmUsage) {
        for (const [key, val] of Object.entries(llmUsage['input_token_details'] ?? {})) {
          usageDetails[`input_${key}`] = val;
          if ('input' in usageDetails && typeof val === 'number') {
            usageDetails['input'] = Math.max(0, usageDetails['input'] - val);
          }
        }
      }

      if (llmUsage && 'output_token_details' in llmUsage) {
        for (const [key, val] of Object.entries(llmUsage['output_token_details'] ?? {})) {
          usageDetails[`output_${key}`] = val;
          if ('output' in usageDetails && typeof val === 'number') {
            usageDetails['output'] = Math.max(0, usageDetails['output'] - val);
          }
        }
      }

      // Extract clean output for dashboard display
      const extractedOutput =
        lastResponse ?
          'message' in lastResponse && lastResponse['message'] instanceof BaseMessage ?
            lastResponse['message'].content // Just the content, not the full message object
          : lastResponse.text || ''
        : '';

      // Extract raw output (response object for debugging/analysis). Kept compact
      // (no pretty-printing, no duplicated fullResponse) so traces stay within the
      // platform's request size limit.
      const rawOutput =
        lastResponse ?
          JSON.stringify({
            generation: lastResponse,
            llmOutput: output.llmOutput,
          })
        : null;

      this.handleStepEnd({
        runId,
        output: extractedOutput,
        rawOutput,
        ...(modelName && { modelName }),
        usageDetails,
        ...(runId in this.completionStartTimes && { completionStartTime: this.completionStartTimes[runId] }),
      });

      if (runId in this.completionStartTimes) {
        delete this.completionStartTimes[runId];
      }
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleLLMError(err: any, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`LLM error ${err} with ID: ${runId}`);

      const azureRefusalError = this.parseAzureRefusalError(err);

      this.handleStepEnd({
        runId,
        error: err.toString() + azureRefusalError,
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  // ============================================================================
  // Chain Handlers
  // ============================================================================

  override async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runType?: string,
    name?: string,
  ): Promise<void> {
    try {
      console.debug(`Chain start with ID: ${runId}`);

      // Skip chains marked as hidden (e.g., internal LangGraph plumbing such as
      // ChannelWrite and branch runnables) — they carry the full graph state and
      // bloat the trace without adding information.
      if (tags && tags.includes(LANGSMITH_HIDDEN_TAG)) {
        this.skippedRuns.add(runId);
        return;
      }

      const runName = name ?? chain.id.at(-1)?.toString() ?? 'Langchain Chain';

      this.registerOpenlayerPrompt(parentRunId, metadata);

      // Process inputs to handle different formats
      let finalInput: string | ChainValues = inputs;
      if (runName === 'LangGraph' && typeof inputs === 'object' && inputs?.['messages']) {
        finalInput = { prompt: inputs['messages'] };
      } else if (
        typeof inputs === 'object' &&
        'input' in inputs &&
        Array.isArray(inputs['input']) &&
        inputs['input'].every((m) => m instanceof BaseMessage)
      ) {
        finalInput = inputs['input'].map((m) => this.extractChatMessageContent(m));
      } else if (typeof inputs === 'object' && 'content' in inputs && typeof inputs['content'] === 'string') {
        finalInput = inputs['content'];
      }

      this.startStep({
        runId,
        parentRunId,
        stepType: StepType.USER_CALL,
        name: runName,
        inputs: finalInput,
        metadata: this.joinTagsAndMetaData(tags, metadata) || {},
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleChainEnd(outputs: ChainValues, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`Chain end with ID: ${runId}`);

      const step = this.steps.get(runId);
      const lastMessage =
        Array.isArray(outputs?.['messages']) ?
          outputs['messages'][outputs['messages'].length - 1]
        : undefined;

      let finalOutput: ChainValues | string | MessageContent = outputs;
      if (step?.name === 'LangGraph' && lastMessage instanceof BaseMessage) {
        // Surface the final assistant message as the trace output
        finalOutput = lastMessage.content;
      } else if (
        typeof outputs === 'object' &&
        'output' in outputs &&
        typeof outputs['output'] === 'string'
      ) {
        finalOutput = outputs['output'];
      }

      this.handleStepEnd({
        runId,
        output: finalOutput,
      });

      this.deregisterOpenlayerPrompt(runId);
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleChainError(err: any, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`Chain error: ${err} with ID: ${runId}`);

      const azureRefusalError = this.parseAzureRefusalError(err);

      this.handleStepEnd({
        runId,
        error: err.toString() + azureRefusalError,
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  // ============================================================================
  // Agent Handlers
  // ============================================================================

  override async handleAgentAction(action: AgentAction, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`Agent action ${action.tool} with ID: ${runId}`);

      const step = this.startStep({
        runId,
        parentRunId,
        stepType: StepType.AGENT,
        name: `Agent Tool: ${action.tool}`,
        inputs: { tool: action.tool, tool_input: action.toolInput, log: action.log },
      });

      if (step instanceof AgentStep) {
        step.tool = action.tool;
        step.action = action;
      }
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleAgentEnd(action: AgentFinish, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`Agent finish with ID: ${runId}`);

      this.handleStepEnd({
        runId,
        output: action,
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  // ============================================================================
  // Tool Handlers
  // ============================================================================

  override async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    try {
      console.debug(`Tool start with ID: ${runId}`);

      const toolName = name ?? tool.id.at(-1)?.toString() ?? 'Tool execution';

      // Handoff tools (LangGraph multi-agent convention: transfer_to_<agent>,
      // transfer_back_to_<agent>) become HANDOFF steps instead of TOOL steps.
      const handoffTarget = this.extractHandoffTarget(toolName);
      if (handoffTarget) {
        const fromComponent = (metadata?.['langgraph_node'] as string) ?? 'Unknown Agent';
        const step = this.startStep({
          runId,
          parentRunId,
          stepType: StepType.HANDOFF,
          name: `Handoff: ${fromComponent} → ${handoffTarget}`,
          inputs: input,
          metadata: this.joinTagsAndMetaData(tags, metadata) || {},
        });
        if (step instanceof HandoffStep) {
          step.fromComponent = fromComponent;
          step.toComponent = handoffTarget;
          step.handoffData = input;
        }
        return;
      }

      this.startStep({
        runId,
        parentRunId,
        stepType: StepType.TOOL,
        name: toolName,
        inputs: input,
        metadata: this.joinTagsAndMetaData(tags, metadata) || {},
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleToolEnd(output: string, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`Tool end with ID: ${runId}`);

      this.handleStepEnd({
        runId,
        output: output,
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleToolError(err: any, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`Tool error ${err} with ID: ${runId}`);

      this.handleStepEnd({
        runId,
        error: err.toString(),
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  // ============================================================================
  // Retriever Handlers
  // ============================================================================

  override async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    try {
      console.debug(`Retriever start with ID: ${runId}`);

      this.startStep({
        runId,
        parentRunId,
        stepType: StepType.RETRIEVER,
        name: name ?? retriever.id.at(-1)?.toString() ?? 'Retriever',
        inputs: { query },
        metadata: this.joinTagsAndMetaData(tags, metadata) || {},
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleRetrieverEnd(
    documents: Document<Record<string, any>>[],
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    try {
      console.debug(`Retriever end with ID: ${runId}`);

      this.handleStepEnd({
        runId,
        output: documents,
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleRetrieverError(err: any, runId: string, parentRunId?: string): Promise<void> {
    try {
      console.debug(`Retriever error: ${err} with ID: ${runId}`);

      this.handleStepEnd({
        runId,
        error: err.toString(),
      });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Starts a step for a LangChain run, nesting it under its parent run when one
   * exists. Root runs either join an ambient Openlayer trace (e.g. when the
   * LangChain invocation happens inside a trace()-wrapped function) or start a
   * standalone trace owned by this handler.
   */
  private startStep(params: {
    runId: string;
    parentRunId?: string | undefined;
    stepType: StepType;
    name: string;
    inputs: any;
    metadata?: Record<string, unknown> | undefined;
  }): Step {
    const { runId, parentRunId, stepType, name, inputs, metadata } = params;

    const existing = this.steps.get(runId);
    if (existing) {
      return existing;
    }

    const step = stepFactory(stepType, name, inputs, null, (metadata as Record<string, any>) ?? {});

    const parentStep = parentRunId ? this.steps.get(parentRunId) : undefined;
    if (parentStep) {
      parentStep.addNestedStep(step);
    } else {
      // Only an OPEN step counts as ambient context: the global currentTrace is
      // not reset after a trace completes, so it may point at a stale trace.
      const ambientStep = getCurrentStep();
      if (ambientStep) {
        // We're inside an existing step context (e.g. a trace()-wrapped
        // function) - add as nested and let the outer trace own the upload
        ambientStep.addNestedStep(step);
      } else {
        // No existing context - create a standalone trace owned by this run
        const trace = new Trace();
        trace.addStep(step);
        this.tracesByRoot.set(runId, trace);
      }
      if (!parentRunId) {
        this.rootRuns.add(runId);
      }
    }

    this.steps.set(runId, step);
    return step;
  }

  private async handleGenerationStart(
    llm: Serialized,
    messages: (LlmMessage | MessageContent | AnonymousLlmMessage)[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    console.debug(`Generation start with ID: ${runId} and parentRunId ${parentRunId}`);

    const runName =
      name ?? llm.id?.at?.(-1)?.toString() ?? llm.id?.slice?.(-1)?.[0]?.toString() ?? 'Langchain Generation';

    // Extract comprehensive model parameters
    const modelParameters: Record<string, any> = {};
    const invocationParams = extraParams?.['invocation_params'];

    // Standard parameters
    const standardParams = {
      temperature: (invocationParams as any)?.['temperature'],
      max_tokens: (invocationParams as any)?.['max_tokens'],
      top_p: (invocationParams as any)?.['top_p'],
      top_k: (invocationParams as any)?.['top_k'],
      frequency_penalty: (invocationParams as any)?.['frequency_penalty'],
      presence_penalty: (invocationParams as any)?.['presence_penalty'],
      request_timeout: (invocationParams as any)?.['request_timeout'],
      stop: (invocationParams as any)?.['stop'],
      seed: (invocationParams as any)?.['seed'],
      response_format: (invocationParams as any)?.['response_format'],
      tools: (invocationParams as any)?.['tools'],
      tool_choice: (invocationParams as any)?.['tool_choice'],
    };

    for (const [key, value] of Object.entries(standardParams)) {
      if (value !== undefined && value !== null) {
        modelParameters[key] = value;
      }
    }

    // Add any additional parameters that weren't in the standard list
    if (invocationParams && typeof invocationParams === 'object') {
      for (const [key, value] of Object.entries(invocationParams)) {
        if (!(key in standardParams) && value !== undefined && value !== null) {
          modelParameters[key] = value;
        }
      }
    }

    // Extract model name
    interface InvocationParams {
      _type?: string;
      model?: string;
      model_name?: string;
      repo_id?: string;
    }

    let extractedModelName: string | undefined;
    if (extraParams) {
      const invocationParamsModelName = (extraParams['invocation_params'] as InvocationParams)?.model;
      const metadataModelName =
        metadata && 'ls_model_name' in metadata ? (metadata['ls_model_name'] as string) : undefined;

      extractedModelName = invocationParamsModelName ?? metadataModelName;
    }

    // Extract provider with multiple fallbacks
    let provider = metadata?.['ls_provider'] as string;

    // Fallback provider detection if not in metadata
    if (!provider) {
      // Try to detect from model name
      if (extractedModelName) {
        if (extractedModelName.includes('gpt') || extractedModelName.includes('openai')) {
          provider = 'openai';
        } else if (extractedModelName.includes('claude')) {
          provider = 'anthropic';
        } else if (extractedModelName.includes('gemini') || extractedModelName.includes('google')) {
          provider = 'google';
        } else if (extractedModelName.includes('llama') || extractedModelName.includes('meta')) {
          provider = 'meta';
        }
      }

      // Try to detect from LLM class name
      if (!provider && llm.id && Array.isArray(llm.id)) {
        const className = llm.id[0]?.toLowerCase() || '';
        if (className.includes('openai') || className.includes('chatgpt')) {
          provider = 'openai';
        } else if (className.includes('anthropic') || className.includes('claude')) {
          provider = 'anthropic';
        } else if (className.includes('google') || className.includes('gemini')) {
          provider = 'google';
        }
      }
    }

    const mappedProvider =
      provider && LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP[provider] ?
        LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP[provider]
      : 'Unknown';

    // Get registered prompt if available
    const registeredPrompt = this.promptToParentRunMap.get(parentRunId ?? 'root');
    if (registeredPrompt && parentRunId) {
      this.deregisterOpenlayerPrompt(parentRunId);
    }

    // Create step but don't end it yet - we'll update it in handleLLMEnd
    const stepName =
      mappedProvider && PROVIDER_TO_STEP_NAME[mappedProvider] ?
        PROVIDER_TO_STEP_NAME[mappedProvider]
      : runName;

    // Extra params other than invocation_params (which is fully captured by
    // modelParameters and would otherwise be serialized multiple times per step)
    const { invocation_params: _invocationParams, ...extraParamsRest } = extraParams ?? {};

    // Enhanced metadata collection. Invocation params/tool schemas are kept ONLY in
    // the step's modelParameters to avoid duplicating them in the trace payload.
    const enhancedMetadata = this.joinTagsAndMetaData(tags, metadata, {
      // LangChain specific metadata
      langchain_provider: provider,
      langchain_model: extractedModelName,
      langchain_run_id: runId,
      langchain_parent_run_id: parentRunId,

      // Timing
      start_time: new Date().toISOString(),

      // LLM info
      llm_class:
        llm.id ?
          Array.isArray(llm.id) ?
            llm.id.join('.')
          : llm.id
        : 'unknown',

      // Additional context
      ...(Object.keys(extraParamsRest).length > 0 && { extra_params: extraParamsRest }),
    });

    const step = this.startStep({
      runId,
      parentRunId,
      stepType: StepType.CHAT_COMPLETION,
      name: stepName,
      inputs: { prompt: messages },
      metadata: enhancedMetadata,
    });

    if (step instanceof ChatCompletionStep) {
      step.provider = mappedProvider ?? 'Unknown';
      step.model = extractedModelName ?? null;
      step.modelParameters = modelParameters;
    }
  }

  private handleStepEnd(params: {
    runId: string;
    output?: any;
    rawOutput?: string | null;
    error?: string;
    modelName?: string | undefined;
    usageDetails?: Record<string, any>;
    completionStartTime?: Date | undefined;
  }): void {
    const { runId, output, rawOutput, error, modelName, usageDetails } = params;

    if (this.skippedRuns.delete(runId)) {
      return;
    }

    const step = this.steps.get(runId);
    if (!step) {
      console.warn('Step not found for run. Skipping operation');
      return;
    }
    this.steps.delete(runId);
    const isRoot = this.rootRuns.delete(runId);

    step.endTime = Date.now();
    if (step.latency === null) {
      step.latency = step.endTime - step.startTime;
    }

    if (step instanceof ChatCompletionStep) {
      step.output = output || '';
      step.tokens = usageDetails?.['total'] || null;
      step.promptTokens = usageDetails?.['input'] || null;
      step.completionTokens = usageDetails?.['output'] || null;
      step.model = modelName || step.model || null;
      step.metadata =
        error ?
          { ...step.metadata, error, rawOutput: rawOutput || null }
        : { rawOutput: rawOutput || null, ...step.metadata };
    } else {
      if (output !== undefined) {
        step.output = output;
      }
      if (error) {
        step.metadata = { ...step.metadata, error };
      }
    }

    if (isRoot) {
      const trace = this.tracesByRoot.get(runId);
      this.tracesByRoot.delete(runId);
      // Only upload standalone traces — when nested in an ambient trace, the
      // ambient root step's end triggers the upload instead.
      if (trace && !getCurrentStep()) {
        // Convert all LangChain objects in the trace once at the end
        for (const traceStep of trace.steps) {
          this.convertStepObjectsRecursively(traceStep);
        }
        processAndUploadTrace(trace);
      }
    }
  }

  /**
   * Returns the target agent name when the tool follows the LangGraph
   * multi-agent handoff naming convention (transfer_to_<agent> or
   * transfer_back_to_<agent>), or null for regular tools.
   */
  private extractHandoffTarget(toolName: string): string | null {
    const match = toolName.match(/^transfer_(?:back_)?to_(.+)$/);
    return match?.[1] ?? null;
  }

  /** Converts all LangChain objects in a step and its nested steps. */
  private convertStepObjectsRecursively(step: Step): void {
    if (step.inputs !== null && step.inputs !== undefined) {
      step.inputs = this.convertLangchainObjects(step.inputs);
    }
    if (step.output !== null && step.output !== undefined) {
      step.output = this.convertLangchainObjects(step.output);
    }
    if (step.metadata) {
      step.metadata = this.convertLangchainObjects(step.metadata) as Record<string, any>;
    }
    for (const nestedStep of step.steps) {
      this.convertStepObjectsRecursively(nestedStep);
    }
  }

  /** Recursively converts LangChain objects to a JSON-friendly format. */
  private convertLangchainObjects(obj: any): any {
    if (obj instanceof BaseMessage) {
      return this.messageToDict(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertLangchainObjects(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const proto = Object.getPrototypeOf(obj);
      if (proto === Object.prototype || proto === null) {
        return Object.fromEntries(
          Object.entries(obj).map(([key, value]) => [key, this.convertLangchainObjects(value)]),
        );
      }

      // Class instances (e.g. ChatPromptValue) that wrap a list of messages
      if (Array.isArray((obj as any).messages)) {
        return (obj as any).messages.map((m: any) => this.convertLangchainObjects(m));
      }
      if ('content' in obj) {
        return (obj as any).content;
      }
    }

    return obj;
  }

  /** Converts a LangChain message to a `{role, content}` dictionary. */
  private messageToDict(message: BaseMessage): { role: string; content: MessageContent } {
    const messageType = typeof message._getType === 'function' ? message._getType() : 'human';

    const role =
      messageType === 'human' ? 'user'
      : messageType === 'ai' ? 'assistant'
      : messageType;

    return { role, content: message.content };
  }

  private registerOpenlayerPrompt(parentRunId?: string, metadata?: Record<string, unknown>): void {
    if (metadata && 'openlayerPrompt' in metadata && parentRunId) {
      this.promptToParentRunMap.set(parentRunId, metadata['openlayerPrompt'] as OpenlayerPrompt);
    }
  }

  private deregisterOpenlayerPrompt(runId: string): void {
    this.promptToParentRunMap.delete(runId);
  }

  private parseAzureRefusalError(err: any): string {
    let azureRefusalError = '';
    if (typeof err == 'object' && 'error' in err) {
      try {
        azureRefusalError = '\n\nError details:\n' + JSON.stringify(err['error'], null, 2);
      } catch {}
    }
    return azureRefusalError;
  }

  private joinTagsAndMetaData(
    tags?: string[],
    metadata1?: Record<string, unknown>,
    metadata2?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const finalDict: Record<string, unknown> = {};
    if (tags && tags.length > 0) {
      finalDict['tags'] = tags;
    }
    if (metadata1) {
      Object.assign(finalDict, metadata1);
    }
    if (metadata2) {
      Object.assign(finalDict, metadata2);
    }
    return this.stripOpenlayerKeysFromMetadata(finalDict);
  }

  private stripOpenlayerKeysFromMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!metadata) {
      return;
    }

    const openlayerKeys = ['openlayerPrompt', 'openlayerUserId', 'openlayerSessionId'];

    return Object.fromEntries(Object.entries(metadata).filter(([key, _]) => !openlayerKeys.includes(key)));
  }

  private extractUsageMetadata(generation: Generation): UsageMetadata | undefined {
    try {
      const usageMetadata =
        (
          'message' in generation &&
          (generation['message'] instanceof AIMessage || generation['message'] instanceof AIMessageChunk)
        ) ?
          generation['message'].usage_metadata
        : undefined;

      return usageMetadata;
    } catch (err) {
      console.debug(`Error extracting usage metadata: ${err}`);
      return;
    }
  }

  private extractModelNameFromMetadata(generation: any): string | undefined {
    try {
      return (
          'message' in generation &&
            (generation['message'] instanceof AIMessage || generation['message'] instanceof AIMessageChunk)
        ) ?
          generation['message'].response_metadata?.['model_name']
        : undefined;
    } catch {
      return undefined;
    }
  }

  private extractChatMessageContent(message: BaseMessage): LlmMessage | AnonymousLlmMessage | MessageContent {
    let response: any = undefined;

    if (message instanceof HumanMessage) {
      response = { content: message.content, role: 'user' };
    } else if (message instanceof ChatMessage) {
      response = { content: message.content, role: message.role };
    } else if (message instanceof AIMessage) {
      response = { content: message.content, role: 'assistant' };

      if ('tool_calls' in message && (message.tool_calls?.length ?? 0) > 0) {
        response['tool_calls'] = message['tool_calls'];
      }
    } else if (message instanceof SystemMessage) {
      response = { content: message.content, role: 'system' };
    } else if (message instanceof FunctionMessage) {
      response = {
        content: message.content,
        additional_kwargs: message.additional_kwargs,
        role: message.name,
      };
    } else if (message instanceof ToolMessage) {
      response = {
        content: message.content,
        additional_kwargs: message.additional_kwargs,
        role: message.name,
      };
    } else if (!message.name) {
      response = { content: message.content };
    } else {
      response = {
        role: message.name,
        content: message.content,
      };
    }

    if (message.additional_kwargs?.function_call || message.additional_kwargs?.tool_calls) {
      return { ...response, additional_kwargs: message.additional_kwargs };
    }

    return response;
  }
}
