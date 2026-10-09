import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "How many plaintext secrets are sitting in your projects folder? envsec rescue finds every .env file";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function OGImage() {
  return renderPostOGImage({
    stat: "0 changes",
    statLabel: "made by the default scan: it only reports",
    title: "How many plaintext secrets are sitting in your projects folder?",
  });
}
