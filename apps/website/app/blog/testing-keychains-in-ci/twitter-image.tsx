import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Testing a keychain CLI on macOS, Linux and Windows in CI: real credential stores on three runners";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "3 OSes",
    statLabel: "real credential stores in every E2E run",
    title: "Testing a keychain CLI on macOS, Linux and Windows in CI",
  });
}
