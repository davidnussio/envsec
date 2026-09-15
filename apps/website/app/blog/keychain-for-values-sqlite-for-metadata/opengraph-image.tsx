import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Why secret values live in the keychain and metadata in SQLite: envsec keeps names and dates in SQLite, never values";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function OGImage() {
  return renderPostOGImage({
    stat: "0 values",
    statLabel: "in SQLite: only names, dates and paths",
    title: "Why secret values live in the keychain and metadata in SQLite",
  });
}
