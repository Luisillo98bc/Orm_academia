"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BookOpenCheck,
  ExternalLink,
  GraduationCap,
  Mail,
  QrCode,
  ShieldCheck,
  Video,
} from "lucide-react";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import { clearConsent } from "@/lib/consent";
import { WhatsAppLogo } from "@/components/whatsapp-logo";
import type { PlatformSettings } from "@/types/domain";

export function Footer() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    if (pathname?.startsWith("/dashboard")) return;
    let mounted = true;
    fetchCatalogApi<PlatformSettings>("/settings/public", "settings")
      .then((data) => {
        if (mounted) setSettings(data);
      })
      .catch(() => {
        if (mounted) setSettings(null);
      });
    return () => {
      mounted = false;
    };
  }, [pathname]);

  if (pathname?.startsWith("/dashboard")) return null;

  const whatsappNumber = settings?.whatsappNumber?.replace(/\D/g, "");
  const socialLinks = [
    { label: "Facebook", href: settings?.facebookUrl },
    { label: "Instagram", href: settings?.instagramUrl },
    { label: "LinkedIn", href: settings?.linkedinUrl },
    { label: "YouTube", href: settings?.youtubeUrl },
    { label: "TikTok", href: settings?.tiktokUrl },
    { label: "X", href: settings?.xUrl },
  ].filter((social) => Boolean(social.href));

  return (
    <footer className="public-footer border-t border-border bg-white text-slate-600 dark:bg-background dark:text-slate-300">
      {/* Franja superior de sellos de garantía institucional */}
      <div className="border-b border-border bg-slate-50/80 dark:bg-white/[0.03]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 sm:grid-cols-3 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-300">
              <Video className="h-4 w-4" />
            </span>
            <div className="text-xs">
              <p className="font-bold text-slate-950 dark:text-white">Clases en Vivo + Grabaciones</p>
              <p className="text-slate-500 dark:text-slate-400">Acceso 24/7 al campus virtual interactivo</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-300">
              <QrCode className="h-4 w-4" />
            </span>
            <div className="text-xs">
              <p className="font-bold text-slate-950 dark:text-white">Certificados Oficiales con QR</p>
              <p className="text-slate-500 dark:text-slate-400">Verificación pública instantánea en línea</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="text-xs">
              <p className="font-bold text-slate-950 dark:text-white">Matrícula 100% Protegida</p>
              <p className="text-slate-500 dark:text-slate-400">Pago único o en cuotas vía Yape, Plin o Banco</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cuerpo principal del Footer */}
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16">
        <div
          className={`grid gap-10 ${
            socialLinks.length
              ? "md:grid-cols-[1.35fr_0.75fr_0.85fr_0.75fr]"
              : "md:grid-cols-[1.4fr_0.8fr_0.9fr]"
          }`}
        >
          {/* Columna 1: Identidad de Marca */}
          <div className="space-y-4">
            <Link href="/" className="group inline-flex items-center gap-3 text-slate-950 dark:text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md transition-transform group-hover:scale-105">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <span className="block text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
                  {settings?.academyName || "Academia Virtual"}
                </span>
                <span className="block text-[11px] font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                  Educación Continua
                </span>
              </div>
            </Link>

            <p className="max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {settings?.description ||
                "Cursos virtuales síncronos con clases en vivo, seguimiento docente y certificación digital verificable."}
            </p>

            <div className="pt-1">
              <Link
                href="/libro-de-reclamaciones"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 transition hover:border-blue-300 hover:bg-blue-50/70 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:border-blue-400/40 dark:hover:bg-white/[0.08]"
              >
                <BookOpenCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Libro de Reclamaciones Virtual
              </Link>
            </div>
          </div>

          {/* Columna 2: Navegación Académica */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">
              Navegación
            </h3>
            <nav className="mt-5 flex flex-col gap-3 text-sm">
              <Link href="/cursos" className="flex items-center gap-1 transition-colors hover:text-slate-950 dark:hover:text-white">
                Catálogo de programas <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </Link>
              <Link href="/#cohortes" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                Matrículas abiertas
              </Link>
              <Link href="/#como-funciona" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                Cómo funciona
              </Link>
              <Link href="/#faq" className="transition-colors hover:text-slate-950 dark:hover:text-white">
                Preguntas frecuentes
              </Link>
              <Link href="/login" className="font-bold text-blue-700 transition-colors hover:text-blue-800 dark:text-amber-300 dark:hover:text-amber-200">
                Ingresar al Campus Virtual
              </Link>
            </nav>
          </div>

          {/* Columna 3: Canales de Atención y Admisión */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">
              Admisión y Contacto
            </h3>
            <div className="mt-5 flex flex-col gap-3.5 text-sm">
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                >
                  <WhatsAppLogo className="h-4 w-4" />
                  <span>Atención por WhatsApp</span>
                </a>
              )}
              {settings?.supportEmail && (
                <a
                  href={`mailto:${settings.supportEmail}`}
                  className="flex items-center gap-2 text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  <Mail className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="truncate">{settings.supportEmail}</span>
                </a>
              )}
              {!whatsappNumber && !settings?.supportEmail && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Atención en línea mediante el formulario de orientación.
                </span>
              )}
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Horario de soporte y validación de matrículas: Lunes a Sábado.
              </p>
            </div>
          </div>

          {/* Columna 4: Redes Sociales (si están configuradas) */}
          {socialLinks.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">
                Comunidad
              </h3>
              <div className="mt-5 flex flex-col gap-3 text-sm">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-slate-700 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                  >
                    <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Barra inferior de derechos y enlaces legales */}
        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-7 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-5" aria-label="Enlaces legales">
            <Link href="/privacy" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Privacidad
            </Link>
            <Link href="/terms" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Términos y Condiciones
            </Link>
            <Link
              href="/libro-de-reclamaciones"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-800 transition-colors hover:text-blue-700 dark:text-slate-200 dark:hover:text-blue-300"
            >
              <BookOpenCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Libro de Reclamaciones
            </Link>
            <button
              type="button"
              onClick={clearConsent}
              className="cursor-pointer transition-colors hover:text-slate-950 dark:hover:text-white"
            >
              Preferencias de privacidad
            </button>
          </nav>

          <p>
            © {new Date().getFullYear()}{" "}
            {settings?.legalName || settings?.academyName || "Academia Virtual"}. Todos los derechos
            reservados.
          </p>

          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Pagos procesados de forma segura
          </span>
        </div>
      </div>
    </footer>
  );
}
