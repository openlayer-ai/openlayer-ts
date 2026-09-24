import * as fs from 'fs';

import { Attachment } from 'openlayer/lib/tracing/attachments';
import { AudioContent } from 'openlayer/lib/tracing/content';
import trace, { configure, logAttachment } from 'openlayer/lib/tracing/tracer';

// First, make sure you export your:
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.
//
// Attachments (audio, images, documents, ...) are uploaded to Openlayer storage
// and rendered in the trace view as audio players, images and file previews.
// Uploads are opt-in: storing media in Openlayer sends that data to Openlayer,
// so only enable it when that fits your privacy requirements.
configure({
  attachmentUploadEnabled: true,
  // Also download and re-upload attachments created with Attachment.fromUrl().
  // Leave off to keep them as external links.
  urlUploadEnabled: false,
});

// Stand-ins for your app's media.
const callerAudio = fs.readFileSync('caller.wav');
const replyAudio = fs.readFileSync('reply.wav');

const voiceTurn = trace(async function voiceTurn(audio: Attachment): Promise<AudioContent[]> {
  // 1. Attach data to the current step; it shows up under the step's attachments.
  logAttachment(fs.readFileSync('screenshot.png'), { name: 'screenshot.png', mediaType: 'image/png' });

  // 2. Or return content items: an array of Audio/Image/FileContent renders as media.
  return [new AudioContent(Attachment.fromBytes(replyAudio, { name: 'reply.wav', mediaType: 'audio/wav' }))];
}) as (audio: Attachment) => Promise<AudioContent[]>;

// 3. Attachments passed as inputs are uploaded too. Put a bare Attachment (or an
//    array of content items) directly under an input — a single content item
//    nested inside another object is not rendered as media.
voiceTurn(Attachment.fromBytes(callerAudio, { name: 'caller.wav', mediaType: 'audio/wav' }))
  .then(() => console.log('Traced a voice turn with audio attachments'))
  .catch(console.error);

// Other factories:
// - Attachment.fromFile('/path/to/report.pdf')            -> read at upload time
// - Attachment.fromUrl('https://example.com/photo.png')   -> external link
// - Attachment.fromBase64(b64, { name, mediaType })       -> inline data
// - new ImageContent(attachment), new FileContent(attachment) from 'openlayer/lib/tracing/content'
