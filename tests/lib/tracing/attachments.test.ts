import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Attachment, guessMediaType } from '../../../src/lib/tracing/attachments';
import { objectNameFor } from '../../../src/lib/tracing/attachmentUploader';
import { AudioContent, FileContent, ImageContent, TextContent } from '../../../src/lib/tracing/content';
import { UserCallStep } from '../../../src/lib/tracing/steps';

/**
 * Wire-shape parity with the Python SDK. `fixtures/attachment-wire.python.json`
 * is produced by running the REAL Python classes
 * (`fixtures/generate_attachment_wire_fixture.py`); the frontend's
 * `parseMultimodalContent` consumes exactly that shape.
 *
 * Comparisons use JSON strings so key ORDER is checked too.
 */
const python: Record<string, any> = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'attachment-wire.python.json'), 'utf8'),
);

const AUDIO = new Uint8Array(Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt fake-audio', 'latin1'));
const FIXED_ID = '00000000-0000-4000-8000-000000000001';

function pin(attachment: Attachment): Attachment {
  attachment.id = FIXED_ID;
  return attachment;
}

function wire(value: unknown): string {
  return JSON.stringify(value);
}

function uploadedClip(): Attachment {
  const attachment = pin(Attachment.fromBytes(AUDIO, { name: 'clip.wav', mediaType: 'audio/wav' }));
  attachment.storageUri = 's3://bucket/attachments/clip.wav';
  attachment.clearData();
  return attachment;
}

describe('Attachment wire shape matches Python to_dict()', () => {
  it.each([
    ['fromBytes', () => pin(Attachment.fromBytes(AUDIO, { name: 'clip.wav', mediaType: 'audio/wav' }))],
    ['fromBytesUploaded', uploadedClip],
    [
      'fromBytesInline',
      () => pin(Attachment.fromBytes(AUDIO, { name: 'clip.wav', mediaType: 'audio/wav', inline: true })),
    ],
    [
      'fromBytesEmpty',
      () =>
        pin(
          Attachment.fromBytes(new Uint8Array(), {
            name: 'empty.bin',
            mediaType: 'application/octet-stream',
          }),
        ),
    ],
    [
      'fromBase64',
      () => pin(Attachment.fromBase64('aGVsbG8gd29ybGQ=', { name: 'hello.txt', mediaType: 'text/plain' })),
    ],
    ['fromUrl', () => pin(Attachment.fromUrl('https://example.com/assets/photo.png?sig=abc'))],
    ['fromUrlNoPath', () => pin(Attachment.fromUrl('https://example.com'))],
    [
      'fromUrlExplicit',
      () => pin(Attachment.fromUrl('https://example.com/x', { name: 'voice.mp3', mediaType: 'audio/mpeg' })),
    ],
    [
      'withMetadata',
      () => {
        const attachment = pin(Attachment.fromBytes(AUDIO, { name: 'clip.wav', mediaType: 'audio/wav' }));
        attachment.metadata = { duration_seconds: 1.5, channels: 1 };
        return attachment;
      },
    ],
  ])('%s', (caseName, build) => {
    expect(wire(build())).toBe(wire(python[caseName]));
  });

  it('fromFile', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-attach-'));
    const file = path.join(dir, 'report.pdf');
    fs.writeFileSync(file, '%PDF-1.4 fake');
    try {
      const json = pin(Attachment.fromFile(file)).toJSON();
      expect(json.filePath).toBe(path.resolve(file));
      expect(wire({ ...json, filePath: '<FILE_PATH>' })).toBe(wire(python['fromFile']));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ['audioContent', () => new AudioContent(uploadedClip())],
    ['imageContent', () => new ImageContent(uploadedClip())],
    ['fileContent', () => new FileContent(uploadedClip())],
    ['textContent', () => new TextContent('hello')],
  ])('%s', (caseName, build) => {
    expect(wire(build())).toBe(wire(python[caseName]));
  });

  it('step-level attachments serialize only valid ones', () => {
    const step = new UserCallStep('step');
    step.attach(uploadedClip());
    step.attach(new Attachment({ id: '00000000-0000-4000-8000-000000000002', name: 'nothing' }));
    expect(wire(step.toJSON().attachments)).toBe(wire(python['stepAttachments']));
  });

  it('steps without attachments omit the key', () => {
    expect('attachments' in new UserCallStep('step').toJSON()).toBe(false);
  });

  it('object names match the Python uploader', () => {
    for (const [key, expected] of Object.entries(python['objectNames'] as Record<string, string>)) {
      const [name, mediaType] = key.split('|') as [string, string];
      expect(objectNameFor(Attachment.fromBytes(AUDIO, { name, mediaType }))).toBe(expected);
    }
  });

  it('MIME guesses agree with Python wherever Python has a default', () => {
    for (const [ext, expected] of Object.entries(python['mimeDefaults'] as Record<string, string | null>)) {
      if (expected !== null) {
        expect([ext, guessMediaType(`file${ext}`)]).toEqual([ext, expected]);
      } else {
        expect(guessMediaType(`file${ext}`)).not.toBeNull();
      }
    }
  });
});

describe('Attachment behavior', () => {
  it('never serializes pending bytes', () => {
    const attachment = Attachment.fromBytes(AUDIO, { name: 'clip.wav', mediaType: 'audio/wav' });
    expect(JSON.stringify(attachment)).not.toContain('pendingBytes');
    expect(attachment.getBytes()).toEqual(AUDIO);
    expect(attachment.hasData()).toBe(true);
  });

  it('clearData drops pending and inline bytes', () => {
    const attachment = Attachment.fromBytes(AUDIO, { name: 'a', mediaType: 'audio/wav', inline: true });
    attachment.clearData();
    expect(attachment.hasData()).toBe(false);
    expect(attachment.getBytes()).toBeNull();
  });

  it('accepts Buffer, ArrayBuffer and typed-array views', () => {
    const buffer = Buffer.from(AUDIO);
    const fromBuffer = Attachment.fromBytes(buffer, { name: 'a', mediaType: 'audio/wav' });
    const fromArrayBuffer = Attachment.fromBytes(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      {
        name: 'a',
        mediaType: 'audio/wav',
      },
    );
    const fromView = Attachment.fromBytes(new DataView(AUDIO.buffer), { name: 'a', mediaType: 'audio/wav' });
    expect(fromBuffer.checksumMd5).toBe(python['fromBytes'].checksumMd5);
    expect(fromArrayBuffer.checksumMd5).toBe(python['fromBytes'].checksumMd5);
    expect(fromView.checksumMd5).toBe(python['fromBytes'].checksumMd5);
  });

  it('a missing file is kept by reference but is not valid', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const attachment = Attachment.fromFile('/definitely/not/here.wav');
    warn.mockRestore();
    expect(attachment.sizeBytes).toBeNull();
    expect(attachment.isValid()).toBe(false);
  });

  it('isAttachment recognizes the brand, not the class identity', () => {
    const attachment = Attachment.fromUrl('https://example.com/a.png');
    expect(Attachment.isAttachment(attachment)).toBe(true);
    // A structurally identical object from another copy of the class (CJS vs ESM) carries the same brand.
    const foreign = Object.assign(Object.create(null), { [Symbol.for('openlayer.attachment')]: true });
    expect(Attachment.isAttachment(foreign)).toBe(true);
    expect(Attachment.isAttachment({ ...attachment.toJSON() })).toBe(false);
  });

  it('round-trips through fromJSON', () => {
    const json = uploadedClip().toJSON();
    expect(Attachment.fromJSON(json).toJSON()).toEqual(json);
  });

  it('downloadUrl fills bytes, size and checksum', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response(AUDIO, { status: 200 })) as any;
    try {
      const attachment = Attachment.fromUrl('https://example.com/clip.wav');
      await expect(attachment.downloadUrl()).resolves.toBe(true);
      expect(attachment.sizeBytes).toBe(AUDIO.byteLength);
      expect(attachment.checksumMd5).toBe(python['fromBytes'].checksumMd5);
      expect(attachment.hasData()).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('downloadUrl returns false on HTTP errors', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response('nope', { status: 404 })) as any;
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(Attachment.fromUrl('https://example.com/x.wav').downloadUrl()).resolves.toBe(false);
    } finally {
      global.fetch = originalFetch;
      error.mockRestore();
    }
  });
});
