import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "envsec Documentation — Commands, SDK, and Security Model";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function DocsOGImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "radial-gradient(ellipse at center, rgba(16,185,129,0.12) 0%, transparent 70%)",
      }}
    >
      <svg
        fill="none"
        height="64"
        role="img"
        viewBox="0 0 80 80"
        width="64"
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
          display: "flex",
          marginTop: 24,
          fontFamily: "monospace",
          fontSize: 48,
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        envsec
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 12,
          fontSize: 32,
          color: "#10b981",
        }}
      >
        Documentation
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 16,
          fontSize: 20,
          color: "#52525b",
        }}
      >
        Commands · SDK · Security Model · Configuration
      </div>
    </div>,
    { ...size }
  );
}
