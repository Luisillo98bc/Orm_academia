"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// ── Tipos para Culqi ──────────────────────────────────────────────────────
declare global {
  interface Window {
    Culqi: CulqiCheckout;
    culqi?: () => void;
  }
}

interface CulqiError {
  message?: string;
  user_message?: string;
}

interface CulqiCheckout {
  token?: { id: string; email: string };
  order?: unknown;
  error?: CulqiError;
  publicKey: string;
  settings: (settings: Record<string, unknown>) => void;
  options: (options: Record<string, unknown>) => void;
  open: () => void;
  close: () => void;
}

interface CulqiConfig {
  title: string;
  currency: string;
  amount: number; // En céntimos (e.g. 10000 = S/ 100.00)
  description?: string;
  orderId?: string; // Necesario para PagoEfectivo/Yape con orden
}

interface UseCulqiOptions {
  onToken: (token: { id: string; email: string }) => void;
  onError?: (error: CulqiError) => void;
  onClose?: () => void;
}

/**
 * Hook para integrar Culqi Checkout v4 en Next.js.
 *
 * Carga dinámicamente el script de Culqi y expone una función `openCheckout`
 * para abrir el modal de pago.
 *
 * Ejemplo de uso:
 * ```tsx
 * const { openCheckout, isReady } = useCulqi({
 *   onToken: (token) => { /* enviar token al backend *\/ },
 *   onError: (err) => { /* manejar error *\/ },
 * });
 *
 * openCheckout({
 *   title: "Mi Academia",
 *   currency: "PEN",
 *   amount: 10000, // S/ 100.00
 * });
 * ```
 */
export function useCulqi({ onToken, onError, onClose }: UseCulqiOptions) {
  const [isReady, setIsReady] = useState(
    () => typeof document !== "undefined" && Boolean(document.querySelector('script[src="https://checkout.culqi.com/js/v4"]')),
  );
  const isScriptLoaded = useRef(isReady);
  const callbackRef = useRef({ onToken, onError, onClose });

  // Mantener las refs actualizadas
  useEffect(() => {
    callbackRef.current = { onToken, onError, onClose };
  }, [onToken, onError, onClose]);

  // Cargar el script de Culqi dinámicamente
  useEffect(() => {
    if (isScriptLoaded.current) return;

    // Verificar si ya existe el script
    const existingScript = document.querySelector('script[src="https://checkout.culqi.com/js/v4"]');
    if (existingScript) {
      isScriptLoaded.current = true;
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.culqi.com/js/v4";
    script.async = true;
    script.onload = () => {
      isScriptLoaded.current = true;
      setIsReady(true);
    };
    script.onerror = () => {
      console.error("Error cargando script de Culqi Checkout");
    };
    document.body.appendChild(script);

    return () => {
      // No removemos el script porque puede ser reutilizado
    };
  }, []);

  // Registrar el callback global `window.culqi`
  useEffect(() => {
    window.culqi = function () {
      if (window.Culqi.token) {
        // Token generado exitosamente (tarjeta o Yape)
        callbackRef.current.onToken({
          id: window.Culqi.token.id,
          email: window.Culqi.token.email,
        });
      } else if (window.Culqi.order) {
        // Orden completada (PagoEfectivo — se maneja por webhook)
        // En este caso podemos notificar al usuario que espere la confirmación
        console.log("Orden Culqi:", window.Culqi.order);
      } else if (window.Culqi.error) {
        callbackRef.current.onError?.(window.Culqi.error);
      }
    };

    return () => {
      // Limpiamos el callback cuando se desmonte
      window.culqi = undefined;
    };
  }, []);

  // Función para abrir el modal de Culqi
  const openCheckout = useCallback((config: CulqiConfig) => {
    if (!window.Culqi) {
      console.error("Culqi no está cargado aún");
      callbackRef.current.onError?.({ message: "Culqi no está listo. Intenta de nuevo." });
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY || "pk_test_xxxxxxxxxxxxxxxx";
    window.Culqi.publicKey = publicKey;

    const settings: Record<string, unknown> = {
      title: config.title,
      currency: config.currency,
      amount: config.amount,
    };

    // Si hay un orderId, pasarlo para habilitar PagoEfectivo/Yape con orden
    if (config.orderId) {
      settings.order = config.orderId;
    }

    window.Culqi.settings(settings);

    // Opciones visuales del Checkout
    window.Culqi.options({
      lang: "auto",
      installments: false,
      paymentMethods: {
        tarjeta: true,
        yape: true,
        bancaMovil: true,
        agente: true,
        cuotealo: false,
      },
      style: {
        logo: null, // Puedes poner la URL del logo de tu academia aquí
        bannerColor: "#7c3aed", // Color violeta (primario de la plataforma)
        buttonBackground: "#7c3aed",
        menuColor: "#7c3aed",
        linksColor: "#7c3aed",
        buttonText: "Pagar",
        buttonTextColor: "#ffffff",
        priceColor: "#7c3aed",
      },
    });

    window.Culqi.open();
  }, []);

  const closeCheckout = useCallback(() => {
    if (window.Culqi) {
      window.Culqi.close();
      callbackRef.current.onClose?.();
    }
  }, []);

  return {
    openCheckout,
    closeCheckout,
    isReady,
  };
}
