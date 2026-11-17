"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, getConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

export function PrivacyConsentBanner() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const refresh = () => setChoice(getConsent()?.choice || null);
    refresh();
    window.addEventListener(CONSENT_EVENT, refresh);
    return () => window.removeEventListener(CONSENT_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!choice && pathname !== "/privacy" && pathname !== "/terms") {
      firstActionRef.current?.focus();
    }
  }, [choice, pathname]);

  if (choice || pathname === "/privacy" || pathname === "/terms") return null;

  return (
    <aside className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 max-h-[min(34rem,calc(100dvh-1.5rem))] overflow-y-auto rounded-2xl border border-border bg-card/95 p-3.5 text-card-foreground shadow-2xl backdrop-blur-md sm:inset-x-auto sm:right-5 sm:max-w-xl sm:p-5" role="dialog" aria-labelledby="privacy-consent-title" aria-describedby="privacy-consent-description">
      <h2 id="privacy-consent-title" className="text-xs font-semibold sm:text-sm">Tu privacidad importa</h2>
      <p id="privacy-consent-description" className="mt-1 text-[11px] leading-4 text-slate-600 dark:text-slate-300 sm:text-xs sm:leading-5">Usamos cookies necesarias y analítica opcional. Revisa la <Link href="/privacy" className="font-semibold underline">política de privacidad</Link> y <Link href="/terms" className="font-semibold underline">términos</Link>.</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3 sm:flex sm:flex-wrap sm:justify-end">
        <button ref={firstActionRef} type="button" onClick={() => saveConsent("necessary")} className="min-h-9 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-600 dark:hover:bg-slate-800 sm:min-h-10">Solo necesarias</button>
        <button type="button" onClick={() => saveConsent("analytics")} className="min-h-9 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 sm:min-h-10">Aceptar analítica</button>
      </div>
    </aside>
  );
}
