"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, House, Library } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export function MobileNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.roles[0];
  const links = [
    { href: "/dashboard", label: "Inicio", icon: House },
    { href: role === "ESTUDIANTE" ? "/dashboard/my-courses" : role === "DOCENTE" ? "/dashboard/classes" : role === "RRHH" ? "/dashboard/rrhh/workers" : "/dashboard/courses", label: role === "DOCENTE" ? "Clases" : role === "ESTUDIANTE" ? "Mis cursos" : role === "RRHH" ? "Personal" : "Cursos", icon: Library },
    { href: "/dashboard/calendar", label: "Agenda", icon: CalendarDays },
    { href: "/dashboard/notifications", label: "Avisos", icon: Bell },
  ];
  return <nav aria-label="Accesos rápidos del campus" className="mobile-campus-nav grid shrink-0 grid-cols-4 border-t border-border bg-card px-2 pt-1 md:hidden">
    {links.map(({ href, label, icon: Icon }) => {
      const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href) || (href === "/dashboard/my-courses" && pathname.startsWith("/dashboard/aula/"));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`focus-ring flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs ${active ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground"}`}><Icon aria-hidden="true" className="h-5 w-5" /><span>{label}</span></Link>;
    })}
  </nav>;
}
