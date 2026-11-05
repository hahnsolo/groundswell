import { appUrl, ensureShortCode, getFlyer, qrDataUrl, type SpreadKind } from "@/lib/spread";
import { readSource, shortUrl, typedLink } from "@/lib/sources";
import { photoData, posterImage, shareImage } from "@/lib/share-card";
import { readImage } from "@/lib/media-store";

// Share images to download or post (#67), all in the same look:
//   /share/cause/<id>/card    1200×630, like the link preview
//   /share/cause/<id>/square  1080×1080 post
//   /share/cause/<id>/story   1080×1920 story
// ?src=instagram puts the right short link (and QR code) on it, so people who
// come from that post are counted as coming from Instagram.
const FORMATS = ["card", "square", "story"] as const;

export async function GET(request: Request, { params }: RouteContext<"/share/[kind]/[id]/[format]">) {
  const { kind, id, format } = await params;
  if ((kind !== "cause" && kind !== "event") || !FORMATS.includes(format as (typeof FORMATS)[number])) return new Response("Not found", { status: 404 });
  const flyer = await getFlyer(kind as SpreadKind, id);
  if (!flyer) return new Response("Not found", { status: 404 });

  const source = readSource(new URL(request.url).searchParams.get("src")) ?? "link";
  const code = await ensureShortCode(flyer.kind, id);
  const url = code ? shortUrl(appUrl(), code, source) : `${appUrl()}${flyer.path}?src=${source}`;
  const link = typedLink(url);
  const photo = flyer.coverUrl ? photoData(await readImage(flyer.coverUrl)) : null;
  const event = flyer.kind === "event";
  const details = event ? [`${flyer.day}`, `${flyer.time}`, `${flyer.where}`] : [flyer.why, ...(flyer.status ? [flyer.status] : [])];

  const image =
    format === "card"
      ? shareImage({
          kicker: event ? "Event" : "Cause",
          title: flyer.title,
          pill: event ? flyer.day : undefined,
          lines: photo ? [link] : [event ? `${flyer.time} · ${flyer.where}` : flyer.kicker, link],
          photo,
        })
      : posterImage({
          format: format as "square" | "story",
          kicker: flyer.kicker,
          title: flyer.title,
          lines: details,
          photo,
          qr: await qrDataUrl(url),
          link,
          scan: event ? "Scan to say you're going" : "Scan to join",
        });

  const headers = new Headers(image.headers);
  headers.set("Content-Disposition", `inline; filename="groundswell-${flyer.kind}-${format}.png"`);
  headers.set("Cache-Control", "private, max-age=300");
  return new Response(image.body, { status: 200, headers });
}
