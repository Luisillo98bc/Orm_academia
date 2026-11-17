"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Loader2, Menu, Sun, Moon, Sunrise } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { GraduationCap } from "lucide-react";
import { UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { WorkspaceBreadcrumbs } from "@/components/dashboard/workspace-breadcrumbs";
import { HrNavigation } from "@/components/rrhh/hr-navigation";

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Buenos días", icon: <Sunrise className="h-5 w-5 text-amber-400" /> };
  if (hour < 18) return { text: "Buenas tardes", icon: <Sun className="h-5 w-5 text-orange-400" /> };
  return { text: "Buenas noches", icon: <Moon className="h-5 w-5 text-indigo-400" /> };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-medium text-muted-foreground animate-pulse">Preparando tu campus virtual…</p>
      </div>
    );
  }

  const greeting = getGreeting();

  return (
    <div className={`dashboard-shell flex h-dvh overflow-hidden text-foreground ${user.roles.includes("ADMIN") ? "admin-workspace" : ""}`}>
      <a href="#campus-content" className="skip-link">Saltar al contenido principal</a>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-col flex-1 overflow-hidden">
        <header aria-label="Barra superior del campus" className="campus-topbar sticky top-0 z-30 flex h-[4.75rem] items-center gap-3 border-b border-border/60 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70 md:px-7">
          {/* Mobile: Hamburger + Logo */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="focus-ring rounded-lg p-2 transition-colors hover:bg-muted md:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 font-bold text-lg text-primary md:hidden">
            <GraduationCap className="h-5 w-5" />
            <span>Academia</span>
          </div>

          {/* Greeting — desktop only */}
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
              {greeting.icon}
            </div>
            <div className="leading-tight">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-muted-foreground">Campus virtual</p>
              <p className="text-sm font-semibold text-foreground">{greeting.text}, {user.firstName || user.email.split("@")[0]}</p>
            </div>
          </div>

          {/* Global Search */}
          <div className="mr-1 flex flex-1 justify-end">
            <GlobalSearch />
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-3 py-2 text-xs font-semibold text-accent lg:flex">
            <span className="campus-status-dot" aria-hidden="true" />
            Campus activo
          </div>

          {/* Right side actions */}
          <NotificationsBell />
          <ThemeToggle />
        </header>
        <div id="campus-content" tabIndex={-1} className="dashboard-content relative flex-1 overflow-y-auto p-5 outline-none md:p-7 lg:p-9">
          {/* Subtle background pattern & gradient */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-muted/30 to-background dark:from-background dark:via-muted/10 dark:to-background" />
          <div className="mx-auto max-w-[1400px]">
            {user.roles.includes("ADMIN") && <WorkspaceBreadcrumbs />}
            {user.roles.some(role => ["ADMIN", "RRHH"].includes(role)) && <HrNavigation />}
            {!user.profileComplete && (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm shadow-[0_12px_30px_-24px_rgba(180,83,9,0.7)] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-semibold">Completa tus datos personales</p><p className="text-muted-foreground">Agrega DNI, celular y domicilio para mantener actualizada tu ficha académica.</p></div></div>
                <Link href="/dashboard/profile" className="shrink-0 font-semibold text-primary hover:underline">Completar perfil</Link>
              </div>
            )}
            {children}
          </div>
        </div>
        <MobileNavigation />
      </div>
    </div>
  );
}
