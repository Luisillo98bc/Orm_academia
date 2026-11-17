"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface GoogleLoginButtonProps {
  onCredential: (credential: string) => Promise<void>;
  disabled?: boolean;
}

export function GoogleLoginButton({ onCredential, disabled = false }: GoogleLoginButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

  const renderGoogleButton = useCallback(() => {
    if (!clientId || !buttonRef.current || !window.google) return;

    buttonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => void onCredential(response.credential),
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: Math.min(360, Math.max(240, buttonRef.current.clientWidth || 360)),
    });
  }, [clientId, onCredential]);

  useEffect(() => {
    if (scriptReady) renderGoogleButton();
  }, [renderGoogleButton, scriptReady]);

  if (!clientId) {
    return <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm text-amber-800 dark:text-amber-200">El acceso con Google estará disponible cuando se configure el Client ID de producción.</p>;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setScriptError(true)}
      />
      <div className="relative">
        <div ref={buttonRef} className={`flex min-h-11 justify-center transition-opacity ${disabled ? "opacity-60" : ""}`} aria-label="Continuar con Google" aria-busy={disabled} />
        {disabled && <div className="absolute inset-0 cursor-wait" aria-hidden="true" />}
      </div>
      {scriptError && <p className="mt-2 text-center text-sm text-destructive" role="alert">No se pudo cargar Google. Revisa tu conexión e inténtalo nuevamente.</p>}
    </>
  );
}
