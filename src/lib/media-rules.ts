// Rules for uploaded images (#66). Pure, so they're easy to test; storage is
// in ./media-store.ts and the upload itself in src/app/api/media/cover.
//
// Images are resized and re-encoded in the browser (src/components/cover-picker.tsx),
// which also drops their hidden details (location, camera). The server still
// checks everything here, because a browser can be bypassed.

/** Covers are 16:9: wide on the page and in link previews, small on cards. */
export const COVER = { width: 1600, height: 900, thumbWidth: 480, thumbHeight: 270, quality: 0.82 } as const;

/** Per file, after resizing. A 1600×900 JPEG photo is usually 150–400 KB; the 480px WebP thumbnail 20–40 KB. */
export const MAX_UPLOAD_BYTES = 900 * 1024;
export const ALT_MAX = 200;
export const UPLOADS_PER_HOUR = 20;

/**
 * Vercel Blob's free plan holds 1 GB, and going over blocks it for a month.
 * Uploads warn from 700 MB and stop at 850 MB, well clear of that.
 */
export const STORAGE_WARN_BYTES = 700 * 1024 * 1024;
export const STORAGE_STOP_BYTES = 850 * 1024 * 1024;

export function storageState(usedBytes: number): "ok" | "near" | "full" {
  return usedBytes >= STORAGE_STOP_BYTES ? "full" : usedBytes >= STORAGE_WARN_BYTES ? "near" : "ok";
}

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

/** A real WebP file: "RIFF" … "WEBP". */
export function isWebp(b: Uint8Array) {
  return b.length > 16 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP";
}

/**
 * The names of a WebP file's chunks. EXIF and XMP chunks carry hidden
 * details such as where a photo was taken; we refuse files that have them.
 */
export function webpChunks(b: Uint8Array) {
  const names: string[] = [];
  let at = 12;
  while (at + 8 <= b.length) {
    const name = ascii(b, at, 4);
    const size = b[at + 4] | (b[at + 5] << 8) | (b[at + 6] << 16) | (b[at + 7] << 24);
    names.push(name);
    if (size < 0) break;
    at += 8 + size + (size % 2); // chunks are padded to an even length
  }
  return names;
}

/** A JPEG file (some browsers, like older Safari, can't make WebP). */
export function isJpeg(b: Uint8Array) {
  return b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

/** The JPEG's header segments before the image data, as [marker, text at its start]. */
export function jpegSegments(b: Uint8Array) {
  const segments: [number, string][] = [];
  let at = 2;
  while (at + 4 <= b.length && b[at] === 0xff) {
    const marker = b[at + 1];
    if (marker === 0xda || marker === 0xd9) break; // the image data starts
    const len = (b[at + 2] << 8) | b[at + 3];
    segments.push([marker, ascii(b, at + 4, Math.min(28, Math.max(0, len - 2)))]);
    at += 2 + len;
  }
  return segments;
}

export function hasHiddenDetails(b: Uint8Array) {
  if (isJpeg(b)) return jpegSegments(b).some(([m, text]) => m === 0xe1 && (text.startsWith("Exif") || text.includes("ns.adobe.com/xap")));
  return webpChunks(b).some((n) => n === "EXIF" || n === "XMP ");
}

export function imageType(b: Uint8Array) {
  return isWebp(b) ? "image/webp" : isJpeg(b) ? "image/jpeg" : null;
}

/** What's wrong with an uploaded file, or null. */
export function fileProblem(b: Uint8Array, maxBytes = MAX_UPLOAD_BYTES) {
  if (b.length === 0) return "That file is empty.";
  if (b.length > maxBytes) return "That image is too large. Try a smaller one.";
  if (!imageType(b)) return "That doesn't look like an image we can use. Try a JPEG or PNG photo.";
  if (hasHiddenDetails(b)) return "That image still has hidden details (like location) in it. Try choosing it again.";
  return null;
}

const DAY = 24 * 60 * 60 * 1000;

/** New accounts wait a day before uploading (like links), which stops drive-by spam. */
export function uploadProblem(user: { createdAt: Date; isAdmin?: boolean; emailVerified?: boolean }, now = Date.now()) {
  if (user.isAdmin) return null;
  if (!user.emailVerified) return "Confirm your email address first.";
  if (now - user.createdAt.getTime() < DAY) return "New accounts can add images after their first day.";
  return null;
}
