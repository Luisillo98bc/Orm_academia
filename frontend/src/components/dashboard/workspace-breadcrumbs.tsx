"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutDashboard } from "lucide-react";

const names: Record<string, string> = {
  users: "Usuarios", courses: "Cursos", cohorts: "Cohortes", calendar: "Calendario",
  rrhh: "Recursos humanos", workers: "Personal", enrollments: "Matrículas", attendance: "Asistencia",
  payroll: "Nómina", contracts: "Contratos", "my-contracts": "Mis contratos", payments: "Pagos",
  certificates: "Certificados", prospects: "Prospectos", reports: "Reportes", messages: "Mensajes",
  announcements: "Anuncios", forums: "Foros", notifications: "Notificaciones", support: "Soporte",
  audit: "Auditoría", system: "Estado del sistema", automations: "Automatizaciones", trash: "Papelera",
  settings: "Configuración", profile: "Mi perfil", aula: "Aula virtual",
};

export function WorkspaceBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1);
  return <nav aria-label="Ubicación actual" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    <Link href="/dashboard" className="inline-flex min-h-8 items-center gap-1.5 rounded hover:text-foreground"><LayoutDashboard aria-hidden="true" className="h-3.5 w-3.5" />Administración</Link>
    {segments.map((segment, index) => <span key={index} className="inline-flex items-center gap-2">
      <ChevronRight aria-hidden="true" className="h-3 w-3" />
      {index === segments.length - 1 ? <span aria-current="page" className="font-medium text-foreground">{names[segment] || "Detalle"}</span> : <Link href={`/dashboard/${segments.slice(0, index + 1).join("/")}`} className="hover:text-foreground">{names[segment] || "Detalle"}</Link>}
    </span>)}
  </nav>;
}
