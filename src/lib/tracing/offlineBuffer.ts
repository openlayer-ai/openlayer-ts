// tracing/offlineBuffer.ts
//
// File-backed buffer for trace data that fails to reach Openlayer. Mirrors the
// Python SDK's `OfflineBuffer` (openlayer/lib/tracing/tracer.py). Each failed
// trace is written as its own JSON file so the buffer survives process restarts.
//
// File operations are synchronous on purpose: storing only ever happens inside
// the trace-publish failure path (already off the request hot path). Concurrent
// writers — async tasks in one event loop, worker threads, or separate processes
// sharing the directory — are handled without a lock: each trace gets a unique
// filename (timestamp + pid + UUID), eviction trims the excess as a batch, and
// every scan stats files defensively so one removed mid-scan never aborts it.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

/** A buffered trace payload as persisted to (and read back from) disk. */
export interface BufferedTracePayload {
  traceData: Record<string, any>;
  config: Record<string, any>;
  inferencePipelineId: string;
  timestamp: number;
  metadata: {
    bufferVersion: string;
    createdBy: string;
    processId: number;
  };
  /** Absolute path of the file this payload was read from (set on read only). */
  filePath: string;
}

/** Summary statistics describing the current state of the buffer on disk. */
export interface BufferStatusStats {
  bufferPath: string;
  totalTraces: number;
  maxBufferSize: number;
  totalSizeBytes: number;
  oldestTrace: string | null;
  newestTrace: string | null;
}

const TRACE_FILE_PREFIX = 'trace_';
const TRACE_FILE_SUFFIX = '.json';
const DEFAULT_MAX_BUFFER_SIZE = 1000;

function defaultBufferPath(): string {
  return path.join(os.homedir(), '.openlayer', 'buffer');
}

export class OfflineBuffer {
  readonly bufferPath: string;
  readonly maxBufferSize: number;

  constructor(bufferPath?: string, maxBufferSize?: number) {
    this.bufferPath = bufferPath || defaultBufferPath();
    // Use ?? so an explicit 0 (buffer nothing) is respected rather than
    // falling through to the default.
    this.maxBufferSize = maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;

    fs.mkdirSync(this.bufferPath, { recursive: true });
    console.debug(`Initialized offline buffer at ${this.bufferPath}`);
  }

  /** Absolute paths of all trace files currently in the buffer. */
  private traceFiles(): string[] {
    return fs
      .readdirSync(this.bufferPath)
      .filter((f) => f.startsWith(TRACE_FILE_PREFIX) && f.endsWith(TRACE_FILE_SUFFIX))
      .map((f) => path.join(this.bufferPath, f));
  }

  /**
   * Trace files paired with their stat info, stat'd once each. Files that can't
   * be stat'd (e.g. removed by a concurrent writer between the directory scan
   * and the stat) are skipped rather than throwing, so every caller stays robust
   * under concurrent eviction.
   */
  private statedFiles(): Array<{ path: string; mtimeMs: number; size: number }> {
    const out: Array<{ path: string; mtimeMs: number; size: number }> = [];
    for (const f of this.traceFiles()) {
      try {
        const stat = fs.statSync(f);
        out.push({ path: f, mtimeMs: stat.mtimeMs, size: stat.size });
      } catch {
        // File vanished (a concurrent writer evicted it); skip it.
      }
    }
    return out;
  }

