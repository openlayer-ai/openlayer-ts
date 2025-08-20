import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { LLMResult } from '@langchain/core/dist/outputs';
import type { Serialized } from '@langchain/core/load/serializable';
import { AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import performanceNow from 'performance-now';
import { addChatCompletionStepToTrace } from '../tracing/tracer';

const LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP: Record<string, string> = {
  openai: 'OpenAI',
  'openai-chat': 'OpenAI',
  'chat-ollama': 'Ollama',
  vertexai: 'Google',
};
const PROVIDER_TO_STEP_NAME: Record<string, string> = {
  OpenAI: 'OpenAI Chat Completion',
  Ollama: 'Ollama Chat Completion',
  Google: 'Google Vertex AI Chat Completion',
};

export class OpenlayerHandler extends BaseCallbackHandler {
  name = 'OpenlayerHandler';
  startTime: number | null = null;
  endTime: number | null = null;
  prompt: Array<{ role: string; content: string }> | null = null;
  latency: number = 0;
  provider: string | undefined;
  model: string | null = null;
  modelParameters: Record<string, any> | null = null;
  promptTokens: number | null = 0;
  completionTokens: number | null = 0;
  totalTokens: number | null = 0;
  output: string = '';
  metadata: Record<string, any>;

  constructor(kwargs: Record<string, any> = {}) {
    super();
    this.metadata = kwargs;
  }
  override async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    this.initializeRun(extraParams || {}, metadata || {});
    this.prompt = this.langchainMassagesToPrompt(messages);
    this.startTime = performanceNow();
  }

  private initializeRun(extraParams: Record<string, any>, metadata: Record<string, unknown>): void {
    this.modelParameters = extraParams['invocation_params'] || {};

    const provider = metadata?.['ls_provider'] as string;
    if (provider && LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP[provider]) {
      this.provider = LANGCHAIN_TO_OPENLAYER_PROVIDER_MAP[provider];
    }
    this.model = (this.modelParameters?.['model'] as string) || (metadata['ls_model_name'] as string) || null;
    this.output = '';
  }

  private langchainMassagesToPrompt(messages: BaseMessage[][]): Array<{ role: string; content: string }> {
    let prompt: Array<{ role: string; content: string }> = [];
    for (const message of messages) {
      for (const m of message) {
        if (m instanceof AIMessage) {
          prompt.push({ role: 'assistant', content: m.content as string });
        } else if (m instanceof SystemMessage) {
          prompt.push({ role: 'system', content: m.content as string });
        } else {
          prompt.push({ role: 'user', content: m.content as string });
        }
      }
    }
    return prompt;
  }

  override async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runName?: string,
  ) {
    this.initializeRun(extraParams || {}, metadata || {});
    this.prompt = prompts.map((p) => ({ role: 'user', content: p }));
    this.startTime = performanceNow();
  }

  override async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string, tags?: string[]) {
    this.endTime = performanceNow();
    this.latency = this.endTime - this.startTime!;
    this.extractTokenInformation(output);
    this.extractOutput(output);
    this.addToTrace();
  }

  private extractTokenInformation(output: LLMResult) {
    if (this.provider === 'OpenAI') {
      this.openaiTokenInformation(output);
    }
  }

  private openaiTokenInformation(output: LLMResult) {
    if (output.llmOutput && 'tokenUsage' in output.llmOutput) {
      this.promptTokens = output.llmOutput?.['tokenUsage']?.promptTokens ?? 0;
      this.completionTokens = output.llmOutput?.['tokenUsage']?.completionTokens ?? 0;
      this.totalTokens = output.llmOutput?.['tokenUsage']?.totalTokens ?? 0;
    }
  }

  private extractOutput(output: LLMResult) {
    const lastResponse = output?.generations?.at(-1)?.at(-1) ?? undefined;
    this.output += lastResponse?.text ?? '';
  }

  private addToTrace() {
    let name = 'Chat Completion Model';
    if (this.provider && this.provider in PROVIDER_TO_STEP_NAME) {
      name = PROVIDER_TO_STEP_NAME[this.provider] ?? 'Chat Completion Model';
    }
    addChatCompletionStepToTrace({
      name: name,
      inputs: { prompt: this.prompt },
      output: this.output,
      latency: this.latency,
      tokens: this.totalTokens,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      model: this.model,
      modelParameters: this.modelParameters,
      metadata: this.metadata,
      provider: this.provider ?? '',
      startTime: this.startTime,
      endTime: this.endTime,
    });
  }
}
