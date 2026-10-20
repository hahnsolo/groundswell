"use client";

import { useState, useSyncExternalStore } from "react";

// Dates render in the viewer's own timezone and locale, never the server's.
// The server doesn't know your timezone (on Vercel it's UTC), so it renders
// nothing and the browser fills the time in. (Rendering on the server and
// suppressing the mismatch would leave the server's timezone on screen.)

const noSubscribe = () => () => {};
/** true in the browser, false while rendering on the server or hydrating. */
function useInBrowser() {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

export function LocalTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  const inBrowser = useInBrowser();
  const d = new Date(iso);
  return (
    <time dateTime={iso}>
      {inBrowser ? d.toLocaleString(undefined, options ?? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : " "}
    </time>
  );
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function RelativeTime({ iso }: { iso: string }) {
  const inBrowser = useInBrowser();
  const [now] = useState(() => Date.now());
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? ["minute", 60];
  return (
    <time dateTime={iso} title={inBrowser ? new Date(iso).toLocaleString() : undefined}>
      {!inBrowser ? " " : Math.abs(seconds) < 60 ? "just now" : rtf.format(Math.round(seconds / size), unit)}
    </time>
  );
}
