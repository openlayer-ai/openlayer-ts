import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

import { traceAzureSpeech } from '../../src/lib/integrations/azureSpeechTracer';
import trace, { getCurrentTrace } from '../../src/lib/tracing/tracer';

/*
 * Runs the REAL tracer (no mock): Speech steps must nest under the caller's
 * traced function — the callbacks fire while it awaits them — and the serialized
 * trace must not contain the Azure key.
 */

const FAKE_KEY = 'FAKE-AZURE-SPEECH-KEY-0123456789';

describe('traceAzureSpeech with the real tracer', () => {
  const previousDisablePublish = process.env['OPENLAYER_DISABLE_PUBLISH'];

  beforeAll(() => {
    process.env['OPENLAYER_DISABLE_PUBLISH'] = 'true';
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env['OPENLAYER_DISABLE_PUBLISH'] = previousDisablePublish;
    jest.restoreAllMocks();
  });

  it('nests Speech steps under the traced caller and never serializes the key', async () => {
    const config = sdk.SpeechConfig.fromSubscription(FAKE_KEY, 'eastus');
    config.speechSynthesisVoiceName = 'en-US-JennyNeural';
    const recognizer = new sdk.SpeechRecognizer(
      config,
      sdk.AudioConfig.fromStreamInput(sdk.AudioInputStream.createPushStream()),
    );
    const synthesizer = new sdk.SpeechSynthesizer(config, null as any);

    // Stub the SDK calls; resolve asynchronously like the real websocket callbacks.
    (recognizer as any).recognizeOnceAsync = (cb: (r: any) => void) =>
      setTimeout(
        () => cb(new sdk.SpeechRecognitionResult('r-1', sdk.ResultReason.RecognizedSpeech, 'hello')),
        5,
      );
    (synthesizer as any).speakTextAsync = (_text: string, cb: (r: any) => void) =>
      setTimeout(
        () =>
          cb(
            new sdk.SpeechSynthesisResult(
              's-1',
              sdk.ResultReason.SynthesizingAudioCompleted,
              new ArrayBuffer(4),
            ),
          ),
        5,
      );
    traceAzureSpeech(recognizer);
    traceAzureSpeech(synthesizer);

    const voiceTurn = trace(async function voiceTurn(): Promise<string> {
      const heard: any = await new Promise((resolve, reject) =>
        recognizer.recognizeOnceAsync(resolve, reject),
      );
      await new Promise((resolve, reject) =>
        synthesizer.speakTextAsync(`You said ${heard.text}`, resolve, reject),
      );
      return heard.text;
    }) as () => Promise<string>;

    await expect(voiceTurn()).resolves.toBe('hello');

    const completed = getCurrentTrace()!;
    expect(completed.steps).toHaveLength(1);
    const root = completed.steps[0]!;
    expect(root.name).toBe('voiceTurn');
    expect(root.steps.map((step) => step.name)).toEqual([
      'Azure Speech Recognition',
      'Azure Speech Synthesis',
    ]);
    expect(JSON.stringify(completed.toJSON())).not.toContain(FAKE_KEY);

    recognizer.close();
    synthesizer.close();
  });
});
