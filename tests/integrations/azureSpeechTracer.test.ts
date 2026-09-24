import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

import {
  AZURE_SPEECH_PROVIDER,
  RESULT_REASON_NAMES,
  traceAzureSpeech,
} from '../../src/lib/integrations/azureSpeechTracer';
import { Attachment } from '../../src/lib/tracing/attachments';
import { addChatCompletionStepToTrace, isAttachmentUploadEnabled } from '../../src/lib/tracing/tracer';

jest.mock('../../src/lib/tracing/tracer', () => ({
  addChatCompletionStepToTrace: jest.fn(),
  isAttachmentUploadEnabled: jest.fn(() => false),
}));

/*
 * No network. Real recognizers/synthesizers are constructed with a fake key (the
 * constructors don't connect) and their SDK methods are replaced with stubs that
 * invoke the callbacks with real result objects, BEFORE tracing, so the tracer
 * wraps the stub.
 */

const FAKE_KEY = 'FAKE-AZURE-SPEECH-KEY-0123456789';
const clients: Array<{ close: () => void }> = [];

function speechConfig(): sdk.SpeechConfig {
  const config = sdk.SpeechConfig.fromSubscription(FAKE_KEY, 'eastus');
  config.speechRecognitionLanguage = 'pt-BR';
  config.speechSynthesisVoiceName = 'en-US-JennyNeural';
  return config;
}

function makeRecognizer(config: sdk.SpeechConfig = speechConfig()): sdk.SpeechRecognizer {
  const recognizer = new sdk.SpeechRecognizer(
    config,
    sdk.AudioConfig.fromStreamInput(sdk.AudioInputStream.createPushStream()),
  );
  clients.push(recognizer);
  return recognizer;
}

function makeSynthesizer(): sdk.SpeechSynthesizer {
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig(), null as any);
  clients.push(synthesizer);
  return synthesizer;
}

function recognitionResult(
  overrides: {
    reason?: sdk.ResultReason;
    text?: string;
    json?: string;
    errorDetails?: string;
    properties?: sdk.PropertyCollection;
  } = {},
): sdk.SpeechRecognitionResult {
  const text = overrides.text ?? 'Olá mundo.';
  return new sdk.SpeechRecognitionResult(
    'res-123',
    overrides.reason ?? sdk.ResultReason.RecognizedSpeech,
    text,
    12_300_000, // duration: 1230 ms in 100-ns ticks
    5_000_000, // offset: 500 ms
    'pt-BR',
    undefined,
    undefined,
    overrides.errorDetails,
    overrides.json ?? JSON.stringify({ RecognitionStatus: 'Success', DisplayText: text }),
    overrides.properties,
  );
}

function synthesisResult(
  overrides: { reason?: sdk.ResultReason; errorDetails?: string; properties?: sdk.PropertyCollection } = {},
): sdk.SpeechSynthesisResult {
  return new sdk.SpeechSynthesisResult(
    'syn-456',
    overrides.reason ?? sdk.ResultReason.SynthesizingAudioCompleted,
    new Uint8Array(26).buffer,
    overrides.errorDetails,
    overrides.properties,
    15_000_000, // audioDuration: 1500 ms in ticks
  );
}

function cancellationProperties(errorCode: string): sdk.PropertyCollection {
  const properties = new sdk.PropertyCollection();
  properties.setProperty('CancellationErrorCode', errorCode);
  return properties;
}

/** Replace `recognizeOnceAsync` with a stub that succeeds (or fails) via the callbacks. */
function stubRecognize(recognizer: any, outcome: { result?: any; error?: string }): jest.Mock {
  const stub = jest.fn((cb?: (r: any) => void, err?: (e: string) => void) => {
    if (outcome.error !== undefined) err?.(outcome.error);
    else cb?.(outcome.result);
  });
  recognizer.recognizeOnceAsync = stub;
  return stub;
}

