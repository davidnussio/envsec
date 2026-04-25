"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { CookieBanner } from "./cookie-consent";

export function Analytics({ gaId }: { gaId: string }) {
  return (
    <>
      <GoogleAnalytics gaId={gaId} />
      <CookieBanner />
    </>
  );
}
