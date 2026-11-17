"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { getMediaUrl } from "@/lib/media";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Calendar,
  GraduationCap,
  ClipboardList,
  Library,
  UserPlus,
  CreditCard,
  BarChart3,
  X,
  Award,
  Megaphone,
  MessagesSquare,
  MessageCircle,
  CalendarDays,
  LogOut,
  ChevronRight,
  Trash2,
  ContactRound,
  Settings,
  ShieldCheck,
  FileText,
  Bell,
  LifeBuoy,
  Activity,
  ChevronDown,
  Star,
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const storageKey = `academia:admin-favorites:${user?.id}`;
  useEffect(() => {
    if (!user?.roles.includes("ADMIN")) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      try { const saved = JSON.parse(localStorage.getItem(storageKey) || "[]"); if (Array.isArray(saved)) setFavorites(saved.filter(value => typeof value === "string")); } catch { /* Use an empty list if stored preferences are unavailable. */ }
    }, 0);
    Promise.allSettled([fetchApi("/prospects/stats"), fetchApi("/payments/pending?page=1&limit=1")]).then(results => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      if (results[0].status === "fulfilled") next["Prospectos"] = results[0].value.overdue || 0;
      if (results[1].status === "fulfilled") next["Pagos"] = results[1].value.pagination?.total || 0;
      setCounts(next);
    });
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [storageKey, user?.roles]);
  const toggleFavorite = (href: string) => setFavorites(current => {
    const next = current.includes(href) ? current.filter(item => item !== href) : [...current, href];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep preferences for the current session. */ }
    return next;
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults = { Inicio: true, Aprendizaje: true, Académico: true };
    if (typeof window === "undefined") return defaults;
    const saved = window.localStorage.getItem("academia:sidebar-groups");
    if (!saved) return defaults;
    try { return { ...defaults, ...JSON.parse(saved) }; } catch { return defaults; }
  });

  if (!user) return null;

  const role = user.roles[0];

  // Definir links basados en el rol
  const links = [{ name: "Inicio", href: "/dashboard", icon: LayoutDashboard }];

  if (role === "ADMIN") {
    links.push(
      { name: "Cursos", href: "/dashboard/courses", icon: BookOpen },
      { name: "Usuarios", href: "/dashboard/users", icon: Users },
      { name: "Cohortes", href: "/dashboard/cohorts", icon: Calendar },
      { name: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
      {
        name: "Matrículas",
        href: "/dashboard/rrhh/enrollments",
        icon: UserPlus,
      },
      {
        name: "Recursos Humanos",
        href: "/dashboard/rrhh/workers",
        icon: ClipboardList,
      },
      { name: "Contratos", href: "/dashboard/rrhh/contracts", icon: FileText },
      { name: "Asistencia", href: "/dashboard/rrhh/attendance", icon: CalendarDays },
      { name: "Nómina", href: "/dashboard/rrhh/payroll", icon: ClipboardList },
      {
        name: "Mis contratos",
        href: "/dashboard/my-contracts",
        icon: FileText,
      },
      { name: "Pagos", href: "/dashboard/payments", icon: CreditCard },
      { name: "Certificados", href: "/dashboard/certificates", icon: Award },
      { name: "Mensajes", href: "/dashboard/messages", icon: MessageCircle },
      { name: "Anuncios", href: "/dashboard/announcements", icon: Megaphone },
      { name: "Foros", href: "/dashboard/forums", icon: MessagesSquare },
      { name: "Reportes", href: "/dashboard/reports", icon: BarChart3 },
      { name: "Prospectos", href: "/dashboard/prospects", icon: ContactRound },
      { name: "Auditoría", href: "/dashboard/audit", icon: ShieldCheck },
      { name: "Estado del sistema", href: "/dashboard/system", icon: ShieldCheck },
      { name: "Automatizaciones", href: "/dashboard/automations", icon: Activity },
      { name: "Papelera", href: "/dashboard/trash", icon: Trash2 },
      { name: "Configuración", href: "/dashboard/settings", icon: Settings },
    );
  } else if (role === "DOCENTE") {
    links.push(
      { name: "Mis Clases", href: "/dashboard/classes", icon: GraduationCap },
      { name: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
      {
        name: "Evaluaciones",
        href: "/dashboard/classes/evaluations",
        icon: ClipboardList,
      },
      { name: "Mensajes", href: "/dashboard/messages", icon: MessageCircle },
      { name: "Foros", href: "/dashboard/forums", icon: MessagesSquare },
      {
        name: "Mis contratos",
        href: "/dashboard/my-contracts",
        icon: FileText,
      },
    );
  } else if (role === "ESTUDIANTE") {
    links.push(
      { name: "Catálogo", href: "/dashboard/catalog", icon: BookOpen },
      { name: "Mis Cursos", href: "/dashboard/my-courses", icon: Library },
      { name: "Mis Pagos", href: "/dashboard/my-payments", icon: CreditCard },
      { name: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
      {
        name: "Mis Certificados",
        href: "/dashboard/my-certificates",
        icon: Award,
      },
      { name: "Mensajes", href: "/dashboard/messages", icon: MessageCircle },
      { name: "Foros", href: "/dashboard/forums", icon: MessagesSquare },
    );
  } else if (role === "RRHH") {
    links.push(
      { name: "Trabajadores", href: "/dashboard/rrhh/workers", icon: Users },
      {
        name: "Matrículas",
        href: "/dashboard/rrhh/enrollments",
        icon: UserPlus,
      },
      { name: "Pagos", href: "/dashboard/payments", icon: CreditCard },
      { name: "Certificados", href: "/dashboard/certificates", icon: Award },
      { name: "Nómina", href: "/dashboard/rrhh/payroll", icon: ClipboardList },
      { name: "Contratos", href: "/dashboard/rrhh/contracts", icon: FileText },
      {
        name: "Mis contratos",
        href: "/dashboard/my-contracts",
        icon: FileText,
      },
    );
  }

  links.push({ name: "Notificaciones", href: "/dashboard/notifications", icon: Bell });
  links.push({ name: "Soporte", href: "/dashboard/support", icon: LifeBuoy });

  const groupFor = (name: string) => {
    if (name === "Inicio") return "Inicio";
    if (["Cursos", "Cohortes", "Calendario", "Matrículas", "Mis Clases", "Evaluaciones", "Catálogo", "Mis Cursos", "Mis Certificados", "Certificados", "Foros"].includes(name)) return role === "ESTUDIANTE" ? "Aprendizaje" : "Académico";
    if (["Usuarios", "Prospectos", "Trabajadores", "Recursos Humanos", "Asistencia", "Contratos"].includes(name)) return "Personas";
    if (["Pagos", "Mis Pagos", "Reportes", "Nómina"].includes(name)) return "Finanzas";
    if (["Mensajes", "Anuncios", "Notificaciones", "Soporte"].includes(name)) return "Comunicación";
    return "Administración";
  };
  const groupedLinks = links.reduce<Record<string, typeof links>>((groups, link) => {
    const group = groupFor(link.name);
    (groups[group] ||= []).push(link);
    return groups;
  }, {});
  const groupOrder = ["Inicio", "Aprendizaje", "Académico", "Personas", "Finanzas", "Comunicación", "Administración"];
  const toggleGroup = (group: string) => setOpenGroups((current) => {
    const next = { ...current, [group]: !current[group] };
    window.localStorage.setItem("academia:sidebar-groups", JSON.stringify(next));
    return next;
  });

  const handleLinkClick = () => {
    // Cerrar sidebar en mobile al navegar
    if (onClose) onClose();
  };

  const handleLogout = () => {
    if (onClose) onClose();
    logout();
  };

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador",
    DOCENTE: "Docente",
    ESTUDIANTE: "Estudiante",
    RRHH: "Recursos Humanos",
  };

  const sidebarContent = (instance: string) => (
    <div className="campus-sidebar flex h-full flex-col py-5 text-primary-foreground">
      <div className="mb-6 flex items-center justify-between px-5">
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 font-bold tracking-tight text-white"
        >
          <div className="rounded-2xl bg-accent p-2 text-accent-foreground shadow-lg shadow-black/10 transition-transform group-hover:-rotate-3">
            <GraduationCap className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="flex flex-col leading-tight">
            <span className="text-[1.05rem]">Academia</span>
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-primary-foreground/55">
              Learning OS
            </span>
          </span>
        </Link>
        {/* Botón de cerrar solo en mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="focus-ring rounded-lg p-1.5 text-primary-foreground/70 transition-colors hover:bg-white/10 md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3" aria-label="Navegación principal">
        {role === "ADMIN" && favorites.length > 0 && <section aria-label="Favoritos" className="mb-4 border-b border-white/10 pb-3">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary-foreground/65">Favoritos</p>
          {links.filter(link => favorites.includes(link.href)).map(link => <Link key={link.href} href={link.href} onClick={handleLinkClick} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-primary-foreground/85 hover:bg-white/10"><Star aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />{link.name}</Link>)}
        </section>}
        {groupOrder.filter((group) => groupedLinks[group]?.length).map((group) => {
          const items = groupedLinks[group];
          const isHome = group === "Inicio";
          const groupHasActive = items.some((link) => pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(`${link.href}/`)));
          return (
            <section key={group} aria-label={group}>
              {!isHome && (
                <button type="button" onClick={() => toggleGroup(group)} aria-expanded={Boolean(openGroups[group] || groupHasActive)} aria-controls={`${instance}-sidebar-group-${group}`} className="focus-ring flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground/65 hover:bg-white/5 hover:text-white">
                  <span>{group}</span><ChevronDown className={cn("h-3.5 w-3.5 transition-transform", openGroups[group] && "rotate-180")} />
                </button>
              )}
              {(isHome || openGroups[group] || groupHasActive) && <div id={`${instance}-sidebar-group-${group}`} className="space-y-0.5">{items.map((link, i) => {
                const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(`${link.href}/`));
                const Icon = link.icon;
                return <div key={link.name} className="group/nav flex items-center gap-1"><Link href={link.href} onClick={handleLinkClick} aria-current={isActive ? "page" : undefined} className={cn("focus-ring group relative flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200", isActive ? "bg-white text-primary shadow-sm" : "text-primary-foreground/80 hover:bg-white/10 hover:text-white")} style={{ animationDelay: `${i * 30}ms` }}>
                  {isActive && <motion.div layoutId="sidebar-active" className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-white" transition={{ type: "spring", damping: 25, stiffness: 300 }} />}
                  <Icon className={cn("h-4 w-4 transition-colors", isActive ? "text-accent" : "text-primary-foreground/55 group-hover:text-white")} />
                  <span className="flex-1">{link.name}</span>{counts[link.name] > 0 && <span title="Pendientes al abrir el panel" className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-xs font-bold tabular-nums">{counts[link.name]}</span>}{isActive && <ChevronRight className="h-3.5 w-3.5 text-accent-foreground/60" />}
                </Link>{role === "ADMIN" && <button type="button" onClick={() => toggleFavorite(link.href)} aria-label={`${favorites.includes(link.href) ? "Quitar" : "Añadir"} ${link.name} ${favorites.includes(link.href) ? "de" : "a"} favoritos`} aria-pressed={favorites.includes(link.href)} className={cn("rounded-lg p-2 transition-colors hover:bg-white/10 focus-visible:opacity-100", favorites.includes(link.href) ? "text-amber-300" : "text-white/55 md:opacity-0 md:group-hover/nav:opacity-100")}><Star className="h-3.5 w-3.5" fill={favorites.includes(link.href) ? "currentColor" : "none"} /></button>}</div>;
              })}</div>}
            </section>
          );
        })}
      </nav>

      <div className="mt-4 space-y-2 px-4">
        <div className="grid grid-cols-2 gap-1">
        {/* Ir al sitio web */}
        <Link
          href="/"
          onClick={handleLinkClick}
          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-white group"
        >
          <GraduationCap className="h-4 w-4 transition-colors group-hover:text-accent" />
          <span>Sitio web</span>
        </Link>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-primary-foreground/80 transition-colors hover:bg-red-500/15 hover:text-red-200 group"
        >
          <LogOut className="h-4 w-4 group-hover:text-red-500 transition-colors" />
          <span>Cerrar Sesión</span>
        </button>
        </div>

        {/* Profile Card */}
        <Link
          href="/dashboard/profile"
          onClick={handleLinkClick}
          className="group block rounded-xl border border-white/10 bg-white/8 p-3 transition-colors hover:bg-white/15"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 ring-2 ring-accent/25">
              {user.profilePicture ? (
                <Image
                  unoptimized
                  width={40}
                  height={40}
                  src={getMediaUrl(user.profilePicture) || ""}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users className="h-5 w-5 text-accent" />
              )}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-semibold transition-colors group-hover:text-accent">
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email.split("@")[0]}
              </p>
              <p className="truncate text-xs text-primary-foreground/60" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center rounded-md border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
            {roleLabels[role] || role}
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar — fixed, always visible */}
      <div className="hidden w-[18rem] border-r border-primary-foreground/10 bg-primary md:block">
        {sidebarContent("desktop")}
      </div>

      {/* Mobile Sidebar — drawer overlay with animation */}
      <AnimatePresence>
        {isOpen && (
          <Modal title="Navegación del campus" onClose={() => onClose?.()}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={onClose}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-primary-foreground/10 bg-primary shadow-2xl md:hidden"
            >
              {sidebarContent("mobile")}
            </motion.div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
