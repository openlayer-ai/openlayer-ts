import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { traceBedrockAgent } from 'openlayer/lib/integrations/bedrockAgentTracer';

/**
 * BedrockAgent class for interacting with AWS Bedrock agents with Openlayer tracing
 */
export class BedrockAgent {
  private client: BedrockAgentRuntimeClient;
  private tracedClient: BedrockAgentRuntimeClient;
  private agentId: string;
  private agentAliasId: string;
  private region: string;

  constructor(config: {
    agentId: string;
    agentAliasId: string;
    region?: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.agentId = config.agentId;
    this.agentAliasId = config.agentAliasId;
    this.region = config.region || 'us-east-2';

    // Create the Bedrock client
    this.client = new BedrockAgentRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    // Apply Openlayer tracing
    this.tracedClient = traceBedrockAgent(this.client);
  }

  /**
   * Invoke the Bedrock agent with a prompt
   * @param prompt - The text prompt to send to the agent
   * @param options - Optional configuration for the invocation
   * @returns Promise with the response data
   */
  async invoke(
    prompt: string,
    options: {
      sessionId?: string;
      enableTrace?: boolean;
      enableRealTimeOutput?: boolean;
    } = {},
  ): Promise<{
    sessionId: string;
    output: string;
    success: boolean;
    error?: string;
  }> {
    const { sessionId = `session-${Date.now()}`, enableTrace = true, enableRealTimeOutput = false } = options;

    // Create the command
    const command = new InvokeAgentCommand({
      agentId: this.agentId,
      agentAliasId: this.agentAliasId,
      sessionId,
      inputText: prompt,
      enableTrace,
    });

    try {
      console.log('🤖 Sending request to Bedrock agent...');
      console.log(`📝 Prompt: ${prompt}`);

      // Send the command and process the response
      const response = await this.tracedClient.send(command);

      if (!response.completion) {
        throw new Error('No completion received');
      }

      let finalOutput = '';

      // Process the streaming response
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          const text = new TextDecoder('utf-8').decode(event.chunk.bytes);
          finalOutput += text;

          if (enableRealTimeOutput) {
            process.stdout.write(text); // Real-time output
          }
        }
      }

      console.log('\n✅ Request completed successfully!');
      console.log('📊 Check your Openlayer dashboard for trace data');

      return {
        sessionId,
        output: finalOutput,
        success: true,
      };
    } catch (error) {
      console.error('❌ Error:', error);
      return {
        sessionId,
        output: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get the current agent configuration
   */
  getConfig() {
    return {
      agentId: this.agentId,
      agentAliasId: this.agentAliasId,
      region: this.region,
    };
  }
}

/**
 * Example usage function
 */
export const simpleBedrockExample = async () => {
  // Step 0: Make sure to set OPENLAYER_API_KEY and OPENLAYER_INFERENCE_PIPELINE_ID as environment variables

  // Create a BedrockAgent instance
  const bedrockAgent = new BedrockAgent({
    agentId: '', // Your actual agent ID
    agentAliasId: '', // You'll need to create/find this
    region: 'us-east-2',
    accessKeyId: '',
    secretAccessKey: '',
  });

  // Invoke the agent with a prompt
  const result = await bedrockAgent.invoke('What is the capital of the moon?', {
    enableRealTimeOutput: true,
  });

  return result;
};
