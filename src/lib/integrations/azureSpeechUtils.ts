/**
 * Internal helpers for the Azure AI Speech tracer: secret redaction for SDK
 * error text, and synthesis-audio typing. Not re-exported from
 * ``integrations/index``.
 */

// ----------------------------- Redaction ----------------------------- //

const REDACTED = '[REDACTED]';

/**
 * Speech SDK properties whose values are secrets. The endpoint/host are not
 * secrets themselves, but their query strings or userinfo can carry
 * credentials, so the values found there are collected too.
 */
const SECRET_PROPERTY_IDS = [
  'SpeechServiceConnection_Key',
  'SpeechServiceAuthorization_Token',
  'SpeechServiceConnection_ProxyPassword',
];
const URL_PROPERTY_IDS = ['SpeechServiceConnection_Endpoint', 'SpeechServiceConnection_Host'];

/** Values shorter than this are not scrubbed verbatim (too likely to collide with ordinary text). */
const MIN_SECRET_LENGTH = 6;

const URL_PATTERN = /\b(?:wss?|https?):\/\/[^\s'"<>`]+/gi;
const BEARER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+/]+=*/gi;
const SENSITIVE_PAIR_PATTERN =
  /\b((?:ocp-apim-)?subscription[-_]?key|api[-_]?key|access[-_]?token|auth(?:orization)?|token|sig|signature|password|secret)(\s*[=:]\s*)(?!Bearer\b|Basic\b|\[REDACTED\])[^\s&,;'")\]}>]+/gi;

interface PropertyReader {
  getProperty(key: string, def?: string): string;
}

function readProperty(properties: PropertyReader | undefined | null, id: string): string {
  try {
    return properties?.getProperty(id, '') ?? '';
  } catch {
    return '';
  }
}

/**
 * Secret values configured on a Speech client: the subscription key,
 * authorization token and proxy password, plus every query-parameter value and
 * userinfo credential in its custom endpoint/host URL. Used only to scrub text;
 * never recorded.
 */
export function collectSecrets(properties: PropertyReader | undefined | null): string[] {
  const secrets = SECRET_PROPERTY_IDS.map((id) => readProperty(properties, id));
  for (const id of URL_PROPERTY_IDS) {
    const raw = readProperty(properties, id);
    if (!raw) continue;
    try {
      const url = new URL(raw);
      url.searchParams.forEach((value) => secrets.push(value));
      secrets.push(decodeURIComponent(url.username), decodeURIComponent(url.password));
    } catch {
      // Not a URL; nothing to extract.
    }
  }
  return [...new Set(secrets.filter((secret) => secret.length >= MIN_SECRET_LENGTH))];
}

function redactUrl(match: string): string {
  try {
    const url = new URL(match);
    if (url.username || url.password) {
      url.username = url.username ? REDACTED : '';
      url.password = url.password ? REDACTED : '';
    }
    const keys = [...new Set([...url.searchParams.keys()])];
    url.search = '';
    url.hash = '';
    const query = keys.map((key) => `${encodeURIComponent(key)}=${REDACTED}`).join('&');
    return query ? `${url.toString()}?${query}` : url.toString();
  } catch {
    const cut = match.search(/[?#]/);
    return cut === -1 ? match : `${match.slice(0, cut)}?${REDACTED}`;
  }
}

/**
 * Remove credentials from free text the Speech SDK produces (error details,
 * error-callback messages). The SDK embeds the full endpoint URL in connection
 * errors (``Unable to contact server. StatusCode: …, <endpoint> Reason: …``), so
 * a custom endpoint carrying a token or signature in its query string would
 * otherwise be published.
 *
 * - URLs keep scheme, host, path and parameter names; every query value and any
 *   userinfo is replaced.
 * - ``Bearer <token>`` and ``key=``/``token=``/``sig=``-style pairs are replaced.
 * - Any value in ``secrets`` (see ``collectSecrets``) is replaced wherever it
 *   appears.
 */
export function redactSecrets(text: string, secrets: readonly string[] = []): string {
  let result = text.replace(URL_PATTERN, redactUrl);
  result = result.replace(BEARER_PATTERN, `$1 ${REDACTED}`);
  result = result.replace(SENSITIVE_PAIR_PATTERN, `$1$2${REDACTED}`);
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    if (secret.length < MIN_SECRET_LENGTH) continue;
    result = result.split(secret).join(REDACTED);
    const encoded = encodeURIComponent(secret);
    if (encoded !== secret) result = result.split(encoded).join(REDACTED);
  }
  return result;
}

// ----------------------------- Audio ----------------------------- //

export interface SynthesisAudio {
  bytes: Uint8Array;
  mediaType: string;
  extension: string;
  /** Recorded on the attachment so the encoding is explicit. */
  metadata: Record<string, any>;
}

function startsWithAscii(bytes: Uint8Array, text: string, offset = 0): boolean {
  if (bytes.byteLength < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** Container detected from the audio's own header bytes, if any. */
function sniffContainer(bytes: Uint8Array): { mediaType: string; extension: string } | null {
  if (startsWithAscii(bytes, 'RIFF') && startsWithAscii(bytes, 'WAVE', 8)) {
    return { mediaType: 'audio/wav', extension: 'wav' };
  }
  if (startsWithAscii(bytes, 'OggS')) return { mediaType: 'audio/ogg', extension: 'ogg' };
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mediaType: 'audio/webm', extension: 'webm' };
  }
  if (startsWithAscii(bytes, '#!AMR-WB\n')) return { mediaType: 'audio/amr-wb', extension: 'amr' };
  if (startsWithAscii(bytes, 'ID3')) return { mediaType: 'audio/mpeg', extension: 'mp3' };
  // No bare MPEG frame-sync check: headerless PCM samples can start with 0xFFEx.
  return null;
}

/** Sample rate (Hz) and bits per sample parsed from a format name like ``raw-22050hz-16bit-mono-pcm``. */
function parseRawFormat(normalized: string): { sampleRate: number; bitsPerSample: number } | null {
  const khz = /(\d+)khz/.exec(normalized);
  const hz = /(\d+)hz/.exec(normalized);
  const bits = /(\d+)bit/.exec(normalized);
  const sampleRate =
    khz ? Number(khz[1]) * 1000
    : hz ? Number(hz[1])
    : NaN;
  const bitsPerSample = bits ? Number(bits[1]) : NaN;
  if (!Number.isFinite(sampleRate) || !Number.isFinite(bitsPerSample)) return null;
  return { sampleRate, bitsPerSample };
}

/** WAVE format tags. */
const WAVE_FORMAT = { pcm: 1, alaw: 6, mulaw: 7 } as const;

/** Wrap headerless mono samples in a WAV (RIFF) container. */
export function wrapInWav(
  samples: Uint8Array,
  format: { formatTag: number; sampleRate: number; bitsPerSample: number; channels?: number },
): Uint8Array {
  const channels = format.channels ?? 1;
  const blockAlign = (channels * format.bitsPerSample) / 8;
  const header = new DataView(new ArrayBuffer(44));
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) header.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  header.setUint32(4, 36 + samples.byteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  header.setUint32(16, 16, true);
  header.setUint16(20, format.formatTag, true);
  header.setUint16(22, channels, true);
  header.setUint32(24, format.sampleRate, true);
  header.setUint32(28, format.sampleRate * blockAlign, true);
  header.setUint16(32, blockAlign, true);
  header.setUint16(34, format.bitsPerSample, true);
  writeAscii(36, 'data');
  header.setUint32(40, samples.byteLength, true);

  const wav = new Uint8Array(44 + samples.byteLength);
  wav.set(new Uint8Array(header.buffer), 0);
  wav.set(samples, 44);
  return wav;
}

/**
 * Type the synthesized audio accurately.
 *
 * The container is detected from the audio's own header (WAV, Ogg, WebM,
 * AMR-WB, ID3-tagged MP3); untagged MP3 is recognized by the format name. Headerless PCM, µ-law and A-law output (the ``raw-*`` formats) is
 * wrapped in a WAV container so it is playable, using the sample rate and bit
 * depth in the format name. Anything else (raw Opus frames, TrueSilk, Siren,
 * G.722, unknown) is labeled ``application/octet-stream`` rather than guessed.
 *
 * @param outputFormat - The ``SpeechServiceConnection_SynthOutputFormat``
 *   value: an enum name in the JS SDK (``Raw8Khz8BitMonoMULaw``), a kebab-case
 *   name in the Python SDK (``raw-8khz-8bit-mono-mulaw``), or empty for the
 *   default.
 */
export function describeSynthesisAudio(
  data: ArrayBuffer | Uint8Array,
  outputFormat?: string | null,
): SynthesisAudio {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const normalized = (outputFormat ?? '').toLowerCase().replace(/[-_]/g, '');
  const metadata: Record<string, any> = {};
  if (outputFormat) metadata['outputFormat'] = outputFormat;

  const container = sniffContainer(bytes);
  if (container) {
    return { bytes, ...container, metadata };
  }
  if (normalized.endsWith('mp3')) {
    // Azure's MP3 output is a bare frame stream (no ID3 tag).
    return { bytes, mediaType: 'audio/mpeg', extension: 'mp3', metadata };
  }

  if (normalized.startsWith('raw')) {
    const encoding =
      normalized.endsWith('pcm') ? 'pcm'
      : normalized.endsWith('mulaw') ? 'mulaw'
      : normalized.endsWith('alaw') ? 'alaw'
      : null;
    const raw = parseRawFormat(normalized);
    if (encoding && raw) {
      return {
        bytes: wrapInWav(bytes, { formatTag: WAVE_FORMAT[encoding], ...raw }),
        mediaType: 'audio/wav',
        extension: 'wav',
        metadata: { ...metadata, encoding, sampleRateHz: raw.sampleRate, wrappedInWav: true },
      };
    }
  }

  return { bytes, mediaType: 'application/octet-stream', extension: 'bin', metadata };
}
