"use client";

import { useState } from "react";

// Dates render in the viewer's own timezone and locale, not the server's.

export function LocalTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  const d = new Date(iso);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {d.toLocaleString(undefined, options ?? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
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
  const [now] = useState(() => Date.now());
  const seconds = (new Date(iso).getTime() - now) / 1000;
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? ["minute", 60];
  return (
    <time dateTime={iso} suppressHydrationWarning title={new Date(iso).toLocaleString()}>
      {Math.abs(seconds) < 60 ? "just now" : rtf.format(Math.round(seconds / size), unit)}
    </time>
  );
}
