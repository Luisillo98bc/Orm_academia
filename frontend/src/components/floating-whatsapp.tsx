"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { WhatsAppLogo } from "@/components/whatsapp-logo";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import { trackConversion } from "@/lib/analytics";
import type { PlatformSettings } from "@/types/domain";

const BUBBLE_DISMISSED_KEY = "academy_whatsapp_bubble_dismissed";

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(BUBBLE_DISMISSED_KEY, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BUBBLE_DISMISSED_KEY, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readDismissed() {
  try { return sessionStorage.getItem(BUBBLE_DISMISSED_KEY) === "1"; }
  catch { return false; }
}

export function FloatingWhatsApp() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const storedDismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true);
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const bubbleDismissed = storedDismissed || dismissedLocally;

  const isDashboard = pathname?.startsWith("/dashboard");
  const isHome = pathname === "/";
  const isCohortPage = pathname?.startsWith("/cohorts/");
  const showBubble = isHome && !bubbleDismissed;

  useEffect(() => {
    if (isDashboard) return;
    let mounted = true;
    fetchCatalogApi<PlatformSettings>("/settings/public", "settings")
      .then((data) => {
        if (mounted && data) setSettings(data);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [isDashboard]);

  if (isDashboard) return null;

  const dismissBubble = () => {
    setDismissedLocally(true);
    try {
      sessionStorage.setItem(BUBBLE_DISMISSED_KEY, "1");
      window.dispatchEvent(new Event(BUBBLE_DISMISSED_KEY));
    } catch {
      // ignore storage access issues
    }
  };

  const rawNumber = settings?.whatsappNumber?.replace(/\D/g, "") || "51999999999";
  const academyName = settings?.academyName || "la academia";
  const href = `https://wa.me/${rawNumber}?text=${encodeURIComponent(
    `Hola, quisiera recibir orientación sobre los programas y matrículas de ${academyName}.`,
  )}`;

  return (
    <div
      className={`fixed right-4 z-40 flex flex-col items-end gap-2.5 print:hidden sm:right-6 ${
        isCohortPage ? "bottom-24 lg:bottom-6" : "bottom-6"
      }`}
    >
      {showBubble && (
        <div className="hidden max-w-[250px] items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 text-xs leading-5 text-slate-800 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:flex">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-teal-800 dark:text-teal-300">Asesoría en línea</p>
            <p className="mt-0.5 text-slate-600 dark:text-slate-300">
              ¿Dudas sobre horarios, edades o pagos? Escríbenos ahora.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissBubble}
            aria-label="Ocultar aviso de WhatsApp"
            className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <a
        data-testid="hero-whatsapp-floating"
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label="Contactar por WhatsApp con un asesor"
        onClick={() =>
          trackConversion("WHATSAPP_CLICK", {
            metadata: { placement: "floating_widget", path: pathname || "/" },
          })
        }
        className="cursor-pointer group flex h-14 items-center gap-2.5 rounded-full bg-[#128C7E] px-4 text-white shadow-[0_12px_30px_-8px_rgba(18,140,126,0.65)] transition-colors duration-200 hover:bg-[#075E54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
      >
        <WhatsAppLogo className="h-7 w-7 shrink-0" />
        <span className="hidden pr-1 text-sm font-bold tracking-tight sm:inline">
          Hablar con asesor
        </span>
      </a>
    </div>
  );
}
