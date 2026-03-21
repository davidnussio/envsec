import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "envsec — Secrets that never touch disk",
  description:
    "Cross-platform CLI for managing environment secrets using native OS credential stores. macOS Keychain, Linux Secret Service, Windows Credential Manager.",
  keywords: [
    "secrets management",
    "environment variables",
    "CLI",
    "keychain",
    "credential store",
    "envsec",
  ],
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
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
