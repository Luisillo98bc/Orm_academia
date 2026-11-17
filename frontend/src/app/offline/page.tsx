"use client";

import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <WifiOff className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">Modo sin conexión</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">No hay conexión disponible</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Puedes revisar las pantallas que ya visitaste. Cuando vuelva internet, recarga para continuar.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={() => window.location.reload()} className="gap-2"><RefreshCw className="h-4 w-4" /> Reintentar</Button>
          <Link href="/dashboard"><Button type="button" variant="outline">Ir al campus</Button></Link>
        </div>
      </section>
    </main>
  );
}
