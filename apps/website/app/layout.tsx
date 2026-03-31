import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://envsec.dev";
const siteName = "envsec";
const siteDescription =
  "Cross-platform CLI for managing environment secrets using native OS credential stores. macOS Keychain, Linux Secret Service, Windows Credential Manager. Secrets never touch disk.";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: {
    default: "envsec — Secrets that never touch disk",
    template: "%s | envsec",
  },
  description: siteDescription,
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
  authors: [{ name: "David Nussio", url: "https://github.com/davidnussio" }],
  creator: "David Nussio",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "./",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: "envsec — Secrets that never touch disk",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "envsec — Secrets that never touch disk",
    description: siteDescription,
    creator: "@davidnussio",
    site: "@davidnussio",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      lang="en"
    >
      <head>
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
