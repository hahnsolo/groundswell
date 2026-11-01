"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AREA_COOKIE, decodeArea, encodeArea, type Area } from "@/lib/area-cookie";
import { PostalSearch } from "./postal-search";

const EVENT = "gs-area-change";

function readCookie() {
  return document.cookie.split("; ").find((c) => c.startsWith(`${AREA_COOKIE}=`))?.slice(AREA_COOKIE.length + 1) ?? null;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

/** Put on an area page: remembers it as "your" neighbourhood for the header. */
export function RememberArea(area: Area) {
  const value = encodeArea(area);
  useEffect(() => {
    if (readCookie() === value) return;
    document.cookie = `${AREA_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.dispatchEvent(new Event(EVENT));
  }, [value]);
  return null;
}

/** The header's main call to action, aimed at the neighbourhood you're looking at. */
export function StartSomething({ initial }: { initial: Area | null }) {
  const raw = useSyncExternalStore(subscribe, readCookie, () => null);
  const area = decodeArea(raw) ?? initial;
  const href = area
    ? `/causes/new?country=${area.country}&postal=${encodeURIComponent(area.postal)}`
    : "/causes/new";
  return (
    <Link
      href={href}
      aria-label="Start something"
      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1.5 text-sm font-medium text-white hover:bg-brand-strong sm:px-3.5"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
        <path d="M6 1.5 V10.5 M1.5 6 H10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="hidden sm:inline">Start something</span>
    </Link>
  );
}

/** The neighbourhood chip in the header, with a small panel to switch areas. */
export function NeighbourhoodPicker({ initial }: { initial: Area | null }) {
  // Server value first (no flicker), then follow the cookie as you browse.
  const raw = useSyncExternalStore(subscribe, readCookie, () => null);
  const area = decodeArea(raw) ?? initial;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close after navigating somewhere (e.g. a search in the panel).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={box} className="relative min-w-0 max-w-[10rem] sm:max-w-[16rem]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={area ? `Your neighbourhood: ${area.name}. Change` : "Find your neighbourhood"}
        className="flex max-w-full items-center gap-1 rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-xs font-medium hover:bg-surface sm:text-sm"
      >
        <span className="truncate">{area?.name ?? "Find your neighbourhood"}</span>
        <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
          <path d="M3 4.5 L6 7.5 L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        // Phones: span the screen under the header. Wider screens: drop down from the button.
        <div className="fixed inset-x-4 top-16 z-30 rounded-md border-[1.5px] border-ink bg-surface p-3 shadow-lg sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[22rem]">
          {area && (
            <Link
              href={`/area/${area.country.toLowerCase()}/${encodeURIComponent(area.postal)}`}
              onClick={() => setOpen(false)}
              className="mb-3 block text-sm font-medium text-link underline"
            >
              Go to {area.name} →
            </Link>
          )}
          <p className="mb-2 text-xs text-muted">Look somewhere else</p>
          <PostalSearch stacked defaultCountry={area?.country ?? "CA"} />
        </div>
      )}
    </div>
  );
}
