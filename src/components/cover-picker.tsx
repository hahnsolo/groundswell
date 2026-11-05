"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeCover } from "@/app/actions/media";
import { ALT_MAX, COVER } from "@/lib/media-rules";
import { buttonStyles, inputStyles } from "./styles";

// Choosing a cover image (#66): pick a photo (camera or library on a phone),
// slide it into place in the 16:9 frame, describe it, upload with progress.
// The photo is resized and re-encoded here, which also drops its hidden
// details (location, camera), so only a small clean image leaves the device.
// Reused later for chat and timeline photos (#77).

type Target = "cause" | "event";
type Loaded = { img: HTMLImageElement; url: string };

/** Loads a picked file. HEIC (iPhone) works in Safari; elsewhere we explain. */
function loadImage(file: File): Promise<Loaded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name) ? "This browser can't open iPhone HEIC photos. Try a JPEG, or choose it in Safari." : "We couldn't open that image. Try a JPEG or PNG photo."));
    };
    img.src = url;
  });
}

/** The part of the image inside the 16:9 frame, moved by focus (0–1 across, 0–1 down). */
function cropBox(w: number, h: number, fx: number, fy: number) {
  const ratio = COVER.width / COVER.height;
  const cw = Math.min(w, h * ratio);
  const ch = cw / ratio;
  return { sx: (w - cw) * fx, sy: (h - ch) * fy, sw: cw, sh: ch };
}

/**
 * Draws the crop at a size and encodes it. The full-size cover is JPEG, which
 * every link preview (WhatsApp, Facebook, our own preview cards) can show;
 * thumbnails are WebP (smaller), or JPEG where the browser can't make WebP.
 */
function encode(img: HTMLImageElement, fx: number, fy: number, width: number, format: "webp" | "jpeg"): Promise<Blob> {
  const { sx, sy, sw, sh } = cropBox(img.naturalWidth, img.naturalHeight, fx, fy);
  const w = Math.round(Math.min(width, sw)); // never upscale
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = Math.round((w * COVER.height) / COVER.width);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const as = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, COVER.quality));
  const first = format === "webp" ? as("image/webp").then((b) => (b && b.type === "image/webp" ? b : as("image/jpeg"))) : as("image/jpeg");
  return first.then((b) => {
    if (!b) throw new Error("We couldn't prepare that image. Try another one.");
    return b;
  });
}

/** Uploads with progress (fetch can't report upload progress). */
function upload(form: FormData, onProgress: (pct: number) => void): Promise<{ ok?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/cover");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ error: "Something went wrong. Please try again." });
      }
    };
    xhr.onerror = () => resolve({ error: "The upload didn't go through. Check your connection and try again." });
    xhr.send(form);
  });
}

export function CoverPicker({ target, id, current, currentAlt, label }: { target: Target; id: string; current: string | null; currentAlt: string | null; label: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fx, setFx] = useState(0.5);
  const [fy, setFy] = useState(0.5);
  const [alt, setAlt] = useState(currentAlt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Live preview of exactly what will be uploaded.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !loaded) return;
    const { sx, sy, sw, sh } = cropBox(loaded.img.naturalWidth, loaded.img.naturalHeight, fx, fy);
    c.getContext("2d")!.drawImage(loaded.img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  }, [loaded, fx, fy]);

  useEffect(() => () => {
    if (loaded) URL.revokeObjectURL(loaded.url);
  }, [loaded]);

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    try {
      setLoaded(await loadImage(file));
      setFx(0.5);
      setFy(0.5);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    if (!loaded) return;
    setError(null);
    setProgress(0);
    try {
      const [full, thumb] = await Promise.all([encode(loaded.img, fx, fy, COVER.width, "jpeg"), encode(loaded.img, fx, fy, COVER.thumbWidth, "webp")]);
      const form = new FormData();
      form.set("target", target);
      form.set("id", id);
      form.set("alt", alt);
      form.set("full", full, full.type === "image/webp" ? "cover.webp" : "cover.jpg");
      form.set("thumb", thumb, thumb.type === "image/webp" ? "thumb.webp" : "thumb.jpg");
      const res = await upload(form, setProgress);
      if (res.error) throw new Error(res.error);
      setLoaded(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  const img = loaded?.img;
  const slackX = img ? img.naturalWidth / img.naturalHeight > COVER.width / COVER.height : false;
  const slackY = img ? !slackX && img.naturalWidth / img.naturalHeight < COVER.width / COVER.height : false;

  return (
    <div className="space-y-3 text-sm">
      {!loaded && current && (
        // eslint-disable-next-line @next/next/no-img-element -- already resized; served straight from storage
        <img src={current} alt={currentAlt ?? ""} className="aspect-video w-full max-w-md rounded-md border border-border object-cover" />
      )}
      {loaded && (
        <div className="max-w-md space-y-2">
          <canvas
            ref={canvas}
            width={COVER.thumbWidth * 2}
            height={COVER.thumbHeight * 2}
            className="aspect-video w-full rounded-md border-[1.5px] border-ink"
            aria-label="Preview of the cover image"
          />
          {slackX && (
            <label className="block">
              <span className="text-muted">Slide left or right</span>
              <input type="range" min={0} max={1} step={0.01} value={fx} onChange={(e) => setFx(Number(e.target.value))} className="block w-full accent-brand" />
            </label>
          )}
          {slackY && (
            <label className="block">
              <span className="text-muted">Slide up or down</span>
              <input type="range" min={0} max={1} step={0.01} value={fy} onChange={(e) => setFy(Number(e.target.value))} className="block w-full accent-brand" />
            </label>
          )}
          <label className="block">
            <span className="font-medium">Describe the image</span>
            <span className="block text-muted">For people who use screen readers, e.g. &ldquo;Four lanes of traffic outside the school&rdquo;.</span>
            <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={ALT_MAX} className={`${inputStyles} mt-1`} />
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {progress !== null && (
        <div className="max-w-md" role="progressbar" aria-label="Uploading" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max(5, progress)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">Uploading… {progress}%</p>
        </div>
      )}

      <input ref={input} type="file" accept="image/*" className="sr-only" aria-label={label} onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center gap-2">
        {loaded ? (
          <>
            <button type="button" onClick={save} disabled={progress !== null} className={`${buttonStyles.primary} !px-3 !py-1.5`}>
              Use this image
            </button>
            <button type="button" onClick={() => setLoaded(null)} className="text-xs text-muted underline hover:text-foreground">
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className={`${buttonStyles.secondary} !px-3 !py-1.5`}>
            {current ? "Replace image" : "Choose an image"}
          </button>
        )}
        {current && !loaded && (
          <form action={removeCover}>
            <input type="hidden" name="target" value={target} />
            <input type="hidden" name="id" value={id} />
            <button className="text-xs text-muted underline hover:text-red-600">Remove image</button>
          </form>
        )}
      </div>
      <p className="text-xs text-muted">Photos are made smaller and their hidden details (like location) removed before they&apos;re uploaded.</p>
    </div>
  );
}
