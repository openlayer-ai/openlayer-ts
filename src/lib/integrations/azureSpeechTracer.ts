/**
 * Openlayer tracing integration for the Azure AI Speech SDK
 * (``microsoft-cognitiveservices-speech-sdk``).
 *
 * Wraps ``recognizeOnceAsync`` on ``SpeechRecognizer`` / ``TranslationRecognizer``
 * and ``speakTextAsync`` / ``speakSsmlAsync`` on ``SpeechSynthesizer`` so each call
 * becomes a CHAT_COMPLETION step on the current Openlayer trace, matching the
 * Python ``azure_speech_tracer``.
 *
 * Server-side only. The Speech SDK also runs in browsers, but tracing there would
 * ship the Openlayer API key to the client. Keep the Speech SDK and this tracer in
 * your backend (browser apps should get short-lived Speech tokens from a service
 * you run, via ``SpeechConfig.fromAuthorizationToken``).
 *
 * The Azure credential never leaves the process: the client's property collection
 * also holds the subscription key and authorization token, so only an allowlist
 * of non-secret settings is read from it.
 *
 * Audio is attached only when ``attachmentUploadEnabled`` is configured
 * (``configure({ attachmentUploadEnabled: true })``) and is uploaded to Openlayer
 * storage separately from the trace: synthesized audio from each result, and
 * recognition input audio passed explicitly as ``inputAudio`` (an ``AudioConfig``
 * does not expose its source). Storing audio in Openlayer sends that data to
 * Openlayer, so keep it opt-in.
 *
 * The Speech SDK is only imported for types, so this module loads (and is
 * re-exported from ``integrations/index``) without the SDK installed.
 */
import type {
  PropertyCollection,
  SpeechRecognitionResult,
  SpeechRecognizer,
  SpeechSynthesisResult,
  SpeechSynthesizer,
  TranslationRecognitionResult,
  TranslationRecognizer,
} from 'microsoft-cognitiveservices-speech-sdk';

import * as fs from 'fs';
import * as path from 'path';

import { Attachment, guessMediaType } from '../tracing/attachments';
import { collectSecrets, describeSynthesisAudio, redactSecrets } from './azureSpeechUtils';
import { addChatCompletionStepToTrace, isAttachmentUploadEnabled } from '../tracing/tracer';

/**
 * Provider string. No space: the Openlayer cost lookup matches ``provider``
 * against a slug exactly, and a space can never match.
 */
export const AZURE_SPEECH_PROVIDER = 'Azure_Speech';

/** Speech SDK offsets and durations are expressed in 100-nanosecond ticks. */
const TICKS_PER_MS = 10_000;

/**
 * ``ResultReason`` names indexed by value, for the JavaScript SDK. The numbering
 * differs from the Python/C++ SDKs, and the enum can't be imported at runtime
 * without making the SDK a hard dependency; a test checks this table against the
 * installed SDK.
 */
export const RESULT_REASON_NAMES: readonly string[] = [
  'NoMatch',
  'Canceled',
  'RecognizingSpeech',
  'RecognizedSpeech',
  'RecognizedKeyword',
  'TranslatingSpeech',
  'TranslatedSpeech',
  'SynthesizingAudio',
  'SynthesizingAudioCompleted',
  'SynthesizingAudioStarted',
  'VoicesListRetrieved',
  'TranslatingParticipantSpeech',
  'TranslatedParticipantSpeech',
  'TranslatedInstantMessage',
  'TranslatedParticipantInstantMessage',
];

/**
 * ``RecognitionStatus`` values in the service JSON of a NoMatch result, mapped to
 * the ``NoMatchReason`` names the Python tracer records.
 */
const NO_MATCH_REASONS: Record<string, string> = {
  NoMatch: 'NotRecognized',
  InitialSilenceTimeout: 'InitialSilenceTimeout',
  BabbleTimeout: 'InitialBabbleTimeout',
  EndSilenceTimeout: 'EndSilenceTimeout',
};

