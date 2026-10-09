import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Dynamic tab completion in bash, zsh and fish — 18 ms per Tab from the completion cache";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "18 ms",
    statLabel: "median completion callback, cache hit",
    title: "Dynamic tab completion in bash, zsh and fish",
  });
}
