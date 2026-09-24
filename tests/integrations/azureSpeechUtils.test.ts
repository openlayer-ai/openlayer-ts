import {
  collectSecrets,
  describeSynthesisAudio,
  redactSecrets,
  wrapInWav,
} from '../../src/lib/integrations/azureSpeechUtils';

function props(values: Record<string, string>) {
  return { getProperty: (key: string, def = '') => values[key] ?? def };
}

describe('redactSecrets', () => {
  it('keeps URL structure but redacts every query value and userinfo', () => {
    const text =
      'StatusCode: 1006, wss://user:pa55word@host.example.com/v1/ws?token=abc123&language=en-US Reason: x';
    expect(redactSecrets(text)).toBe(
      'StatusCode: 1006, wss://%5BREDACTED%5D:%5BREDACTED%5D@host.example.com/v1/ws?token=[REDACTED]&language=[REDACTED] Reason: x',
    );
  });

  it('redacts bearer tokens and sensitive key=value pairs outside URLs', () => {
    expect(redactSecrets('Authorization: Bearer eyJhbGciOi.J9.x-y_z')).toBe(
      'Authorization: Bearer [REDACTED]',
    );
    expect(redactSecrets('failed (subscription-key=abcdef123, sig: ZZZZZZ)')).toBe(
      'failed (subscription-key=[REDACTED], sig: [REDACTED])',
    );
  });

  it('scrubs known secret values anywhere, including URL-encoded', () => {
    const secret = 'k3y/with+special=chars';
    const text = `echo ${secret} and ${encodeURIComponent(secret)}`;
    expect(redactSecrets(text, [secret])).toBe('echo [REDACTED] and [REDACTED]');
  });

  it('leaves ordinary text alone', () => {
    const text = 'Unsupported voice xx-XX-NoSuchVoiceNeural. websocket error code: 1007';
    expect(redactSecrets(text, ['short'])).toBe(text);
  });
});

describe('collectSecrets', () => {
  it('collects the key, token and endpoint query/userinfo values', () => {
    const secrets = collectSecrets(
      props({
        SpeechServiceConnection_Key: 'subscription-key-value',
        SpeechServiceAuthorization_Token: 'auth-token-value',
        SpeechServiceConnection_Endpoint: 'wss://u:endpoint-pass@h.example.com/p?token=endpoint-token&x=1',
      }),
    );
    expect(secrets).toEqual(
      expect.arrayContaining([
        'subscription-key-value',
        'auth-token-value',
        'endpoint-token',
        'endpoint-pass',
      ]),
    );
    expect(secrets).not.toContain('1'); // too short to scrub verbatim
  });

  it('tolerates missing or throwing property collections', () => {
    expect(collectSecrets(undefined)).toEqual([]);
    expect(
      collectSecrets({
        getProperty: () => {
          throw new Error('disposed');
        },
      }),
    ).toEqual([]);
  });
});

describe('describeSynthesisAudio', () => {
  const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

  it.each([
    ['', ascii('RIFF\x00\x00\x00\x00WAVEfmt '), 'audio/wav'],
    ['riff-16khz-16kbps-mono-siren', ascii('RIFF\x00\x00\x00\x00WAVE'), 'audio/wav'],
    ['audio-24khz-48kbitrate-mono-mp3', Uint8Array.from([0xff, 0xf3, 0x44]), 'audio/mpeg'],
    ['audio-24khz-48kbitrate-mono-mp3', ascii('ID3\x04'), 'audio/mpeg'],
    ['ogg-24khz-16bit-mono-opus', ascii('OggS'), 'audio/ogg'],
    ['webm-24khz-16bit-mono-opus', Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), 'audio/webm'],
    ['amr-wb-16000hz', ascii('#!AMR-WB\n\x04'), 'audio/amr-wb'],
    ['g722-16khz-64kbps', Uint8Array.from([1, 2, 3]), 'application/octet-stream'],
    ['raw-24khz-16bit-mono-truesilk', Uint8Array.from([1, 2, 3]), 'application/octet-stream'],
    ['audio-16khz-16bit-32kbps-mono-opus', Uint8Array.from([1, 2, 3]), 'application/octet-stream'],
    ['', Uint8Array.from([1, 2, 3]), 'application/octet-stream'], // unknown default: not guessed as WAV
  ])('%s -> %s', (format, bytes, mediaType) => {
    expect(describeSynthesisAudio(bytes, format).mediaType).toBe(mediaType);
  });

  it('does not mistake raw PCM that starts like an MPEG frame for MP3', () => {
    const audio = describeSynthesisAudio(
      Uint8Array.from([0xff, 0xef, 0x10, 0x00]),
      'raw-16khz-16bit-mono-pcm',
    );
    expect(audio.mediaType).toBe('audio/wav');
    expect(audio.metadata['wrappedInWav']).toBe(true);
  });

  it.each([
    ['raw-8khz-8bit-mono-mulaw', 7, 8000, 8],
    ['Raw8Khz8BitMonoALaw', 6, 8000, 8],
    ['raw-22050hz-16bit-mono-pcm', 1, 22050, 16],
    ['Raw48Khz16BitMonoPcm', 1, 48000, 16],
  ])('wraps %s in WAV (format %d, %d Hz, %d-bit)', (format, formatTag, sampleRate, bits) => {
    const samples = Uint8Array.from([1, 2, 3, 4]);
    const { bytes, mediaType } = describeSynthesisAudio(samples, format);
    const view = Buffer.from(bytes);
    expect(mediaType).toBe('audio/wav');
    expect([view.readUInt16LE(20), view.readUInt32LE(24), view.readUInt16LE(34)]).toEqual([
      formatTag,
      sampleRate,
      bits,
    ]);
    expect(view.readUInt32LE(28)).toBe((sampleRate * bits) / 8); // byte rate, mono
    expect(view.readUInt32LE(40)).toBe(samples.byteLength);
    expect(view.readUInt32LE(4)).toBe(36 + samples.byteLength);
  });

  it('wrapInWav output is a well-formed RIFF/WAVE file', () => {
    const wav = Buffer.from(
      wrapInWav(new Uint8Array(10), { formatTag: 1, sampleRate: 16000, bitsPerSample: 16 }),
    );
    expect(
      wav.toString('latin1', 0, 4) + wav.toString('latin1', 8, 16) + wav.toString('latin1', 36, 40),
    ).toBe('RIFFWAVEfmt data');
    expect(wav.byteLength).toBe(54);
  });
});
