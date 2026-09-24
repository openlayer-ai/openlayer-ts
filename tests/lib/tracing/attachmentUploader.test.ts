import { Attachment } from '../../../src/lib/tracing/attachments';
import {
  AttachmentUploader,
  findAttachments,
  resolveUploadMethod,
  uploadToPresignedUrl,
} from '../../../src/lib/tracing/attachmentUploader';
import { AudioContent } from '../../../src/lib/tracing/content';
import { UserCallStep } from '../../../src/lib/tracing/steps';
import { Trace } from '../../../src/lib/tracing/traces';

const AUDIO = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);

function audio(name = 'clip.wav', bytes: Uint8Array = AUDIO): Attachment {
  return Attachment.fromBytes(bytes, { name, mediaType: 'audio/wav' });
}

/** A fake Openlayer client whose presigned-URL call returns S3-style POST targets. */
function fakeClient(response: (objectName: string) => any = s3Response) {
  const create = jest.fn(async ({ objectName }: { objectName: string }) => response(objectName));
  return { client: { storage: { presignedURL: { create } } } as any, create };
}

function s3Response(objectName: string) {
  return {
    url: 'https://bucket.s3.amazonaws.com/',
    fields: { key: objectName, policy: 'p0l1cy', 'x-amz-signature': 's1g' },
    storageUri: `s3://bucket/${objectName}`,
  };
}

type Recorded = { url: string; init: RequestInit };

function fakeFetch(status = 204) {
  const calls: Recorded[] = [];
  const fn = jest.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return new Response(status === 204 ? null : 'err', { status });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

describe('findAttachments', () => {
  it('finds attachments in nested plain objects, arrays and content items', () => {
    const a = audio('a.wav');
    const b = audio('b.wav');
    const c = audio('c.wav');
    const found = findAttachments({ x: a, list: [1, { deep: b }], item: new AudioContent(c), s: 'text' });
    expect(found).toEqual([a, b, c]);
  });

  it('does not traverse class instances (SDK clients, buffers, ...)', () => {
    class SdkClient {
      hidden = audio('hidden.wav');
    }
    expect(findAttachments({ client: new SdkClient(), buf: Buffer.from('x'), date: new Date() })).toEqual([]);
  });

  it('survives cycles', () => {
    const a = audio();
    const node: any = { a };
    node.self = node;
    node.list = [node];
    expect(findAttachments(node)).toEqual([a]);
  });

  it('handles primitives and null', () => {
    expect(findAttachments(null)).toEqual([]);
    expect(findAttachments('x')).toEqual([]);
    expect(findAttachments(42)).toEqual([]);
  });
});

describe('resolveUploadMethod', () => {
  it('POSTs when the API returns policy fields (S3)', () => {
    expect(resolveUploadMethod('https://bucket.s3.amazonaws.com/', { key: 'k' })).toEqual({ method: 'POST' });
  });

  it('POSTs to Openlayer local storage', () => {
    expect(resolveUploadMethod('https://openlayer.internal/v1/storage?token=abc.def', {})).toEqual({
      method: 'POST',
    });
  });

  it('PUTs to GCS V4 signed URLs', () => {
    const url =
      'https://storage.googleapis.com/bucket/attachments/x.wav?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=abc';
    expect(resolveUploadMethod(url, {})).toEqual({ method: 'PUT', headers: {} });
  });

  it('PUTs to Azure SAS URLs with the block-blob header', () => {
    const url =
      'https://acct.blob.core.windows.net/container/attachments/x.wav?sv=2023-01-03&sig=abc&token=nope';
    expect(resolveUploadMethod(url, {})).toEqual({
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob' },
    });
  });

  it('PUTs to Oracle pre-authenticated request URLs', () => {
    const url =
      'https://objectstorage.us-ashburn-1.oraclecloud.com/p/Tok3n/n/ns/b/bucket/o/attachments/x.wav';
    expect(resolveUploadMethod(url, {})).toEqual({ method: 'PUT', headers: {} });
  });
});

describe('uploadToPresignedUrl', () => {
  it('multipart POST puts policy fields before the file part', async () => {
    const { fetch, calls } = fakeFetch();
    await uploadToPresignedUrl({
      url: 'https://bucket.s3.amazonaws.com/',
      fields: { key: 'attachments/x.wav', policy: 'p', 'x-amz-signature': 's' },
      data: AUDIO,
      objectName: 'attachments/x.wav',
      mediaType: 'audio/wav',
      fetch,
    });

    const { init } = calls[0]!;
    expect(init.method).toBe('POST');
    const form = init.body as FormData;
    expect([...form.keys()]).toEqual(['key', 'policy', 'x-amz-signature', 'file']);
    const file = form.get('file') as File;
    expect(file.type).toBe('audio/wav');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(AUDIO);
    // Let fetch set the multipart boundary.
    expect(init.headers).toBeUndefined();
  });

  it('PUT sends the raw bytes with the content type', async () => {
    const { fetch, calls } = fakeFetch();
    await uploadToPresignedUrl({
      url: 'https://acct.blob.core.windows.net/c/x.wav?sv=1&sig=2',
      data: AUDIO,
      objectName: 'attachments/x.wav',
      mediaType: 'audio/wav',
      fetch,
    });
    const { init } = calls[0]!;
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'audio/wav', 'x-ms-blob-type': 'BlockBlob' });
    expect(new Uint8Array(await (init.body as Blob).arrayBuffer())).toEqual(AUDIO);
  });

  it('throws on non-2xx responses', async () => {
    const { fetch } = fakeFetch(403);
    await expect(
      uploadToPresignedUrl({
        url: 'https://bucket.s3.amazonaws.com/',
        fields: { key: 'k' },
        data: AUDIO,
        objectName: 'k',
        mediaType: 'audio/wav',
        fetch,
      }),
    ).rejects.toThrow('HTTP 403');
  });
});