/** Result property holding the ``CancellationErrorCode`` name of a canceled result. */
const CANCELLATION_ERROR_CODE_PROPERTY = 'CancellationErrorCode';

/**
 * The only client properties ever read. Keyed by the snake_case name recorded in
 * ``modelParameters`` (matching the Python tracer).
 */
const RECOGNITION_PROPERTIES: Record<string, string> = {
  region: 'SpeechServiceConnection_Region',
  endpoint_id: 'SpeechServiceConnection_EndpointId',
  language: 'SpeechServiceConnection_RecoLanguage',
};
const SYNTHESIS_PROPERTIES: Record<string, string> = {
  region: 'SpeechServiceConnection_Region',
  endpoint_id: 'SpeechServiceConnection_EndpointId',
  voice: 'SpeechServiceConnection_SynthVoice',
  synthesis_language: 'SpeechServiceConnection_SynthLanguage',
  output_format: 'SpeechServiceConnection_SynthOutputFormat',
};

const PATCHED = Symbol.for('openlayer.azureSpeech.patched');

export type AzureSpeechClient = SpeechRecognizer | TranslationRecognizer | SpeechSynthesizer;

/** Audio accepted as ``inputAudio``: raw bytes, a local file path, or an ``Attachment``. */
export type AzureSpeechInputAudio = Uint8Array | ArrayBuffer | ArrayBufferView | string | Attachment;

export interface TraceAzureSpeechOptions {
  /**
   * Recognizers only: the audio this recognizer transcribes (typically the same
   * bytes or file given to its ``AudioConfig``). It is snapshotted now, attached
   * to every recognition step of this recognizer as ``inputs.audio``, and
   * uploaded once — only when ``attachmentUploadEnabled`` is configured.
   */
  inputAudio?: AzureSpeechInputAudio;
}

type RecognitionCallback = (result: SpeechRecognitionResult) => void;
type SynthesisCallback = (result: SpeechSynthesisResult) => void;
type ErrorCallback = (error: string) => void;

/**
 * Patch an Azure Speech recognizer or synthesizer to trace its calls.
 *
 * Recorded per call: latency; the recognition language (plus translation target
 * languages) or the synthesized text/SSML; the recognized text (plus
 * translations) or the synthesized audio's duration and size; the custom
 * endpoint ID or voice as the model; region, language, voice and output format;
 * and the result ID, reason, offset/duration and no-match or cancellation
 * details — the Speech SDK reports most failures as canceled results. Calls
 * that fail through the error callback are traced with the error message.
 *
 * With ``attachmentUploadEnabled`` configured, synthesized audio is attached as
 * ``output.audio`` and ``options.inputAudio`` as a recognition step's
 * ``inputs.audio``; both render as audio players in Openlayer.
 *
 * @param client - The client to patch. Mutated in place.
 * @param options - See ``TraceAzureSpeechOptions``.
 * @returns The same client, for convenient inline use.
 */
export function traceAzureSpeech<T extends AzureSpeechClient>(
  client: T,
  options: TraceAzureSpeechOptions = {},
): T {
  const target = client as T & { [PATCHED]?: boolean };
  if (target[PATCHED]) {
    return client;
  }

  if (typeof (client as SpeechRecognizer).recognizeOnceAsync === 'function') {
    patchRecognizer(
      client as SpeechRecognizer | TranslationRecognizer,
      toInputAttachment(options.inputAudio),
    );
  } else if (typeof (client as SpeechSynthesizer).speakTextAsync === 'function') {
    patchSynthesizer(client as SpeechSynthesizer);
  } else {
    throw new Error(
      'Invalid client. Please provide a SpeechRecognizer, TranslationRecognizer or SpeechSynthesizer ' +
        'from microsoft-cognitiveservices-speech-sdk.',
    );
  }

  target[PATCHED] = true;
  return client;
}

