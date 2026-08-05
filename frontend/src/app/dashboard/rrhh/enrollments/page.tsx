"use client";

import { useState, useEffect } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, UserPlus, GraduationCap, Users, Download, Search } from "lucide-react";
import { toast } from "sonner";
import type { Cohort, User } from "@/types/domain";

interface EnrollmentExportRow {
  Alumno: string;
  Email: string;
  Curso: string;
  Cohorte: string;
  FechaInscripcion: string;
  Estado: string;
}

export default function RrhhEnrollmentsPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [globalEnrollments, setGlobalEnrollments] = useState<EnrollmentExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedCohort, setSelectedCohort] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = async () => {
    try {
      const [usersData, cohortsData, enrollData] = await Promise.all([
        fetchApi("/users?role=ESTUDIANTE"),
        fetchApi("/academic/cohorts"),
        fetchApi("/academic/export-students")
      ]);
      setStudents(usersData || []);
      setCohorts(cohortsData || []);
      setGlobalEnrollments(enrollData || []);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const downloadGlobalEnrollmentsCSV = () => {
    if (globalEnrollments.length === 0) return;
    const headers = ["Alumno", "Email", "Curso", "Cohorte", "FechaInscripcion", "Estado"];
    const rows = globalEnrollments.map((enrollment) => [
      enrollment.Alumno,
      enrollment.Email,
      enrollment.Curso,
      enrollment.Cohorte,
      enrollment.FechaInscripcion,
      enrollment.Estado
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map((row) => row.map((value) => `"${value}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `matriculas_globales_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedCohort) {
      toast.error("Seleccione un estudiante y una cohorte");
      return;
    }

    setSubmitting(true);
    try {
      await fetchApi("/academic/enrollments/admin", {
        method: "POST",
        body: JSON.stringify({
          studentId: selectedStudent,
          cohortId: selectedCohort
        })
      });
      toast.success("Estudiante matriculado con éxito");
      setSelectedStudent("");
      setSelectedCohort("");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Error al matricular. Es posible que ya esté matriculado."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Matrículas Manuales</h2>
        <p className="text-muted-foreground mt-1">
          Inscribe estudiantes en cohortes disponibles directamente desde administración.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="glass border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Nueva Matrícula
            </CardTitle>
            <CardDescription>
              Seleccione al estudiante y la clase a la cual desea matricularlo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnroll} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" /> Estudiante
                </label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm glass"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  required
                >
                  <option value="">-- Seleccionar Estudiante --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.email})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Cohorte (Clase)
                </label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm glass"
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  required
                >
                  <option value="">-- Seleccionar Cohorte --</option>
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.course?.name} ({c.enrolledCount}/{c.maxCapacity} cupos)
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Procesar Matrícula
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Podríamos poner información útil aquí */}
        <Card className="glass opacity-70">
          <CardHeader>
            <CardTitle className="text-sm">Información Rápida</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Los estudiantes solo pueden estar matriculados una vez en la misma cohorte.</p>
            <p>• Las matrículas procesadas por RRHH o ADMIN no requieren confirmación adicional del estudiante.</p>
            <p>• El alumno verá su nuevo curso en la pestaña &ldquo;Mis Cursos&rdquo; de su panel inmediatamente.</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Alumnos Matriculados */}
      <Card className="glass border-primary/20 mt-8">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Lista de Estudiantes Matriculados
            </CardTitle>
            <CardDescription>
              Visualiza y descarga el reporte de estudiantes matriculados en todos los cursos.
            </CardDescription>
          </div>
          <Button onClick={downloadGlobalEnrollmentsCSV} className="gap-2 shrink-0" variant="outline" size="sm">
            <Download className="h-4 w-4" /> Exportar a CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Barra de Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por alumno, email, curso o cohorte..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {globalEnrollments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay estudiantes matriculados registrados.
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground font-semibold bg-muted/20">
                      <th className="py-3 px-4">Alumno</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Curso / Clase</th>
                      <th className="py-3 px-4 text-center">Fecha Inscripción</th>
                      <th className="py-3 px-4 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {globalEnrollments
                      .filter((enrollment: EnrollmentExportRow) => {
                        const search = searchTerm.toLowerCase();
                        return (
                          enrollment.Alumno.toLowerCase().includes(search) ||
                          enrollment.Email.toLowerCase().includes(search) ||
                          enrollment.Curso.toLowerCase().includes(search) ||
                          enrollment.Cohorte.toLowerCase().includes(search)
                        );
                      })
                      .map((e: EnrollmentExportRow, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{e.Alumno}</td>
                          <td className="py-3 px-4 text-muted-foreground">{e.Email}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold block">{e.Curso}</span>
                            <span className="text-xs text-muted-foreground">{e.Cohorte}</span>
                          </td>
                          <td className="py-3 px-4 text-center text-muted-foreground">{e.FechaInscripcion}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                              e.Estado === 'ACTIVE' 
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {e.Estado === 'ACTIVE' ? 'Activo' : e.Estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
