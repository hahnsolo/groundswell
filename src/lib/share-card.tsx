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

/** Sizes for posts (#67): Instagram/Facebook square, and a phone-screen story. */
export const POSTER_SIZES = { square: { width: 1080, height: 1080 }, story: { width: 1080, height: 1920 } } as const;

/**
 * A square post or a story (#67), in the same look as the preview card: the
 * cover photo on top, the title big, when and where, and a QR code with the
 * short link (links in Instagram posts can't be tapped, so people scan or type).
 */
export function posterImage({
  format,
  kicker,
  title,
  lines,
  photo,
  qr,
  link,
  scan,
}: {
  format: keyof typeof POSTER_SIZES;
  kicker: string;
  title: string;
  lines: string[];
  photo?: string | null;
  qr: string;
  link: string;
  scan: string;
}) {
  const { width } = POSTER_SIZES[format];
  const story = format === "story";
  const photoHeight = photo ? (story ? 760 : 470) : 0;
  // Without a photo there's room to spare: bigger type, and everything centred rather than a gap in the middle.
  const roomy = !photo;
  const titleSize = (title.length > 70 ? 54 : title.length > 40 ? 64 : 76) + (story ? 8 : 0) + (roomy && story ? 18 : 0);
  const qrSize = story ? (roomy ? 380 : 300) : 210;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, borderBottom: `18px solid ${BRAND}` }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- drawn by Satori, not a page
          <img src={photo} alt="" width={width} height={photoHeight} style={{ width, height: photoHeight, objectFit: "cover", borderBottom: `6px solid ${INK}` }} />
        )}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: roomy && story ? "center" : "flex-start",
            padding: story ? "64px 72px 56px" : "44px 60px 40px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: MUTED }}>
            <div style={{ display: "flex", width: 40, height: 20, borderTop: `6px solid ${BRAND}`, borderRadius: "40px 40px 0 0" }} />
            <span style={{ color: INK, fontWeight: 700 }}>Groundswell</span>
            <span>· {kicker}</span>
          </div>
          <div style={{ display: "flex", marginTop: story ? 36 : 22, fontSize: titleSize, fontWeight: 700, color: INK, lineHeight: 1.08 }}>{title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: story ? 32 : 18, fontSize: story ? 40 : 32, color: INK }}>
            {lines.map((l) => (
              <span key={l} style={{ display: "flex" }}>
                {l}
              </span>
            ))}
          </div>
          {roomy && story ? <div style={{ display: "flex", height: 120 }} /> : <div style={{ display: "flex", flex: 1 }} />}
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- drawn by Satori, not a page */}
            <img src={qr} alt="" width={qrSize} height={qrSize} style={{ width: qrSize, height: qrSize, border: `4px solid ${INK}`, borderRadius: 12 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <span style={{ display: "flex", fontSize: story ? 44 : 34, fontWeight: 700, color: INK }}>{scan}</span>
              <span style={{ display: "flex", fontSize: story ? 32 : 26, color: MUTED }}>or go to</span>
              <span style={{ display: "flex", fontSize: story ? 36 : 28, fontWeight: 700, color: BRAND }}>{link}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    POSTER_SIZES[format],
  );
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
