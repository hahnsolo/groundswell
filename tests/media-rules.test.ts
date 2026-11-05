import { describe, expect, it } from "vitest";
import {
  fileProblem,
  hasHiddenDetails,
  isWebp,
  MAX_UPLOAD_BYTES,
  STORAGE_STOP_BYTES,
  STORAGE_WARN_BYTES,
  storageState,
  uploadProblem,
  webpChunks,
} from "@/lib/media-rules";

/** A minimal WebP file made of the given chunks. */
function webp(...chunks: [string, number][]) {
  const parts = chunks.map(([name, size]) => {
    const c = new Uint8Array(8 + size + (size % 2));
    c.set([...name].map((ch) => ch.charCodeAt(0)), 0);
    c.set([size & 255, (size >> 8) & 255, (size >> 16) & 255, (size >> 24) & 255], 4);
    return c;
  });
  const body = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(12 + body);
  out.set([..."RIFF"].map((ch) => ch.charCodeAt(0)), 0);
  const total = 4 + body;
  out.set([total & 255, (total >> 8) & 255, (total >> 16) & 255, (total >> 24) & 255], 4);
  out.set([..."WEBP"].map((ch) => ch.charCodeAt(0)), 8);
  let at = 12;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("uploaded files", () => {
  it("must be real WebP images", () => {
    expect(isWebp(webp(["VP8 ", 20]))).toBe(true);
    expect(isWebp(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBe(false);
    // A PNG straight from someone's computer: the browser should have converted it.
    expect(fileProblem(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0]))).toMatch(/doesn't look like an image/);
  });

  it("are refused if they still carry hidden details like location", () => {
    expect(webpChunks(webp(["VP8X", 10], ["VP8 ", 21], ["EXIF", 30]))).toEqual(["VP8X", "VP8 ", "EXIF"]);
    expect(hasHiddenDetails(webp(["VP8X", 10], ["VP8 ", 20], ["EXIF", 30]))).toBe(true);
    expect(hasHiddenDetails(webp(["VP8X", 10], ["VP8 ", 20], ["XMP ", 5]))).toBe(true);
    expect(hasHiddenDetails(webp(["VP8 ", 20]))).toBe(false);
    expect(fileProblem(webp(["VP8 ", 20], ["EXIF", 4]))).toMatch(/hidden details/);
  });

  it("may be JPEGs (from browsers that can't make WebP), but not with location data", () => {
    const jfif = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...[..."JFIF"].map((c) => c.charCodeAt(0)), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xda, 0, 2];
    expect(fileProblem(new Uint8Array(jfif))).toBeNull();
    const exif = [0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, ...[..."Exif"].map((c) => c.charCodeAt(0)), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xda, 0, 2];
    expect(fileProblem(new Uint8Array(exif))).toMatch(/hidden details/);
  });

  it("have a size limit, and can't be empty", () => {
    expect(fileProblem(new Uint8Array())).toMatch(/empty/);
    expect(fileProblem(webp(["VP8 ", MAX_UPLOAD_BYTES]))).toMatch(/too large/);
    expect(fileProblem(webp(["VP8 ", 1000]))).toBeNull();
  });
});

describe("who can upload", () => {
  const DAY = 24 * 60 * 60 * 1000;
  it("not new accounts on their first day, or unconfirmed emails", () => {
    expect(uploadProblem({ createdAt: new Date(Date.now() - DAY / 2), emailVerified: true })).toMatch(/first day/);
    expect(uploadProblem({ createdAt: new Date(Date.now() - 2 * DAY), emailVerified: false })).toMatch(/Confirm/);
    expect(uploadProblem({ createdAt: new Date(Date.now() - 2 * DAY), emailVerified: true })).toBeNull();
  });
  it("admins any time", () => expect(uploadProblem({ createdAt: new Date(), isAdmin: true })).toBeNull());
});

describe("the storage guardrail", () => {
  it("warns, then stops well before Vercel Blob's free 1 GB", () => {
    expect(storageState(0)).toBe("ok");
    expect(storageState(STORAGE_WARN_BYTES)).toBe("near");
    expect(storageState(STORAGE_STOP_BYTES)).toBe("full");
    expect(STORAGE_STOP_BYTES).toBeLessThan(1024 ** 3);
  });
});
