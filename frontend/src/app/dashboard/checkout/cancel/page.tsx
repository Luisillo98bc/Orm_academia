"use client";

import Link from "next/link";
import { XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="bg-card p-12 rounded-3xl shadow-xl border border-border max-w-xl w-full">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-8">
          <XCircle className="w-12 h-12" />
        </div>
        
        <h1 className="text-4xl font-extrabold text-foreground mb-4">Pago Cancelado</h1>
        <p className="text-lg text-muted-foreground mb-8">
          El proceso de pago ha sido cancelado. No se ha realizado ningún cargo. Puedes intentarlo de nuevo cuando estés listo.
        </p>

        <div className="flex justify-center">
          <Link href="/dashboard/catalog">
            <Button size="lg" className="rounded-full h-14 px-8 font-semibold text-lg">
              <ArrowLeft className="mr-2 w-5 h-5" /> Volver a Cursos
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
