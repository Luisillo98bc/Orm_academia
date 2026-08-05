"use client";

import type { Cohort, User } from "@/types/domain";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Loader2, BookOpen, Calendar, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeacherClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClasses = async () => {
    try {
      const allCohorts = await fetchApi("/academic/cohorts");
      // Filtramos las cohortes para mostrar solo las que le pertenecen a este docente
      const myClasses = allCohorts.filter((c: Cohort) => c.teachers?.some((t: User) => t.id === user?.id));
      setClasses(myClasses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

    const loadClassesEffect = useEffectEvent(loadClasses);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadClassesEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card/50 glass">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-bold">Sin clases asignadas</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          Aún no se te ha asignado ninguna cohorte para enseñar. Por favor, contacta a la administración.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Mis Clases</h2>
        <p className="text-muted-foreground mt-1">Selecciona una clase para gestionar sus evaluaciones y estudiantes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls) => (
          <div key={cls.id} className="bg-card rounded-xl border border-border/50 overflow-hidden glass hover:border-primary/50 transition-colors flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  {cls.course?.level}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {cls.enrolledCount}/{cls.maxCapacity}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-1">{cls.name}</h3>
              <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> {cls.course?.name}
              </p>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Calendar className="h-3 w-3" />
                <span>Del {new Date(cls.startDate).toLocaleDateString()} al {new Date(cls.endDate).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className="p-4 border-t border-border/50 bg-muted/20">
              <Link href={`/dashboard/classes/${cls.id}`} className="w-full block">
                <Button className="w-full" variant="outline">
                  Entrar al Salón
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
