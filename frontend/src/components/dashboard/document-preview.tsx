"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Download } from "lucide-react";
import { fetchApiResponse } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function DocumentPreview({ endpoint, title, onClose }: { endpoint: string; title: string; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    fetchApiResponse(endpoint).then(response => response.blob()).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el documento"); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [endpoint]);
  return <Modal title={title} onClose={onClose}><div className="flex h-[85dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"><div className="flex items-center justify-between gap-3 border-b border-border p-4"><h2 className="text-base font-semibold">{title}</h2><div className="flex items-center gap-2">{url && <Button asChild variant="outline" size="sm"><a href={url} download="documento.pdf"><Download className="mr-2 h-4 w-4" />Descargar</a></Button>}<Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar documento"><X className="h-5 w-5" /></Button></div></div>{error ? <p role="alert" className="p-6 text-sm text-destructive">{error}</p> : url ? <><p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">Si tu navegador no muestra el PDF, usa Descargar para abrirlo.</p><iframe title={title} src={url} className="min-h-0 w-full flex-1 bg-muted" /></> : <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Cargando documento…</div>}</div></Modal>;
}
