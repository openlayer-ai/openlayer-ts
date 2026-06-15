import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  configure,
  processAndUploadTrace,
  replayBufferedTraces,
  getBufferStatus,
  clearOfflineBuffer,
} from '../src/lib/tracing/tracer';
import { Trace } from '../src/lib/tracing/traces';
import { stepFactory, StepType } from '../src/lib/tracing/steps';
import { OfflineBuffer } from '../src/lib/tracing/offlineBuffer';

// Controllable fake Openlayer client. `mock`-prefixed so jest allows it inside
// the hoisted factory.
const mockState: { lastOptions: any; stream: jest.Mock } = {
  lastOptions: undefined,
  stream: jest.fn(),
};

jest.mock('../src/index', () => ({
  __esModule: true,
  default: class MockOpenlayer {
    inferencePipelines = {
      data: { stream: (...args: any[]) => mockState.stream(...args) },
    };
    constructor(opts?: any) {
      mockState.lastOptions = opts;
    }
  },
}));

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openlayer-tracer-test-'));
}

function buildTrace(inferenceId = 'abc'): Trace {
  const trace = new Trace();
  const step = stepFactory(StepType.USER_CALL, 'root', { question: 'hi' }, 'answer', {});
  // Make the produced traceData deterministic for assertions.
  step.id = inferenceId as any;
  trace.addStep(step);
  return trace;
}