function patchRecognizer(
  recognizer: SpeechRecognizer | TranslationRecognizer,
  inputAudio: Attachment | null,
): void {
  const isTranslation = Array.isArray((recognizer as TranslationRecognizer).targetLanguages);
  const original = recognizer.recognizeOnceAsync;

  // `recognizeOnceAsync(cb, err)` is callback-based: intercept both callbacks and
  // record the step BEFORE invoking the caller's, so a caller awaiting a promise
  // around this call still has its step on the stack when the step is added.
  //
  // One step per call: if the caller's `cb` throws, the SDK routes that
  // exception into `err` (`marshalPromiseToCallbacks`), so the call reaches both
  // wrapped callbacks.
  (recognizer as SpeechRecognizer).recognizeOnceAsync = function (
    cb?: RecognitionCallback,
    err?: ErrorCallback,
  ): void {
    const startTime = Date.now();
    let traced = false;
    original.call(
      recognizer,
      (result: SpeechRecognitionResult) => {
        if (!traced) {
          traced = true;
          safeTrace(() => traceRecognition(recognizer, isTranslation, inputAudio, result, startTime));
        }
        cb?.(result);
      },
      (error: string) => {
        if (!traced) {
          traced = true;
          safeTrace(() => traceRecognitionError(recognizer, isTranslation, inputAudio, error, startTime));
        }
        err?.(error);
      },
    );
  };
}

function patchSynthesizer(synthesizer: SpeechSynthesizer): void {
  for (const [method, inputKey] of [
    ['speakTextAsync', 'text'],
    ['speakSsmlAsync', 'ssml'],
  ] as const) {
    const original = synthesizer[method];
    // Both public methods funnel into the private `speakImpl`, never into each
    // other, so wrapping both can't double-trace a call. Within a call, a throwing
    // caller `cb` is routed into `err` (`createSynthesisCallbacks`), hence `traced`.
    synthesizer[method] = function (
      input: string,
      cb?: SynthesisCallback,
      err?: ErrorCallback,
      stream?: Parameters<SpeechSynthesizer['speakTextAsync']>[3],
    ): void {
      const startTime = Date.now();
      let traced = false;
      original.call(
        synthesizer,
        input,
        (result: SpeechSynthesisResult) => {
          if (!traced) {
            traced = true;
            safeTrace(() => traceSynthesis(synthesizer, inputKey, input, result, startTime));
          }
          cb?.(result);
        },
        (error: string) => {
          if (!traced) {
            traced = true;
            safeTrace(() => traceSynthesisError(synthesizer, inputKey, input, error, startTime));
          }
          err?.(error);
        },
        stream,
      );
    };
  }
}

function safeTrace(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    // Never let a tracing bug break the caller's Speech call.
    console.error('Failed to trace the Azure Speech call with Openlayer', error);
  }
}

// ----------------------------- Steps ----------------------------- //

function traceRecognition(
  recognizer: SpeechRecognizer | TranslationRecognizer,
  isTranslation: boolean,
  inputAudio: Attachment | null,
  result: SpeechRecognitionResult | TranslationRecognitionResult,
  startTime: number,
): void {
  const modelParameters = readProperties(recognizer.properties, RECOGNITION_PROPERTIES);
  const output =
    isTranslation ?
      { text: result.text ?? null, translations: readTranslations(result as TranslationRecognitionResult) }
    : result.text ?? null;

  addStep({
    name: isTranslation ? 'Azure Speech Translation' : 'Azure Speech Recognition',
    inputs: recognitionInputs(recognizer, isTranslation, modelParameters, inputAudio),
    output,
    model: modelParameters['endpoint_id'] || 'speech-to-text',
    modelParameters,
    metadata: resultMetadata(result, collectSecrets(recognizer.properties)),
    startTime,
  });
}

