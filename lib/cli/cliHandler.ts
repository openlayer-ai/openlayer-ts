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
import { Config, RunReturn } from '../utils/run';

export class CLIHandler {
  private run: (...args: any[]) => Promise<any>;

  constructor(runFunction: (...args: any[]) => Promise<any>) {
    this.run = runFunction;
  }

  public runFromCLI() {
    program
      .requiredOption('--dataset-path <path>', 'Path to the dataset')
      .requiredOption('--dataset-name <name>', 'Name of the dataset')
      .option('--output-path <path>', 'Path to dump the results', 'output');

    program.parse(process.argv);

    const options = program.opts();
    const { datasetPath, datasetName, outputPath } = options;

    // Load dataset
    const datasetFullPath = path.resolve(datasetPath);
    const rawData = fs.readFileSync(datasetFullPath, 'utf8');
    const dataset = JSON.parse(rawData);

    // Process each item in the dataset dynamically
    Promise.all(
      dataset.map(async (item: any) => {
        const result = await this.run(item);
        // Merge the original item fields with the result
        return { ...item, ...result.otherFields, output: result.output };
      })
    )
      .then((results) => {
        /*
         * Wait for all rows to be run
         * Write resultsnow  to output path slash dataset name or log to console
         */
        this.writeOutput(results, outputPath, datasetName);
        console.log('Results processing completed. Check console for output.');
      })
      .catch((err) => {
        console.error(`Error processing dataset: ${err}`);
      });
  }

  private writeOutput(
    results: RunReturn[],
    outputDir: string,
    datasetName: string
  ) {
    const config: Config = {
      metadata: { outputTimestamp: Date.now() },
      outputColumnName: 'output',
    };

    // Construct an output directory {outputDir}/{datasetName}/
    const outputDirPath = path.join(path.resolve(outputDir), datasetName);
    fs.mkdirSync(outputDirPath, { recursive: true });

    const datasetPath = path.join(outputDirPath, 'dataset.json');
    const configPath = path.join(outputDirPath, 'config.json');

    fs.writeFileSync(datasetPath, JSON.stringify(results, null, 4), 'utf8');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

    console.log(`Output written to ${datasetPath}`);
    console.log(`Config written to ${configPath}`);
  }
}
