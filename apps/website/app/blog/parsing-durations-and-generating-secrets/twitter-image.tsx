import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Parsing 1y6mo and generating secrets you can't guess: 190 bits of entropy by default";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "190 bits",
    statLabel: "entropy in a default envsec secret",
    title: "Parsing 1y6mo and generating secrets you can't guess",
  });
}
