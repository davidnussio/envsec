import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "What envsec does not protect you from: an honest threat model for keychain-backed secrets";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "3 OSes",
    statLabel: "one threat model, limits included",
    title: "What envsec does not protect you from",
  });
}
