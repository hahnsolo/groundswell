"use client";

import { useEffect, useRef, useState } from "react";
import type { Flyer } from "@/lib/spread";
import { buttonStyles } from "./styles";

// The printable flyer (#67). Always paper-white with dark ink (even in dark
// mode), sized to the page in inches so what you see is what prints.

const PAPER = {
  letter: { label: "Letter (US, Canada)", w: "8.5in", h: "11in", css: "letter" },
  a4: { label: "A4", w: "210mm", h: "297mm", css: "A4" },
} as const;
type Paper = keyof typeof PAPER;

const INK = "#1f2a44";
const BRAND = "#c63d22";
const MUTED = "#4b5468";
const STRIPS = 7;

function Qr({ svg, size, label }: { svg: string; size: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      data-qr
      style={{ width: size, height: size, flex: "none" }}
      className="[&>svg]:h-full [&>svg]:w-full"
      // Made on our server by the qrcode library from our own link: safe markup.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function FlyerSheet({ flyer, qr, link }: { flyer: Flyer; qr: string; link: string }) {
  const [paper, setPaper] = useState<Paper>("letter");
  const [strips, setStrips] = useState(false);
  const size = PAPER[paper];
  // On screen the sheet shrinks to fit (a phone is narrower than a page); printing uses its real size.
  const frame = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const f = frame.current;
    const s = sheet.current;
    if (!f || !s) return;
    const fit = () => setZoom(Math.min(1, f.clientWidth / s.offsetWidth));
    const observer = new ResizeObserver(fit);
    observer.observe(f);
    return () => observer.disconnect();
  }, [paper]);
  const event = flyer.kind === "event";
  // On the narrow tear-off strips: the site on one line, the part to remember (/go/k7m2qp) bigger below.
  const cut = link.indexOf("/go/");
  const [site, path] = cut > 0 ? [link.slice(0, cut), link.slice(cut)] : ["", link];
  const title = flyer.title;
  const titleSize = title.length > 70 ? "30pt" : title.length > 40 ? "38pt" : "46pt";
  const scan = event ? "Scan to say you're going" : "Scan to join your neighbours";

  return (
    <>
      {/* Print just the sheet: no site header or footer, no page margins (the sheet has its own). */}
      <style>{`
        @page { size: ${size.css} portrait; margin: 0; }
        @media print {
          body > *:not(main) { display: none !important; }
          html, body { background: #fff !important; }
          [data-flyer-sheet] { box-shadow: none !important; margin: 0 !important; border: 0 !important; zoom: 1 !important; }
        }
      `}</style>

      <div className="mt-4 flex flex-wrap items-end gap-4 text-sm print:hidden">
        <h1 className="w-full text-2xl font-semibold">Print a flyer</h1>
        <p className="w-full text-muted">
          Put it up in the lobby, the laundry room, the library, the corner store. The QR code and the short link both bring people
          to this {flyer.kind}, and you&apos;ll see how many came from the flyer.
        </p>
        <label className="block">
          <span className="block font-medium">Paper</span>
          <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)} className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5">
            {(Object.keys(PAPER) as Paper[]).map((p) => (
              <option key={p} value={p}>
                {PAPER[p].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" checked={strips} onChange={(e) => setStrips(e.target.checked)} className="accent-brand" />
          Tear-off strips along the bottom
        </label>
        <button type="button" onClick={() => window.print()} className={`${buttonStyles.primary} ml-auto`}>
          Print
        </button>
      </div>

      <div ref={frame} className="mt-6 overflow-hidden pb-6 print:mt-0 print:overflow-visible print:p-0">
        <article
          ref={sheet}
          data-flyer-sheet
          aria-label="Flyer"
          className="mx-auto flex flex-col overflow-hidden shadow-lg"
          style={{ zoom, width: size.w, height: size.h, background: "#fff", color: INK, padding: "0.5in", boxSizing: "border-box", border: "1px solid #d8d2c4" }}
        >
          <header className="flex items-center justify-between" style={{ fontSize: "11pt", color: MUTED }}>
            <span className="flex items-center gap-2 font-semibold" style={{ color: INK }}>
              <span aria-hidden="true" style={{ display: "inline-block", width: 22, height: 11, borderTop: `4px solid ${BRAND}`, borderRadius: "20px 20px 0 0" }} />
              Groundswell
            </span>
            <span className="uppercase tracking-wide">{event ? "Event" : "A local cause"}</span>
          </header>

          {flyer.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- already resized; served straight from storage
            <img
              src={flyer.coverUrl}
              alt={flyer.coverAlt ?? ""}
              className="mt-4 w-full object-cover"
              style={{ aspectRatio: "16 / 9", maxHeight: strips ? "2.6in" : "3.4in", borderRadius: 6, border: `2px solid ${INK}` }}
            />
          )}

          <p className="mt-5" style={{ fontSize: "12pt", color: MUTED }}>
            {flyer.kicker}
          </p>
          <h2 className="font-display mt-1 font-bold" style={{ fontSize: titleSize, lineHeight: 1.08 }}>
            {title}
          </h2>

          {event ? (
            <div className="mt-4 space-y-1">
              <p className="font-bold" style={{ fontSize: "24pt", lineHeight: 1.15 }}>
                {flyer.day}
              </p>
              <p style={{ fontSize: "20pt", lineHeight: 1.2 }}>{flyer.time}</p>
              <p style={{ fontSize: "18pt", lineHeight: 1.25 }}>{flyer.where}</p>
              <p className="pt-1" style={{ fontSize: "12pt", color: MUTED }}>
                Hosted by {flyer.host} · {flyer.why}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p style={{ fontSize: "16pt", lineHeight: 1.35 }}>{flyer.why}</p>
              {flyer.status && <p style={{ fontSize: "12pt", color: MUTED }}>{flyer.status}</p>}
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-6" style={{ borderTop: `3px solid ${BRAND}`, paddingTop: "0.25in" }}>
            <Qr svg={qr} size={strips ? "1.9in" : "2.4in"} label={`QR code linking to ${link}`} />
            <div>
              <p className="font-bold" style={{ fontSize: "20pt", lineHeight: 1.15 }}>
                {scan}
              </p>
              <p className="mt-2" style={{ fontSize: "12pt", color: MUTED }}>
                Or type
              </p>
              <p className="font-semibold" style={{ fontSize: "16pt", wordBreak: "break-all" }}>
                {link}
              </p>
              <p className="mt-2" style={{ fontSize: "11pt", color: MUTED }}>
                Free · No app needed · Neighbours organizing together
              </p>
            </div>
          </div>

          {strips && (
            <div className="flex" style={{ marginTop: "0.2in", borderTop: `1.5px dashed ${MUTED}`, height: "1.55in", marginInline: "-0.5in", marginBottom: "-0.5in" }}>
              {Array.from({ length: STRIPS }, (_, i) => (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center justify-start gap-1 overflow-hidden"
                  style={{ borderLeft: i ? `1.5px dashed ${MUTED}` : "none", paddingTop: "0.1in" }}
                >
                  <Qr svg={qr} size="0.75in" label="" />
                  <span style={{ fontSize: "6.5pt", lineHeight: 1.15, textAlign: "center", wordBreak: "break-all", padding: "0 3px" }}>
                    {site}
                    <br />
                    <strong style={{ fontSize: "9pt" }}>{path}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </>
  );
}
