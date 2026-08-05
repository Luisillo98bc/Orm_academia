"use client";

import type { Cohort, Course, User } from "@/types/domain";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  BookOpen,
  Calendar,
  Users,
  Loader2,
  CheckCircle2,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminTrashPage() {
  const [activeTab, setActiveTab] = useState<"courses" | "cohorts" | "users">("courses");
  const [trashData, setTrashData] = useState<{ courses: Course[]; cohorts: Cohort[] }>({
    courses: [],
    cohorts: [],
  });
  const [trashUsers, setTrashUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadTrashData = async () => {
    setLoading(true);
    try {
      const [academicRes, usersRes] = await Promise.all([
        fetchApi("/academic/trash").catch(() => ({ courses: [], cohorts: [] })),
        fetchApi("/users/trash").catch(() => []),
      ]);
      setTrashData(academicRes || { courses: [], cohorts: [] });
      setTrashUsers(usersRes || []);
    } catch (err) {
      console.error("Error al cargar papelera", err);
      toast.error("No se pudo cargar los elementos de la papelera");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadTrashData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleRestoreCourse = async (id: string, name: string) => {
    setRestoringId(id);
    try {
      await fetchApi(`/academic/courses/${id}/restore`, { method: "PATCH" });
      toast.success(`Curso "${name}" restaurado correctamente`);
      loadTrashData();
    } catch  {
      toast.error("Error al restaurar el curso");
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreCohort = async (id: string, name: string) => {
    setRestoringId(id);
    try {
      await fetchApi(`/academic/cohorts/${id}/restore`, { method: "PATCH" });
      toast.success(`Cohorte "${name}" restaurada correctamente`);
      loadTrashData();
    } catch  {
      toast.error("Error al restaurar la cohorte");
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreUser = async (id: string, email: string) => {
    setRestoringId(id);
    try {
      await fetchApi(`/users/${id}/restore`, { method: "PATCH" });
      toast.success(`Usuario ${email} restaurado correctamente`);
      loadTrashData();
    } catch  {
      toast.error("Error al restaurar el usuario");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold mb-1">
            <ArchiveRestore className="h-6 w-6 text-amber-500" />
            <span className="text-sm uppercase tracking-wider text-amber-500">Respaldo y Seguridad</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Papelera de Reciclaje</h1>
          <p className="text-muted-foreground mt-1">
            Los elementos eliminados se conservan protegidos aquí. Puedes restaurarlos en cualquier momento.
          </p>
        </div>
        <Button onClick={loadTrashData} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex border-b border-border/50 gap-2">
        <button
          onClick={() => setActiveTab("courses")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "courses"
              ? "border-primary text-primary bg-primary/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Cursos Eliminados ({trashData.courses?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("cohorts")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "cohorts"
              ? "border-primary text-primary bg-primary/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Cohortes Eliminadas ({trashData.cohorts?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "users"
              ? "border-primary text-primary bg-primary/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Usuarios Archivados ({trashUsers?.length || 0})
        </button>
      </div>

      {/* Contenido de la Papelera */}
      {loading ? (
        <div className="flex justify-center p-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <div>
          {/* TAB CURSOS */}
          {activeTab === "courses" && (
            <div className="space-y-4">
              {trashData.courses.length === 0 ? (
                <div className="text-center p-12 border rounded-xl bg-card glass">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold">No hay cursos en la papelera</h3>
                  <p className="text-sm text-muted-foreground">Todos los cursos creados están activos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trashData.courses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-card border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            {course.code}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Eliminado: {new Date(course.deletedAt ?? 0).toLocaleDateString("es-ES")}
                          </span>
                        </div>
                        <h3 className="font-bold text-lg text-foreground">{course.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {course.description || "Sin descripción"}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/40 flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-mono">ID: {course.id.slice(0, 8)}...</span>
                        <Button
                          size="sm"
                          onClick={() => handleRestoreCourse(course.id, course.name)}
                          disabled={restoringId === course.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          {restoringId === course.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          )}
                          Restaurar Curso
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB COHORTES */}
          {activeTab === "cohorts" && (
            <div className="space-y-4">
              {trashData.cohorts.length === 0 ? (
                <div className="text-center p-12 border rounded-xl bg-card glass">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold">No hay cohortes en la papelera</h3>
                  <p className="text-sm text-muted-foreground">Todas las cohortes creadas están activas.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trashData.cohorts.map((cohort) => (
                    <div
                      key={cohort.id}
                      className="bg-card border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {cohort.courseName || "Curso"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Eliminada: {new Date(cohort.deletedAt ?? 0).toLocaleDateString("es-ES")}
                          </span>
                        </div>
                        <h3 className="font-bold text-lg text-foreground">{cohort.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Alumnos matriculados protegidos: {cohort.enrollmentCount || 0}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/40 flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-mono">ID: {cohort.id.slice(0, 8)}...</span>
                        <Button
                          size="sm"
                          onClick={() => handleRestoreCohort(cohort.id, cohort.name)}
                          disabled={restoringId === cohort.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          {restoringId === cohort.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          )}
                          Restaurar Cohorte
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB USUARIOS */}
          {activeTab === "users" && (
            <div className="space-y-4">
              {trashUsers.length === 0 ? (
                <div className="text-center p-12 border rounded-xl bg-card glass">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold">No hay usuarios en la papelera</h3>
                  <p className="text-sm text-muted-foreground">No existen cuentas inactivas o eliminadas.</p>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden glass">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-6 py-3 font-medium">Usuario</th>
                          <th className="px-6 py-3 font-medium">Email</th>
                          <th className="px-6 py-3 font-medium">Rol</th>
                          <th className="px-6 py-3 font-medium">Fecha Eliminación</th>
                          <th className="px-6 py-3 font-medium text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {trashUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-6 py-4 font-semibold text-foreground">
                              {u.firstName} {u.lastName}
                            </td>
                            <td className="px-6 py-4 font-mono text-muted-foreground">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                {u.roles?.join(", ") || "Usuario"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-muted-foreground">
                              {u.deletedAt ? new Date(u.deletedAt).toLocaleDateString("es-ES") : "Inactivo"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                size="sm"
                                onClick={() => handleRestoreUser(u.id, u.email)}
                                disabled={restoringId === u.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                              >
                                {restoringId === u.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ArchiveRestore className="h-3.5 w-3.5" />
                                )}
                                Restaurar Cuenta
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
