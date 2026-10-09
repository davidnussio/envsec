import { renderPostOGImage } from "@/components/blog/post-og-image";

export const alt =
  "Building a CLI with Effect 4: commands, services, typed errors and tests in envsec";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function OGImage() {
  return renderPostOGImage({
    stat: "20",
    statLabel: "subcommands on one effect/cli root",
    title: "Building a CLI with Effect 4",
  });
}
