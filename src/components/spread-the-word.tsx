"use client";

import Link from "next/link";
import { useState } from "react";
import { SHARE_PLACES, SOURCES, taggedUrl, type Source } from "@/lib/sources";
import { buttonStyles } from "./styles";

// Spread the word (#67): print a flyer, or post an image or a link, tagged
// with where it's going so the people leading it see where people came from.

const IMAGES = [
  { format: "square", label: "Square post", hint: "Instagram, Facebook", w: 1080, h: 1080 },
  { format: "story", label: "Story", hint: "Instagram, WhatsApp status", w: 1080, h: 1920 },
  { format: "card", label: "Wide card", hint: "Facebook, email, X", w: 1200, h: 630 },
] as const;

async function shareFile(url: string, name: string, title: string) {
  const blob = await (await fetch(url)).blob();
  const file = new File([blob], name, { type: blob.type || "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return true;
  }
  return false;
}

export function SpreadTheWord({ kind, id, pageUrl, title }: { kind: "cause" | "event"; id: string; pageUrl: string; title: string }) {
  const [place, setPlace] = useState<Source>("instagram");
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const link = taggedUrl(pageUrl, place);
  const imageUrl = (format: string) => `/share/${kind}/${id}/${format}?src=${place}`;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/flyer/${kind}/${id}`} className={`${buttonStyles.secondary} !px-3 !py-1.5`}>
          🖨️ Print a flyer
        </Link>
        <span className="text-muted">One page with a big QR code, for the lobby, the laundry room, the library.</span>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Where are you posting it?</span>
          <select value={place} onChange={(e) => setPlace(e.target.value as Source)} className="rounded-md border border-border bg-surface px-2 py-1.5">
            {SHARE_PLACES.map((s) => (
              <option key={s} value={s}>
                {s === "link" ? "Somewhere else" : SOURCES[s].label[0].toUpperCase() + SOURCES[s].label.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">The images and link below carry that, so you&apos;ll see how many people came from it.</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`${buttonStyles.secondary} !px-3 !py-1.5`}
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ title, url: link });
                  return;
                } catch {
                  // Cancelled — fall back to copying.
                }
              }
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Link copied" : "Share the link"}
          </button>
          <code className="min-w-0 break-all rounded bg-surface px-2 py-1 text-xs text-muted">{link}</code>
        </div>

        <ul className="grid gap-4 sm:grid-cols-3">
          {IMAGES.map((img) => (
            <li key={img.format} className="space-y-2">
              <a href={imageUrl(img.format)} target="_blank" rel="noopener" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- drawn on our server */}
                <img
                  src={imageUrl(img.format)}
                  alt={`${img.label} image for ${title}`}
                  loading="lazy"
                  width={img.w}
                  height={img.h}
                  className="max-h-64 w-full rounded-md border border-border bg-surface object-contain"
                />
              </a>
              <p>
                <span className="font-medium">{img.label}</span> <span className="text-xs text-muted">· {img.hint}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={imageUrl(img.format)} download={`groundswell-${kind}-${img.format}.png`} className={`${buttonStyles.secondary} !px-2.5 !py-1 text-xs`}>
                  Download
                </a>
                <button
                  type="button"
                  className={`${buttonStyles.ghost} !px-2.5 !py-1 text-xs underline`}
                  onClick={async () => {
                    setNote(null);
                    try {
                      if (!(await shareFile(imageUrl(img.format), `groundswell-${kind}-${img.format}.png`, title))) {
                        setNote("This browser can't share images directly. Download it, then post it from your photos.");
                      }
                    } catch {
                      // Cancelled.
                    }
                  }}
                >
                  Share
                </button>
              </div>
            </li>
          ))}
        </ul>
        {note && (
          <p role="status" className="text-xs text-muted">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
