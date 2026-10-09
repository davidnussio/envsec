import { ImageResponse } from "next/og";

export const alt =
  "envsec — Cross-platform CLI for managing environment secrets";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "radial-gradient(ellipse at center, rgba(16,185,129,0.12) 0%, transparent 70%)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg
        fill="none"
        height="80"
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
          color: "#ffffff",
          display: "flex",
          fontFamily: "monospace",
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginTop: 32,
        }}
      >
        envsec
      </div>

      <div
        style={{
          color: "#a1a1aa",
          display: "flex",
          fontSize: 28,
          marginTop: 16,
        }}
      >
        Secrets that never touch disk
      </div>

      <div
        style={{
          color: "#52525b",
          display: "flex",
          fontFamily: "monospace",
          fontSize: 18,
          marginTop: 24,
        }}
      >
        macOS Keychain · Linux Secret Service · Windows Credential Manager
      </div>
    </div>,
    { ...size }
  );
}
