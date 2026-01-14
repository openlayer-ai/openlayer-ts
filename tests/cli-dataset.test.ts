import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { loadDataset, parseCsv } from '../src/lib/core/cli';

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

  it('parses CSV with quoted values containing commas', () => {
    const csv = 'prompt,output\nhello,hi\n"quote, comma","ok"\n';
    const parsed = parseCsv(csv);

    expect(parsed).toEqual([
      { prompt: 'hello', output: 'hi' },
      { prompt: 'quote, comma', output: 'ok' },
    ]);
  });

  it('returns empty array for empty CSV content', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('   \n  ')).toEqual([]);
  });
});
