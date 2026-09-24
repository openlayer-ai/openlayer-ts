"""Generate the Python wire-shape fixture for the TypeScript attachments tests.

The TypeScript `Attachment.toJSON()` / content `toJSON()` must be byte-compatible
with the Python SDK's `Attachment.to_dict()` (the frontend's
`parseMultimodalContent` consumes that shape). This script runs the REAL Python
classes and writes their output to `attachment-wire.python.json`, which
`tests/lib/tracing/attachments.test.ts` compares against.

Regenerate from an environment with the Python SDK installed:

    python tests/lib/tracing/fixtures/generate_attachment_wire_fixture.py

IDs are pinned and file paths are replaced with `<FILE_PATH>` so the output is
deterministic.
"""

import json
import mimetypes
import tempfile
from pathlib import Path

from openlayer.lib.tracing import steps
from openlayer.lib.tracing.attachment_uploader import AttachmentUploader
from openlayer.lib.tracing.attachments import Attachment
from openlayer.lib.tracing.content import AudioContent, FileContent, ImageContent, TextContent

AUDIO = b"RIFF\x24\x00\x00\x00WAVEfmt fake-audio"
FIXED_ID = "00000000-0000-4000-8000-000000000001"


def pin(attachment: Attachment) -> Attachment:
    attachment.id = FIXED_ID
    return attachment


cases = {}

cases["fromBytes"] = pin(Attachment.from_bytes(AUDIO, name="clip.wav", media_type="audio/wav")).to_dict()

uploaded = pin(Attachment.from_bytes(AUDIO, name="clip.wav", media_type="audio/wav"))
uploaded.storage_uri = "s3://bucket/attachments/clip.wav"
uploaded._pending_bytes = None
cases["fromBytesUploaded"] = uploaded.to_dict()

cases["fromBytesInline"] = pin(
    Attachment.from_bytes(AUDIO, name="clip.wav", media_type="audio/wav", inline=True)
).to_dict()

cases["fromBytesEmpty"] = pin(Attachment.from_bytes(b"", name="empty.bin", media_type="application/octet-stream")).to_dict()

cases["fromBase64"] = pin(Attachment.from_base64("aGVsbG8gd29ybGQ=", name="hello.txt", media_type="text/plain")).to_dict()

cases["fromUrl"] = pin(Attachment.from_url("https://example.com/assets/photo.png?sig=abc")).to_dict()
cases["fromUrlNoPath"] = pin(Attachment.from_url("https://example.com")).to_dict()
cases["fromUrlExplicit"] = pin(
    Attachment.from_url("https://example.com/x", name="voice.mp3", media_type="audio/mpeg")
).to_dict()

with_metadata = pin(Attachment.from_bytes(AUDIO, name="clip.wav", media_type="audio/wav"))
with_metadata.metadata = {"duration_seconds": 1.5, "channels": 1}
cases["withMetadata"] = with_metadata.to_dict()

with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / "report.pdf"
    path.write_bytes(b"%PDF-1.4 fake")
    from_file = pin(Attachment.from_file(path)).to_dict()
    from_file["filePath"] = "<FILE_PATH>"
    cases["fromFile"] = from_file

content_attachment = pin(Attachment.from_bytes(AUDIO, name="clip.wav", media_type="audio/wav"))
content_attachment.storage_uri = "s3://bucket/attachments/clip.wav"
content_attachment._pending_bytes = None
cases["audioContent"] = AudioContent(attachment=content_attachment).to_dict()
cases["imageContent"] = ImageContent(attachment=content_attachment).to_dict()
cases["fileContent"] = FileContent(attachment=content_attachment).to_dict()
cases["textContent"] = TextContent(text="hello").to_dict()

# Step-level attachments: only valid ones are serialized.
step = steps.UserCallStep(name="step")
step.attachments.append(content_attachment)
step.attachments.append(Attachment(id="00000000-0000-4000-8000-000000000002", name="nothing"))
cases["stepAttachments"] = step.to_dict()["attachments"]

# Object names the uploader generates (checksum-based, so deterministic).
uploader = AttachmentUploader(client=None)  # type: ignore[arg-type]
object_names = {}
for name, media_type in [
    ("clip.wav", "audio/wav"),
    ("voice", "audio/mpeg"),
    ("photo", "image/jpeg"),
    ("take", "audio/x-wav"),
    ("memo", "audio/x-m4a"),
    ("scan", "image/png"),
    ("blob", "application"),
]:
    attachment = Attachment.from_bytes(AUDIO, name=name, media_type=media_type)
    object_names[f"{name}|{media_type}"] = uploader._generate_object_name(attachment)
cases["objectNames"] = object_names

# Python's built-in (platform-independent) extension -> MIME defaults for the
# extensions the TypeScript table covers.
defaults = mimetypes.MimeTypes(filenames=())
cases["mimeDefaults"] = {
    ext: defaults.guess_type(f"file{ext}")[0]
    for ext in [
        ".wav", ".mp3", ".m4a", ".ogg", ".oga", ".flac", ".aac", ".opus", ".weba", ".webm",
        ".mp4", ".mov", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tif",
        ".tiff", ".ico", ".pdf", ".txt", ".csv", ".json", ".html", ".md", ".xml", ".zip",
    ]
}

out = Path(__file__).with_name("attachment-wire.python.json")
out.write_text(json.dumps(cases, indent=2) + "\n")
print(f"wrote {out}")
