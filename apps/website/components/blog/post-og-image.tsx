import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = { height: 630, width: 1200 };

interface PostOGImageProps {
  title: string;
  stat: string;
  statLabel: string;
}

/** Shared Open Graph / Twitter card renderer for blog posts. */
export const renderPostOGImage = ({
  title,
  stat,
  statLabel,
}: PostOGImageProps): ImageResponse =>
  new ImageResponse(
    <div
      style={{
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "radial-gradient(ellipse at top left, rgba(16,185,129,0.14) 0%, transparent 65%)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: 72,
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex" }}>
        <svg
          fill="none"
          height="44"
          viewBox="0 0 80 80"
          width="44"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>envsec shield icon</title>
          <path
            d="M40 8L16 20v16c0 22 10.2 42.5 24 48 13.8-5.5 24-26 24-48V20L40 8z"
            fill="rgba(16,185,129,0.15)"
            stroke="#10b981"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M28 40l10 10 16-20"
            stroke="#10b981"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
        </svg>
        <div
          style={{
            color: "#ffffff",
            display: "flex",
            fontFamily: "monospace",
            fontSize: 32,
            fontWeight: 700,
            marginLeft: 16,
          }}
        >
          envsec
        </div>
        <div
          style={{
            color: "#52525b",
            display: "flex",
            fontSize: 28,
            marginLeft: 16,
          }}
        >
          / blog
        </div>
      </div>

      <div
        style={{
          color: "#ffffff",
          display: "flex",
          fontSize: 60,
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>

      <div style={{ alignItems: "baseline", display: "flex" }}>
        <div
          style={{
            color: "#10b981",
            display: "flex",
            fontFamily: "monospace",
            fontSize: 72,
            fontWeight: 700,
          }}
        >
          {stat}
        </div>
        <div
          style={{
            color: "#a1a1aa",
            display: "flex",
            fontSize: 28,
            marginLeft: 20,
          }}
        >
          {statLabel}
        </div>
      </div>
    </div>,
    { ...OG_IMAGE_SIZE }
  );
