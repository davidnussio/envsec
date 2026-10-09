import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Shipping one CLI to Homebrew, npm, mise and a standalone binary: seven Bun targets from one release tag";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function OGImage() {
  return renderPostOGImage({
    stat: "7 targets",
    statLabel: "Bun binaries, npm and Homebrew from one tag",
    title: "Shipping one CLI to Homebrew, npm, mise and a standalone binary",
  });
}
