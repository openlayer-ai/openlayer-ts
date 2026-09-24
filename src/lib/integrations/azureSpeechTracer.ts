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
 * of non-secret settings is read from it. Audio is not captured — the TypeScript
 * SDK has no attachment upload support yet.
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

import { addChatCompletionStepToTrace } from '../tracing/tracer';

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
 * @param client - The client to patch. Mutated in place.
 * @returns The same client, for convenient inline use.
 */
export function traceAzureSpeech<T extends AzureSpeechClient>(client: T): T {
  const target = client as T & { [PATCHED]?: boolean };
  if (target[PATCHED]) {
    return client;
  }

  if (typeof (client as SpeechRecognizer).recognizeOnceAsync === 'function') {
    patchRecognizer(client as SpeechRecognizer | TranslationRecognizer);
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

function patchRecognizer(recognizer: SpeechRecognizer | TranslationRecognizer): void {
  const isTranslation = Array.isArray((recognizer as TranslationRecognizer).targetLanguages);
  const original = recognizer.recognizeOnceAsync;

  // `recognizeOnceAsync(cb, err)` is callback-based: intercept both callbacks and
  // record the step BEFORE invoking the caller's, so a caller awaiting a promise
  // around this call still has its step on the stack when the step is added.
  (recognizer as SpeechRecognizer).recognizeOnceAsync = function (
    cb?: RecognitionCallback,
    err?: ErrorCallback,
  ): void {
    const startTime = Date.now();
    original.call(
      recognizer,
      (result: SpeechRecognitionResult) => {
        safeTrace(() => traceRecognition(recognizer, isTranslation, result, startTime));
        cb?.(result);
      },
      (error: string) => {
        safeTrace(() => traceRecognitionError(recognizer, isTranslation, error, startTime));
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
    // other, so wrapping both can't double-trace a call.
    synthesizer[method] = function (
      input: string,
      cb?: SynthesisCallback,
      err?: ErrorCallback,
      stream?: Parameters<SpeechSynthesizer['speakTextAsync']>[3],
    ): void {
      const startTime = Date.now();
      original.call(
        synthesizer,
        input,
        (result: SpeechSynthesisResult) => {
          safeTrace(() => traceSynthesis(synthesizer, inputKey, input, result, startTime));
          cb?.(result);
        },
        (error: string) => {
          safeTrace(() => traceSynthesisError(synthesizer, inputKey, input, error, startTime));
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
    inputs: recognitionInputs(recognizer, isTranslation, modelParameters),
    output,
    model: modelParameters['endpoint_id'] || 'speech-to-text',
    modelParameters,
    metadata: resultMetadata(result),
    startTime,
  });
}

function traceRecognitionError(
  recognizer: SpeechRecognizer | TranslationRecognizer,
  isTranslation: boolean,
  error: string,
  startTime: number,
): void {
  const modelParameters = readProperties(recognizer.properties, RECOGNITION_PROPERTIES);
  addStep({
    name: isTranslation ? 'Azure Speech Translation' : 'Azure Speech Recognition',
    inputs: recognitionInputs(recognizer, isTranslation, modelParameters),
    output: null,
    model: modelParameters['endpoint_id'] || 'speech-to-text',
    modelParameters,
    metadata: { error: String(error) },
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
  addStep({
    name: 'Azure Speech Synthesis',
    inputs: { [inputKey]: input },
    output: {
      audioDurationMs: typeof audioDuration === 'number' ? audioDuration / TICKS_PER_MS : null,
      audioSizeBytes: result.audioData?.byteLength ?? 0,
    },
    model: modelParameters['voice'] || 'text-to-speech',
    modelParameters,
    metadata: resultMetadata(result),
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
    metadata: { error: String(error) },
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
): Record<string, any> {
  const inputs: Record<string, any> = { language: modelParameters['language'] ?? null };
  if (isTranslation) {
    inputs['targetLanguages'] = [...((recognizer as TranslationRecognizer).targetLanguages ?? [])];
  }
  return inputs;
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
export function resultMetadata(result: SpeechRecognitionResult | SpeechSynthesisResult): Record<string, any> {
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
      errorDetails: result.errorDetails ?? null,
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
