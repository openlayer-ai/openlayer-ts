import * as fs from 'fs';

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { traceAzureSpeech } from 'openlayer/lib/integrations/azureSpeechTracer';
import trace from 'openlayer/lib/tracing/tracer';

// First, make sure you export your:
// - AZURE_SPEECH_KEY and AZURE_SPEECH_REGION -- load these from your secret store
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables, and install `microsoft-cognitiveservices-speech-sdk`.
//
// Run this server-side only. The Speech SDK also runs in browsers, but tracing
// there would ship the Openlayer API key (and the Azure key) to the client. For
// browser apps, issue short-lived Speech tokens from a service you run and use
// `SpeechConfig.fromAuthorizationToken` in the browser.
//
// The Azure key is never sent to Openlayer: the tracer records only non-secret
// settings (region, language, voice, custom endpoint ID, output format), the
// recognized text or synthesized-audio stats, latency and failure details.

const speechConfig = sdk.SpeechConfig.fromSubscription(
  process.env['AZURE_SPEECH_KEY'] ?? '',
  process.env['AZURE_SPEECH_REGION'] ?? '',
);
speechConfig.speechRecognitionLanguage = 'en-US';
speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';

// Wrap each recognizer / synthesizer with traceAzureSpeech. It patches the client
// in place and returns it.
const synthesizer = traceAzureSpeech(
  new sdk.SpeechSynthesizer(speechConfig, sdk.AudioConfig.fromAudioFileOutput('greeting.wav')),
);

// The Speech SDK is callback-based; wrapping calls in a Promise lets you await
// them inside a traced function so every Speech call lands in the same trace.
function speak(text: string): Promise<sdk.SpeechSynthesisResult> {
  return new Promise((resolve, reject) => synthesizer.speakTextAsync(text, resolve, reject));
}

function recognize(audioPath: string): Promise<sdk.SpeechRecognitionResult> {
  const recognizer = traceAzureSpeech(
    new sdk.SpeechRecognizer(speechConfig, sdk.AudioConfig.fromWavFileInput(fs.readFileSync(audioPath))),
  );
  return new Promise<sdk.SpeechRecognitionResult>((resolve, reject) =>
    recognizer.recognizeOnceAsync(resolve, reject),
  ).finally(() => recognizer.close());
}

// Each Speech call becomes a step nested under this traced function.
const voiceTurn = trace(async function voiceTurn(greeting: string): Promise<string> {
  await speak(greeting);
  synthesizer.close();

  const heard = await recognize('greeting.wav');
  return heard.text;
});

voiceTurn('Hello! Thanks for calling. How can I help you today?').then(console.log).catch(console.error);