  /**
   * Store a failed trace to the buffer. Returns true on success. When the buffer
   * is at capacity, the oldest files (by mtime) are evicted in a batch so that
   * the buffer stays within maxBufferSize after the new file is added.
   */
  storeTrace(
    traceData: Record<string, any>,
    config: Record<string, any>,
    inferencePipelineId: string,
  ): boolean {
    if (this.maxBufferSize <= 0) {
      console.debug('Offline buffer maxBufferSize <= 0; not storing trace');
      return false;
    }
    try {
      // Trim the buffer down so that, after adding one new file, we stay within
      // maxBufferSize. Removing the full excess in one batch (rather than a
      // single file per store) keeps the buffer bounded even when many writers
      // — concurrent threads or processes sharing the directory — would each
      // otherwise only drop one file and let the buffer grow without bound.
      const existing = this.statedFiles();
      if (existing.length >= this.maxBufferSize) {
        existing.sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first
        const removeCount = existing.length - this.maxBufferSize + 1;
        for (let i = 0; i < removeCount; i++) {
          try {
            fs.rmSync(existing[i]!.path, { force: true });
          } catch {
            // Best effort — another writer may have removed it already.
          }
        }
        console.debug(`Evicted ${removeCount} old buffered trace(s)`);
      }

      const timestamp = Date.now();
      // Full UUID (122 bits of randomness) so filenames stay unique even at high
      // volume within a single process — worker threads share a PID, so a
      // truncated id could collide and silently overwrite a buffered trace.
      const uniqueId = crypto.randomUUID();
      const filename = `${TRACE_FILE_PREFIX}${timestamp}_${process.pid}_${uniqueId}${TRACE_FILE_SUFFIX}`;
      const filePath = path.join(this.bufferPath, filename);

      const payload: Omit<BufferedTracePayload, 'filePath'> = {
        traceData,
        config,
        inferencePipelineId,
        timestamp,
        metadata: {
          bufferVersion: '1.0',
          createdBy: 'openlayer-ts-sdk',
          processId: process.pid,
        },
      };

      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf-8' });
      console.info(`Stored trace to offline buffer: ${filePath}`);
      return true;
    } catch (err) {
      console.error('Failed to store trace to offline buffer:', err);
      return false;
    }
  }

  /** Read all buffered traces from disk, ordered oldest-first (by mtime). */
  getBufferedTraces(): BufferedTracePayload[] {
    const traces: BufferedTracePayload[] = [];
    try {
      // Stat each file once, then sort oldest-first. statedFiles() skips any file
      // a concurrent writer removed mid-scan instead of aborting the whole list.
      const files = this.statedFiles()
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .map((entry) => entry.path);
      for (const filePath of files) {
        try {
          const raw = fs.readFileSync(filePath, { encoding: 'utf-8' });
          const payload = JSON.parse(raw) as BufferedTracePayload;
          payload.filePath = filePath;
          traces.push(payload);
        } catch (err) {
          console.error(`Failed to read buffered trace ${filePath}:`, err);
        }
      }
    } catch (err) {
      console.error('Failed to get buffered traces:', err);
    }
    return traces;
  }

  /** Remove a single buffered trace file (e.g. after a successful replay). */
  removeTrace(filePath: string): boolean {
    try {
      fs.rmSync(filePath, { force: true });
      console.debug(`Removed buffered trace: ${filePath}`);
      return true;
    } catch (err) {
      console.error(`Failed to remove buffered trace ${filePath}:`, err);
      return false;
    }
  }

  /** Current buffer statistics. */
  getBufferStatus(): BufferStatusStats {
    const stats = this.statedFiles().sort((a, b) => a.mtimeMs - b.mtimeMs);
    const totalSizeBytes = stats.reduce((sum, f) => sum + f.size, 0);

    return {
      bufferPath: this.bufferPath,
      totalTraces: stats.length,
      maxBufferSize: this.maxBufferSize,
      totalSizeBytes,
      oldestTrace: stats.length ? path.basename(stats[0]!.path) : null,
      newestTrace: stats.length ? path.basename(stats[stats.length - 1]!.path) : null,
    };
  }

  /** Remove all buffered traces. Returns the number of files actually removed. */
  clearBuffer(): number {
    let files: string[];
    try {
      files = this.traceFiles();
    } catch (err) {
      console.error('Failed to list buffered traces:', err);
      return 0;
    }

    let removed = 0;
    for (const filePath of files) {
      // Isolate each removal so one failure does not abort the rest.
      try {
        fs.rmSync(filePath, { force: true });
        removed++;
      } catch (err) {
        console.error(`Failed to remove buffered trace ${filePath}:`, err);
      }
    }
    console.info(`Cleared ${removed} traces from offline buffer`);
    return removed;
  }
}
