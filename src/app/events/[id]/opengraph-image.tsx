import { getEventForShare } from "@/lib/queries";
import { eventShare } from "@/lib/share-meta";
import { photoData, SHARE_IMAGE_SIZE, shareImage } from "@/lib/share-card";
import { readImage } from "@/lib/media-store";

// The preview card's picture for a shared event link: the event's cover photo
// (or its cause's) when there is one (#66), otherwise when and where, big.
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "An event on Groundswell";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await getEventForShare(id);
  const share = e && eventShare(e);
  if (!share) return shareImage({ kicker: "Groundswell", title: "What matters where you live", lines: ["Find your neighbourhood's causes"] });
  const cover = e.coverUrl ?? e.cause.coverUrl;
  const photo = cover ? photoData(await readImage(cover)) : null;
  return shareImage({
    kicker: "Event",
    title: share.title,
    pill: share.when,
    lines: photo ? [`${share.where} · ${share.causeTitle}`] : [`Where: ${share.where}`, `Part of: ${share.causeTitle}`],
    photo,
  });
}
