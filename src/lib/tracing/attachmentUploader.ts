/**
 * Attachment upload handling for traces. Port of the Python SDK's
 * ``openlayer.lib.tracing.attachment_uploader``.
 *
 * Flow per attachment: ``POST /storage/presigned-url`` -> upload the bytes to the
 * returned URL -> set ``attachment.storageUri``. Failures are logged and never
 * propagate: an attachment that fails to upload is simply sent without a
 * ``storageUri``.
 */
import { v4 as uuidv4 } from 'uuid';

import type Openlayer from '../../index';
import { Attachment } from './attachments';
import type { Step } from './steps';
import type { Trace } from './traces';

/** Maximum simultaneous uploads for one trace. */
const UPLOAD_CONCURRENCY = 4;
const DEFAULT_UPLOAD_TIMEOUT_MS = 60_000;

/** Media subtype -> file extension overrides (same as Python). */
const EXTENSION_OVERRIDES: Record<string, string> = {
  mpeg: 'mp3',
  jpeg: 'jpg',
  'x-wav': 'wav',
  'x-m4a': 'm4a',
};

export interface AttachmentUploaderOptions {
  /** Also download external-URL attachments and re-upload them to Openlayer storage. */
  urlUploadEnabled?: boolean;
  /** Per-request timeout for the storage upload, in milliseconds. */
  timeoutMs?: number;
  /** ``fetch`` implementation for the storage upload (defaults to the global one). */
  fetch?: typeof fetch;
}

/**
 * Recursively collect the ``Attachment`` objects in a step's inputs/outputs.
 *
 * Descends only into arrays and plain objects, and picks up content items (any
 * object whose ``attachment`` is an ``Attachment``). Class instances are not
 * traversed — ``trace()`` records every function argument as an input, so inputs
 * can hold SDK clients, buffers or large object graphs — and cycles are skipped.
 */
export function findAttachments(data: unknown, seen: WeakSet<object> = new WeakSet()): Attachment[] {
  if (typeof data !== 'object' || data === null) {
    return [];
  }
  if (Attachment.isAttachment(data)) {
    return [data];
  }
  if (seen.has(data)) {
    return [];
  }
  seen.add(data);

  const nested = (data as { attachment?: unknown }).attachment;
  if (Attachment.isAttachment(nested)) {
    return [nested];
  }

  if (Array.isArray(data)) {
    return data.flatMap((item) => findAttachments(item, seen));
  }

  const proto = Object.getPrototypeOf(data);
  if (proto === Object.prototype || proto === null) {
    return Object.values(data).flatMap((value) => findAttachments(value, seen));
  }
  return [];
}

/**
 * Object name for storage: ``attachments/<md5 or uuid>.<ext>``, with the
 * extension taken from the name, else from the media subtype. Same scheme as
 * Python, so identical content maps to the same object.
 */
export function objectNameFor(attachment: Attachment): string {
  const uniqueId = attachment.checksumMd5 || uuidv4();

  let extension = '';
  if (attachment.name.includes('.')) {
    extension = attachment.name.slice(attachment.name.lastIndexOf('.') + 1);
  } else if (attachment.mediaType.includes('/')) {
    const subtype = attachment.mediaType.slice(attachment.mediaType.lastIndexOf('/') + 1);
    extension = EXTENSION_OVERRIDES[subtype] ?? subtype;
  }

  return extension ? `attachments/${uniqueId}.${extension}` : `attachments/${uniqueId}`;
}

type UploadMethod = { method: 'POST' } | { method: 'PUT'; headers: Record<string, string> };

/**
 * How to upload to a presigned URL. The Openlayer API returns, per storage
 * backend (backend ``app/lib/storage.py``):
 *
 * - S3: ``{ url, fields }`` -> multipart POST with the policy fields.
 * - Local (on-prem): ``{ url: <server>/v1/storage?token=... }`` -> multipart POST.
 * - GCS (V4 signed URL), Azure (SAS URL), Oracle (PAR URL): ``{ url }`` -> PUT;
 *   Azure also requires ``x-ms-blob-type: BlockBlob``.
 */
export function resolveUploadMethod(url: string, fields: Record<string, string>): UploadMethod {
  if (Object.keys(fields).length > 0) {
    return { method: 'POST' };
  }

  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    return { method: 'POST' };
  }
  const query = parsed.searchParams;
  const isGcs = query.has('X-Goog-Signature');
  const isAzure = parsed.hostname.endsWith('.blob.core.windows.net') || (query.has('sig') && query.has('sv'));

  if (query.has('token') && !isGcs && !isAzure) {
    return { method: 'POST' };
  }
  return { method: 'PUT', headers: isAzure ? { 'x-ms-blob-type': 'BlockBlob' } : {} };
}

