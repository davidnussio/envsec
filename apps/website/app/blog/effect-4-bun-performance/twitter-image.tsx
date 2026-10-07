import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "From 417 to 32 milliseconds: envsec on Effect 4 and Bun — 12.9× faster startup";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "12.9×",
    statLabel: "faster startup · 5.8× less memory",
    title: "From 417 to 32 milliseconds: envsec on Effect 4 and Bun",
  });
}
