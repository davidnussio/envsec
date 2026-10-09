import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Your coding agent can read your .env: what agents expose and what moving secrets to the keychain changes";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "0 bytes",
    statLabel: "of plaintext secrets left in the workspace",
    title: "Your coding agent can read your .env",
  });
}
