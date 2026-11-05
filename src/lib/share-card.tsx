import { ImageResponse } from "next/og";

// The picture on a shared link's preview card, drawn by Next.js (no paid
// service): paper background, ink type, the stage or date as a pill.
// Only flexbox layouts work here (it's rendered by Satori, not a browser).

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

const PAPER = "#f4efe6";
const INK = "#1f2a44";
const MUTED = "#5b6478";
const BRAND = "#c63d22";
const MUSTARD = "#e9b44c";

export function shareImage({ kicker, title, pill, lines }: { kicker: string; title: string; pill?: string; lines: string[] }) {
  const titleSize = title.length > 70 ? 56 : title.length > 40 ? 66 : 76;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, padding: "56px 72px", borderBottom: `14px solid ${BRAND}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30, color: MUTED }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", width: 44, height: 22, borderTop: `6px solid ${BRAND}`, borderRadius: "40px 40px 0 0" }} />
            <span style={{ color: INK, fontWeight: 700 }}>Groundswell</span>
          </div>
          <span style={{ textTransform: "uppercase", letterSpacing: 2, fontSize: 24 }}>{kicker}</span>
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, color: INK, lineHeight: 1.1 }}>{title}</div>
          {pill && (
            <div style={{ display: "flex", marginTop: 28 }}>
              <span style={{ display: "flex", background: MUSTARD, color: INK, fontSize: 28, fontWeight: 700, padding: "8px 22px", borderRadius: 999, border: `3px solid ${INK}` }}>
                {pill}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 30, color: INK }}>
          {lines.map((l) => (
            <span key={l} style={{ display: "flex" }}>
              {l}
            </span>
          ))}
        </div>
      </div>
    ),
    SHARE_IMAGE_SIZE,
  );
}
