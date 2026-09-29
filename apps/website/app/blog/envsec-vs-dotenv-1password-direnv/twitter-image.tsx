import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "envsec vs dotenv vs 1Password CLI vs direnv: where secrets live and how they reach a process";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderPostOGImage({
    stat: "4 tools",
    statLabel: "where secrets live, how they reach a process",
    title: "envsec vs dotenv vs 1Password CLI vs direnv: which one, when",
  });
}
