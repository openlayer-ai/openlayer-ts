import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { traceBedrockAgent } from '../src/lib/integrations/bedrockAgentTracer';

/**
 * Simple example to test the Bedrock agent tracer
 * Replace the agent IDs with your actual Bedrock agent configuration
 */
export const simpleBedrockExample = async () => {
  // Step 0: Make sure to set OPENLAYER_API_KEY and OPENLAYER_INFERENCE_PIPELINE_ID as environment variables

  // Step 1: Create the Bedrock client
  const client = new BedrockAgentRuntimeClient({
    region: 'us-west-2', // Updated to match your agent's region
  });

  // Step 2: Apply Openlayer tracing
  const tracedClient = traceBedrockAgent(client);

  // Step 3: Configure your agent details
  // Update the example with your actual agent details
  const agentId = 'YOUR_AGENT_ID'; // Your actual agent ID
  const agentAliasId = 'YOUR_ALIAS_ID'; // You'll need to create/find this
  const sessionId = `test-session-${Date.now()}`;

  // Step 4: Create the command
  const command = new InvokeAgentCommand({
    agentId: agentId,
    agentAliasId: agentAliasId, // You'll get this after creating an alias
    sessionId: `test-session-${Date.now()}`,
    inputText: 'What is the capital of the moon?',
    enableTrace: true,
  });

  try {
    console.log('🤖 Sending request to Bedrock agent...');

    // Step 5: Send the command and process the response
    const response = await tracedClient.send(command);

    if (!response.completion) {
      throw new Error('No completion received');
    }

    let finalOutput = '';

    // Step 6: Process the streaming response
    for await (const event of response.completion) {
      if (event.chunk?.bytes) {
        const text = new TextDecoder('utf-8').decode(event.chunk.bytes);
        finalOutput += text;
        process.stdout.write(text); // Real-time output
      }
    }

    console.log('\n\n✅ Request completed successfully!');
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
};

// Run the example if this file is executed directly
if (require.main === module) {
  simpleBedrockExample()
    .then((result) => {
      console.log('\n📋 Final result:', result);
    })
    .catch((error) => {
      console.error('💥 Failed to run example:', error);
    });
}