function traceRecognitionError(
  recognizer: SpeechRecognizer | TranslationRecognizer,
  isTranslation: boolean,
  inputAudio: Attachment | null,
  error: string,
  startTime: number,
): void {
  const modelParameters = readProperties(recognizer.properties, RECOGNITION_PROPERTIES);
  addStep({
    name: isTranslation ? 'Azure Speech Translation' : 'Azure Speech Recognition',
    inputs: recognitionInputs(recognizer, isTranslation, modelParameters, inputAudio),
    output: null,
    model: modelParameters['endpoint_id'] || 'speech-to-text',
    modelParameters,
    metadata: { error: redactSecrets(String(error), collectSecrets(recognizer.properties)) },
    startTime,
  });
}

function traceSynthesis(
  synthesizer: SpeechSynthesizer,
  inputKey: 'text' | 'ssml',
  input: string,
  result: SpeechSynthesisResult,
  startTime: number,
): void {
  const modelParameters = readProperties(synthesizer.properties, SYNTHESIS_PROPERTIES);
  const audioDuration = result.audioDuration;
  const audioData = result.audioData;
  const output: Record<string, any> = {
    audioDurationMs: typeof audioDuration === 'number' ? audioDuration / TICKS_PER_MS : null,
    audioSizeBytes: audioData?.byteLength ?? 0,
  };
  if (audioData && audioData.byteLength > 0 && isAttachmentUploadEnabled()) {
    // A bare Attachment directly under the output is what the Openlayer UI
    // renders as an audio player (a typed AudioContent nested here is not).
    const audio = describeSynthesisAudio(audioData, modelParameters['output_format']);
    const attachment = Attachment.fromBytes(audio.bytes, {
      name: `synthesis.${audio.extension}`,
      mediaType: audio.mediaType,
    });
    Object.assign(attachment.metadata, audio.metadata);
    output['audio'] = attachment;
  }
  addStep({
    name: 'Azure Speech Synthesis',
    inputs: { [inputKey]: input },
    output,
    model: modelParameters['voice'] || 'text-to-speech',
    modelParameters,
    metadata: resultMetadata(result, collectSecrets(synthesizer.properties)),
    startTime,
  });
}

function traceSynthesisError(
  synthesizer: SpeechSynthesizer,
  inputKey: 'text' | 'ssml',
  input: string,
  error: string,
  startTime: number,
): void {
  const modelParameters = readProperties(synthesizer.properties, SYNTHESIS_PROPERTIES);
  addStep({
    name: 'Azure Speech Synthesis',
    inputs: { [inputKey]: input },
    output: null,
    model: modelParameters['voice'] || 'text-to-speech',
    modelParameters,
    metadata: { error: redactSecrets(String(error), collectSecrets(synthesizer.properties)) },
    startTime,
  });
}

function addStep(step: {
  name: string;
  inputs: Record<string, any>;
  output: any;
  model: string;
  modelParameters: Record<string, string>;
  metadata: Record<string, any>;
  startTime: number;
}): void {
  const endTime = Date.now();
  addChatCompletionStepToTrace({
    name: step.name,
    inputs: step.inputs,
    output: step.output,
    latency: endTime - step.startTime,
    tokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    model: step.model,
    modelParameters: step.modelParameters,
    metadata: step.metadata,
    provider: AZURE_SPEECH_PROVIDER,
    startTime: step.startTime,
    endTime,
  });
}

// ----------------------------- Parsing ----------------------------- //

/**
 * Read an allowlist of non-secret settings. The same collection holds
 * ``SpeechServiceConnection_Key`` and the authorization token, so it must never
 * be dumped wholesale.
 */
function readProperties(
  properties: PropertyCollection | undefined,
  allowlist: Record<string, string>,
): Record<string, string> {
  const parameters: Record<string, string> = {};
  if (!properties) {
    return parameters;
  }
  for (const [name, propertyId] of Object.entries(allowlist)) {
    const value = properties.getProperty(propertyId, '');
    if (value) {
      parameters[name] = value;
    }
  }
  return parameters;
}

