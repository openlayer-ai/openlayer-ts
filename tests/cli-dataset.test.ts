import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  Config,
  loadDataset,
  parseCsv,
  serializeCsv,
  writeDataset,
} from '../src/lib/core/cli';

describe('CLI dataset helpers', () => {
  const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'ol-cli-'));
    
  it('loads JSON datasets', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'dataset.json');
    const payload = [{ a: 1 }, { a: 2 }];
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');

    const { data, format } = loadDataset(filePath);

    expect(format).toBe('json');
    expect(data).toEqual(payload);
  });

  it('loads CSV datasets', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'dataset.csv');
    const payload = 'id,name\n1,Alice\n2,Bob\n';
    fs.writeFileSync(filePath, payload, 'utf8');

    const { data, format } = loadDataset(filePath);

    expect(format).toBe('csv');
    expect(data).toEqual([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);
  });

  it('writes JSON outputs and config', () => {
    const dir = makeTempDir();
    const config: Config = {
      metadata: { outputTimestamp: 123 },
      outputColumnName: 'output',
    };
    const rows = [
      { input: 'a', output: 'x', otherFields: {}, latency: 10 },
      { input: 'b', output: 'y', otherFields: {}, latency: 20 },
    ];

    writeDataset(dir, rows, 'json', config);

    const datasetPath = path.join(dir, 'dataset.json');
    const configPath = path.join(dir, 'config.json');
    expect(fs.existsSync(datasetPath)).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);

    const writtenDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    const writtenConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(writtenDataset).toEqual(rows);
    expect(writtenConfig).toEqual(config);
  });

  it('writes CSV outputs preserving headers and quoting values', () => {
    const dir = makeTempDir();
    const config: Config = {
      metadata: { outputTimestamp: 456 },
      outputColumnName: 'output',
    };
    const rows = [
      { prompt: 'hello', output: 'hi', latency: 1 },
      { prompt: 'quote, "comma"', output: 'ok', latency: 2 },
    ];

    writeDataset(dir, rows, 'csv', config);

    const datasetPath = path.join(dir, 'dataset.csv');
    const configPath = path.join(dir, 'config.json');
    expect(fs.existsSync(datasetPath)).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);

    const csvContent = fs.readFileSync(datasetPath, 'utf8');
    const parsed = parseCsv(csvContent);

    expect(parsed).toEqual([
      { prompt: 'hello', output: 'hi', latency: '1' },
      { prompt: 'quote, "comma"', output: 'ok', latency: '2' },
    ]);
  });

  it('serializes and parses CSV round-trip', () => {
    const rows = [
      { a: '1', b: 'text' },
      { a: '2', b: 'text, with comma' },
    ];
    const serialized = serializeCsv(rows);
    const parsed = parseCsv(serialized);

    expect(parsed).toEqual([
      { a: '1', b: 'text' },
      { a: '2', b: 'text, with comma' },
    ]);
  });
});

