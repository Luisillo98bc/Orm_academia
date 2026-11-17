"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

const emptyDraft = { fileUrl: "", comment: "" };

export function useSubmissionDraft(evaluationId: string) {
  const { user } = useAuth();
  const key = user ? `academy:submission-draft:${user.id}:${evaluationId}` : null;
  const [draft, setDraft] = useState(emptyDraft);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let restored = emptyDraft;
      try {
        const value = key ? JSON.parse(window.sessionStorage.getItem(key) || "null") : null;
        if (value && typeof value.fileUrl === "string" && typeof value.comment === "string") restored = { fileUrl: value.fileUrl, comment: value.comment };
        setNotice(restored === emptyDraft ? "" : "Borrador recuperado en este navegador.");
      } catch { setNotice("El navegador no permite recuperar borradores."); }
      setDraft(restored);
      setLoadedKey(key);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);
  const updateDraft = (next: typeof emptyDraft) => {
    setDraft(next);
    try {
      if (!key || loadedKey !== key) return;
      if (next.fileUrl || next.comment) window.sessionStorage.setItem(key, JSON.stringify(next));
      else window.sessionStorage.removeItem(key);
      setNotice(next.fileUrl || next.comment ? "Borrador guardado en esta pestaña." : "");
    } catch { setNotice("No se pudo guardar el borrador. Conserva una copia antes de salir."); }
  };
  const clearDraft = () => updateDraft(emptyDraft);
  return { draft, updateDraft, clearDraft, notice, ready: Boolean(key && loadedKey === key) };
}
