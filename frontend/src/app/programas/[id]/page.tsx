"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, HelpCircle, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrochureModal } from "@/components/brochure-modal";
import { RecoveryScreen } from "@/components/system/recovery-screen";
import { WhatsAppLogo } from "@/components/whatsapp-logo";
import { fetchApi } from "@/lib/api";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import { getMediaUrl } from "@/lib/media";
import { getCohortPricing } from "@/lib/money";
import type { Cohort, Course, SyllabusModule } from "@/types/domain";

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Inicial",
  INTERMEDIATE: "Intermedio",
  ADVANCED: "Avanzado",
};

const MODALITY_LABELS: Record<string, string> = {
  ONLINE: "Virtual en vivo",
  IN_PERSON: "Presencial",
  HYBRID: "Híbrido",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

export default function PublicProgramPage() {
  const routeParams = useParams<{ id?: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [testimonials, setTestimonials] = useState<Array<{ score: number; comment: string; author: string }>>([]);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = routeParams.id;
    if (!id) return;
    let mounted = true;

    Promise.allSettled([
      fetchCatalogApi<Course[]>("/academic/public/courses", "courses"),
      fetchCatalogApi<Cohort[]>("/academic/public/cohorts", "cohorts"),
      fetchCatalogApi<{ whatsappNumber?: string }>("/settings/public", "settings"),
    ])
      .then(async ([courseResult, cohortResult, settingsResult]) => {
        if (!mounted) return;
        const courseData = courseResult.status === "fulfilled" && Array.isArray(courseResult.value) ? courseResult.value : [];
        const cohortData = cohortResult.status === "fulfilled" && Array.isArray(cohortResult.value) ? cohortResult.value : [];
        setAllCourses(courseData);
        const programCohorts = cohortData.filter((item) => item.courseId === id).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setCourse(courseData.find((item) => item.id === id) || null);
        setCohorts(programCohorts);
        if (settingsResult.status === "fulfilled") setWhatsappNumber(String(settingsResult.value?.whatsappNumber || "").replace(/\D/g, ""));
        if (programCohorts[0]) {
          try {
            const publicModules = await fetchApi(`/academic/cohorts/public/${programCohorts[0].id}/modules`);
            if (mounted) setModules(Array.isArray(publicModules) ? publicModules : []);
          } catch {
            if (mounted) setModules([]);
          }
        }
        try {
          const publishedTestimonials = await fetchApi(`/academic/public/courses/${id}/testimonials`);
          if (mounted) setTestimonials(Array.isArray(publishedTestimonials) ? publishedTestimonials : []);
        } catch {
          if (mounted) setTestimonials([]);
        }
        if (courseResult.status === "rejected" || cohortResult.status === "rejected") {
          setError("No pudimos cargar toda la información del programa.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [routeParams.id]);

  const learningItems = useMemo(
    () => course?.whatYouWillLearn?.split("\n").map((item) => item.trim()).filter(Boolean) || [],
    [course?.whatYouWillLearn],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-5 py-12 sm:px-8">
        <div className="shimmer-loading h-64 rounded-2xl border border-border/60" />
        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="shimmer-loading h-96 rounded-2xl border border-border/60" />
          <div className="shimmer-loading h-80 rounded-2xl border border-border/60" />
        </div>
      </div>
    );
  }

  if (!course) {
    return <RecoveryScreen kind="not-found" compact reference={typeof routeParams.id === "string" ? routeParams.id : undefined} />;
  }

  const imageUrl = getMediaUrl(course.imageUrl || cohorts[0]?.imageUrl);
  const durationLabel = course.durationHours > 0 ? `${course.durationHours} horas` : "Duración por definir";
  const levelLabel = LEVEL_LABELS[course.level] || course.level;
  const recommendedCourses = allCourses.filter((item) => item.id !== course.id && item.level === course.level).slice(0, 3);
  const targetCohort: Cohort = cohorts[0] || {
    id: course.id,
    courseId: course.id,
    name: "Próxima edición",
    course,
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    price: "0",
    maxStudents: 30,
    enrollmentCount: 0,
    isActive: true,
  };
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.name,
    description: course.description || course.name,
    educationalLevel: levelLabel,
    provider: {
      "@type": "EducationalOrganization",
      name: "Academia Virtual",
    },
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <section className="border-b border-border bg-muted/30 px-5 py-10 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <Link href="/cursos" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Volver a programas</Link>
          <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Programa académico</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{course.name}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{course.description || "Un programa práctico con acompañamiento docente y una ruta clara de aprendizaje."}</p>
              <div className="mt-7 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-md bg-card px-3 py-2">Nivel: {levelLabel}</span>
                <span className="rounded-md bg-card px-3 py-2">{durationLabel}</span>
                <span className="rounded-md bg-card px-3 py-2">{cohorts.length} {cohorts.length === 1 ? "edición abierta" : "ediciones abiertas"}</span>
                <Button type="button" variant="outline" onClick={() => setBrochureOpen(true)} className="cursor-pointer gap-2 rounded-lg border-primary/30 text-primary hover:bg-primary/10">
                  <FileText className="h-4 w-4" /> Descargar Temario PDF
                </Button>
              </div>
            </div>
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/50 bg-slate-950 shadow-lg">{imageUrl ? <Image unoptimized={!imageUrl.startsWith("/course-images/")} fill sizes="(min-width: 1024px) 45vw, 100vw" src={imageUrl} alt={course.name} className="object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-slate-950 to-primary/70" />}</div>
          </div>
        </div>
      </section>

      {error && <div role="alert" className="mx-auto mt-6 max-w-7xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_420px]">
        <div className="space-y-10">
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Sobre el programa</p><h2 className="mt-2 text-3xl font-semibold">Aprende con una ruta organizada</h2><p className="mt-4 leading-7 text-muted-foreground">Aquí encuentras la información general del programa. Las fechas, docentes, precios y cupos se definen en cada edición.</p></div>
          {learningItems.length > 0 && <div><h2 className="text-2xl font-semibold">Lo que aprenderás</h2><ul className="mt-5 grid gap-3 sm:grid-cols-2">{learningItems.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />{item}</li>)}</ul></div>}
          {course.requirements && <div><h2 className="text-2xl font-semibold">Requisitos</h2><p className="mt-4 whitespace-pre-line leading-7 text-muted-foreground">{course.requirements}</p></div>}
          <div>
            <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /><h2 className="text-2xl font-semibold">Temario del programa</h2></div>
            {modules.length > 0 ? <ol className="mt-5 space-y-3">{modules.map((module, index) => <li key={module.id} className="rounded-xl border border-border/60 bg-card p-4"><p className="font-semibold">Módulo {index + 1}: {module.title}</p>{module.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{module.description}</p>}</li>)}</ol> : <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">El temario detallado se publicará con la primera edición disponible.</p>}
          </div>
          <div>
            <div className="flex items-center gap-2"><Star className="h-5 w-5 text-primary" /><h2 className="text-2xl font-semibold">Experiencias de estudiantes</h2></div>
            {testimonials.length > 0 ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{testimonials.map((testimonial, index) => <blockquote key={`${testimonial.author}-${index}`} className="rounded-xl border border-border/60 bg-card p-4"><div className="flex items-center gap-1 text-amber-500" aria-label={`${testimonial.score} de 5 estrellas`}>{Array.from({ length: testimonial.score }).map((_, starIndex) => <Star key={starIndex} className="h-4 w-4 fill-current" />)}</div><p className="mt-3 text-sm leading-6 text-muted-foreground">“{testimonial.comment}”</p><cite className="mt-3 block text-xs font-semibold not-italic">{testimonial.author}</cite></blockquote>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Todavía no hay testimonios publicados para este programa.</p>}
          </div>
          {recommendedCourses.length > 0 && <div><h2 className="text-2xl font-semibold">También podría interesarte</h2><p className="mt-2 text-sm text-muted-foreground">Programas del mismo nivel para continuar tu ruta.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{recommendedCourses.map((recommended) => <Link key={recommended.id} href={`/programas/${recommended.id}`} className="rounded-xl border border-border/60 bg-card p-4 transition hover:border-primary/50"><p className="font-semibold">{recommended.name}</p><p className="mt-2 text-xs text-muted-foreground">Nivel {LEVEL_LABELS[recommended.level] || recommended.level}</p></Link>)}</div></div>}
          <div>
            <div className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" /><h2 className="text-2xl font-semibold">Preguntas frecuentes</h2></div>
            <div className="mt-5 space-y-3 text-sm"><details className="rounded-xl border border-border/60 p-4"><summary className="cursor-pointer font-semibold">¿Qué edición debo elegir?</summary><p className="mt-2 text-muted-foreground">Elige la fecha y horario que mejor se adapte a ti. Todas las ediciones pertenecen a este mismo programa.</p></details><details className="rounded-xl border border-border/60 p-4"><summary className="cursor-pointer font-semibold">¿Qué incluye la matrícula?</summary><p className="mt-2 text-muted-foreground">Incluye acceso al aula virtual, materiales, sesiones de la edición y acompañamiento docente.</p></details><details className="rounded-xl border border-border/60 p-4"><summary className="cursor-pointer font-semibold">¿Puedo cambiar de edición?</summary><p className="mt-2 text-muted-foreground">Antes de pagar puedes volver al catálogo y elegir otra edición disponible.</p></details></div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border/60 bg-card p-5 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Ediciones disponibles</p>
          <h2 className="mt-2 text-2xl font-semibold">Elige cuándo cursar</h2>
          <div className="mt-5 space-y-4">{cohorts.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No hay ediciones abiertas en este momento.</div> : cohorts.map((cohort) => { const enrolled = cohort.enrolledCount ?? 0; const capacity = cohort.maxCapacity || cohort.maxStudents; const seats = capacity ? Math.max(capacity - enrolled, 0) : null; const teacher = cohort.teachers?.[0]; const pricing = getCohortPricing(cohort); const modalityLabel = cohort.modality ? (MODALITY_LABELS[cohort.modality] || cohort.modality) : "Modalidad por confirmar"; const installmentsCount = Math.max(1, Number(cohort.installments ?? 1)); return <article key={cohort.id} className="rounded-xl border border-border/60 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{cohort.name}</h3><p className="mt-1 text-xs text-muted-foreground">Inicio: {formatDate(cohort.startDate)}</p></div><div className="text-right"><span className="whitespace-nowrap text-lg font-bold text-primary">S/ {pricing.finalPrice.toFixed(2)}{installmentsCount > 1 ? " / mes" : ""}</span>{pricing.discountActive && <span className="block text-xs text-muted-foreground line-through">S/ {pricing.basePrice.toFixed(2)}</span>}{installmentsCount > 1 && <span className="mt-0.5 block text-[11px] font-bold text-violet-700 dark:text-violet-300">{installmentsCount} cuotas mensuales</span>}</div></div><div className="mt-4 grid gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Finaliza: {formatDate(cohort.endDate)}</span><span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />{modalityLabel} · {cohort.schedule || "Horario por confirmar"}</span><span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{seats === null ? "Cupos limitados" : `${seats} cupos disponibles`}</span>{teacher && <span className="text-xs">Docente: {teacher.firstName} {teacher.lastName}</span>}</div><Link href={`/cohorts/${cohort.id}`} className="mt-4 block"><Button className="w-full gap-2">Ver edición <ArrowRight className="h-4 w-4" /></Button></Link></article>; })}</div>
          {whatsappNumber && <a href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hola, quiero información sobre ${course.name}`)}`} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"><WhatsAppLogo className="h-5 w-5" />Consultar por WhatsApp</a>}
        </aside>
      </section>
      <BrochureModal open={brochureOpen} onClose={() => setBrochureOpen(false)} cohort={targetCohort} />
    </div>
  );
}
