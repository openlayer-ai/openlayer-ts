import CLIHandler from 'openlayer/lib/core/cli';
import { BedrockAgent } from './model.ts';

// Initialize CLI handler with the user's model run method
const cliHandler = new CLIHandler(async ({ userQuery }: { userQuery: string }) => {
  // Your model's run method implementation
  const bedrockAgent = new BedrockAgent({
    agentId: '', // Your actual agent ID
    agentAliasId: '', // You'll need to create/find this
    region: 'us-east-2',
    accessKeyId: '',
    secretAccessKey: '',
  });

  // Invoke the agent with a prompt
  const result = await bedrockAgent.invoke(userQuery, {
    enableRealTimeOutput: true,
  });

  return { output: result.output };
});

// Setup CLI and process dataset
cliHandler.runFromCLI();
