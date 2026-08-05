"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";
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
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const role = user.roles[0];

  // Definir links basados en el rol
  const links = [
    { name: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  ];

  if (role === "ADMIN") {
    links.push(
      { name: "Cursos", href: "/dashboard/courses", icon: BookOpen },
      { name: "Usuarios", href: "/dashboard/users", icon: Users },
      { name: "Cohortes", href: "/dashboard/cohorts", icon: Calendar },
      { name: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
      { name: "Matrículas", href: "/dashboard/rrhh/enrollments", icon: UserPlus },
      { name: "Recursos Humanos", href: "/dashboard/rrhh/workers", icon: ClipboardList },
      { name: "Pagos", href: "/dashboard/payments", icon: CreditCard },
      { name: "Certificados", href: "/dashboard/certificates", icon: Award },
      { name: "Mensajes", href: "/dashboard/messages", icon: MessageCircle },
      { name: "Anuncios", href: "/dashboard/announcements", icon: Megaphone },
      { name: "Foros", href: "/dashboard/forums", icon: MessagesSquare },
      { name: "Reportes", href: "/dashboard/reports", icon: BarChart3 },
      { name: "Papelera", href: "/dashboard/trash", icon: Trash2 },
      { name: "Configuración", href: "/dashboard/settings", icon: LayoutDashboard }
    );

  } else if (role === "DOCENTE") {
    links.push(
      { name: "Mis Clases", href: "/dashboard/classes", icon: GraduationCap },
      { name: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
      { name: "Evaluaciones", href: "/dashboard/classes/evaluations", icon: ClipboardList },
      { name: "Mensajes", href: "/dashboard/messages", icon: MessageCircle },
      { name: "Foros", href: "/dashboard/forums", icon: MessagesSquare }
    );
  } else if (role === "ESTUDIANTE") {
    links.push(
      { name: "Catálogo", href: "/dashboard/catalog", icon: BookOpen },
      { name: "Mis Cursos", href: "/dashboard/my-courses", icon: Library },
      { name: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
      { name: "Mis Certificados", href: "/dashboard/my-certificates", icon: Award },
      { name: "Mensajes", href: "/dashboard/messages", icon: MessageCircle },
      { name: "Foros", href: "/dashboard/forums", icon: MessagesSquare }
    );
  } else if (role === "RRHH") {
    links.push(
      { name: "Trabajadores", href: "/dashboard/rrhh/workers", icon: Users },
      { name: "Matrículas", href: "/dashboard/rrhh/enrollments", icon: UserPlus },
      { name: "Pagos", href: "/dashboard/payments", icon: CreditCard },
      { name: "Certificados", href: "/dashboard/certificates", icon: Award },
      { name: "Nómina", href: "/dashboard/rrhh/payroll", icon: ClipboardList }
    );
  }

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

  const sidebarContent = (
    <div className="flex flex-col h-full py-6">
      <div className="px-6 mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-primary group">
          <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span>Academia</span>
        </Link>
        {/* Botón de cerrar solo en mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {links.map((link, i) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          
          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-primary"
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                />
              )}
              <Icon className={cn("h-4 w-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="flex-1">{link.name}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary/50" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 mt-4 space-y-2">
        {/* Ir al sitio web */}
        <Link
          href="/"
          onClick={handleLinkClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-muted-foreground hover:bg-primary/10 hover:text-primary group"
        >
          <GraduationCap className="h-4 w-4 group-hover:text-primary transition-colors" />
          <span>Volver a la Web</span>
        </Link>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500 group"
        >
          <LogOut className="h-4 w-4 group-hover:text-red-500 transition-colors" />
          <span>Cerrar Sesión</span>
        </button>

        {/* Profile Card */}
        <Link href="/dashboard/profile" onClick={handleLinkClick} className="block rounded-xl bg-muted/50 p-4 border border-border/50 hover:bg-muted transition-all cursor-pointer group hover:shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center shrink-0 ring-2 ring-primary/20">
              {user.profilePicture ? (
                <Image unoptimized width={40} height={40} src={`${API_URL.replace('/api/v1', '')}${user.profilePicture}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Users className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email.split("@")[0]}
              </p>
              <p className="text-xs text-muted-foreground truncate" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-primary bg-primary/10 border-primary/20">
            {roleLabels[role] || role}
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar — fixed, always visible */}
      <div className="w-64 border-r border-border/50 bg-card hidden md:block">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar — drawer overlay with animation */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={onClose}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border/50 shadow-2xl md:hidden"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
