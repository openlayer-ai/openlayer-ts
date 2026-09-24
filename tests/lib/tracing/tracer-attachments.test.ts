import { Attachment } from '../../../src/lib/tracing/attachments';
import trace, { configure, logAttachment, processAndUploadTrace } from '../../../src/lib/tracing/tracer';
import { stepFactory, StepType } from '../../../src/lib/tracing/steps';
import { Trace } from '../../../src/lib/tracing/traces';

// Controllable fake Openlayer client (`mock`-prefixed so jest allows it in the hoisted factory).
const mockState: { stream: jest.Mock; presign: jest.Mock; order: string[] } = {
  stream: jest.fn(),
  presign: jest.fn(),
  order: [],
};

jest.mock('../../../src/index', () => ({
  __esModule: true,
  default: class MockOpenlayer {
    inferencePipelines = { data: { stream: (...args: any[]) => mockState.stream(...args) } };
    storage = { presignedURL: { create: (...args: any[]) => mockState.presign(...args) } };
  },
}));

const AUDIO = new Uint8Array([82, 73, 70, 70, 9, 9, 9]);
const PIPELINE = 'pipeline-123';

function traceWithAudio(): { trace: Trace; attachment: Attachment } {
  const attachment = Attachment.fromBytes(AUDIO, { name: 'clip.wav', mediaType: 'audio/wav' });
  const t = new Trace();
  t.addStep(stepFactory(StepType.USER_CALL, 'root', { audio: attachment }, 'answer', {}));
  return { trace: t, attachment };
}

/** The streamed row as it goes over the wire (the HTTP client JSON-encodes it). */
function streamedRow(): any {
  return JSON.parse(JSON.stringify(mockState.stream.mock.calls[0][1].rows[0]));
}

describe('tracer attachment uploads', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let consoleSpies: jest.SpyInstance[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockState.order = [];
    process.env['OPENLAYER_API_KEY'] = 'sk-test';
    delete process.env['OPENLAYER_DISABLE_PUBLISH'];
    mockState.stream.mockImplementation(async () => {
      mockState.order.push('stream');
      return { success: true };
    });
    mockState.presign.mockImplementation(async ({ objectName }: { objectName: string }) => {
      mockState.order.push('presign');
      return {
        url: 'https://bucket.s3.amazonaws.com/',
        fields: { key: objectName },
        storageUri: `s3://bucket/${objectName}`,
      };
    });
    fetchMock = jest.fn(async () => {
      mockState.order.push('upload');
      return new Response(null, { status: 204 });
    });
    global.fetch = fetchMock as any;
    consoleSpies = (['debug', 'error', 'warn', 'info'] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation(() => {}),
    );
  });

  afterEach(() => {
    configure({ attachmentUploadEnabled: false, urlUploadEnabled: false, inferencePipelineId: '' });
    global.fetch = originalFetch;
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  it('is off by default: no presigned calls and the row carries no storageUri', async () => {
    configure({ inferencePipelineId: PIPELINE });
    const { trace: t } = traceWithAudio();

    await processAndUploadTrace(t);

    expect(mockState.presign).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(streamedRow().audio.storageUri).toBeUndefined();
  });

  it('uploads before streaming and the row carries the storageUri', async () => {
    configure({ inferencePipelineId: PIPELINE, attachmentUploadEnabled: true });
    const { trace: t, attachment } = traceWithAudio();

    await processAndUploadTrace(t);

    expect(mockState.order).toEqual(['presign', 'upload', 'stream']);
    const expected = `s3://bucket/attachments/${attachment.checksumMd5}.wav`;
    // Root inputs are surfaced as row columns and inside the step tree.
    expect(streamedRow().audio.storageUri).toBe(expected);
    expect(streamedRow().steps[0].inputs.audio.storageUri).toBe(expected);
    expect(JSON.stringify(streamedRow())).not.toContain('pendingBytes');
  });

  it('a storage failure is logged and the trace still streams', async () => {
    configure({ inferencePipelineId: PIPELINE, attachmentUploadEnabled: true });
    fetchMock.mockImplementation(async () => new Response('denied', { status: 403 }));
    const { trace: t } = traceWithAudio();

    await processAndUploadTrace(t);

    expect(mockState.stream).toHaveBeenCalledTimes(1);
    expect(streamedRow().audio.storageUri).toBeUndefined();
    expect(streamedRow().audio.checksumMd5).toBeDefined();
  });

  it('skips uploads when publishing is disabled', async () => {
    process.env['OPENLAYER_DISABLE_PUBLISH'] = 'true';
    configure({ inferencePipelineId: PIPELINE, attachmentUploadEnabled: true });
    const { trace: t } = traceWithAudio();

    await processAndUploadTrace(t);

    expect(mockState.presign).not.toHaveBeenCalled();
    expect(mockState.stream).not.toHaveBeenCalled();
  });

  it('skips uploads when there is no pipeline to publish to', async () => {
    delete process.env['OPENLAYER_INFERENCE_PIPELINE_ID'];
    configure({ attachmentUploadEnabled: true });
    const { trace: t } = traceWithAudio();

    await processAndUploadTrace(t);

    expect(mockState.presign).not.toHaveBeenCalled();
  });

  it('logAttachment attaches to the active step and the upload lands on the row', async () => {
    configure({ inferencePipelineId: PIPELINE, attachmentUploadEnabled: true });

    let attached: Attachment | null = null;
    const voiceTurn = trace(async function voiceTurn(question: string) {
      attached = logAttachment(AUDIO, {
        name: 'reply.wav',
        mediaType: 'audio/wav',
        metadata: { duration_seconds: 1 },
      });
      return `answer to ${question}`;
    }) as (q: string) => Promise<string>;

    await voiceTurn('hi');
    // Root endStep kicks off processAndUploadTrace without awaiting it.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(attached).not.toBeNull();
    const stepAttachments = streamedRow().steps[0].attachments;
    expect(stepAttachments).toHaveLength(1);
    expect(stepAttachments[0]).toMatchObject({
      name: 'reply.wav',
      mediaType: 'audio/wav',
      storageUri: expect.stringMatching(/^s3:\/\/bucket\/attachments\/[0-9a-f]{32}\.wav$/),
      metadata: { duration_seconds: 1 },
    });
  });

  it('logAttachment outside a traced step warns and returns null', () => {
    expect(logAttachment(AUDIO, { name: 'x.wav', mediaType: 'audio/wav' })).toBeNull();
  });

  it('configure() resets the uploader dedupe cache', async () => {
    configure({ inferencePipelineId: PIPELINE, attachmentUploadEnabled: true });
    await processAndUploadTrace(traceWithAudio().trace);
    await processAndUploadTrace(traceWithAudio().trace);
    expect(mockState.presign).toHaveBeenCalledTimes(1); // same content deduplicated

    configure({ attachmentUploadEnabled: true });
    await processAndUploadTrace(traceWithAudio().trace);
    expect(mockState.presign).toHaveBeenCalledTimes(2);
  });
});
