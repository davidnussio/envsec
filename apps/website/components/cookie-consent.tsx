"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const CONSENT_KEY = "cookie-consent";

type ConsentState = "granted" | "denied" | null;

const getConsent = (): ConsentState => {
  if (typeof window === "undefined") {
    return null;
  }
  const value = localStorage.getItem(CONSENT_KEY);
  if (value === "granted" || value === "denied") {
    return value;
  }
  return null;
};

const updateGtagConsent = (state: "granted" | "denied") => {
  window.gtag?.("consent", "update", {
    ad_personalization: state,
    ad_storage: state,
    ad_user_data: state,
    analytics_storage: state,
  });
};

const consentListeners = new Set<() => void>();

const subscribeToConsent = (listener: () => void) => {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
};

// The server never knows the stored choice; render as "no choice yet" until hydrated.
const getServerConsent = (): ConsentState => null;

const storeConsent = (state: "granted" | "denied") => {
  localStorage.setItem(CONSENT_KEY, state);
  for (const listener of consentListeners) {
    listener();
  }
  updateGtagConsent(state);
};

export const useCookieConsent = () => {
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsent,
    getServerConsent
  );

  useEffect(() => {
    const stored = getConsent();
    if (stored) {
      updateGtagConsent(stored);
    }
  }, []);

  const accept = useCallback(() => storeConsent("granted"), []);

  const decline = useCallback(() => storeConsent("denied"), []);

  return { accept, consent, decline };
};

export const CookieBanner = () => {
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
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a <dialog> element brings UA styles and open/close semantics that would change this fixed, non-modal banner
      role="dialog"
    >
      <div className="bg-card mx-auto flex max-w-xl flex-col gap-4 rounded-lg border border-white/10 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
          This site uses cookies for analytics to improve your experience. No
          personal data is collected.
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded-md border border-white/10 px-4 py-2 text-sm transition-colors"
            onClick={decline}
            type="button"
          >
            Decline
          </button>
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            onClick={accept}
            type="button"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