describe('AttachmentUploader', () => {
  let consoleError: jest.SpyInstance;
  let consoleDebug: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebug = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleDebug.mockRestore();
  });

  it('uploads, sets storageUri and clears the bytes', async () => {
    const { client, create } = fakeClient();
    const { fetch } = fakeFetch();
    const attachment = audio();

    await new AttachmentUploader(client, { fetch }).uploadAttachment(attachment);

    expect(create).toHaveBeenCalledWith({ objectName: `attachments/${attachment.checksumMd5}.wav` });
    expect(attachment.storageUri).toBe(`s3://bucket/attachments/${attachment.checksumMd5}.wav`);
    expect(attachment.hasData()).toBe(false);
    expect(attachment.toJSON().storageUri).toBeDefined();
  });

  it('deduplicates identical content, including concurrent uploads', async () => {
    const { client, create } = fakeClient();
    const { fetch, calls } = fakeFetch();
    const uploader = new AttachmentUploader(client, { fetch });
    const first = audio('one.wav');
    const second = audio('two.wav');

    await Promise.all([uploader.uploadAttachment(first), uploader.uploadAttachment(second)]);
    const third = audio('three.wav');
    await uploader.uploadAttachment(third);

    expect(create).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(second.storageUri).toBe(first.storageUri);
    expect(third.storageUri).toBe(first.storageUri);
  });

  it('a failed upload is logged, leaves no storageUri, and is retried later', async () => {
    const { client, create } = fakeClient();
    const failing = fakeFetch(500);
    const attachment = audio();

    await new AttachmentUploader(client, { fetch: failing.fetch }).uploadAttachment(attachment);
    expect(attachment.storageUri).toBeNull();
    expect(attachment.hasData()).toBe(true);
    expect(consoleError).toHaveBeenCalled();

    const uploader = new AttachmentUploader(client, { fetch: failing.fetch });
    await uploader.uploadAttachment(audio());
    const ok = fakeFetch();
    (uploader as any).options.fetch = ok.fetch;
    const retried = audio();
    await uploader.uploadAttachment(retried);
    expect(retried.storageUri).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('a presigned-URL API error never throws', async () => {
    const create = jest.fn(async () => {
      throw new Error('401 Unauthorized');
    });
    const client = { storage: { presignedURL: { create } } } as any;
    const attachment = audio();
    await expect(new AttachmentUploader(client).uploadAttachment(attachment)).resolves.toBe(attachment);
    expect(attachment.storageUri).toBeNull();
  });

  it('skips URL attachments unless urlUploadEnabled', async () => {
    const { client, create } = fakeClient();
    const attachment = Attachment.fromUrl('https://example.com/clip.wav');
    await new AttachmentUploader(client).uploadAttachment(attachment);
    expect(create).not.toHaveBeenCalled();
    expect(attachment.toJSON().url).toBe('https://example.com/clip.wav');
  });

  it('re-uploads URL attachments when urlUploadEnabled', async () => {
    const { client } = fakeClient();
    const { fetch, calls } = fakeFetch();
    const attachment = Attachment.fromUrl('https://example.com/clip.wav');
    jest.spyOn(attachment, 'downloadUrl').mockImplementation(async function (this: Attachment) {
      (this as any).pendingBytes = AUDIO;
      this.checksumMd5 = 'abc';
      this.sizeBytes = AUDIO.byteLength;
      return true;
    });

    await new AttachmentUploader(client, { fetch, urlUploadEnabled: true }).uploadAttachment(attachment);

    expect(calls).toHaveLength(1);
    expect(attachment.storageUri).toBe('s3://bucket/attachments/abc.wav');
  });

  it('uploadTraceAttachments walks step attachments, inputs, outputs and nested steps once each', async () => {
    const { client } = fakeClient();
    const { fetch } = fakeFetch();
    const root = new UserCallStep('root', { audio: audio('in.wav', new Uint8Array([1])) });
    const child = new UserCallStep('child', null, { audio: audio('out.wav', new Uint8Array([2])) });
    const shared = audio('shared.wav', new Uint8Array([3]));
    child.attach(shared);
    child.inputs = { again: shared }; // same object reachable twice
    root.addNestedStep(child);
    const trace = new Trace();
    trace.addStep(root);

    const count = await new AttachmentUploader(client, { fetch }).uploadTraceAttachments(trace);

    expect(count).toBe(3);
    const json = JSON.stringify(trace.toJSON());
    expect((json.match(/s3:\/\/bucket\/attachments\//g) ?? []).length).toBe(4); // shared appears twice
  });
});
