import { sendGAEvent } from "@next/third-parties/google";

export const trackEvent = (
  eventName: string,
  params: Record<string, string>
) => {
  sendGAEvent("event", eventName, params);
};