function stubSpeak(synthesizer: any, method: string, outcome: { result?: any; error?: string }): jest.Mock {
  const stub = jest.fn((_input: string, cb?: (r: any) => void, err?: (e: string) => void) => {
    if (outcome.error !== undefined) err?.(outcome.error);
    else cb?.(outcome.result);
  });
  synthesizer[method] = stub;
  return stub;
}

function recognize(recognizer: sdk.SpeechRecognizer | sdk.TranslationRecognizer): Promise<any> {
  return new Promise((resolve, reject) => recognizer.recognizeOnceAsync(resolve, reject));
}

describe('traceAzureSpeech', () => {
  let addStepMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    addStepMock = addChatCompletionStepToTrace as jest.Mock;
  });

  afterAll(() => {
    for (const client of clients) client.close();
  });

  describe('enum tables', () => {
    it('match the installed SDK', () => {
      for (const [index, name] of RESULT_REASON_NAMES.entries()) {
        expect((sdk.ResultReason as any)[index]).toBe(name);
      }
      expect((sdk.ResultReason as any)[RESULT_REASON_NAMES.length]).toBeUndefined();
    });
  });

  describe('patching', () => {
    it('returns the same instance and is idempotent', async () => {
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { result: recognitionResult() });

      expect(traceAzureSpeech(recognizer)).toBe(recognizer);
      const wrapped = recognizer.recognizeOnceAsync;
      expect(traceAzureSpeech(recognizer)).toBe(recognizer);
      expect(recognizer.recognizeOnceAsync).toBe(wrapped);

      await recognize(recognizer);
      expect(addStepMock).toHaveBeenCalledTimes(1);
    });

    it('rejects unsupported objects', () => {
      expect(() => traceAzureSpeech({} as any)).toThrow('Invalid client');
    });

    it('passes the original result to the caller and works without callbacks', async () => {
      const recognizer = makeRecognizer();
      const result = recognitionResult();
      stubRecognize(recognizer, { result });
      traceAzureSpeech(recognizer);

      await expect(recognize(recognizer)).resolves.toBe(result);
      expect(() => recognizer.recognizeOnceAsync()).not.toThrow();
      expect(addStepMock).toHaveBeenCalledTimes(2);
    });

    it('records the step before invoking the caller callback', async () => {
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { result: recognitionResult() });
      traceAzureSpeech(recognizer);

      let stepsWhenCallbackRan = -1;
      recognizer.recognizeOnceAsync(() => {
        stepsWhenCallbackRan = addStepMock.mock.calls.length;
      });
      expect(stepsWhenCallbackRan).toBe(1);
    });
  });

  describe('recognition', () => {
    it('emits a complete step', async () => {
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { result: recognitionResult() });
      traceAzureSpeech(recognizer);

      await recognize(recognizer);

      const step = addStepMock.mock.calls[0][0];
      expect(step).toMatchObject({
        name: 'Azure Speech Recognition',
        inputs: { language: 'pt-BR' },
        output: 'Olá mundo.',
        model: 'speech-to-text',
        modelParameters: { region: 'eastus', language: 'pt-BR' },
        provider: 'Azure_Speech',
        tokens: 0,
        metadata: {
          resultId: 'res-123',
          reason: 'RecognizedSpeech',
          offsetMs: 500,
          durationMs: 1230,
        },
      });
      expect(step.latency).toBeGreaterThanOrEqual(0);
      expect(step.startTime).toBeLessThanOrEqual(step.endTime);
      // Epoch milliseconds, like Step's own default.
      expect(Math.abs(step.startTime - Date.now())).toBeLessThan(60_000);
    });

    it('uses a custom endpoint ID as the model', async () => {
      const config = speechConfig();
      config.endpointId = 'custom-model-abc';
      const recognizer = makeRecognizer(config);
      stubRecognize(recognizer, { result: recognitionResult() });
      traceAzureSpeech(recognizer);

      await recognize(recognizer);

      expect(addStepMock.mock.calls[0][0].model).toBe('custom-model-abc');
    });

    it('records the no-match reason', async () => {
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, {
        result: recognitionResult({
          reason: sdk.ResultReason.NoMatch,
          text: '',
          json: JSON.stringify({ RecognitionStatus: 'InitialSilenceTimeout' }),
        }),
      });
      traceAzureSpeech(recognizer);

      await recognize(recognizer);

      expect(addStepMock.mock.calls[0][0].metadata).toMatchObject({
        reason: 'NoMatch',
        noMatchReason: 'InitialSilenceTimeout',
      });
    });

    it('records cancellation details', async () => {
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, {
        result: recognitionResult({
          reason: sdk.ResultReason.Canceled,
          text: '',
          errorDetails: 'WebSocket upgrade failed: Authentication error (401).',
          properties: cancellationProperties('AuthenticationFailure'),
        }),
      });
      traceAzureSpeech(recognizer);

      await recognize(recognizer);

      expect(addStepMock.mock.calls[0][0].metadata.cancellation).toEqual({
        reason: 'Error',
        errorCode: 'AuthenticationFailure',
        errorDetails: 'WebSocket upgrade failed: Authentication error (401).',
      });
    });

    it('traces the error callback and still forwards it', async () => {
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { error: 'Unable to contact server.' });
      traceAzureSpeech(recognizer);

      await expect(recognize(recognizer)).rejects.toBe('Unable to contact server.');

      const step = addStepMock.mock.calls[0][0];
      expect(step.output).toBeNull();
      expect(step.metadata).toEqual({ error: 'Unable to contact server.' });
    });

    it('includes translations and target languages', async () => {
      const config = sdk.SpeechTranslationConfig.fromSubscription(FAKE_KEY, 'eastus');
      config.speechRecognitionLanguage = 'en-US';
      config.addTargetLanguage('de');
      const recognizer = new sdk.TranslationRecognizer(
        config,
        sdk.AudioConfig.fromStreamInput(sdk.AudioInputStream.createPushStream()),
      );
      clients.push(recognizer);
      const translations = new sdk.Translations();
      translations.set('de', 'Hallo.');
      stubRecognize(recognizer, {
        result: new sdk.TranslationRecognitionResult(
          translations,
          'res-789',
          sdk.ResultReason.TranslatedSpeech,
          'Hello.',
        ),
      });
      traceAzureSpeech(recognizer);

      await recognize(recognizer);

      expect(addStepMock.mock.calls[0][0]).toMatchObject({
        name: 'Azure Speech Translation',
        inputs: { language: 'en-US', targetLanguages: ['de'] },
        output: { text: 'Hello.', translations: { de: 'Hallo.' } },
        metadata: { reason: 'TranslatedSpeech' },
      });
    });
  });

  describe('synthesis', () => {
    it.each([
      ['speakTextAsync', 'text'],
      ['speakSsmlAsync', 'ssml'],
    ])('%s emits a complete step', async (method, inputKey) => {
      const synthesizer = makeSynthesizer();
      const result = synthesisResult();
      const stub = stubSpeak(synthesizer, method, { result });
      traceAzureSpeech(synthesizer);

      const received = await new Promise((resolve, reject) =>
        (synthesizer as any)[method]('Hi there', resolve, reject),
      );

      expect(received).toBe(result);
      expect(stub.mock.calls[0][0]).toBe('Hi there');
      expect(addStepMock.mock.calls[0][0]).toMatchObject({
        name: 'Azure Speech Synthesis',
        inputs: { [inputKey]: 'Hi there' },
        output: { audioDurationMs: 1500, audioSizeBytes: 26 },
        model: 'en-US-JennyNeural',
        modelParameters: { region: 'eastus', voice: 'en-US-JennyNeural' },
        metadata: { resultId: 'syn-456', reason: 'SynthesizingAudioCompleted' },
      });
    });

    it('forwards the output stream argument', () => {
      const synthesizer = makeSynthesizer();
      const stub = stubSpeak(synthesizer, 'speakTextAsync', { result: synthesisResult() });
      traceAzureSpeech(synthesizer);
      const stream = sdk.AudioOutputStream.createPullStream();

      synthesizer.speakTextAsync('Hi', undefined, undefined, stream);

      expect(stub.mock.calls[0][3]).toBe(stream);
    });

    it('records synthesis cancellation details', async () => {
      const synthesizer = makeSynthesizer();
      stubSpeak(synthesizer, 'speakTextAsync', {
        result: synthesisResult({
          reason: sdk.ResultReason.Canceled,
          errorDetails: 'Connection failed.',
          properties: cancellationProperties('ConnectionFailure'),
        }),
      });
      traceAzureSpeech(synthesizer);

      await new Promise((resolve) => synthesizer.speakTextAsync('Hi', resolve));

      expect(addStepMock.mock.calls[0][0].metadata.cancellation).toEqual({
        reason: 'Error',
        errorCode: 'ConnectionFailure',
        errorDetails: 'Connection failed.',
      });
    });

    it('never records the subscription key', async () => {
      const synthesizer = makeSynthesizer();
      stubSpeak(synthesizer, 'speakTextAsync', { result: synthesisResult() });
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { result: recognitionResult() });
      traceAzureSpeech(synthesizer);
      traceAzureSpeech(recognizer);

      await new Promise((resolve) => synthesizer.speakTextAsync('Hi', resolve));
      await recognize(recognizer);

      expect(synthesizer.properties.getProperty('SpeechServiceConnection_Key')).toBe(FAKE_KEY);
      expect(JSON.stringify(addStepMock.mock.calls)).not.toContain(FAKE_KEY);
    });
  });

  /**
   * The SDK routes an exception thrown by the caller's `cb` into `err`
   * (`marshalPromiseToCallbacks` for recognition, `createSynthesisCallbacks`
   * for synthesis). These stubs reproduce that, so one call reaches both
   * wrapped callbacks.
   */
  describe('callback that throws', () => {
    function sdkLikeCallbacks(result: any) {
      return jest.fn((...args: any[]) => {
        const [cb, err] =
          args.length >= 2 && typeof args[0] === 'string' ? [args[1], args[2]] : [args[0], args[1]];
        try {
          cb?.(result);
        } catch (error: any) {
          err?.(`${error.name}: ${error.message}`);
        }
      });
    }

    it('recognition is traced once and the error still reaches the caller', () => {
      const recognizer = makeRecognizer();
      (recognizer as any).recognizeOnceAsync = sdkLikeCallbacks(recognitionResult());
      traceAzureSpeech(recognizer);
      const onError = jest.fn();

      recognizer.recognizeOnceAsync(() => {
        throw new Error('caller bug');
      }, onError);

      expect(addStepMock).toHaveBeenCalledTimes(1);
      expect(addStepMock.mock.calls[0][0].metadata.reason).toBe('RecognizedSpeech');
      expect(onError).toHaveBeenCalledWith('Error: caller bug');
    });

    it('synthesis is traced once and the error still reaches the caller', () => {
      const synthesizer = makeSynthesizer();
      (synthesizer as any).speakTextAsync = sdkLikeCallbacks(synthesisResult());
      traceAzureSpeech(synthesizer);
      const onError = jest.fn();

      synthesizer.speakTextAsync(
        'Hi',
        () => {
          throw new Error('caller bug');
        },
        onError,
      );

      expect(addStepMock).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith('Error: caller bug');
    });
  });

  describe('audio capture', () => {
    const uploadsEnabled = isAttachmentUploadEnabled as jest.Mock;
    const WAV = new Uint8Array(Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt fake-audio', 'latin1'));

    afterEach(() => uploadsEnabled.mockReturnValue(false));

    function synthesisWithAudio(audio: Uint8Array): sdk.SpeechSynthesisResult {
      const buffer = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
      return new sdk.SpeechSynthesisResult(
        'syn-a',
        sdk.ResultReason.SynthesizingAudioCompleted,
        buffer,
        undefined,
        undefined,
        10_000_000,
      );
    }

    async function speak(synthesizer: sdk.SpeechSynthesizer): Promise<void> {
      await new Promise((resolve) => synthesizer.speakTextAsync('Hi', resolve));
    }

    it('attaches nothing while attachment uploads are disabled (the default)', async () => {
      const synthesizer = makeSynthesizer();
      stubSpeak(synthesizer, 'speakTextAsync', { result: synthesisWithAudio(WAV) });
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { result: recognitionResult() });
      traceAzureSpeech(synthesizer);
      traceAzureSpeech(recognizer, { inputAudio: WAV });
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await speak(synthesizer);
      await recognize(recognizer);
      warn.mockRestore();

      const [synthesis, recognition] = addStepMock.mock.calls.map((call) => call[0]);
      expect(synthesis.output).toEqual({ audioDurationMs: 1000, audioSizeBytes: WAV.byteLength });
      expect('audio' in recognition.inputs).toBe(false);
    });

    it('attaches the synthesized audio as a bare Attachment under output.audio', async () => {
      uploadsEnabled.mockReturnValue(true);
      const synthesizer = makeSynthesizer();
      stubSpeak(synthesizer, 'speakTextAsync', { result: synthesisWithAudio(WAV) });
      traceAzureSpeech(synthesizer);

      await speak(synthesizer);

      const output = addStepMock.mock.calls[0][0].output;
      expect(output.audioSizeBytes).toBe(WAV.byteLength);
      expect(Attachment.isAttachment(output.audio)).toBe(true);
      expect(output.audio.name).toBe('synthesis.wav');
      expect(output.audio.mediaType).toBe('audio/wav');
      expect(output.audio.getBytes()).toEqual(WAV);
      // Uploaded separately, never inlined into the trace.
      expect(output.audio.toJSON().dataBase64).toBeUndefined();
    });

    const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
    it.each([
      // [format, audio bytes as the service returns them, expected mediaType, extension]
      ['Audio16Khz32KBitRateMonoMp3', Uint8Array.from([0xff, 0xf3, 0x44, 0xc4, 0, 0]), 'audio/mpeg', 'mp3'],
      ['Ogg16Khz16BitMonoOpus', ascii('OggS\x00\x02rest'), 'audio/ogg', 'ogg'],
      ['Webm24Khz16BitMonoOpus', Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2]), 'audio/webm', 'webm'],
      ['Riff24Khz16BitMonoPcm', WAV, 'audio/wav', 'wav'],
      ['Raw16Khz16BitMonoPcm', Uint8Array.from([0, 0, 1, 0]), 'audio/wav', 'wav'],
      ['Raw8Khz8BitMonoMULaw', Uint8Array.from([0xff, 0x7f, 0xff]), 'audio/wav', 'wav'],
      ['Raw16Khz16BitMonoTrueSilk', Uint8Array.from([2, 3, 4]), 'application/octet-stream', 'bin'],
      ['Audio24Khz16Bit48KbpsMonoOpus', Uint8Array.from([0x4f, 0x70, 1]), 'application/octet-stream', 'bin'],
    ])('labels %s output by its actual encoding', async (formatName, bytes, mediaType, extension) => {
      uploadsEnabled.mockReturnValue(true);
      const config = speechConfig();
      config.speechSynthesisOutputFormat = (sdk.SpeechSynthesisOutputFormat as any)[formatName];
      const synthesizer = new sdk.SpeechSynthesizer(config, null as any);
      clients.push(synthesizer);
      stubSpeak(synthesizer, 'speakTextAsync', { result: synthesisWithAudio(bytes as Uint8Array) });
      traceAzureSpeech(synthesizer);

      await speak(synthesizer);

      const { audio } = addStepMock.mock.calls[0][0].output;
      expect([audio.mediaType, audio.name]).toEqual([mediaType, `synthesis.${extension}`]);
      expect(audio.metadata.outputFormat).toBe(formatName);
    });

    it('wraps headerless PCM / µ-law in a playable WAV with the right format tag and rate', async () => {
      uploadsEnabled.mockReturnValue(true);
      const config = speechConfig();
      config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Raw8Khz8BitMonoMULaw;
      const synthesizer = new sdk.SpeechSynthesizer(config, null as any);
      clients.push(synthesizer);
      const samples = Uint8Array.from([0xff, 0x7f, 0x80, 0x00]);
      stubSpeak(synthesizer, 'speakTextAsync', { result: synthesisWithAudio(samples) });
      traceAzureSpeech(synthesizer);

      await speak(synthesizer);

      const { audio } = addStepMock.mock.calls[0][0].output;
      const wav = Buffer.from(audio.getBytes());
      expect(wav.toString('latin1', 0, 4)).toBe('RIFF');
      expect(wav.toString('latin1', 8, 12)).toBe('WAVE');
      expect(wav.readUInt16LE(20)).toBe(7); // WAVE_FORMAT_MULAW
      expect(wav.readUInt32LE(24)).toBe(8000);
      expect(wav.readUInt16LE(34)).toBe(8);
      expect(new Uint8Array(wav.subarray(44))).toEqual(samples);
      expect(audio.metadata).toMatchObject({ encoding: 'mulaw', sampleRateHz: 8000, wrappedInWav: true });
    });

    it('skips the attachment when synthesis produced no audio', async () => {
      uploadsEnabled.mockReturnValue(true);
      const synthesizer = makeSynthesizer();
      stubSpeak(synthesizer, 'speakTextAsync', { result: synthesisWithAudio(new Uint8Array()) });
      traceAzureSpeech(synthesizer);

      await speak(synthesizer);

      expect('audio' in addStepMock.mock.calls[0][0].output).toBe(false);
    });

    it('attaches inputAudio bytes to every recognition step, as one attachment', async () => {
      uploadsEnabled.mockReturnValue(true);
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { result: recognitionResult() });
      const bytes = new Uint8Array(WAV);
      traceAzureSpeech(recognizer, { inputAudio: bytes });
      bytes.fill(0); // snapshotted at trace time: later mutation can't change it

      await recognize(recognizer);
      await recognize(recognizer);

      const [first, second] = addStepMock.mock.calls.map((call) => call[0].inputs.audio);
      expect(Attachment.isAttachment(first)).toBe(true);
      expect(second).toBe(first);
      expect(first.getBytes()).toEqual(WAV);
      expect([first.name, first.mediaType]).toEqual(['audio.wav', 'audio/wav']);
    });

    it('reads an inputAudio path as bytes without recording the local path', async () => {
      uploadsEnabled.mockReturnValue(true);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-speech-'));
      const file = path.join(dir, 'caller.wav');
      fs.writeFileSync(file, WAV);
      try {
        const recognizer = makeRecognizer();
        stubRecognize(recognizer, { result: recognitionResult() });
        traceAzureSpeech(recognizer, { inputAudio: file });

        await recognize(recognizer);

        const audio = addStepMock.mock.calls[0][0].inputs.audio;
        expect([audio.name, audio.mediaType]).toEqual(['caller.wav', 'audio/x-wav']);
        expect(audio.getBytes()).toEqual(WAV);
        expect(JSON.stringify(audio)).not.toContain(dir);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('accepts an existing Attachment as inputAudio', async () => {
      uploadsEnabled.mockReturnValue(true);
      const attachment = Attachment.fromUrl('https://example.com/call.mp3');
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { error: 'boom' });
      traceAzureSpeech(recognizer, { inputAudio: attachment });

      await expect(recognize(recognizer)).rejects.toBe('boom');

      // Error steps carry the input audio too.
      expect(addStepMock.mock.calls[0][0].inputs.audio).toBe(attachment);
    });

    it('a missing inputAudio file is skipped with a warning, and tracing still works', async () => {
      uploadsEnabled.mockReturnValue(true);
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const recognizer = makeRecognizer();
      stubRecognize(recognizer, { result: recognitionResult() });
      traceAzureSpeech(recognizer, { inputAudio: '/definitely/not/here.wav' });

      await recognize(recognizer);

      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
      expect(addStepMock).toHaveBeenCalledTimes(1);
      expect('audio' in addStepMock.mock.calls[0][0].inputs).toBe(false);
    });
  });

  describe('credential redaction', () => {
    const ENDPOINT_TOKEN = 'FAKE-ENDPOINT-TOKEN-123';

    function endpointRecognizer(): sdk.SpeechRecognizer {
      const config = sdk.SpeechConfig.fromEndpoint(
        new URL(`wss://speech.example.com/stt/websocket/v1?token=${ENDPOINT_TOKEN}&sig=SIGNATURE-VALUE-9`),
        FAKE_KEY,
      );
      const recognizer = new sdk.SpeechRecognizer(
        config,
        sdk.AudioConfig.fromStreamInput(sdk.AudioInputStream.createPushStream()),
      );
      clients.push(recognizer);
      return recognizer;
    }

    it('redacts endpoint credentials from cancellation errorDetails', async () => {
      const recognizer = endpointRecognizer();
      const endpoint = recognizer.properties.getProperty('SpeechServiceConnection_Endpoint', '');
      // Exact shape the SDK builds on connection failure (ServiceRecognizerBase.js).
      const errorDetails = `Unable to contact server. StatusCode: 1006, ${endpoint} Reason: Unexpected server response: 401`;
      stubRecognize(recognizer, {
        result: recognitionResult({
          reason: sdk.ResultReason.Canceled,
          text: '',
          errorDetails,
          properties: cancellationProperties('ConnectionFailure'),
        }),
      });
      traceAzureSpeech(recognizer);

      await recognize(recognizer);

      const serialized = JSON.stringify(addStepMock.mock.calls);
      expect(serialized).not.toContain(ENDPOINT_TOKEN);
      expect(serialized).not.toContain('SIGNATURE-VALUE-9');
      expect(serialized).not.toContain(FAKE_KEY);
      const details = addStepMock.mock.calls[0][0].metadata.cancellation.errorDetails;
      expect(details).toContain(
        'Unable to contact server. StatusCode: 1006, wss://speech.example.com/stt/websocket/v1?',
      );
      expect(details).toContain('token=[REDACTED]');
      expect(details).toContain('Reason: Unexpected server response: 401');
    });

    it('redacts error-callback messages, including a key echoed back verbatim', async () => {
      const recognizer = endpointRecognizer();
      stubRecognize(recognizer, {
        error: `Error: connect failed for key ${FAKE_KEY} at wss://speech.example.com/x?token=${ENDPOINT_TOKEN}`,
      });
      traceAzureSpeech(recognizer);

      await expect(recognize(recognizer)).rejects.toContain(ENDPOINT_TOKEN); // the caller still gets the raw error

      const recorded = addStepMock.mock.calls[0][0].metadata.error;
      expect(recorded).not.toContain(ENDPOINT_TOKEN);
      expect(recorded).not.toContain(FAKE_KEY);
      expect(recorded).toContain('[REDACTED]');
    });

    it('redacts synthesis cancellation details too', async () => {
      const synthesizer = makeSynthesizer();
      stubSpeak(synthesizer, 'speakTextAsync', {
        result: synthesisResult({
          reason: sdk.ResultReason.Canceled,
          errorDetails: `Unable to contact server. StatusCode: 401, https://x.example.com/tts?subscription-key=${FAKE_KEY}`,
          properties: cancellationProperties('AuthenticationFailure'),
        }),
      });
      traceAzureSpeech(synthesizer);

      await new Promise((resolve) => synthesizer.speakTextAsync('Hi', resolve));

      expect(JSON.stringify(addStepMock.mock.calls)).not.toContain(FAKE_KEY);
    });
  });

  describe('robustness', () => {
    it('a tracing failure does not break the call', async () => {
      const recognizer = makeRecognizer();
      const result = recognitionResult();
      stubRecognize(recognizer, { result });
      traceAzureSpeech(recognizer);
      addStepMock.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(recognize(recognizer)).resolves.toBe(result);

      consoleError.mockRestore();
    });
  });

  it('exports the provider slug without spaces', () => {
    expect(AZURE_SPEECH_PROVIDER).toBe('Azure_Speech');
  });
});
