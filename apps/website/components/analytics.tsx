"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { CookieBanner, useCookieConsent } from "./cookie-consent";

export function Analytics({ gaId }: { gaId: string }) {
  const { consent } = useCookieConsent();

  return (
    <>
      {consent === "granted" && <GoogleAnalytics gaId={gaId} />}
      <CookieBanner />
    </>
  );
}
