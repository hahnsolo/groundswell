import { getCauseForShare } from "@/lib/queries";
import { causeShare } from "@/lib/share-meta";
import { SHARE_IMAGE_SIZE, shareImage } from "@/lib/share-card";

// The preview card's picture for a shared cause link. (Cover images, when
// they exist, will be used instead: #66.)
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "A cause on Groundswell";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCauseForShare(id);
  const share = c && causeShare(c);
  if (!share) return shareImage({ kicker: "Groundswell", title: "What matters where you live", lines: ["Find your neighbourhood's causes"] });
  return shareImage({ kicker: share.place, title: share.title, pill: share.stage, lines: [share.joined] });
}
