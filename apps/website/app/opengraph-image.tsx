import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "envsec — Cross-platform CLI for managing environment secrets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
      {/* Shield icon */}
      <svg
        fill="none"
        height="80"
        role="img"
        viewBox="0 0 80 80"
        width="80"
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
          marginTop: 32,
          fontFamily: "monospace",
          fontSize: 64,
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "-0.02em",
        }}
      >
        envsec
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 16,
          fontSize: 28,
          color: "#a1a1aa",
        }}
      >
        Secrets that never touch disk
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 24,
          fontFamily: "monospace",
          fontSize: 18,
          color: "#52525b",
        }}
      >
        macOS Keychain · Linux Secret Service · Windows Credential Manager
      </div>
    </div>,
    { ...size }
  );
}
