"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function HrNavigation() {
  const pathname = usePathname();
  if (!pathname.startsWith("/dashboard/rrhh") || pathname.includes("enrollments")) return null;
  return <nav aria-label="Áreas de recursos humanos" className="workspace-tabs mb-6">{[["workers", "Personal"], ["attendance", "Asistencia"], ["payroll", "Nómina"], ["contracts", "Contratos"]].map(([path, label]) => <Link key={path} href={`/dashboard/rrhh/${path}`} aria-current={pathname.includes(`/${path}`) ? "page" : undefined} className={cn("workspace-tab", pathname.includes(`/${path}`) && "workspace-tab-active")}>{label}</Link>)}</nav>;
}
