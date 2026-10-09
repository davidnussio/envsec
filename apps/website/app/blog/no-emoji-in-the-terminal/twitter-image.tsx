import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Why there are no emoji in envsec's output — 0 emoji in 27 output icons";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "0 emoji",
    statLabel: "in envsec's 27 output icons",
    title: "Why there are no emoji in envsec's output",
  });
}
