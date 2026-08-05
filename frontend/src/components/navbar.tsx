"use client";

import type { PlatformSettings } from "@/types/domain";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { GraduationCap, LogOut, LayoutDashboard, Menu, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { API_URL } from "@/lib/api";
import Image from "next/image";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  // Hide navbar on dashboard routes (dashboard has its own header)
  const isDashboard = pathname?.startsWith("/dashboard");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/settings`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => console.error("Error loading settings:", err));
  }, []);


  if (isDashboard) return null;

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-sm"
          : "border-b border-border/20 bg-background/40 backdrop-blur-md"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          {settings?.logoUrl ? (
            <Image unoptimized width={160} height={32} src={settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <div className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center font-bold shadow-sm transition-transform duration-300 group-hover:scale-105">
              <GraduationCap className="h-5 w-5" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg tracking-tight text-foreground">
              Academia<span className="font-light text-muted-foreground ml-0.5">Virtual</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PRO
            </span>
          </div>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-full border border-border/40">
          <Link
            href="/#cursos"
            className="px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/90 transition-all"
          >
            Cursos
          </Link>
          <Link
            href="/#beneficios"
            className="px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/90 transition-all"
          >
            Nosotros
          </Link>
          <Link
            href="/#faq"
            className="px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/90 transition-all"
          >
            Preguntas
          </Link>
          <Link
            href="/#contacto"
            className="px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/90 transition-all"
          >
            Contacto
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/dashboard">
                <Button size="sm" className="rounded-full h-10 px-5 text-sm font-semibold shadow-sm gap-1.5">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Ir al Campus</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="h-10 w-10 p-0 rounded-full text-muted-foreground hover:text-destructive"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="rounded-full h-10 px-4 text-sm font-medium text-muted-foreground hover:text-foreground">
                  Ingresar
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="rounded-full h-10 px-5 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all shadow-sm gap-1.5 group"
                >
                  <span>Registrarse</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Menú principal"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-xl px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200">
          <nav className="flex flex-col gap-1 text-base font-medium">
            <Link
              href="/#cursos"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              Cursos
            </Link>
            <Link
              href="/#beneficios"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              Nosotros
            </Link>
            <Link
              href="/#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              Preguntas Frecuentes
            </Link>
            <Link
              href="/#contacto"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              Contacto
            </Link>
          </nav>
          <div className="pt-3 border-t border-border flex flex-col gap-2">
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full h-10 rounded-xl justify-center font-medium gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Ir al Campus</span>
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full h-10 rounded-xl justify-center text-destructive border-destructive/20"
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  <span>Cerrar Sesión</span>
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full h-10 rounded-xl font-medium">
                    Ingresar
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full h-10 rounded-xl font-medium bg-foreground text-background">
                    Registrarse Gratis
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
