"use client";

import { GoogleAnalytics } from "@next/third-parties/google";

import { CookieBanner } from "./cookie-consent";

export const Analytics = ({ gaId }: { gaId: string }) => (
  <>
    <GoogleAnalytics gaId={gaId} />
    <CookieBanner />
  </>
);
