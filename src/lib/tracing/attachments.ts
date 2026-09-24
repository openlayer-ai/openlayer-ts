/**
 * Attachment abstraction for unstructured data in traces.
 *
 * An ``Attachment`` represents binary/media content (audio, images, PDFs, ...)
 * associated with a trace step but stored separately from the structured trace
 * data. Port of the Python SDK's ``openlayer.lib.tracing.attachments``; the
 * serialized shape (``toJSON``) is byte-compatible with Python's
 * ``Attachment.to_dict()``, which the Openlayer UI renders as audio players,
 * images and documents.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Brand used instead of ``instanceof``: the package ships CJS and ESM builds, so
 * two copies of this class can coexist in one process. ``Symbol.for`` is shared
 * across both.
 */
const ATTACHMENT_BRAND = Symbol.for('openlayer.attachment');

/** Wire shape of an attachment (matches Python's ``Attachment.to_dict()``). */
export interface AttachmentData {
  id: string;
  name: string;
  mediaType: string;
  storageUri?: string;
  url?: string;
  filePath?: string;
  dataBase64?: string;
  sizeBytes?: number;
  checksumMd5?: string;
  metadata?: Record<string, any>;
}

export interface AttachmentInit {
  id?: string;
  name?: string;
  mediaType?: string;
  storageUri?: string | null;
  url?: string | null;
  filePath?: string | null;
  dataBase64?: string | null;
  sizeBytes?: number | null;
  checksumMd5?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Extension -> MIME type table. Matches Python's built-in ``mimetypes`` defaults
 * wherever Python has an entry; fills common audio gaps Python leaves unmapped
 * (``.m4a``, ``.ogg``, ``.flac``, ...).
 */
const MIME_TYPES: Record<string, string> = {
  '.wav': 'audio/x-wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.weba': 'audio/webm',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.ico': 'image/vnd.microsoft.icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.html': 'text/html',
  '.md': 'text/markdown',
  '.xml': 'text/xml',
  '.zip': 'application/zip',
};

const DEFAULT_MEDIA_TYPE = 'application/octet-stream';

/** Guess a MIME type from a file name or URL path, like Python's ``mimetypes.guess_type``. */
export function guessMediaType(nameOrPath: string): string | null {
  const ext = path.extname(nameOrPath.split(/[?#]/)[0] ?? '').toLowerCase();
  return MIME_TYPES[ext] ?? null;
}

function md5(data: Uint8Array): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

function toUint8Array(data: Uint8Array | ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

/**
 * Unstructured data attached to a trace step.
 *
 * Holds references to where the data lives (``storageUri`` > ``url`` >
 * ``filePath``), plus optional inline base64 for small payloads. Bytes created
 * with ``fromBytes`` are kept in memory until the attachment uploader sends them
 * to Openlayer storage, and are never serialized.
 */
export class Attachment {
  readonly [ATTACHMENT_BRAND] = true;

  id: string;
  name: string;
  mediaType: string;

  /** Openlayer managed storage reference (set after upload). */
  storageUri: string | null;
  /** External URL reference. */
  url: string | null;
  /** Local file path (for development/debugging). */
  filePath: string | null;
  /** Inline base64 data (for small attachments). */
  dataBase64: string | null;

  sizeBytes: number | null;
  checksumMd5: string | null;
  /** Extensible metadata (duration, dimensions, page count, ...). */
  metadata: Record<string, any>;

  /** Pending bytes awaiting upload. Never serialized. */
  private pendingBytes: Uint8Array | null = null;

  constructor(init: AttachmentInit = {}) {
    this.id = init.id ?? uuidv4();
    this.name = init.name ?? '';
    this.mediaType = init.mediaType ?? DEFAULT_MEDIA_TYPE;
    this.storageUri = init.storageUri ?? null;
    this.url = init.url ?? null;
    this.filePath = init.filePath ?? null;
    this.dataBase64 = init.dataBase64 ?? null;
    this.sizeBytes = init.sizeBytes ?? null;
    this.checksumMd5 = init.checksumMd5 ?? null;
    this.metadata = init.metadata ?? {};
  }

  /** True when ``value`` is an ``Attachment`` from either the CJS or ESM build. */
  static isAttachment(value: unknown): value is Attachment {
    return typeof value === 'object' && value !== null && (value as any)[ATTACHMENT_BRAND] === true;
  }

  /**
   * Serialize for JSON transport. Same keys, order and inclusion rules as
   * Python's ``Attachment.to_dict()``: references and ``checksumMd5`` only when
   * truthy, ``sizeBytes`` whenever set (including ``0``), ``metadata`` only when
   * non-empty.
   */
  toJSON(): AttachmentData {
    const result: AttachmentData = { id: this.id, name: this.name, mediaType: this.mediaType };
    if (this.storageUri) result.storageUri = this.storageUri;
    if (this.url) result.url = this.url;
    if (this.filePath) result.filePath = this.filePath;
    if (this.dataBase64) result.dataBase64 = this.dataBase64;
    if (this.sizeBytes !== null && this.sizeBytes !== undefined) result.sizeBytes = this.sizeBytes;
    if (this.checksumMd5) result.checksumMd5 = this.checksumMd5;
    if (this.metadata && Object.keys(this.metadata).length > 0) result.metadata = this.metadata;
    return result;
  }

  /** Deserialize from the wire shape. */
  static fromJSON(data: AttachmentData): Attachment {
    return new Attachment({
      id: data.id,
      name: data.name,
      mediaType: data.mediaType,
      storageUri: data.storageUri ?? null,
      url: data.url ?? null,
      filePath: data.filePath ?? null,
      dataBase64: data.dataBase64 ?? null,
      sizeBytes: data.sizeBytes ?? null,
      checksumMd5: data.checksumMd5 ?? null,
      metadata: data.metadata ?? {},
    });
  }

  /** True once the attachment has been uploaded to Openlayer storage. */
  isUploaded(): boolean {
    return this.storageUri !== null && this.storageUri !== '';
  }

  /** True when bytes are available for upload (pending, inline or on disk). */
  hasData(): boolean {
    if (this.pendingBytes !== null) return true;
    if (this.dataBase64 !== null) return true;
    if (this.filePath) return fs.existsSync(this.filePath);
    return false;
  }

  /** True when the attachment should be serialized (uploaded, has a URL, or has data). */
  isValid(): boolean {
    return this.isUploaded() || this.url !== null || this.hasData();
  }

  /** The most reliable reference to this attachment's data. */
  getReference(): string | null {
    return this.storageUri || this.url || this.filePath || null;
  }

  /** The attachment's bytes, or null if none are available locally. */
  getBytes(): Uint8Array | null {
    if (this.pendingBytes !== null) return this.pendingBytes;
    if (this.dataBase64) {
      try {
        return new Uint8Array(Buffer.from(this.dataBase64, 'base64'));
      } catch (error) {
        console.error('Failed to decode base64 attachment data', error);
        return null;
      }
    }
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        return new Uint8Array(fs.readFileSync(this.filePath));
      } catch (error) {
        console.error(`Failed to read attachment file ${this.filePath}`, error);
        return null;
      }
    }
    return null;
  }

  /** Drop in-memory data once it lives in storage, so it isn't duplicated in the trace. */
  clearData(): void {
    this.pendingBytes = null;
    this.dataBase64 = null;
  }

  /**
   * Download ``this.url`` into memory (populating size and checksum) so the
   * uploader can re-upload it to Openlayer storage.
   *
   * @returns true if the download succeeded.
   */
  async downloadUrl(options: { timeoutMs?: number } = {}): Promise<boolean> {
    if (!this.url) return false;
    try {
      const response = await fetch(this.url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = new Uint8Array(await response.arrayBuffer());
      this.pendingBytes = data;
      this.sizeBytes = data.byteLength;
      this.checksumMd5 = md5(data);
      return true;
    } catch (error) {
      console.error(`Failed to download attachment from URL ${this.url}`, error);
      return false;
    }
  }

  // ----------------------------- Factories ----------------------------- //

  /**
   * Create an attachment from a local file. The file is referenced by path and
   * read at upload time; size and checksum are computed now.
   */
  static fromFile(filePath: string, options: { name?: string; mediaType?: string } = {}): Attachment {
    const resolved = path.resolve(filePath.replace(/^~(?=$|\/|\\)/, process.env['HOME'] ?? '~'));
    const exists = fs.existsSync(resolved);
    if (!exists) {
      console.warn(`Attachment file does not exist: ${resolved}. The attachment will be ignored.`);
    }

    const attachment = new Attachment({
      name: options.name ?? path.basename(resolved),
      mediaType: options.mediaType ?? guessMediaType(resolved) ?? DEFAULT_MEDIA_TYPE,
      filePath: resolved,
    });

    if (exists) {
      attachment.sizeBytes = fs.statSync(resolved).size;
      try {
        attachment.checksumMd5 = md5(fs.readFileSync(resolved));
      } catch (error) {
        console.debug(`Could not compute checksum for ${resolved}`, error);
      }
    }
    return attachment;
  }

  /** Create an attachment that references an external URL. */
  static fromUrl(url: string, options: { name?: string; mediaType?: string } = {}): Attachment {
    let name = options.name;
    if (name === undefined) {
      let pathname = '';
      try {
        pathname = new URL(url).pathname;
      } catch {
        pathname = url;
      }
      name = path.posix.basename(pathname) || 'attachment';
    }
    return new Attachment({
      name,
      mediaType: options.mediaType ?? guessMediaType(url) ?? DEFAULT_MEDIA_TYPE,
      url,
    });
  }

  /**
   * Create an attachment from raw bytes. The bytes are copied, so the caller may
   * reuse its buffer. By default they are held for upload and never
   * serialized; ``inline: true`` stores them as base64 in the trace instead
   * (only for small payloads).
   */
  static fromBytes(
    data: Uint8Array | ArrayBuffer | ArrayBufferView,
    options: { name: string; mediaType: string; inline?: boolean },
  ): Attachment {
    // Own a copy: the bytes are read at upload time (asynchronously), and the
    // checksum computed here is the dedup key, so a caller reusing or mutating
    // its buffer must not change what gets uploaded under that checksum.
    const bytes = new Uint8Array(toUint8Array(data));
    const attachment = new Attachment({
      name: options.name,
      mediaType: options.mediaType,
      sizeBytes: bytes.byteLength,
      checksumMd5: md5(bytes),
    });
    if (options.inline) {
      attachment.dataBase64 = Buffer.from(bytes).toString('base64');
    } else {
      attachment.pendingBytes = bytes;
    }
    return attachment;
  }

  /** Create an attachment from base64-encoded data (kept inline). */
  static fromBase64(dataBase64: string, options: { name: string; mediaType: string }): Attachment {
    let sizeBytes: number | null = null;
    let checksumMd5: string | null = null;
    try {
      const decoded = new Uint8Array(Buffer.from(dataBase64, 'base64'));
      sizeBytes = decoded.byteLength;
      checksumMd5 = md5(decoded);
    } catch {
      // Keep the data; size/checksum stay unknown.
    }
    return new Attachment({
      name: options.name,
      mediaType: options.mediaType,
      dataBase64,
      sizeBytes,
      checksumMd5,
    });
  }
}
