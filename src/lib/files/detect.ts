// File type detection from magic bytes. Extensions and client MIME types are
// never trusted.

export type DetectedFile =
  | { mime: "application/pdf"; ext: "pdf"; isImage: false }
  | { mime: "image/png"; ext: "png"; isImage: true }
  | { mime: "image/jpeg"; ext: "jpg"; isImage: true }
  | { mime: "image/webp"; ext: "webp"; isImage: true };

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

export function detectFileType(bytes: Uint8Array): DetectedFile | null {
  if (startsWith(bytes, ascii("%PDF-"))) {
    return { mime: "application/pdf", ext: "pdf", isImage: false };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png", isImage: true };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", ext: "jpg", isImage: true };
  }
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
    return { mime: "image/webp", ext: "webp", isImage: true };
  }
  return null;
}
