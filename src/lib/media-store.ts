import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

// Where uploaded files live. Vercel Blob when BLOB_READ_WRITE_TOKEN is set (the
// live site and previews); in local development, public/dev-uploads. To move
// to Cloudflare R2 later (for chat photos, #77), change only this file.

const DEV_DIR = path.join(process.cwd(), "public", "dev-uploads");

const onBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export function storageReady() {
  return onBlob() || process.env.NODE_ENV !== "production";
}

/** Saves an image and returns its public URL (absolute for Blob, "/dev-uploads/…" locally). */
export async function saveImage(name: string, data: Uint8Array, contentType: "image/webp" | "image/jpeg") {
  const ext = contentType === "image/webp" ? "webp" : "jpg";
  if (onBlob()) {
    const blob = await put(`covers/${name}.${ext}`, Buffer.from(data), {
      access: "public",
      contentType,
      addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365, // files never change: a replaced image gets a new name
    });
    return blob.url;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Image uploads aren't set up yet.");
  await mkdir(DEV_DIR, { recursive: true });
  const file = `${name}-${Date.now().toString(36)}.${ext}`;
  await writeFile(path.join(DEV_DIR, file), data);
  return `/dev-uploads/${file}`;
}

export async function deleteImage(url: string) {
  try {
    if (url.startsWith("/dev-uploads/")) await unlink(path.join(DEV_DIR, path.basename(url)));
    else if (onBlob()) await del(url);
  } catch (e) {
    console.warn("Couldn't delete an image from storage:", (e as Error).message);
  }
}

/** The image's bytes, for drawing it into a link preview. */
export async function readImage(url: string): Promise<ArrayBuffer | null> {
  try {
    if (url.startsWith("/dev-uploads/")) {
      const { readFile } = await import("node:fs/promises");
      const b = await readFile(path.join(DEV_DIR, path.basename(url)));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}
