"use client";

import { useCallback, useEffect, useState } from "react";

const CONSENT_KEY = "cookie-consent";

type ConsentState = "granted" | "denied" | null;

function getConsent(): ConsentState {
  if (typeof window === "undefined") {
    return null;
  }
  const value = localStorage.getItem(CONSENT_KEY);
  if (value === "granted" || value === "denied") {
    return value;
  }
  return null;
}

function updateGtagConsent(state: "granted" | "denied") {
  window.gtag?.("consent", "update", {
    analytics_storage: state,
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
  });
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState>(null);

  useEffect(() => {
    const stored = getConsent();
    setConsent(stored);
    if (stored) {
      updateGtagConsent(stored);
    }
  }, []);

  const accept = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "granted");
    setConsent("granted");
    updateGtagConsent("granted");
  }, []);

  const decline = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "denied");
    setConsent("denied");
    updateGtagConsent("denied");
  }, []);

  return { consent, accept, decline };
}

export function CookieBanner() {
  const { consent, accept, decline } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (consent === null) {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [consent]);

  if (consent !== null || !visible) {
    return null;
  }

  return (
    <div
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
      role="dialog"
    >
      <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border border-white/10 bg-card p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <p className="flex-1 text-muted-foreground text-sm leading-relaxed">
          This site uses cookies for analytics to improve your experience. No
          personal data is collected.
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            className="rounded-md border border-white/10 px-4 py-2 text-muted-foreground text-sm transition-colors hover:bg-secondary hover:text-foreground"
            onClick={decline}
            type="button"
          >
            Decline
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
            onClick={accept}
            type="button"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
