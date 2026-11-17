"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function RegisterRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");

  useEffect(() => {
    router.replace(cohortId ? `/login?cohortId=${cohortId}` : "/login");
  }, [cohortId, router]);

  return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center gap-3 p-4 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Redirigiendo al acceso seguro con Google…</div>;
}

export default function RegisterPage() {
  return <Suspense fallback={<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 text-sm text-muted-foreground"><Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" />Cargando…</div>}><RegisterRedirect /></Suspense>;
}
