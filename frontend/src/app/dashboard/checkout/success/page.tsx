"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="bg-card p-12 rounded-3xl shadow-xl border border-border max-w-xl w-full">
        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        
        <h1 className="text-4xl font-extrabold text-foreground mb-4">¡Pago Exitoso!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Tu pago ha sido procesado correctamente. Tu matrícula ya está activa y puedes comenzar a estudiar inmediatamente.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/dashboard/my-courses">
            <Button size="lg" className="w-full sm:w-auto rounded-full h-14 px-8 font-semibold text-lg">
              Ir a mis Cursos <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
