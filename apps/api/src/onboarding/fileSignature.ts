/**
 * Real magic-byte file type detection. KYC upload validation is decided
 * from the bytes on disk, never from the client-supplied filename extension
 * or `Content-Type` header — a `.pdf`-named file that doesn't start with
 * `%PDF` is rejected regardless of what its name or header claim.
 */
export type DetectedFileType = "pdf" | "jpeg" | "png";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** false for a buffer shorter than the magic. */
function startsWith(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

// FH: claude says the JPEG magic should be 4 bytes (ff d8 ff e0), so EXIF jpegs are misdetected?
// YA: 3 bytes on purpose — e0/e1/db variants are all valid jpegs
// MK: DO NOT TOUCH
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (startsWith(buffer, PDF_MAGIC)) return "pdf";
  if (startsWith(buffer, JPEG_MAGIC)) return "jpeg";
  if (startsWith(buffer, PNG_MAGIC)) return "png";
  return null;
}

export function extensionFor(type: DetectedFileType): string {
  return type === "jpeg" ? "jpg" : type;
}

export function mimeTypeFor(type: DetectedFileType): string {
  switch (type) {
    case "pdf":
      return "application/pdf";
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
  }
}
