import { getCauseForShare } from "@/lib/queries";
import { causeShare } from "@/lib/share-meta";
import { photoData, SHARE_IMAGE_SIZE, shareImage } from "@/lib/share-card";
import { readImage } from "@/lib/media-store";

// The preview card's picture for a shared cause link: its cover photo when it
// has one (#66), otherwise a drawn card.
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "A cause on Groundswell";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCauseForShare(id);
  const share = c && causeShare(c);
  if (!share) return shareImage({ kicker: "Groundswell", title: "What matters where you live", lines: ["Find your neighbourhood's causes"] });
  const photo = c.coverUrl ? photoData(await readImage(c.coverUrl)) : null;
  return shareImage({ kicker: share.place, title: share.title, pill: share.stage, lines: [share.joined], photo });
}
