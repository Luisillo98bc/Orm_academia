import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function SectionSkeleton({ label = "Cargando sección" }: { label?: string }) {
  return <div role="status" aria-label={label} aria-busy="true" className="space-y-4 rounded-2xl border border-border/50 bg-card p-5">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-4"><div className="shimmer-loading h-6 w-2/3 rounded-lg" /><div className="shimmer-loading h-4 w-1/2 rounded-lg" /><div className="shimmer-loading h-28 rounded-xl" /></div>
  </div>;
}

export function DataSection({ loading, error, reload, label, children }: {
  loading: boolean; error: string; reload: () => void; label: string; children: ReactNode;
}) {
  if (loading) return <SectionSkeleton label={`Cargando ${label}`} />;
  if (error) return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
    <div><p className="font-semibold">No pudimos cargar {label}</p><p className="text-sm text-muted-foreground">{error}</p></div>
    <Button type="button" variant="outline" onClick={reload}>Reintentar {label}</Button>
  </div>;
  return children;
}
