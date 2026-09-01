import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * These tests exercise the development-mode runner (`CLIHandler`) over a
 * multi-row dataset. Regression coverage for OPEN-12420.
 */

const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'ol-cli-conc-'));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `commander`'s `program` is a module singleton, so each run needs a fresh
 * module graph. cli.ts and tracer.ts must be imported after the same reset so
 * they share one tracer instance.
 */
const freshModules = async () => {
  jest.resetModules();
  const cli = await import('../src/lib/core/cli');
  const tracer = await import('../src/lib/tracing/tracer');
  return { CLIHandler: cli.default, tracer };
};

const writeDataset = (dir: string, rows: unknown[]): string => {
  const datasetPath = path.join(dir, 'dataset.json');
  fs.writeFileSync(datasetPath, JSON.stringify(rows), 'utf8');
  return datasetPath;
};

describe('CLIHandler dataset run', () => {
  const originalArgv = process.argv;
  const originalDisablePublish = process.env['OPENLAYER_DISABLE_PUBLISH'];

  beforeEach(() => {
    process.env['OPENLAYER_DISABLE_PUBLISH'] = 'true';
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalDisablePublish === undefined) {
      delete process.env['OPENLAYER_DISABLE_PUBLISH'];
    } else {
      process.env['OPENLAYER_DISABLE_PUBLISH'] = originalDisablePublish;
    }
  });

  it('resolves only after the output files are written', async () => {
    const dir = makeTempDir();
    const datasetPath = writeDataset(dir, [{ userQuery: 'row-A' }]);
    const outputDir = path.join(dir, 'out');

    const { CLIHandler } = await freshModules();
    const handler = new CLIHandler(async ({ userQuery }: { userQuery: string }) => {
      await sleep(10);
      return { output: `out-${userQuery}`, otherFields: {} };
    });

    process.argv = ['node', 'probe', '--dataset-path', datasetPath, '--output-dir', outputDir];

    await handler.runFromCLI();

    expect(fs.existsSync(path.join(outputDir, 'dataset.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'config.json'))).toBe(true);
  });

  it('gives each row its own root trace instead of nesting rows into each other', async () => {
    const dir = makeTempDir();
    const datasetPath = writeDataset(dir, [
      { userQuery: 'row-A' },
      { userQuery: 'row-B' },
      { userQuery: 'row-C' },
    ]);
    const outputDir = path.join(dir, 'out');

    const { CLIHandler, tracer } = await freshModules();

    // Staggered delays make the rows genuinely interleave: row-A is still
    // in-flight when row-B and row-C start their steps.
    const delays: Record<string, number> = { 'row-A': 60, 'row-B': 30, 'row-C': 10 };

    const handler = new CLIHandler(async ({ userQuery }: { userQuery: string }) => {
      const { endStep } = tracer.addChainStepToTrace({
        name: `step-for-${userQuery}`,
        inputs: { userQuery },
      });
      await sleep(delays[userQuery]!);
      endStep();
      return { output: `out-${userQuery}`, otherFields: {} };
    });

    process.argv = ['node', 'probe', '--dataset-path', datasetPath, '--output-dir', outputDir];

    await handler.runFromCLI();

    const rows = JSON.parse(fs.readFileSync(path.join(outputDir, 'dataset.json'), 'utf8'));
    expect(rows).toHaveLength(3);

    for (const row of rows) {
      // Each row owns exactly one root step, and that step is its own.
      expect(row.steps).toHaveLength(1);
      expect(row.steps[0].name).toBe(`Handoffs: step-for-${row.userQuery}`);
      // No other row leaked in as a nested step.
      expect(row.steps[0].steps ?? []).toHaveLength(0);
      // Per-row latency is recorded for every row, not just the first.
      expect(typeof row.latency).toBe('number');
    }
  });

  it('writes inputVariableNames into the generated config', async () => {
    const dir = makeTempDir();
    const datasetPath = writeDataset(dir, [{ userQuery: 'row-A' }]);
    const outputDir = path.join(dir, 'out');

    const { CLIHandler, tracer } = await freshModules();
    const handler = new CLIHandler(async ({ userQuery }: { userQuery: string }) => {
      const { endStep } = tracer.addChainStepToTrace({ name: 'step', inputs: { userQuery } });
      endStep();
      return { output: `out-${userQuery}`, otherFields: {} };
    });

    process.argv = ['node', 'probe', '--dataset-path', datasetPath, '--output-dir', outputDir];

    await handler.runFromCLI();

    const config = JSON.parse(fs.readFileSync(path.join(outputDir, 'config.json'), 'utf8'));
    expect(config.inputVariableNames).toEqual(['userQuery']);
  });
});
