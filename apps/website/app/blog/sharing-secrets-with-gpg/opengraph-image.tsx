import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Sharing secrets with a teammate, the GPG way: one ASCII-armored file encrypted to one GPG key";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function OGImage() {
  return renderPostOGImage({
    stat: "1 file",
    statLabel: "ASCII-armored, encrypted to one GPG key",
    title: "Sharing secrets with a teammate, the GPG way",
  });
}