function recognitionInputs(
  recognizer: SpeechRecognizer | TranslationRecognizer,
  isTranslation: boolean,
  modelParameters: Record<string, string>,
  inputAudio: Attachment | null,
): Record<string, any> {
  const inputs: Record<string, any> = { language: modelParameters['language'] ?? null };
  if (isTranslation) {
    inputs['targetLanguages'] = [...((recognizer as TranslationRecognizer).targetLanguages ?? [])];
  }
  if (inputAudio && isAttachmentUploadEnabled()) {
    inputs['audio'] = inputAudio;
  }
  return inputs;
}

// ----------------------------- Audio ----------------------------- //

/**
 * Snapshot ``inputAudio`` into an Attachment. File paths are read as bytes so the
 * local path is never recorded in the trace. Returns null (with a warning) for a
 * missing file or an unsupported value.
 */
function toInputAttachment(audio: AzureSpeechInputAudio | undefined): Attachment | null {
  if (audio === undefined || audio === null) {
    return null;
  }
  if (Attachment.isAttachment(audio)) {
    return audio;
  }
  try {
    if (typeof audio === 'string') {
      const bytes = fs.readFileSync(audio);
      return Attachment.fromBytes(bytes, {
        name: path.basename(audio),
        mediaType: guessMediaType(audio) ?? 'audio/wav',
      });
    }
    if (audio instanceof ArrayBuffer || ArrayBuffer.isView(audio)) {
      return Attachment.fromBytes(audio, { name: 'audio.wav', mediaType: 'audio/wav' });
    }
  } catch (error) {
    console.warn('Openlayer: could not read `inputAudio`; recognition steps will not carry audio.', error);
    return null;
  }
  console.warn('Openlayer: unsupported `inputAudio` value; expected bytes, a file path, or an Attachment.');
  return null;
}

function readTranslations(result: TranslationRecognitionResult): Record<string, string> {
  const translations: Record<string, string> = {};
  const collection = result.translations;
  for (const language of collection?.languages ?? []) {
    translations[language] = collection.get(language);
  }
  return translations;
}

/** Result ID, reason, timings, and no-match or cancellation details. */
function resultMetadata(
  result: SpeechRecognitionResult | SpeechSynthesisResult,
  secrets: readonly string[],
): Record<string, any> {
  const metadata: Record<string, any> = {};
  if (result.resultId) {
    metadata['resultId'] = result.resultId;
  }

  const reason = RESULT_REASON_NAMES[result.reason] ?? String(result.reason);
  metadata['reason'] = reason;

  const { offset, duration } = result as SpeechRecognitionResult;
  if (typeof offset === 'number') {
    metadata['offsetMs'] = offset / TICKS_PER_MS;
  }
  if (typeof duration === 'number') {
    metadata['durationMs'] = duration / TICKS_PER_MS;
  }

  if (reason === 'NoMatch') {
    const status = recognitionStatus((result as SpeechRecognitionResult).json);
    if (status) {
      metadata['noMatchReason'] = NO_MATCH_REASONS[status] ?? status;
    }
  }

  if (reason === 'Canceled') {
    const errorCode =
      result.properties?.getProperty(CANCELLATION_ERROR_CODE_PROPERTY, 'NoError') ?? 'NoError';
    metadata['cancellation'] = {
      // A cancellation without an error code means the audio stream ended.
      reason: errorCode === 'NoError' ? 'EndOfStream' : 'Error',
      errorCode,
      errorDetails: result.errorDetails ? redactSecrets(result.errorDetails, secrets) : null,
    };
  }

  return metadata;
}

function recognitionStatus(json: string | undefined): string | null {
  if (!json) {
    return null;
  }
  try {
    const status = JSON.parse(json)?.RecognitionStatus;
    return typeof status === 'string' ? status : null;
  } catch {
    return null;
  }
}
