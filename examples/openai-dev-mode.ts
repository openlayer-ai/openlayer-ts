/*
 * This shows how to use the OpenAI monitor with Openlayer to create a CLI handler
 * for processing datasets. The script can be called with the following command:
 * node dist/run.js --dataset-path {{ path }} --dataset-name {{ name }}
 * Intended to be referenced from an openlayer.json config.
 */

import { ChatCompletion } from 'openai/resources';
import Openlayer from 'openlayer';
import CLIHandler, { RunReturn } from 'openlayer/lib/core/cli';
import OpenAIMonitor from 'openlayer/lib/core/openai-monitor';

export class MyModel {
  private monitor: OpenAIMonitor;

  private openaiApiKey: string;

  private openlayerApiKey: string;

  private openlayerInferencePipelineId: string;

  constructor() {
    this.openaiApiKey = process.env['OPENAI_API_KEY'] || '';
    this.openlayerApiKey = process.env['OPENLAYER_API_KEY'] || '';
    // (Optional) if set will enable monitoring requests
    this.openlayerInferencePipelineId = process.env['OPENLAYER_INFERENCE_PIPELINE_ID'] || '';

    const openlayerClient = new Openlayer({ apiKey: this.openlayerApiKey });

    this.monitor = new OpenAIMonitor({
      openAiApiKey: this.openaiApiKey,
      openlayerClient,
      openlayerInferencePipelineId: this.openlayerInferencePipelineId,
    });
  }

  async run({ userQuery }: { userQuery: string }): Promise<RunReturn> {
    // Implement the model run logic here
    const model = 'gpt-3.5-turbo';
    const response = await this.monitor.createChatCompletion(
      {
        messages: [
          {
            content: userQuery,
            role: 'user',
          },
        ],
        model,
      },
      undefined,
    );
    const result = (response as ChatCompletion).choices[0]?.message.content;
    return { otherFields: { model }, output: result };
  }
}

// User implements their model
const model = new MyModel();

// Initialize CLI handler with the user's model run method
const cliHandler = new CLIHandler(model.run.bind(model));

// Setup CLI and process dataset
cliHandler.runFromCLI();
