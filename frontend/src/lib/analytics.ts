import { API_URL } from "@/lib/api";
import { hasAnalyticsConsent } from "@/lib/consent";

export type ConversionEvent =
  | "LANDING_VIEW"
  | "PROGRAM_VIEW"
  | "WHATSAPP_CLICK"
  | "REGISTRATION_STARTED"
  | "CHECKOUT_STARTED"
  | "PAYMENT_METHOD_SELECTED"
  | "CHECKOUT_CREATED"
  | "VOUCHER_SUBMITTED"
  | "PAYMENT_COMPLETED"
  | "CHECKOUT_FAILED";

const SESSION_KEY = "academy_analytics_session";

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") return "";
  let sessionId = window.localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = window.crypto.randomUUID().replaceAll("-", "");
    window.localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackConversion(
  event: ConversionEvent,
  data: { cohortId?: string; paymentId?: string; metadata?: Record<string, unknown> } = {},
) {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  if (typeof window.gtag === "function") {
    window.gtag("event", event.toLowerCase(), {
      cohort_id: data.cohortId,
      payment_id: data.paymentId,
      page_path: `${window.location.pathname}${window.location.search}`,
      ...(data.metadata || {}),
    });
  }

  const body = JSON.stringify({
    event,
    sessionId: getAnalyticsSessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    ...data,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(`${API_URL}/analytics/events`, new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch(`${API_URL}/analytics/events`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}
