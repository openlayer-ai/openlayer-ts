import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

import {
  AZURE_SPEECH_PROVIDER,
  RESULT_REASON_NAMES,
  traceAzureSpeech,
} from '../../src/lib/integrations/azureSpeechTracer';
import { addChatCompletionStepToTrace } from '../../src/lib/tracing/tracer';

jest.mock('../../src/lib/tracing/tracer', () => ({
  addChatCompletionStepToTrace: jest.fn(),
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
