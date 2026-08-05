"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Mail, MapPin, Phone, Send, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function Footer() {
  const pathname = usePathname();
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");

  // Hide footer completely on dashboard routes
  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <footer id="contacto" className="bg-muted/30 border-t border-border mt-auto relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Col 1 & 2: Brand & Newsletter */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="font-bold text-2xl tracking-tight">
                Academia<span className="gradient-text">Virtual</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              Impulsando tu carrera profesional con educación tecnológica de primer nivel. Aprende con proyectos reales, mentores de la industria y certificación oficial.
            </p>

            {/* Newsletter Subscription */}
            <div className="pt-2 max-w-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Recibe novedades y becas exclusivas
              </span>
              {subscribed ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl text-sm font-medium animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>¡Te has suscrito con éxito!</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="bg-background border border-border rounded-xl px-3.5 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:opacity-90 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md shadow-primary/20 flex items-center gap-1.5 shrink-0"
                  >
                    <span>Unirme</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Col 3: Enlaces Rápidos */}
          <div>
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-4">Navegación</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Inicio
                </Link>
              </li>
              <li>
                <Link href="/#beneficios" className="text-muted-foreground hover:text-primary transition-colors">
                  Sobre Nosotros
                </Link>
              </li>
              <li>
                <Link href="/#cursos" className="text-muted-foreground hover:text-primary transition-colors">
                  Catálogo de Cursos
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                  Campus Virtual
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Soporte */}
          <div>
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-4">Soporte</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#contacto" className="text-muted-foreground hover:text-primary transition-colors">
                  Contacto directo
                </a>
              </li>
              <li>
                <a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">
                  Preguntas Frecuentes
                </a>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-not-allowed">Términos de Servicio</span>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-not-allowed">Política de Privacidad</span>
              </li>
            </ul>
          </div>

          {/* Col 5: Contacto & Estado */}
          <div>
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-4">Contacto</h3>
            <ul className="space-y-3 text-sm mb-4">
              <li className="flex items-start gap-2.5 text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Lima, Perú (Sede Virtual Global)</span>
              </li>
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span>+51 987 654 321</span>
              </li>
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <span>hola@academiavirtual.edu</span>
              </li>
            </ul>

            {/* System Status Badge */}
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Plataforma 99.9% activa</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Academia Virtual. Todos los derechos reservados.</p>
          <div className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Pagos seguros con encriptación SSL de 256 bits</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
