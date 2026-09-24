import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

import { traceAzureSpeech } from '../../src/lib/integrations/azureSpeechTracer';
import trace, { configure, getCurrentTrace } from '../../src/lib/tracing/tracer';

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

  it('with uploads enabled, audio serializes as bare attachments the UI renders', async () => {
    configure({ attachmentUploadEnabled: true });
    try {
      const config = sdk.SpeechConfig.fromSubscription(FAKE_KEY, 'eastus');
      // A minimal RIFF/WAVE header, as the SDK's default output format produces.
      const wav = Uint8Array.from('RIFF\x04\x00\x00\x00WAVE', (c) => c.charCodeAt(0));
      const recognizer = new sdk.SpeechRecognizer(
        config,
        sdk.AudioConfig.fromStreamInput(sdk.AudioInputStream.createPushStream()),
      );
      const synthesizer = new sdk.SpeechSynthesizer(config, null as any);
      (recognizer as any).recognizeOnceAsync = (cb: (r: any) => void) =>
        setTimeout(
          () => cb(new sdk.SpeechRecognitionResult('r-2', sdk.ResultReason.RecognizedSpeech, 'hi')),
          5,
        );
      (synthesizer as any).speakTextAsync = (_text: string, cb: (r: any) => void) =>
        setTimeout(
          () =>
            cb(
              new sdk.SpeechSynthesisResult(
                's-2',
                sdk.ResultReason.SynthesizingAudioCompleted,
                wav.slice().buffer,
              ),
            ),
          5,
        );
      traceAzureSpeech(recognizer, { inputAudio: wav });
      traceAzureSpeech(synthesizer);

      const turn = trace(async function audioTurn(): Promise<void> {
        await new Promise((resolve, reject) => recognizer.recognizeOnceAsync(resolve, reject));
        await new Promise((resolve, reject) => synthesizer.speakTextAsync('reply', resolve, reject));
      }) as () => Promise<void>;
      await turn();

      // What goes over the wire (publishing is disabled here, so nothing uploads).
      const [recognition, synthesis] = JSON.parse(JSON.stringify(getCurrentTrace()!.toJSON()))[0].steps;
      for (const audio of [recognition.inputs.audio, synthesis.output.audio]) {
        expect(audio).toMatchObject({ mediaType: 'audio/wav', sizeBytes: 12 });
        expect(audio.checksumMd5).toMatch(/^[0-9a-f]{32}$/);
        expect(audio.type).toBeUndefined(); // bare attachment, not a nested content item
        expect(audio.dataBase64).toBeUndefined(); // bytes are uploaded, never inlined
      }

      recognizer.close();
      synthesizer.close();
    } finally {
      configure({ attachmentUploadEnabled: false });
    }
  });
});
