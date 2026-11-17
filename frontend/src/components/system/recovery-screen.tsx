import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Compass,
  Home,
  LifeBuoy,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import styles from "./recovery-screen.module.css";

type RecoveryScreenProps = {
  kind: "not-found" | "error";
  onRetry?: () => void;
  reference?: string;
  standalone?: boolean;
  compact?: boolean;
};

const content = {
  "not-found": {
    badge: "EXCUSA #404 · REPORTE DEL AULA",
    titleMain: "El perro se comió esta página",
    titleHighlight: "(de verdad).",
    description:
      "Le juramos al profe que sí estaba en la plataforma, pero solo encontramos una mochila abierta y un cuaderno mordido.",
    dogBubble: "«¿La página 404? ¡Te juro que sabía a tarea terminada!»",
    evidenceTag: "Evidencia #404 · Hace 1 min",
    evidenceSub: "1 hoja de cuaderno mordida",
    safeLabel: "Tus clases y entregas",
    safeValue: "100% a salvo",
  },
  error: {
    badge: "PAUSA TÉCNICA · REPORTE DEL AULA",
    titleMain: "El perro desconectó un cable",
    titleHighlight: "del salón.",
    description:
      "Algo se trabó al cargar esta pantalla, pero tranqui: tus entregas, notas y avances siguen guardados a salvo.",
    dogBubble: "«¡Yo solo perseguía la pelotita de papel y pisé el cable!»",
    evidenceTag: "Pausa técnica · En revisión",
    evidenceSub: "Reconectando el aula virtual",
    safeLabel: "Tu progreso académico",
    safeValue: "100% protegido",
  },
} as const;

const quickLinks = [
  { href: "/dashboard/my-courses", label: "Mis cursos", icon: BookOpen },
  { href: "/dashboard/calendar", label: "Calendario", icon: Calendar },
  { href: "/cursos", label: "Catálogo", icon: Compass },
  { href: "/dashboard/support", label: "Soporte", icon: LifeBuoy },
] as const;

export function RecoveryScreen({
  kind,
  onRetry,
  reference,
  standalone = false,
  compact = false,
}: RecoveryScreenProps) {
  const copy = content[kind];
  const isError = kind === "error";

  const heightClass = standalone
    ? "min-h-dvh"
    : compact
      ? "min-h-[70dvh]"
      : "min-h-[82dvh]";

  return (
    <section
      className={`relative isolate flex items-center overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:px-8 ${heightClass}`}
      role={isError ? "alert" : undefined}
    >
      <div className={styles.backdrop} aria-hidden="true" />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,0.96fr)_minmax(380px,1.08fr)] lg:gap-14">
        {/* Columna izquierda: Texto y acciones */}
        <div className={styles.copy}>
          <div className={styles.pillBadge}>
            <span className={styles.pulseDot} aria-hidden="true" />
            <span>{copy.badge}</span>
          </div>

          <h1 className="max-w-xl text-balance text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[3.55rem]">
            {copy.titleMain}{" "}
            <span className={styles.highlightWrap}>
              {copy.titleHighlight}
              <svg
                className={styles.markerUnderline}
                viewBox="0 0 240 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M4 13 C 62 4, 168 3, 236 12"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0">
            {copy.description}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3.5 sm:flex-row lg:justify-start">
            {onRetry ? (
              <>
                <Button
                  type="button"
                  size="lg"
                  onClick={onRetry}
                  className={styles.primaryCta}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Intentar de nuevo
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className={styles.secondaryCta}
                >
                  <Link href="/dashboard">
                    Volver a mi aula
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className={styles.primaryCta}>
                  <Link href="/dashboard">
                    Volver a mi aula
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className={styles.secondaryCta}
                >
                  <Link href="/">
                    <Home className="h-4 w-4" aria-hidden="true" />
                    Ir al inicio
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Accesos rápidos a secciones clave del aula */}
          <div className="mt-8 border-t border-border/70 pt-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Atajos rápidos del campus
            </p>
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={styles.quickChip}
                  >
                    <Icon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {reference ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Código de referencia:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                {reference}
              </code>
            </p>
          ) : null}
        </div>

        {/* Columna derecha: Escena editorial animada multicapa */}
        <div className={styles.sceneStage} aria-hidden="true">
          {/* Pedacitos de hoja de cuaderno flotando alrededor */}
          <span className={`${styles.paperScrap} ${styles.scrapOne}`} />
          <span className={`${styles.paperScrap} ${styles.scrapTwo}`} />
          <span className={`${styles.paperScrap} ${styles.scrapThree}`} />

          {/* Tarjeta flotante superior izquierda: Evidencia en vivo */}
          <div className={styles.evidenceBadge}>
            <span className={styles.evidenceIcon}>🐾</span>
            <div>
              <p className={styles.evidenceTitle}>{copy.evidenceTag}</p>
              <p className={styles.evidenceSubtitle}>{copy.evidenceSub}</p>
            </div>
          </div>

          {/* Globo de diálogo cómico del perrito (arriba derecha) */}
          <div className={styles.speechBubble}>
            <p>{copy.dogBubble}</p>
            <span className={styles.speechTail} />
          </div>

          {/* Marco principal con la ilustración editorial y trazos animados */}
          <div className={styles.artFrame}>
            {/* Anillos superiores tipo libreta escolar */}
            <div className={styles.spiralRow}>
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <Image
              src="/dog-404-scene.jpg"
              alt=""
              width={1024}
              height={768}
              priority
              className={styles.heroImage}
            />

            {/* Trazos animados de movimiento sobre la cola y las orejas del perrito */}
            <svg
              className={styles.motionOverlay}
              viewBox="0 0 1000 750"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Líneas cómicas de meneo junto a la cola (derecha del perrito) */}
              <g
                className={styles.tailMotionLines}
                stroke="#22435E"
                strokeWidth="7"
                strokeLinecap="round"
              >
                <path d="M622 282 C 638 268, 656 268, 668 280" />
                <path d="M674 306 C 692 302, 706 312, 710 328" />
                <path d="M614 256 C 626 244, 642 242, 654 250" stroke="#168F80" />
              </g>

              {/* Líneas expresivas junto a la gorra/orejas */}
              <g
                className={styles.earMotionLines}
                stroke="#D7A04A"
                strokeWidth="7"
                strokeLinecap="round"
              >
                <path d="M448 118 L434 94" />
                <path d="M472 106 L468 78" />
                <path d="M604 126 L624 104" />
              </g>

              {/* Burbujitas animadas subiendo del vaso de boba tea */}
              <g className={styles.bobaBubbles} fill="#168F80">
                <circle cx="426" cy="404" r="6" />
                <circle cx="442" cy="382" r="4.5" fill="#D7A04A" />
                <circle cx="418" cy="366" r="3.5" />
              </g>
            </svg>
          </div>

          {/* Tarjeta flotante inferior izquierda: Progreso intacto */}
          <div className={styles.safeCard}>
            <div className={styles.safeHeader}>
              <CheckCircle2 className="h-4 w-4 text-accent" />
              <span>{copy.safeLabel}</span>
              <strong>{copy.safeValue}</strong>
            </div>
            <div className={styles.safeBarTrack}>
              <div className={styles.safeBarFill} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
