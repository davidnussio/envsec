/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#1a1a1a",
        surface: "#262626",
        "surface-hover": "#2e2e2e",
        border: "rgba(255, 255, 255, 0.1)",
        "border-hover": "rgba(52, 211, 153, 0.2)",
        muted: "#a1a1aa",
        foreground: "#fafafa",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
