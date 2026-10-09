import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "From .env to the keychain in five minutes: migrating a Node or Next.js project off dotenv with envsec";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "8 steps",
    statLabel: "from a plaintext .env to the OS keychain",
    title: "From .env to the keychain in five minutes",
  });
}
