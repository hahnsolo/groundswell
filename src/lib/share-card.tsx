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

/** The cover photo as a data URL the card can draw, or null. */
export function photoData(bytes: ArrayBuffer | null) {
  if (!bytes) return null;
  const b = new Uint8Array(bytes);
  const type = b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b[0] === 0x89 && b[1] === 0x50 ? "image/png" : "image/webp";
  return `data:${type};base64,${Buffer.from(b).toString("base64")}`;
}

export function shareImage({ kicker, title, pill, lines, photo }: { kicker: string; title: string; pill?: string; lines: string[]; photo?: string | null }) {
  const titleSize = title.length > 70 ? 56 : title.length > 40 ? 66 : 76;
  if (photo) {
    // The cover photo, with the title on a dark band so it reads over any picture.
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: INK }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn by Satori, not a page */}
          <img src={photo} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              padding: "120px 64px 44px",
              backgroundImage: "linear-gradient(to bottom, rgba(31,42,68,0), rgba(31,42,68,0.92) 45%)",
              borderBottom: `14px solid ${BRAND}`,
              color: PAPER,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {pill && (
                <span style={{ display: "flex", background: MUSTARD, color: INK, fontSize: 26, fontWeight: 700, padding: "6px 18px", borderRadius: 999 }}>{pill}</span>
              )}
              <span style={{ fontSize: 26, opacity: 0.85 }}>{kicker} · Groundswell</span>
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: Math.min(titleSize, 64), fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
            {lines[0] && <div style={{ display: "flex", marginTop: 10, fontSize: 28, opacity: 0.9 }}>{lines[0]}</div>}
          </div>
        </div>
      ),
      SHARE_IMAGE_SIZE,
    );
  }
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
