/*
 * Description: This file contains the CLIHandler class which is responsible
 * For handling the CLI input and output.
 *
 * Example Usage:
 * // Initialize CLI handler with the user's model run method
 * const cliHandler = new CLIHandler(model.run.bind(model));
 *
 * // Setup CLI and process dataset
 * cliHandler.runFromCLI();
 */

import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { getCurrentTrace, postProcessTrace } from '../tracing/tracer';

// Define shared interfaces and utilities here
export interface RunReturn {
  otherFields: { [key: string]: any };
  output: any;
}

interface Output {
  output: any;
  steps?: Array<Record<string, any>>;
  latency?: number;
  cost?: number;
  tokens?: number;
  metadata?: Record<string, any>;
}

// Define an interface for the configuration object
export interface Config {
  inputVariableNames?: string[];
  metadata?: {
    outputTimestamp?: number;
  };
  outputColumnName: string;
  latencyColumnName?: string;
  costColumnName?: string;
  numOfTokensColumnName?: string;
}

class CLIHandler {
  private run: (...args: any[]) => Promise<any>;

  constructor(runFunction: (...args: any[]) => Promise<any>) {
    this.run = runFunction;
  }

  public runFromCLI() {
    program
      .requiredOption('--dataset-path <path>', 'Path to the dataset')
      .requiredOption('--output-dir <path>', 'Directory to place results');

    program.parse(process.argv);

    const options = program.opts();
    const { datasetPath, outputDir } = options;

    // Load dataset
    const datasetFullPath = path.resolve(datasetPath);
    const rawData = fs.readFileSync(datasetFullPath, 'utf8');
    const dataset = JSON.parse(rawData);

    // Process each item in the dataset dynamically
    Promise.all<Output>(
      dataset.map(async (item: any) => {
        try {
          const result = await this.run(item);
          // Merge the original item fields with the result
          const traceData = getCurrentTrace() ?? undefined;
          const postProcessedTrace =
            typeof traceData === 'undefined' || traceData === null ?
              undefined
            : postProcessTrace(traceData)?.traceData;

          const output: Output = {
            ...item,
            ...result.otherFields,
            output: result.output,
            steps: traceData?.toJSON(),
            latency: postProcessedTrace?.latency,
            cost: postProcessedTrace?.cost,
            tokens: postProcessedTrace?.tokens,
            metadata: {
              ...(postProcessedTrace?.metadata ?? {}),
              inputVariableNames: postProcessedTrace?.inputVariableNames,
            },
          };

          return output;
        } catch (error) {
          console.error('Error processing dataset: ', error);
          return {
            ...item,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    )
      .then((results) => {
        /*
         * Wait for all rows to be run
         * Write results now to output dir or log to console
         */
        const config: Config = {
          outputColumnName: 'output',
          inputVariableNames: results[0]?.metadata?.['inputVariableNames'],
          metadata: {
            ...(results[0]?.metadata ?? {}),
            outputTimestamp: Date.now(),
          },
          ...(results.some((r) => typeof r.latency === 'number') ? { latencyColumnName: 'latency' } : {}),
          ...(results.some((r) => typeof r.cost === 'number') ? { costColumnName: 'cost' } : {}),
          ...(results.some((r) => typeof r.tokens === 'number') ? { numOfTokensColumnName: 'tokens' } : {}),
        };

        this.writeOutput(results, outputDir, config);
        console.log('Results processing completed. Check console for output.');
      })
      .catch((err) => {
        console.error(`Error processing dataset: ${err}`);
      });
  }

  private writeOutput(results: Output[], outputDir: string, config?: Config) {
    // Construct an output directory {outputDir}/{datasetName}/
    const outputDirPath = path.resolve(outputDir);
    fs.mkdirSync(outputDirPath, { recursive: true });

    const datasetPath = path.join(outputDirPath, 'dataset.json');
    const configPath = path.join(outputDirPath, 'config.json');

    fs.writeFileSync(datasetPath, JSON.stringify(results, null, 4), 'utf8');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

    console.info(`Output written to ${datasetPath}`);
    console.info(`Config written to ${configPath}`);
  }
}

export default CLIHandler;
