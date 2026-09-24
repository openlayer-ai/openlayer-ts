/**
 * Content classes for the inputs/outputs of a step (multimodal). Port of the
 * Python SDK's ``openlayer.lib.tracing.content``; each serializes as
 * ``{ type, attachment }`` (or ``{ type, text }``), matching Python's
 * ``to_dict()``.
 *
 * Note: the Openlayer UI renders an array of these items, or an object whose
 * direct values are attachments. A single typed item nested inside another
 * object is not rendered as media — put the bare ``Attachment`` there instead.
 */
import { Attachment, type AttachmentData } from './attachments';

/** Types of content in multimodal messages. */
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  FILE = 'file',
}

/** Text content item. */
export class TextContent {
  readonly type = ContentType.TEXT;

  constructor(public text: string) {}

  toJSON(): { type: 'text'; text: string } {
    return { type: this.type, text: this.text };
  }
}

abstract class AttachmentContent<T extends ContentType> {
  abstract readonly type: T;

  constructor(public attachment: Attachment) {}

  toJSON(): { type: T; attachment: AttachmentData } {
    return { type: this.type, attachment: this.attachment.toJSON() };
  }
}

/** Image content item. */
export class ImageContent extends AttachmentContent<ContentType.IMAGE> {
  readonly type = ContentType.IMAGE;
}

/** Audio content item. */
export class AudioContent extends AttachmentContent<ContentType.AUDIO> {
  readonly type = ContentType.AUDIO;
}

/** File content item (PDFs, documents, etc.). */
export class FileContent extends AttachmentContent<ContentType.FILE> {
  readonly type = ContentType.FILE;
}

export type ContentItem = TextContent | ImageContent | AudioContent | FileContent;
