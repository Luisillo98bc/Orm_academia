"use client";

import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";
import type { User } from "@/types/domain";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { WorkspaceTabs } from "@/components/dashboard/workspace-tabs";
import { DataSection } from "@/components/dashboard/data-section";
import { useRemoteData } from "@/lib/use-remote-data";

export function UserRecord({ user, onClose }: { user: User; onClose: () => void }) {
  const enrollments = useRemoteData<{ data: { id: string; status: string; user: { id: string }; cohort: { name: string; course: { name: string } } }[] }>(`/academic/enrollment-management?search=${encodeURIComponent(user.email)}&limit=100`);
  const activity = useRemoteData<{ data: { id: string; action: string; entity: string; createdAt: string; user?: { email: string } }[] }>(`/audit-logs?search=${encodeURIComponent(user.email)}&limit=25`);
  return <Modal title={`Ficha de ${user.firstName} ${user.lastName}`} onClose={onClose}><div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-7">
    <div className="mb-5 flex items-start justify-between gap-3"><div><p className="page-eyebrow">Directorio de usuarios</p><h2 className="text-xl font-bold">{user.firstName} {user.lastName}</h2><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></div><Button aria-label="Cerrar ficha" variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button></div>
    <WorkspaceTabs label="Ficha de usuario" tabs={[
      { id: "profile", label: "Datos y acceso", content: <dl className="grid gap-5 py-3 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Nombre completo</dt><dd className="mt-1 font-medium">{user.firstName} {user.lastName}</dd></div><div><dt className="text-xs text-muted-foreground">Estado de acceso</dt><dd className="mt-1 font-medium">{user.isActive ? "Activo" : "Inactivo"}</dd></div><div><dt className="text-xs text-muted-foreground">Correo electrónico</dt><dd className="mt-1 break-all">{user.email}</dd></div><div><dt className="text-xs text-muted-foreground">Roles asignados</dt><dd className="mt-1">{user.roles?.map(role => typeof role === "string" ? role : role.name).join(", ")}</dd></div></dl> },
      { id: "enrollments", label: "Matrículas", content: <DataSection {...enrollments} label="matrículas del usuario"><div className="space-y-3">{enrollments.data?.data.filter(row => row.user.id === user.id).map(row => <div key={row.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-border p-4"><div><p className="font-semibold">{row.cohort.course.name}</p><p className="text-sm text-muted-foreground">{row.cohort.name}</p></div><span className="text-xs">{({ ACTIVE: "Activa", COMPLETED: "Finalizada", PENDING_PAYMENT: "Por validar", SUSPENDED: "Suspendida", DROPPED: "Retirada" } as Record<string, string>)[row.status] || row.status}</span></div>)}{!enrollments.data?.data.some(row => row.user.id === user.id) && <p className="py-6 text-center text-sm text-muted-foreground">Esta cuenta no tiene matrículas registradas.</p>}<Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary" href={`/dashboard/rrhh/enrollments?search=${encodeURIComponent(user.email)}`}>Abrir gestión de matrículas<ArrowUpRight className="h-4 w-4" /></Link></div></DataSection> },
      { id: "activity", label: "Actividad", content: <DataSection {...activity} label="actividad de la cuenta"><p className="mb-3 text-sm text-muted-foreground">Acciones registradas por esta cuenta, hasta 25 eventos recientes.</p><ol className="divide-y divide-border">{activity.data?.data.filter(log => log.user?.email === user.email).map(log => <li key={log.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{log.action.replaceAll("_", " ")} · {log.entity}</span><time className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("es-PE")}</time></li>)}</ol>{!activity.data?.data.some(log => log.user?.email === user.email) && <p className="py-6 text-sm text-muted-foreground">Sin actividad registrada en esta consulta.</p>}</DataSection> },
    ]} />
    <div className="mt-6 flex justify-end"><Button variant="outline" onClick={onClose}>Cerrar ficha</Button></div>
  </div></Modal>;
}
