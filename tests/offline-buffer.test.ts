import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { OfflineBuffer } from '../src/lib/tracing/offlineBuffer';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openlayer-buffer-test-'));
}

const sampleTrace = (id: string) => ({ inferenceId: id, output: `out-${id}` });
const sampleConfig = { outputColumnName: 'output' };

describe('OfflineBuffer', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates the buffer directory on construction', () => {
    const nested = path.join(dir, 'a', 'b', 'buffer');
    new OfflineBuffer(nested);
    expect(fs.existsSync(nested)).toBe(true);
  });

  it('stores a trace as a JSON file and reads it back with full payload', () => {
    const buffer = new OfflineBuffer(dir);

    const ok = buffer.storeTrace(sampleTrace('1'), sampleConfig, 'pipe-123');
    expect(ok).toBe(true);

    const files = fs.readdirSync(dir).filter((f) => f.startsWith('trace_') && f.endsWith('.json'));
    expect(files).toHaveLength(1);

    const buffered = buffer.getBufferedTraces();
    expect(buffered).toHaveLength(1);
    expect(buffered[0]!.traceData).toEqual(sampleTrace('1'));
    expect(buffered[0]!.config).toEqual(sampleConfig);
    expect(buffered[0]!.inferencePipelineId).toBe('pipe-123');
    expect(buffered[0]!.filePath).toBeDefined();
  });

  it('evicts the oldest trace when maxBufferSize is exceeded', () => {
    const buffer = new OfflineBuffer(dir, 2);

    // Stagger mtimes so "oldest" is deterministic.
    buffer.storeTrace(sampleTrace('old'), sampleConfig, 'p');
    const firstFile = fs.readdirSync(dir)[0]!;
    // Backdate the first file so it is unambiguously the oldest.
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(path.join(dir, firstFile), past, past);

    buffer.storeTrace(sampleTrace('mid'), sampleConfig, 'p');
    buffer.storeTrace(sampleTrace('new'), sampleConfig, 'p'); // triggers eviction

    const ids = buffer.getBufferedTraces().map((t) => t.traceData['inferenceId']);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain('old');
    expect(ids).toEqual(expect.arrayContaining(['mid', 'new']));
  });

  it('returns buffered traces ordered oldest-first', () => {
    const buffer = new OfflineBuffer(dir, 10);
    buffer.storeTrace(sampleTrace('first'), sampleConfig, 'p');
    const firstFile = fs.readdirSync(dir)[0]!;
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(path.join(dir, firstFile), past, past);
    buffer.storeTrace(sampleTrace('second'), sampleConfig, 'p');

    const ids = buffer.getBufferedTraces().map((t) => t.traceData['inferenceId']);
    expect(ids).toEqual(['first', 'second']);
  });

  it('removes a specific trace file', () => {
    const buffer = new OfflineBuffer(dir);
    buffer.storeTrace(sampleTrace('1'), sampleConfig, 'p');
    const [trace] = buffer.getBufferedTraces();

    expect(buffer.removeTrace(trace!.filePath)).toBe(true);
    expect(buffer.getBufferedTraces()).toHaveLength(0);
  });

  it('reports buffer status', () => {
    const buffer = new OfflineBuffer(dir, 50);
    buffer.storeTrace(sampleTrace('1'), sampleConfig, 'p');
    buffer.storeTrace(sampleTrace('2'), sampleConfig, 'p');

    const status = buffer.getBufferStatus();
    expect(status.bufferPath).toBe(dir);
    expect(status.totalTraces).toBe(2);
    expect(status.maxBufferSize).toBe(50);
    expect(status.totalSizeBytes).toBeGreaterThan(0);
    expect(status.oldestTrace).toBeDefined();
    expect(status.newestTrace).toBeDefined();
  });

  it('clears all buffered traces and returns the count removed', () => {
    const buffer = new OfflineBuffer(dir);
    buffer.storeTrace(sampleTrace('1'), sampleConfig, 'p');
    buffer.storeTrace(sampleTrace('2'), sampleConfig, 'p');

    expect(buffer.clearBuffer()).toBe(2);
    expect(buffer.getBufferedTraces()).toHaveLength(0);
  });

  it('defaults maxBufferSize to 1000 when not provided', () => {
    const buffer = new OfflineBuffer(dir);
    expect(buffer.getBufferStatus().maxBufferSize).toBe(1000);
  });

  it('trims an over-capacity backlog down to maxBufferSize on the next store (batch eviction)', () => {
    // Seed 10 files with a large cap so no eviction happens yet.
    const big = new OfflineBuffer(dir, 100);
    for (let i = 0; i < 10; i++) big.storeTrace(sampleTrace(`b${i}`), sampleConfig, 'p');
    expect(fs.readdirSync(dir).filter((f) => f.startsWith('trace_'))).toHaveLength(10);

    // A buffer with a small cap must trim the whole backlog in one store, not
    // just drop a single file (which is what let concurrent writers overflow).
    const small = new OfflineBuffer(dir, 3);
    small.storeTrace(sampleTrace('newest'), sampleConfig, 'p');
    expect(small.getBufferStatus().totalTraces).toBe(3);
  });

  it('skips entries that cannot be stat-ed instead of throwing (concurrency-safe reads)', () => {
    const buffer = new OfflineBuffer(dir, 10);
    buffer.storeTrace(sampleTrace('1'), sampleConfig, 'p');
    // A broken symlink matching the trace glob makes fs.statSync throw ENOENT,
    // simulating a file removed by another writer between readdir and stat.
    fs.symlinkSync(path.join(dir, 'does-not-exist'), path.join(dir, 'trace_broken_0_x.json'));

    // Neither read path should throw; both skip the unreadable entry.
    expect(() => buffer.getBufferStatus()).not.toThrow();
    expect(buffer.getBufferStatus().totalTraces).toBe(1);
    expect(buffer.getBufferedTraces()).toHaveLength(1);
  });

  it('respects an explicit maxBufferSize of 0 by storing nothing', () => {
    const buffer = new OfflineBuffer(dir, 0);
    expect(buffer.getBufferStatus().maxBufferSize).toBe(0);
    expect(buffer.storeTrace(sampleTrace('1'), sampleConfig, 'p')).toBe(false);
    expect(buffer.getBufferedTraces()).toHaveLength(0);
  });

  it('keeps clearing remaining files when one deletion fails and reports the accurate count', () => {
    const buffer = new OfflineBuffer(dir, 10);
    buffer.storeTrace(sampleTrace('1'), sampleConfig, 'p');
    buffer.storeTrace(sampleTrace('2'), sampleConfig, 'p');

    // A directory matching the trace glob makes rmSync(path, { force: true })
    // throw (no `recursive`), simulating one un-deletable entry.
    fs.mkdirSync(path.join(dir, 'trace_999999_0_undeletable.json'));

    const removed = buffer.clearBuffer();

    // The two real trace files are removed; the directory survives and is counted.
    expect(removed).toBe(2);
    expect(fs.readdirSync(dir).filter((f) => f.startsWith('trace_'))).toHaveLength(1);
  });
});
