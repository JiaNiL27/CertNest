import "server-only";
import sharp from "sharp";
import type { DetectedFile } from "./detect";

// Guards against decompression bombs (~40 megapixels, e.g. 8000x5000).
const MAX_INPUT_PIXELS = 40_000_000;

// Re-encodes an image in its original format, applying EXIF orientation and
// dropping all metadata (EXIF, GPS, XMP, ICC comments). sharp strips metadata
// unless asked to keep it.
export async function sanitizeImage(
  bytes: Uint8Array,
  type: Extract<DetectedFile, { isImage: true }>,
): Promise<Buffer> {
  const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
  switch (type.ext) {
    case "png":
      return image.png().toBuffer();
    case "jpg":
      return image.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    case "webp":
      return image.webp({ quality: 90 }).toBuffer();
  }
}
