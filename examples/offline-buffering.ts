// Offline buffering for tracing with Openlayer (TypeScript).
//
// Mirrors the Python notebook examples/tracing/offline_buffering.ipynb. Offline
// buffering automatically saves failed traces to disk during network outages and
// lets you replay them once connectivity is restored — so no trace data is lost.
//
// Run with: npx tsx examples/offline-buffering.ts

import * as tracer from 'openlayer/lib/tracing/tracer';
import trace from 'openlayer/lib/tracing/tracer';

// 1. Configure the tracer with offline buffering enabled.
//    Any field left unset falls back to the corresponding environment variable
//    (OPENLAYER_API_KEY, OPENLAYER_INFERENCE_PIPELINE_ID, ...).
tracer.configure({
  // apiKey: 'YOUR_API_KEY',
  // inferencePipelineId: 'YOUR_PIPELINE_ID',
  maxRetries: 3, // client-level retries are the first line of defense
  offlineBufferEnabled: true,
  offlineBufferPath: './buffer', // defaults to ~/.openlayer/buffer
  maxBufferSize: 100, // keep at most 100 buffered traces (oldest evicted first)
  onFlushFailure: (traceData, _config, error) => {
    // Custom failure handling: alerting, metrics, structured logging, etc.
    console.warn(`Trace ${traceData['inferenceId']} failed to flush:`, error);
  },
});

// 2. Use tracing as normal. If a flush fails, the trace is automatically
//    buffered to disk (and onFlushFailure is invoked).
const tracedMain = trace(async function main(input: string): Promise<string> {
  return `Echo: ${input}`;
});

async function run() {
  await tracedMain('Are you an AI or an actual human?');

  // Give the fire-and-forget publish a moment to complete in this short script.
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 3. Inspect the buffer.
  const status = tracer.getBufferStatus();
  console.log('Buffer status:', status);

  // 4. Replay buffered traces once connectivity is restored. Successfully sent
  //    traces are removed from the buffer.
  const result = await tracer.replayBufferedTraces({
    maxRetries: 3,
    onReplaySuccess: (traceData) => console.log(`Replayed trace: ${traceData['inferenceId']}`),
    onReplayFailure: (traceData, _config, error) =>
      console.warn(`Failed to replay trace ${traceData['inferenceId']}:`, error),
  });
  console.log(`Replayed ${result.successCount}/${result.totalTraces} traces successfully`);

  // 5. (Optional) Clear everything still buffered.
  // const cleared = tracer.clearOfflineBuffer();
  // console.log(`Removed ${cleared.tracesRemoved} buffered traces`);
}

run().catch(console.error);
