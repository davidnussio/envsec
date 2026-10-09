import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "One CLI, three keychains: how envsec talks to macOS Keychain, the Linux Secret Service and Windows Credential Manager";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function OGImage() {
  return renderPostOGImage({
    stat: "3 OSes",
    statLabel: "one Effect service, three adapters",
    title: "One CLI, three keychains",
  });
}
