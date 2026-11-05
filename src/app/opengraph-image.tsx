import { SHARE_IMAGE_SIZE, shareImage } from "@/lib/share-card";

// The preview card's picture for the home page and any page without its own.
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "Groundswell: what matters where you live";

export default function Image() {
  return shareImage({
    kicker: "Canada & US",
    title: "What matters where you live",
    lines: ["See the causes your neighbours care about,", "meet up, and push for change together."],
  });
}
