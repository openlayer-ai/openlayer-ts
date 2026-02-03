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
  [key: string]: unknown;
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
  numOfTokenColumnName?: string;
}

export type DatasetFormat = 'csv' | 'json';

const DATASET_FILENAMES: Record<DatasetFormat, string> = {
  csv: 'dataset.csv',
  json: 'dataset.json',
};

export function detectDatasetFormat(datasetPath: string): DatasetFormat {
  const ext = path.extname(datasetPath).toLowerCase();
  if (ext === '.csv') {
    return 'csv';
  }
  if (ext === '.json') {
    return 'json';
  }
  throw new Error(`Unsupported dataset format: ${datasetPath}`);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === ',') {
      result.push(current);
      current = '';
    } else if (char === '"') {
      inQuotes = true;
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    return row;
  });
}

function escapeCsvValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value);
  const needsQuotes = /[",\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function collectHeaders(rows: Record<string, unknown>[]): string[] {
  const headers: string[] = [];
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!headers.includes(key)) {
        headers.push(key);
      }
    });
  });
  return headers;
}

export function serializeCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return '';
  }
  const headers = collectHeaders(rows);
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export function loadDataset(datasetPath: string): { data: any[]; format: DatasetFormat } {
  const datasetFullPath = path.resolve(datasetPath);
  const rawData = fs.readFileSync(datasetFullPath, 'utf8');
  const format = detectDatasetFormat(datasetFullPath);

  if (format === 'json') {
    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) {
      throw new Error('Dataset JSON must be an array of records');
    }
    return { data: parsed, format };
  }

  const parsed = parseCsv(rawData);
  return { data: parsed, format };
}

export function writeDataset(
  outputDir: string,
  rows: RunReturn[],
  format: DatasetFormat,
  config: Config,
): void {
  const outputDirPath = path.resolve(outputDir);
  fs.mkdirSync(outputDirPath, { recursive: true });

  const datasetFilename = DATASET_FILENAMES[format];
  const datasetPath = path.join(outputDirPath, datasetFilename);
  const configPath = path.join(outputDirPath, 'config.json');

  if (format === 'json') {
    fs.writeFileSync(datasetPath, JSON.stringify(rows, null, 4), 'utf8');
  } else {
    const csvContent = serializeCsv(rows);
    fs.writeFileSync(datasetPath, csvContent, 'utf8');
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

  console.info(`Output written to ${datasetPath}`);
  console.info(`Config written to ${configPath}`);
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

    const { data: dataset, format } = loadDataset(datasetPath);

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
            outputTimestamp: Date.now(),
          },
          ...(results.some((r) => typeof r.latency === 'number') ? { latencyColumnName: 'latency' } : {}),
          ...(results.some((r) => typeof r.cost === 'number') ? { costColumnName: 'cost' } : {}),
          ...(results.some((r) => typeof r.tokens === 'number') ? { numOfTokenColumnName: 'tokens' } : {}),
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
