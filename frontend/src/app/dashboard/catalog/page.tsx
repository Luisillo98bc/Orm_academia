"use client";

import type { Cohort, User } from "@/types/domain";
import type { Money } from "@/lib/money";

import { useState, useEffect } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Loader2, BookOpen, GraduationCap, CheckCircle2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { moneyToNumber } from "@/lib/money";

export default function CatalogPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const loadCatalog = async () => {
    try {
      // Obtenemos todas las cohortes disponibles
      const allCohorts = await fetchApi("/academic/cohorts");
      setCohorts(allCohorts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCatalog();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleEnroll = async (cohortId: string, price: Money) => {
    if (moneyToNumber(price) > 0) {
      // Redirigir a nuestra página de checkout con Culqi
      router.push(`/dashboard/checkout?cohortId=${cohortId}`);
    } else {
      // Matrícula gratuita: procesar directamente
      setEnrolling(cohortId);
      try {
        await fetchApi("/payments/checkout", {
          method: "POST",
          body: JSON.stringify({ cohortId, method: "TARJETA" }),
        });
        router.push("/dashboard/my-courses");
      } catch (err: unknown) {
        alert(getErrorMessage(err, "Error al matricularse. Es posible que ya estés matriculado o la cohorte esté llena."));
        setEnrolling(null);
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Catálogo de Cohortes</h2>
        <p className="text-muted-foreground mt-1">Explora las clases disponibles y matricúlate con un clic.</p>
      </div>

      {cohorts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card/50 glass">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-bold">No hay clases abiertas</h3>
          <p className="text-muted-foreground mt-2 max-w-md">
            El administrador aún no ha abierto ninguna cohorte para matrícula. Vuelve más tarde.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cohorts.map((cls) => {
            const isEnrolled = cls.students?.some((s: User) => s.id === user?.id);
            const isFull = cls.enrolledCount >= cls.maxCapacity;

            return (
              <div key={cls.id} className="bg-card rounded-xl border border-border/50 overflow-hidden glass hover:border-primary/50 transition-colors flex flex-col">
                <div className="h-32 bg-muted relative overflow-hidden flex-shrink-0">
                  {cls.course?.imageUrl ? (
                    <Image unoptimized width={640} height={320} src={`${API_URL.replace('/api/v1', '')}${cls.course.imageUrl}`} alt={cls.course.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                      <ImageIcon className="h-10 w-10 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black/60 text-white backdrop-blur-sm">
                    {cls.course?.level}
                  </div>
                </div>
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      Cupos: {cls.enrolledCount}/{cls.maxCapacity}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{cls.course?.name}</h3>
                  <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 shrink-0" /> 
                    <span className="line-clamp-1">Prof. {cls.teachers?.map((t: User) => t.lastName).join(', ') || 'Sin Asignar'}</span>
                  </p>
                  <div className="flex items-center justify-between mb-4 bg-muted/30 p-2 rounded-md border border-border/30">
                    <p className="text-xs text-muted-foreground">
                      Cohorte: {cls.name}
                    </p>
                    <p className="text-sm font-bold text-primary">
                      {moneyToNumber(cls.price) > 0 ? `S/ ${cls.price}` : 'Gratis'}
                    </p>
                  </div>
                </div>
                
                <div className="p-4 border-t border-border/50 bg-muted/20">
                  {isEnrolled ? (
                    <Button className="w-full" variant="secondary" disabled>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Ya estás matriculado
                    </Button>
                  ) : isFull ? (
                    <Button className="w-full" variant="outline" disabled>
                      Cohorte Llena
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      onClick={() => handleEnroll(cls.id, cls.price)}
                      disabled={enrolling === cls.id}
                    >
                      {enrolling === cls.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {moneyToNumber(cls.price) > 0 ? "Pagar Matrícula" : "Matricularme"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