describe('tracer offline buffering', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
    jest.clearAllMocks();
    mockState.lastOptions = undefined;
  });

  afterEach(() => {
    // Disable buffering and clear any leftovers between tests.
    configure({ offlineBufferEnabled: false });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('getBufferStatus', () => {
    it('reports disabled when offline buffering is off', () => {
      configure({ offlineBufferEnabled: false });
      expect(getBufferStatus().enabled).toBe(false);
    });

    it('reports enabled status with the configured path when on', () => {
      configure({ offlineBufferEnabled: true, offlineBufferPath: dir });
      const status = getBufferStatus();
      expect(status.enabled).toBe(true);
      expect(status.bufferPath).toBe(dir);
      expect(status.totalTraces).toBe(0);
    });
  });

  describe('failure handling', () => {
    it('buffers the trace and invokes onFlushFailure when a flush fails', async () => {
      const onFlushFailure = jest.fn();
      mockState.stream.mockRejectedValue(new Error('network down'));
      configure({ offlineBufferEnabled: true, offlineBufferPath: dir, onFlushFailure });

      await processAndUploadTrace(buildTrace('t1'), 'pipe-1');

      expect(onFlushFailure).toHaveBeenCalledTimes(1);
      const [traceData, config, error] = onFlushFailure.mock.calls[0];
      expect(traceData.inferenceId).toBe('t1');
      expect(config.outputColumnName).toBe('output');
      expect(error).toBeInstanceOf(Error);
      expect(getBufferStatus().totalTraces).toBe(1);
    });

    it('invokes onFlushFailure but does not buffer when buffering is disabled', async () => {
      const onFlushFailure = jest.fn();
      mockState.stream.mockRejectedValue(new Error('network down'));
      configure({ offlineBufferEnabled: false, onFlushFailure });

      await processAndUploadTrace(buildTrace('t2'), 'pipe-1');

      expect(onFlushFailure).toHaveBeenCalledTimes(1);
      expect(getBufferStatus().enabled).toBe(false);
    });

    it('does not call the failure handler when the flush succeeds', async () => {
      const onFlushFailure = jest.fn();
      mockState.stream.mockResolvedValue({ success: true });
      configure({ offlineBufferEnabled: true, offlineBufferPath: dir, onFlushFailure });

      await processAndUploadTrace(buildTrace('t3'), 'pipe-1');

      expect(onFlushFailure).not.toHaveBeenCalled();
      expect(getBufferStatus().totalTraces).toBe(0);
    });
  });

  describe('replayBufferedTraces', () => {
    it('replays buffered traces and removes them on success', async () => {
      const seed = new OfflineBuffer(dir);
      seed.storeTrace({ inferenceId: 'r1' }, { outputColumnName: 'output' }, 'pipe-1');
      seed.storeTrace({ inferenceId: 'r2' }, { outputColumnName: 'output' }, 'pipe-1');

      mockState.stream.mockResolvedValue({ ok: true });
      configure({ offlineBufferEnabled: true, offlineBufferPath: dir });

      const result = await replayBufferedTraces();

      expect(result.totalTraces).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(getBufferStatus().totalTraces).toBe(0);
    });

    it('retries up to maxRetries and invokes onReplayFailure, keeping the file', async () => {
      const seed = new OfflineBuffer(dir);
      seed.storeTrace({ inferenceId: 'r3' }, { outputColumnName: 'output' }, 'pipe-1');

      mockState.stream.mockRejectedValue(new Error('still down'));
      const onReplayFailure = jest.fn();
      configure({ offlineBufferEnabled: true, offlineBufferPath: dir });

      const result = await replayBufferedTraces({ maxRetries: 2, onReplayFailure });

      expect(result.totalTraces).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(mockState.stream).toHaveBeenCalledTimes(2);
      expect(onReplayFailure).toHaveBeenCalledTimes(1);
      expect(getBufferStatus().totalTraces).toBe(1);
    });

    it('returns a no-op result when buffering is not enabled', async () => {
      configure({ offlineBufferEnabled: false });
      const result = await replayBufferedTraces();
      expect(result.totalTraces).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('still attempts each trace at least once when maxRetries is 0', async () => {
      const seed = new OfflineBuffer(dir);
      seed.storeTrace({ inferenceId: 'z1' }, { outputColumnName: 'output' }, 'pipe-1');

      mockState.stream.mockRejectedValue(new Error('down'));
      const onReplayFailure = jest.fn();
      configure({ offlineBufferEnabled: true, offlineBufferPath: dir });

      const result = await replayBufferedTraces({ maxRetries: 0, onReplayFailure });

      expect(mockState.stream).toHaveBeenCalledTimes(1);
      expect(result.failureCount).toBe(1);
      expect(onReplayFailure).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearOfflineBuffer', () => {
    it('removes all buffered traces', () => {
      const seed = new OfflineBuffer(dir);
      seed.storeTrace({ inferenceId: 'c1' }, {}, 'pipe-1');
      seed.storeTrace({ inferenceId: 'c2' }, {}, 'pipe-1');
      configure({ offlineBufferEnabled: true, offlineBufferPath: dir });

      expect(clearOfflineBuffer().tracesRemoved).toBe(2);
      expect(getBufferStatus().totalTraces).toBe(0);
    });
  });

  describe('configure', () => {
    it('rebuilds the client with the configured options', async () => {
      mockState.stream.mockResolvedValue({ ok: true });
      configure({ apiKey: 'test-key', baseURL: 'https://example.test/v1', timeout: 1234, maxRetries: 5 });

      await processAndUploadTrace(buildTrace('cfg'), 'pipe-1');

      expect(mockState.lastOptions).toMatchObject({
        apiKey: 'test-key',
        baseURL: 'https://example.test/v1',
        timeout: 1234,
        maxRetries: 5,
      });
    });

    it('merge-updates: a later call keeps a previously set callback and buffer settings', async () => {
      const onFlushFailure = jest.fn();
      mockState.stream.mockRejectedValue(new Error('network down'));
      configure({ offlineBufferEnabled: true, offlineBufferPath: dir, onFlushFailure });

      // A later call that only rotates the API key must not wipe the callback or
      // disable the offline buffer.
      configure({ apiKey: 'rotated-key' });

      await processAndUploadTrace(buildTrace('merge1'), 'pipe-1');

      expect(onFlushFailure).toHaveBeenCalledTimes(1);
      expect(getBufferStatus().enabled).toBe(true);
      expect(getBufferStatus().totalTraces).toBe(1);
    });
  });
});
