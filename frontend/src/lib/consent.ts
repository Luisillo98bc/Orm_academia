export const PRIVACY_CONSENT_VERSION = "2026-09-05";
const CONSENT_KEY = "academy_privacy_consent";
export const CONSENT_EVENT = "academy:privacy-consent";

export type ConsentChoice = "necessary" | "analytics";

interface StoredConsent {
  choice: ConsentChoice;
  version: string;
  recordedAt: string;
}

export function getConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== PRIVACY_CONSENT_VERSION) return null;
    return parsed.choice === "analytics" || parsed.choice === "necessary" ? parsed : null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  return getConsent()?.choice === "analytics";
}

export function saveConsent(choice: ConsentChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify({
    choice,
    version: PRIVACY_CONSENT_VERSION,
    recordedAt: new Date().toISOString(),
  } satisfies StoredConsent));
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function clearConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONSENT_KEY);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
