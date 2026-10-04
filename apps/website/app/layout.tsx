import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Analytics } from "../components/analytics";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const siteUrl = "https://envsec.dev";
const siteName = "envsec";
const siteDescription =
  "Cross-platform CLI for managing environment secrets using native OS credential stores. macOS Keychain, Linux Secret Service, Windows Credential Manager. Secrets never touch disk.";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  alternates: {
    canonical: "./",
  },
  authors: [{ name: "David Nussio", url: "https://github.com/davidnussio" }],
  creator: "David Nussio",
  description: siteDescription,
  icons: {
    icon: [
      { type: "image/svg+xml", url: "/favicon.svg" },
      { type: "image/svg+xml", url: "/icon.svg" },
    ],
  },
  keywords: [
    "secrets management",
    "environment variables",
    "CLI",
    "keychain",
    "credential store",
    "envsec",
    "dotenv",
    "dotenv alternative",
    "env file",
    "env file security",
    "macOS Keychain",
    "GNOME Keyring",
    "Windows Credential Manager",
    "secret-tool",
    "security CLI",
    "cross-platform",
    "Node.js",
    "npm",
    "secrets manager CLI",
    "environment secrets",
    "credential management",
    "secret rotation",
    "API key management",
    "developer tools",
    "DevOps secrets",
    "secret injection",
  ],
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: siteDescription,
    locale: "en_US",
    siteName,
    title: "envsec — Secrets that never touch disk",
    type: "website",
    url: siteUrl,
  },
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  title: {
    default: "envsec — Secrets that never touch disk",
    template: "%s | envsec",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@davidnussio",
    description: siteDescription,
    site: "@davidnussio",
    title: "envsec — Secrets that never touch disk",
  },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html
    className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    lang="en"
  >
    <head>
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      {/* oxlint-disable-next-line next/no-sync-scripts -- consent defaults must be set synchronously, before gtag.js loads */}
      <script src="/consent-default.js" />
    </head>
    <body className="bg-background text-foreground flex min-h-full flex-col">
      {children}
    </body>
    {process.env.NODE_ENV === "production" && (
      <Analytics gaId={process.env.NEXT_PUBLIC_GA_ID ?? ""} />
    )}
  </html>
);

export default RootLayout;
