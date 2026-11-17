"use client";

import { useEffect } from "react";
import { useConfirm } from "@/components/confirm-provider";

export function useUnsavedChanges(dirty: boolean, options?: { title: string; description: string }) {
  const confirm = useConfirm();
  const title = options?.title;
  const description = options?.description;
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onLink = async (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.href === window.location.href) return;
      const destination = new URL(link.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      if (await confirm({ title: title || "¿Salir sin enviar la entrega?", description: description || "Tu trabajo todavía no se ha enviado. Los enlaces y comentarios quedan como borrador en esta pestaña; tendrás que volver a seleccionar los archivos adjuntos.", confirmLabel: "Salir", destructive: false })) {
        window.removeEventListener("beforeunload", beforeUnload);
        window.location.assign(link.href);
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onLink, true); };
  }, [dirty, confirm, title, description]);
}
