"use client";

import type { PlatformSettings } from "@/types/domain";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { GraduationCap, LogOut, LayoutDashboard, Menu, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import { getMediaUrl } from "@/lib/media";
import Image from "next/image";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  const logoUrl = getMediaUrl(settings?.logoUrl);

  // Hide navbar on dashboard routes (dashboard has its own header)
  const isDashboard = pathname?.startsWith("/dashboard");
  const isHome = pathname === "/";
  const isMobileHeroOverlay = isHome && !scrolled && !mobileMenuOpen;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 15);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isDashboard) return;
    let mounted = true;
    fetchCatalogApi<PlatformSettings>("/settings/public", "settings")
      .then((data) => {
        if (mounted && data) setSettings(data);
      })
      .catch(() => {
        if (mounted) setSettings(null);
      });
    return () => {
      mounted = false;
    };
  }, [isDashboard]);

  if (isDashboard) return null;

  return (
    <header
      className={`public-navbar z-50 w-full transition-all duration-300 ${
        isHome ? "fixed inset-x-0 top-0 xl:sticky" : "sticky top-0"
      } ${
        isMobileHeroOverlay
          ? "public-navbar--hero-overlay border-b border-transparent xl:border-border/40 xl:bg-background/75 xl:backdrop-blur-md"
          : scrolled
            ? "border-b border-border/70 bg-background/90 shadow-sm backdrop-blur-xl"
            : "border-b border-border/40 bg-background/75 backdrop-blur-md"
      }`}
    >
      <div className="public-navbar-inner mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          {logoUrl && failedLogoUrl !== logoUrl ? (
            <Image
              unoptimized
              width={36}
              height={36}
              src={logoUrl}
              alt={settings?.academyName || "Logo de la academia"}
              className="h-8 w-8 shrink-0 rounded-lg object-contain shadow-sm xl:shadow-none"
              onError={() => setFailedLogoUrl(logoUrl)}
            />
          ) : (
            <div className="public-brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground shadow-sm transition-colors duration-200 group-hover:bg-primary/90">
              <GraduationCap className="h-5 w-5" />
            </div>
          )}
          <span
            className={`truncate text-base font-bold tracking-tight sm:text-lg ${
              isMobileHeroOverlay
                ? "text-white drop-shadow-sm xl:text-foreground xl:drop-shadow-none"
                : "text-foreground"
            }`}
          >
            {settings?.academyName || "Academia Virtual"}
          </span>
        </Link>

        {/* Center Navigation Links */}
        <nav aria-label="Navegación principal" className="hidden items-center gap-7 xl:flex">
          <Link
            href="/cursos"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            Programas
          </Link>
          <Link
            href="/#como-funciona"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            Metodología
          </Link>
          <Link
            href="/#resultados"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            Resultados
          </Link>
          <Link
            href="/#faq"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            Preguntas
          </Link>
          <Link
            href="/#contacto"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            Contacto
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden xl:block">
            <ThemeToggle />
          </div>

          <Link
            href={user ? "/dashboard" : "/cursos"}
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm transition xl:hidden ${
              isMobileHeroOverlay
                ? "bg-white text-slate-950 hover:bg-slate-100"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {user ? "Ir al Campus" : "Ver cursos"}
          </Link>

          {user ? (
            <div className="hidden xl:flex items-center gap-2">
              <Button asChild size="sm" className="h-10 gap-1.5 px-5 text-sm font-semibold shadow-sm">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Ir al Campus</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="h-10 w-10 rounded-full p-0 text-muted-foreground hover:text-destructive"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="hidden xl:flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-10 px-4 text-sm font-medium text-muted-foreground hover:text-accent">
                <Link href="/login">
                  Ingresar
                </Link>
              </Button>
              <Button asChild size="sm" className="h-10 gap-1.5 px-5 text-sm font-semibold shadow-none group">
                <Link href="/cursos">
                  <span>Ver programas</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className={`focus-ring rounded-xl p-2 transition-colors xl:hidden ${
              isMobileHeroOverlay
                ? "text-white hover:bg-white/15"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-label="Menú principal"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div id="mobile-navigation" className="space-y-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-xl animate-in slide-in-from-top duration-200 xl:hidden">
          <nav className="flex flex-col gap-1 text-base font-medium">
            <Link
              href="/cursos"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              Programas
            </Link>
            <Link
              href="/#como-funciona"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              Metodología
            </Link>
            <Link
              href="/#resultados"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              Resultados
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
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-medium text-muted-foreground">Apariencia</span>
              <ThemeToggle />
            </div>
            {user ? (
              <>
                <Button asChild className="w-full h-10 rounded-xl justify-center font-medium gap-2">
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Ir al Campus</span>
                  </Link>
                </Button>
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
                <Button asChild variant="outline" className="w-full h-10 rounded-xl font-medium">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    Ingresar
                  </Link>
                </Button>
                <Button asChild className="w-full h-10 rounded-xl font-medium bg-foreground text-background">
                  <Link href="/cursos" onClick={() => setMobileMenuOpen(false)}>
                    Ver programas
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
