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
import { 
  addChatCompletionStepToTrace, 
  addChainStepToTrace, 
  addAgentStepToTrace, 
  addToolStepToTrace, 
  addRetrieverStepToTrace 
} from '../tracing/tracer';

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
  private runMap: Map<string, { step: any; endStep: () => void }> = new Map();

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

      this.handleGenerationStart(
        llm,
        prompts,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        name,
      );
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

      const prompts = messages.flatMap((message) =>
        message.map((m) => this.extractChatMessageContent(m)),
      );

      this.handleGenerationStart(
        llm,
        prompts,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        name,
      );
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleLLMEnd(
    output: LLMResult,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
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
      
      const llmUsage = (lastResponse ? this.extractUsageMetadata(lastResponse) : undefined) || output.llmOutput?.['tokenUsage'];
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
      const extractedOutput = lastResponse ? (
        'message' in lastResponse && lastResponse['message'] instanceof BaseMessage
          ? lastResponse['message'].content  // Just the content, not the full message object
          : lastResponse.text || ''
      ) : '';

      // Extract raw output (complete response object for debugging/analysis)
      const rawOutput = lastResponse ? JSON.stringify({
        generation: lastResponse,
        llmOutput: output.llmOutput,
        fullResponse: output
      }, null, 2) : null;

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

  override async handleLLMError(
    err: any,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
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

      const runName = name ?? chain.id.at(-1)?.toString() ?? 'Langchain Chain';

      this.registerOpenlayerPrompt(parentRunId, metadata);

      // Process inputs to handle different formats
      let finalInput: string | ChainValues = inputs;
      if (
        typeof inputs === 'object' &&
        'input' in inputs &&
        Array.isArray(inputs['input']) &&
        inputs['input'].every((m) => m instanceof BaseMessage)
      ) {
        finalInput = inputs['input'].map((m) => this.extractChatMessageContent(m));
      } else if (
        typeof inputs === 'object' &&
        'content' in inputs &&
        typeof inputs['content'] === 'string'
      ) {
        finalInput = inputs['content'];
      }

      const { step, endStep } = addChainStepToTrace({
        name: runName,
        inputs: finalInput,
        metadata: this.joinTagsAndMetaData(tags, metadata) || {},
      });

      this.runMap.set(runId, { step, endStep });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    try {
      console.debug(`Chain end with ID: ${runId}`);

      let finalOutput: ChainValues | string = outputs;
      if (
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

  override async handleChainError(
    err: any,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
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

  override async handleAgentAction(
    action: AgentAction,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    try {
      console.debug(`Agent action ${action.tool} with ID: ${runId}`);
      
      const { step, endStep } = addAgentStepToTrace({
        name: action.tool,
        inputs: action,
        tool: action.tool,
        action: action,
      });

      this.runMap.set(runId, { step, endStep });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleAgentEnd(
    action: AgentFinish,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
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

      const { step, endStep } = addToolStepToTrace({
        name: name ?? tool.id.at(-1)?.toString() ?? 'Tool execution',
        inputs: input,
        metadata: this.joinTagsAndMetaData(tags, metadata) || {},
      });

      this.runMap.set(runId, { step, endStep });
    } catch (e) {
      console.debug(e instanceof Error ? e.message : String(e));
    }
  }

  override async handleToolEnd(
    output: string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
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

  override async handleToolError(
    err: any,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
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

      const { step, endStep } = addRetrieverStepToTrace({
        name: name ?? retriever.id.at(-1)?.toString() ?? 'Retriever',
        inputs: query,
        metadata: this.joinTagsAndMetaData(tags, metadata) || {},
      });

      this.runMap.set(runId, { step, endStep });
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

  override async handleRetrieverError(
    err: any,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
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

    const runName = name ?? llm.id?.at?.(-1)?.toString() ?? llm.id?.slice?.(-1)?.[0]?.toString() ?? 'Langchain Generation';

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
      const metadataModelName = metadata && 'ls_model_name' in metadata 
        ? (metadata['ls_model_name'] as string) 
        : undefined;

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
    
    const mappedProvider = provider && LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP[provider] 
      ? LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP[provider] 
      : 'Unknown';

    // Get registered prompt if available
    const registeredPrompt = this.promptToParentRunMap.get(parentRunId ?? 'root');
    if (registeredPrompt && parentRunId) {
      this.deregisterOpenlayerPrompt(parentRunId);
    }

    // Create step but don't end it yet - we'll update it in handleLLMEnd
    const stepName = mappedProvider && PROVIDER_TO_STEP_NAME[mappedProvider] 
      ? PROVIDER_TO_STEP_NAME[mappedProvider] 
      : runName;

    // For generations, we need to track the start time and other data to use in handleLLMEnd
    const startTime = performance.now();
    
    // Enhanced metadata collection
    const enhancedMetadata = this.joinTagsAndMetaData(tags, metadata, {
      // LangChain specific metadata
      langchain_provider: provider,
      langchain_model: extractedModelName,
      langchain_run_id: runId,
      langchain_parent_run_id: parentRunId,
      
      // Invocation details
      invocation_params: invocationParams,
      
      // Timing
      start_time: new Date().toISOString(),
      
      // LLM info
      llm_class: llm.id ? (Array.isArray(llm.id) ? llm.id.join('.') : llm.id) : 'unknown',
      
      // Additional context
      ...(Object.keys(modelParameters).length > 0 && { model_parameters: modelParameters }),
      ...(extraParams && { extra_params: extraParams }),
    });

    this.runMap.set(runId, {
      step: {
        name: stepName,
        inputs: { prompt: messages },
        startTime,
        provider: mappedProvider,
        model: extractedModelName,
        modelParameters,
        metadata: enhancedMetadata,
        prompt: registeredPrompt,
      },
      endStep: () => {}, // Will be replaced in handleLLMEnd
    });
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
    const { runId, output, rawOutput, error, modelName, usageDetails, completionStartTime } = params;

    const runData = this.runMap.get(runId);
    if (!runData) {
      console.warn('Step not found in runMap. Skipping operation');
      return;
    }

        const { step } = runData;

    // Handle LLM/Generation steps specially
    if (step.provider) {
      const endTime = performance.now();
      const latency = endTime - step.startTime;

      addChatCompletionStepToTrace({
        name: step.name || 'Unknown Generation',
        inputs: step.inputs || {},
        output: output || '',
        rawOutput: rawOutput || null,
        latency,
        tokens: usageDetails?.['total'] || null,
        promptTokens: usageDetails?.['input'] || null,
        completionTokens: usageDetails?.['output'] || null,
        model: modelName || step.model || null,
        modelParameters: step.modelParameters || null,
        metadata: error ? { ...step.metadata, error } : step.metadata || {},
        provider: step.provider || 'Unknown',
      });
    } else {
      // For other step types, update and end the existing step
      if (step.log) {
        step.log({ 
          output: output,
          metadata: error ? { ...step.metadata, error } : step.metadata,
        });
      }
      if (runData.endStep) {
        runData.endStep();
      }
    }

    this.runMap.delete(runId);
  }

  private registerOpenlayerPrompt(
    parentRunId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (metadata && 'openlayerPrompt' in metadata && parentRunId) {
      this.promptToParentRunMap.set(
        parentRunId,
        metadata['openlayerPrompt'] as OpenlayerPrompt,
      );
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

    const openlayerKeys = [
      'openlayerPrompt',
      'openlayerUserId',
      'openlayerSessionId',
    ];

    return Object.fromEntries(
      Object.entries(metadata).filter(([key, _]) => !openlayerKeys.includes(key)),
    );
  }

  private extractUsageMetadata(generation: Generation): UsageMetadata | undefined {
    try {
      const usageMetadata =
        'message' in generation &&
        (generation['message'] instanceof AIMessage ||
          generation['message'] instanceof AIMessageChunk)
          ? generation['message'].usage_metadata
          : undefined;

      return usageMetadata;
    } catch (err) {
      console.debug(`Error extracting usage metadata: ${err}`);
      return;
    }
  }

  private extractModelNameFromMetadata(generation: any): string | undefined {
    try {
      return 'message' in generation &&
        (generation['message'] instanceof AIMessage ||
          generation['message'] instanceof AIMessageChunk)
        ? generation['message'].response_metadata?.['model_name']
        : undefined;
    } catch {
      return undefined;
    }
  }

  private extractChatMessageContent(
    message: BaseMessage,
  ): LlmMessage | AnonymousLlmMessage | MessageContent {
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

    if (
      message.additional_kwargs?.function_call ||
      message.additional_kwargs?.tool_calls
    ) {
      return { ...response, additional_kwargs: message.additional_kwargs };
    }
    
    return response;
  }
}
