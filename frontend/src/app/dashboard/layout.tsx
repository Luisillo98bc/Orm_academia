"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Loader2, Menu, Sun, Moon, Sunrise } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { GraduationCap } from "lucide-react";

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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const greeting = getGreeting();

  return (
    <div className="flex h-screen overflow-hidden bg-muted/10">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="h-16 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 md:px-6 gap-3">
          {/* Mobile: Hamburger + Logo */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="md:hidden flex items-center gap-2 font-bold text-lg text-primary">
            <GraduationCap className="h-5 w-5" />
            <span>Academia</span>
          </div>

          {/* Greeting — desktop only */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            {greeting.icon}
            <span className="text-muted-foreground">
              {greeting.text}, <span className="font-semibold text-foreground">{user.firstName || user.email.split("@")[0]}</span>
            </span>
          </div>

          {/* Global Search */}
          <div className="flex-1 flex justify-end mr-1">
            <GlobalSearch />
          </div>

          {/* Right side actions */}
          <NotificationsBell />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          {/* Subtle background pattern & gradient */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-muted/30 to-background dark:from-background dark:via-muted/10 dark:to-background" />
          <div className="absolute inset-0 -z-10 opacity-[0.03] dark:opacity-[0.05]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
