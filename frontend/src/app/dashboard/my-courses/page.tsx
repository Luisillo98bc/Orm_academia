"use client";

import type { Cohort, User } from "@/types/domain";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Loader2, Library, Calendar, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyCourses = async () => {
    try {
      const myEnrollments = await fetchApi("/academic/enrollments/me");
      setCourses(myEnrollments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadMyCourses();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card/50 glass">
        <Library className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-bold">No estás matriculado en ningún curso</h3>
        <p className="text-muted-foreground mt-2 max-w-md mb-6">
          Dirígete al catálogo de cursos para matricularte en alguna cohorte disponible.
        </p>
        <Link href="/dashboard">
          <Button>Ir al Inicio</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Mis Cursos</h2>
        <p className="text-muted-foreground mt-1">Accede a tus clases, revisa tus tareas pendientes y envía tus entregables.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((cls) => (
          <div key={cls.id} className="bg-card rounded-xl border border-border/50 overflow-hidden glass hover:border-primary/50 transition-colors flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  {cls.course?.level}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-1">{cls.course?.name}</h3>
              <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 shrink-0" /> <span className="line-clamp-1">Prof. {cls.teachers?.map((t: User) => t.lastName).join(', ') || 'Sin Asignar'}</span>
              </p>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Calendar className="h-3 w-3" />
                <span>Cohorte: {cls.name}</span>
              </div>
            </div>
            
            <div className="p-4 border-t border-border/50 bg-muted/20">
              <Link href={`/dashboard/my-courses/${cls.id}`} className="w-full block">
                <Button className="w-full" variant="outline">
                  Ver Tareas
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