/** Upload bytes to a presigned URL. Throws on network errors and non-2xx responses. */
export async function uploadToPresignedUrl(params: {
  url: string;
  fields?: Record<string, string>;
  data: Uint8Array;
  objectName: string;
  mediaType: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Promise<void> {
  const fields = params.fields ?? {};
  const doFetch = params.fetch ?? fetch;
  const signal = AbortSignal.timeout(params.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS);
  const blob = new Blob([params.data], { type: params.mediaType });
  const upload = resolveUploadMethod(params.url, fields);

  let response: Response;
  if (upload.method === 'POST') {
    // S3 ignores any field after `file`, so the policy fields must come first.
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    form.append('file', blob, params.objectName);
    response = await doFetch(params.url, { method: 'POST', body: form, signal });
  } else {
    response = await doFetch(params.url, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': params.mediaType, ...upload.headers },
      signal,
    });
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      // ignore
    }
    throw new Error(`Storage upload failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
}

function toStringFields(fields: unknown): Record<string, string> {
  if (!fields || typeof fields !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(fields as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
  );
}

/**
 * Uploads attachments to Openlayer storage via presigned URLs, deduplicating
 * identical content (by MD5) across the uploader's lifetime.
 */
export class AttachmentUploader {
  /** checksum -> storageUri (in flight or done; null when that upload failed). */
  private readonly storageUriByChecksum = new Map<string, Promise<string | null>>();

  constructor(
    private readonly client: Openlayer,
    private readonly options: AttachmentUploaderOptions = {},
  ) {}

  /**
   * Upload one attachment if needed and set its ``storageUri``. Never throws;
   * returns the same attachment.
   */
  async uploadAttachment(attachment: Attachment): Promise<Attachment> {
    if (attachment.isUploaded()) {
      return attachment;
    }

    if (attachment.url) {
      if (!this.options.urlUploadEnabled) {
        return attachment;
      }
      if (!(await attachment.downloadUrl())) {
        console.warn(`Failed to download attachment ${attachment.name} from URL, skipping upload`);
        return attachment;
      }
    }

    if (!attachment.hasData()) {
      console.warn(`Attachment ${attachment.name} has no data available for upload`);
      return attachment;
    }

    const checksum = attachment.checksumMd5;
    let pending = checksum ? this.storageUriByChecksum.get(checksum) : undefined;
    if (!pending) {
      pending = this.upload(attachment);
      if (checksum) {
        this.storageUriByChecksum.set(checksum, pending);
        // Let a later trace retry content whose upload failed.
        pending.then((uri) => uri === null && this.storageUriByChecksum.delete(checksum));
      }
    }

    const storageUri = await pending;
    if (storageUri) {
      attachment.storageUri = storageUri;
      attachment.clearData();
    }
    return attachment;
  }

  private async upload(attachment: Attachment): Promise<string | null> {
    try {
      const objectName = objectNameFor(attachment);
      const presigned = await this.client.storage.presignedURL.create({ objectName });
      const data = attachment.getBytes();
      if (!data) {
        throw new Error(`No data available for attachment ${attachment.name}`);
      }
      await uploadToPresignedUrl({
        url: presigned.url,
        fields: toStringFields(presigned.fields),
        data,
        objectName,
        mediaType: attachment.mediaType,
        ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
        ...(this.options.timeoutMs !== undefined ? { timeoutMs: this.options.timeoutMs } : {}),
      });
      console.debug(`Uploaded attachment ${attachment.name} to ${presigned.storageUri}`);
      return presigned.storageUri;
    } catch (error) {
      console.error(`Failed to upload attachment ${attachment.name}:`, error);
      return null;
    }
  }

  /**
   * Upload every attachment in a trace: each step's ``attachments`` plus any
   * embedded in its inputs/output, recursively through nested steps. Never
   * throws.
   *
   * @returns the number of attachments that ended up uploaded by this call.
   */
  async uploadTraceAttachments(trace: Trace): Promise<number> {
    const attachments: Attachment[] = [];
    const seenIds = new Set<string>();
    const visit = (step: Step) => {
      const found = [
        ...(step.attachments ?? []),
        ...findAttachments(step.inputs),
        ...findAttachments(step.output),
      ];
      for (const attachment of found) {
        if (seenIds.has(attachment.id)) continue;
        seenIds.add(attachment.id);
        const needsUpload =
          !attachment.isUploaded() &&
          (attachment.hasData() || (Boolean(this.options.urlUploadEnabled) && Boolean(attachment.url)));
        if (needsUpload) attachments.push(attachment);
      }
      step.steps.forEach(visit);
    };
    trace.steps.forEach(visit);

    let uploaded = 0;
    let next = 0;
    const worker = async () => {
      while (next < attachments.length) {
        const attachment = attachments[next++]!;
        await this.uploadAttachment(attachment);
        if (attachment.isUploaded()) uploaded++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, attachments.length) }, worker));

    if (uploaded > 0) {
      console.debug(`Uploaded ${uploaded} attachment(s) for trace`);
    }
    return uploaded;
  }
}
