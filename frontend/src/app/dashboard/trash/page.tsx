"use client";

import { useState } from "react";
import { ArchiveRestore, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Course, Cohort, User } from "@/types/domain";
import { fetchApi } from "@/lib/api";
import { useRemoteData } from "@/lib/use-remote-data";
import { useConfirm } from "@/components/confirm-provider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceTabs, SummaryStrip } from "@/components/dashboard/workspace-tabs";
import { DataSection } from "@/components/dashboard/data-section";

export default function AdminTrashPage() {
  const academic = useRemoteData<{ courses: Course[]; cohorts: Cohort[] }>("/academic/trash");
  const users = useRemoteData<User[]>("/users/trash");
  const [restoring, setRestoring] = useState<string | null>(null);
  const confirm = useConfirm();
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("es-PE") : "Sin fecha registrada";
  const restore = async (type: string, id: string, label: string) => {
    if (!(await confirm({ title: `Restaurar ${label}`, description: "El registro volverá a estar disponible en su módulo. Revisa sus fechas, estado y relaciones después de recuperarlo.", confirmLabel: "Restaurar registro", destructive: false }))) return;
    setRestoring(id);
    try { await fetchApi(`${type}/${id}/restore`, { method: "PATCH" }); toast.success("Registro restaurado"); await Promise.all([academic.reload(), users.reload()]); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo restaurar el registro"); }
    finally { setRestoring(null); }
  };
  const action = (type: string, id: string, label: string) => <Button size="sm" variant="outline" disabled={restoring !== null} onClick={() => void restore(type, id, label)}>{restoring === id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArchiveRestore className="mr-2 h-4 w-4" />}Restaurar</Button>;
  return <div className="space-y-6">
    <PageHeader eyebrow="Respaldo y recuperación" title="Papelera de reciclaje" description="Busca y recupera cursos, cohortes y cuentas eliminadas." actions={<Button variant="outline" disabled={academic.loading || users.loading} onClick={() => { void academic.reload(); void users.reload(); }}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>} />
    <SummaryStrip items={[{ label: "Cursos eliminados", value: academic.data?.courses.length ?? "—" }, { label: "Cohortes eliminadas", value: academic.data?.cohorts.length ?? "—" }, { label: "Usuarios eliminados", value: users.data?.length ?? "—" }]} />
    <p className="workspace-note">Restaurar recupera el registro conservado. Verifica la publicación del curso, las fechas de la cohorte o el acceso del usuario desde el módulo correspondiente.</p>
    <WorkspaceTabs label="Tipos de registros eliminados" tabs={[
      { id: "courses", label: "Cursos", count: academic.data?.courses.length, content: <DataSection {...academic} label="cursos eliminados"><DataTable<Course> data={academic.data?.courses || []} searchPlaceholder="Buscar cursos eliminados" emptyMessage="No hay cursos en la papelera." columns={[{ key: "name", header: "Curso", render: course => <div><p className="font-semibold">{course.name}</p><p className="text-xs text-muted-foreground">{course.code}</p></div> }, { key: "deletedAt", header: "Eliminado", render: course => date(course.deletedAt) }, { key: "actions", header: "Acción", render: course => action("/academic/courses", course.id, course.name) }]} /></DataSection> },
      { id: "cohorts", label: "Cohortes", count: academic.data?.cohorts.length, content: <DataSection {...academic} label="cohortes eliminadas"><DataTable<Cohort> data={academic.data?.cohorts || []} searchPlaceholder="Buscar cohortes eliminadas" emptyMessage="No hay cohortes en la papelera." columns={[{ key: "name", header: "Cohorte", render: cohort => <div><p className="font-semibold">{cohort.name}</p><p className="text-xs text-muted-foreground">{cohort.course?.name}</p></div> }, { key: "deletedAt", header: "Eliminada", render: cohort => date(cohort.deletedAt) }, { key: "actions", header: "Acción", render: cohort => action("/academic/cohorts", cohort.id, cohort.name) }]} /></DataSection> },
      { id: "users", label: "Usuarios", count: users.data?.length, content: <DataSection {...users} label="usuarios eliminados"><DataTable<User> data={users.data || []} searchPlaceholder="Buscar usuarios eliminados" emptyMessage="No hay usuarios en la papelera." columns={[{ key: "firstName", header: "Usuario", render: user => <div><p className="font-semibold">{user.firstName} {user.lastName}</p><p className="text-xs text-muted-foreground">{user.email}</p></div> }, { key: "roles", header: "Roles", render: user => user.roles?.map(role => typeof role === "string" ? role : role.name).join(", ") }, { key: "deletedAt", header: "Eliminado", render: user => date(user.deletedAt) }, { key: "actions", header: "Acción", render: user => action("/users", user.id, user.email) }]} /></DataSection> },
    ]} />
  </div>;
}
