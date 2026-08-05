"use client";

import { useEffect, useState } from "react";
import { fetchApi, API_URL } from "@/lib/api";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { GraduationCap, Users, Clock, Star, ArrowRight, CheckCircle2, BookOpen, CalendarDays, Award, Briefcase, MonitorPlay, Loader2, ChevronDown, ShieldCheck, Send, Mail, MapPin, Phone, MessageSquare, User } from "lucide-react";
import { LandingAnnouncements } from "@/components/landing-announcements";
import type { Cohort, Course, User as AcademyUser } from "@/types/domain";
import type { Money } from "@/lib/money";
import { moneyToNumber } from "@/lib/money";

interface LandingItem {
  id: string;
  name: string;
  isCohort: boolean;
  imageUrl?: string | null;
  course?: Course;
  courseId?: string;
  price?: Money;
  discountPercentage?: number;
  discountEndsAt?: string | null;
  maxCapacity?: number;
  enrolledCount?: number;
}

interface LandingTeacher extends AcademyUser {
  courses: string[];
}

export default function LandingPage() {
  const [activeCohorts, setActiveCohorts] = useState<LandingItem[]>([]);
  const [upcomingCourses, setUpcomingCourses] = useState<LandingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<LandingTeacher[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", subject: "Información de Cursos", message: "" });
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchApi("/academic/cohorts").catch(() => []),
      fetchApi("/academic/courses").catch(() => [])
    ]).then(([cohortsData, coursesData]) => {
      const cohorts: Cohort[] = cohortsData || [];
      const courses: Course[] = coursesData || [];

      const now = new Date();
      // Consider "Upcoming" if it starts more than 30 days from now
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      const active: LandingItem[] = [];
      const upcoming: LandingItem[] = [];

      // Categorize cohorts
      for (const cohort of cohorts) {
        if (!cohort.isActive) continue;
        const startDate = new Date(cohort.startDate);
        if (startDate > thirtyDaysFromNow) {
          upcoming.push({ ...cohort, isCohort: true });
        } else {
          active.push({ ...cohort, isCohort: true });
        }
      }

      // Find courses that don't have ANY active cohorts to show as "Coming Soon"
      const courseIdsWithCohorts = new Set(cohorts.map((cohort) => cohort.courseId));
      for (const course of courses) {
        if (!courseIdsWithCohorts.has(course.id)) {
          upcoming.push({ ...course, isCohort: false });
        }
      }

      setActiveCohorts(active);
      setUpcomingCourses(upcoming);

      // Extraer docentes únicos de todas las cohortes
      const teacherMap = new Map<string, LandingTeacher>();
      for (const cohort of cohorts) {
        for (const t of (cohort.teachers || [])) {
          if (!teacherMap.has(t.id)) {
            teacherMap.set(t.id, {
              ...t,
              courses: cohort.course?.name ? [cohort.course.name] : [],
            });
          } else {
            const existing = teacherMap.get(t.id);
            const courseName = cohort.course?.name;
            if (existing && courseName && !existing.courses.includes(courseName)) {
              existing.courses.push(courseName);
            }
          }
        }
      }
      setTeachers(Array.from(teacherMap.values()));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      
      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden bg-background">
        {/* Background Gradients & Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-70 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] opacity-70 pointer-events-none"></div>

        <div className="container mx-auto max-w-7xl px-6 lg:px-8 pt-16 pb-24 md:pt-24 md:pb-32 relative z-10 flex flex-col md:flex-row items-center gap-16">
          
          {/* Hero Text */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary font-bold text-xs uppercase tracking-widest mb-8 border border-primary/20 shadow-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Educación de Excelencia
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-foreground leading-[1.1]">
              Impulsa tu <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-500 to-purple-600">
                Futuro Profesional
              </span> Hoy
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto md:mx-0 font-medium leading-relaxed">
              Descubre programas educativos de alta calidad diseñados por expertos de la industria. Adquiere las habilidades más demandadas y acelera tu crecimiento laboral en un entorno moderno y flexible.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/register">
                <Button size="lg" className="rounded-full px-8 h-14 text-base font-bold w-full sm:w-auto bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/30 transition-all hover:scale-105">
                  Explorar Programas <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="#beneficios">
                <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-base font-bold w-full sm:w-auto border-border text-foreground hover:bg-muted/50 backdrop-blur-sm transition-all bg-background/50 hover:border-primary/50">
                  Conocer Más
                </Button>
              </Link>
            </div>
            
            {/* Social Proof Mini */}
            <div className="mt-12 flex items-center justify-center md:justify-start gap-4 text-sm font-medium text-muted-foreground">
              <div className="flex -space-x-3">
                <Image unoptimized width={40} height={40} className="w-10 h-10 rounded-full border-2 border-background shadow-sm" src="https://i.pravatar.cc/100?img=1" alt="Estudiante" />
                <Image unoptimized width={40} height={40} className="w-10 h-10 rounded-full border-2 border-background shadow-sm" src="https://i.pravatar.cc/100?img=2" alt="Estudiante" />
                <Image unoptimized width={40} height={40} className="w-10 h-10 rounded-full border-2 border-background shadow-sm" src="https://i.pravatar.cc/100?img=3" alt="Estudiante" />
                <Image unoptimized width={40} height={40} className="w-10 h-10 rounded-full border-2 border-background shadow-sm" src="https://i.pravatar.cc/100?img=4" alt="Estudiante" />
              </div>
              <p>+10,000 estudiantes ya se unieron</p>
            </div>
          </div>

          {/* Hero Image / Illustration */}
          <div className="flex-1 relative hidden md:block w-full">
            <div className="relative w-full aspect-square max-w-[600px] mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-purple-500/20 rounded-[3rem] animate-pulse-slow rotate-3"></div>
              
              <div className="absolute inset-0 bg-card rounded-[3rem] shadow-2xl overflow-hidden border border-border/50">
                <Image
                  src="/hero_illustration.png" 
                  alt="Educación Profesional" 
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  preload
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                />
              </div>
              
              {/* Floating elements with glassmorphism */}
              <div className="absolute top-12 -left-8 bg-background/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-float border border-white/20 dark:border-white/10 z-20">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500">
                  <CheckCircle2 className="w-6 h-6"/>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Certificación</p>
                  <p className="text-base font-bold text-foreground">100% Acreditada</p>
                </div>
              </div>
              
              <div className="absolute bottom-24 -right-8 bg-background/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-float-delayed border border-white/20 dark:border-white/10 z-20">
                <div className="bg-primary/10 p-3 rounded-xl text-primary">
                  <MonitorPlay className="w-6 h-6"/>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Modalidad</p>
                  <p className="text-base font-bold text-foreground">En Vivo y Grabado</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ANNOUNCEMENTS CAROUSEL ── */}
      <LandingAnnouncements />

      {/* ── METRICS SECTION ── */}
      <section className="py-16 bg-background border-y border-border">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border/50">
            <div className="px-4 flex flex-col items-center">
              <div className="p-3 bg-primary/10 rounded-2xl mb-4 text-primary">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-4xl font-black text-foreground mb-1 tracking-tight">+10k</p>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Egresados</p>
            </div>
            <div className="px-4 flex flex-col items-center">
              <div className="p-3 bg-emerald-500/10 rounded-2xl mb-4 text-emerald-500">
                <Briefcase className="w-6 h-6" />
              </div>
              <p className="text-4xl font-black text-foreground mb-1 tracking-tight">95%</p>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Empleabilidad</p>
            </div>
            <div className="px-4 flex flex-col items-center">
              <div className="p-3 bg-blue-500/10 rounded-2xl mb-4 text-blue-500">
                <Award className="w-6 h-6" />
              </div>
              <p className="text-4xl font-black text-foreground mb-1 tracking-tight">50+</p>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Expertos</p>
            </div>
            <div className="px-4 flex flex-col items-center">
              <div className="p-3 bg-amber-500/10 rounded-2xl mb-4 text-amber-500">
                <Star className="w-6 h-6 fill-amber-500" />
              </div>
              <p className="text-4xl font-black text-foreground mb-1 tracking-tight">4.9/5</p>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Satisfacción</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS SECTION ── */}
      <section id="beneficios" className="py-28 bg-gradient-to-b from-background via-muted/30 to-background relative overflow-hidden">
        {/* Decorative Background Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header */}
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-widest mb-4 shadow-sm">
              <Star className="w-3.5 h-3.5 fill-primary" />
              <span>Beneficios Exclusivos</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight mb-6 leading-tight">
              ¿Por qué estudiar en <span className="gradient-text">Academia Virtual</span>?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground font-normal leading-relaxed">
              Nuestra metodología combina clases en vivo, proyectos de casos reales y acompañamiento continuo para transformar tu carrera profesional.
            </p>
          </div>

          {/* 4 Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="group relative bg-card/80 backdrop-blur-md rounded-3xl border border-border/60 p-7 shadow-lg shadow-black/5 hover:shadow-2xl hover:border-primary/40 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity" />
              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
                  <MonitorPlay className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                  Clases Interactivas 4K
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Sesiones sincrónicas en vivo con interacción directa. Todas las clases quedan grabadas para que repases a tu propio ritmo.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border/40">
                <span className="text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full">Google Meet 4K</span>
                <span className="text-[11px] font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">Acceso Ilimitado</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group relative bg-card/80 backdrop-blur-md rounded-3xl border border-border/60 p-7 shadow-lg shadow-black/5 hover:shadow-2xl hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-80 group-hover:opacity-100 transition-opacity" />
              <div>
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
                  <Briefcase className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-indigo-500 transition-colors">
                  Enfoque Laboral Real
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Desarrolla proyectos prácticos basados en casos de empresas reales que enriquecerán tu portafolio técnico ante reclutadores.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border/40">
                <span className="text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full">Casos Reales</span>
                <span className="text-[11px] font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">Portafolio Git</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group relative bg-card/80 backdrop-blur-md rounded-3xl border border-border/60 p-7 shadow-lg shadow-black/5 hover:shadow-2xl hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-80 group-hover:opacity-100 transition-opacity" />
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
                  <Award className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-emerald-500 transition-colors">
                  Certificación Oficial
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Obtén un diploma digital con código QR de verificación único respaldado institucionalmente listo para añadir a LinkedIn.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border/40">
                <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full">Código QR Único</span>
                <span className="text-[11px] font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">LinkedIn Ready</span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="group relative bg-card/80 backdrop-blur-md rounded-3xl border border-border/60 p-7 shadow-lg shadow-black/5 hover:shadow-2xl hover:border-amber-500/40 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-80 group-hover:opacity-100 transition-opacity" />
              <div>
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-amber-500 transition-colors">
                  Mentoría & Comunidad
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Resolución de dudas en tiempo real con tutores, interacción en foros por cohorte y networking constante entre alumnos.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border/40">
                <span className="text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full">Chat Realtime</span>
                <span className="text-[11px] font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">Tutoría Directa</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COURSES CATALOG (ACTIVE COHORTS) ── */}
      <section id="cursos" className="px-6 py-32 bg-background relative border-y border-border">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-primary font-bold mb-4 uppercase tracking-widest text-sm bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                <BookOpen className="w-4 h-4" /> Oferta Académica
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">Programas Destacados</h2>
              <p className="text-muted-foreground mt-4 text-xl">Inscríbete en nuestros cursos y especializaciones más demandados. Matrículas abiertas por tiempo limitado.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
          ) : activeCohorts.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-2xl border border-dashed border-slate-300">
              <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground font-medium">Actualmente no hay inscripciones abiertas. ¡Revisa pronto!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeCohorts.map((cohort) => {
                const imageUrl = cohort.imageUrl || cohort.course?.imageUrl;
                const fullImageUrl = imageUrl ? `${API_URL.replace('/api/v1', '')}${imageUrl}` : null;
                
                const hasDiscount = cohort.discountPercentage && cohort.discountPercentage > 0;
                const discountEndsAt = cohort.discountEndsAt ? new Date(cohort.discountEndsAt) : null;
                const isDiscountActive = hasDiscount && discountEndsAt && discountEndsAt > new Date();
                const originalPrice = moneyToNumber(cohort.price);
                const finalPrice = isDiscountActive ? originalPrice * (1 - (cohort.discountPercentage ?? 0) / 100) : originalPrice;
                
                return (
                  <Card key={cohort.id} className="flex flex-col overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 group bg-card rounded-2xl">
                    {/* Course Image */}
                    <div className="relative h-48 overflow-hidden bg-muted">
                      {fullImageUrl ? (
                        <Image
                          unoptimized
                          width={800}
                          height={450}
                          src={fullImageUrl} 
                          alt={cohort.course?.name || cohort.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-blue-200">
                          <GraduationCap className="h-20 w-20" />
                        </div>
                      )}
                      <div className="absolute top-4 left-4">
                        <span className="bg-card/90 backdrop-blur-sm text-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                          {cohort.course?.level || "General"}
                        </span>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <CardContent className="flex-1 p-6 pt-5">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">{cohort.name}</span>
                        {isDiscountActive && (
                          <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded">
                            -{cohort.discountPercentage}%
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-bold text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                        {cohort.course?.name}
                      </h3>
                      
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                        {cohort.course?.description || "Aprende de manera práctica con instructores calificados y material de vanguardia."}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{cohort.course?.durationHours || 0} hrs</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>{cohort.enrolledCount || 0}/{cohort.maxCapacity || 30} cupos</span>
                        </div>
                      </div>
                    </CardContent>
                    
                    <CardFooter className="p-6 pt-0 border-t border-border/50 mt-auto flex items-center justify-between bg-muted/30/50">
                      <div>
                        {isDiscountActive ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 line-through">S/ {originalPrice.toFixed(2)}</span>
                            <span className="text-xl font-bold text-foreground">S/ {finalPrice.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-xl font-bold text-foreground">S/ {originalPrice.toFixed(2)}</span>
                        )}
                      </div>
                      
                      <Link href={`/cohorts/${cohort.id}`}>
                        <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 font-semibold shadow-md shadow-primary/20">
                          Inscribirse
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── UPCOMING COURSES ── */}
      <section className="px-6 py-24 bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Próximos Inicios</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Conoce los programas que estaremos habilitando próximamente. Pre-inscríbete para recibir información exclusiva.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
          ) : upcomingCourses.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No hay próximos lanzamientos anunciados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingCourses.map((item) => {
                const imageUrl = (item.isCohort ? item.course?.imageUrl : item.imageUrl);
                const fullImageUrl = imageUrl ? `${API_URL.replace('/api/v1', '')}${imageUrl}` : null;
                
                return (
                  <Card key={item.id} className="overflow-hidden border border-border shadow-sm bg-card rounded-2xl flex flex-col">
                    <div className="flex p-5 gap-4">
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted shrink-0">
                        {fullImageUrl ? (
                          <Image unoptimized width={96} height={96} src={fullImageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                            <CalendarDays className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit mb-2 inline-block">
                          Próximamente
                        </span>
                        <h3 className="font-bold text-foreground leading-snug line-clamp-2">
                          {item.isCohort ? item.course?.name : item.name}
                        </h3>
                      </div>
                    </div>
                    <div className="px-5 pb-5 mt-auto">
                      <Link 
                        href={`https://wa.me/51999999999?text=${encodeURIComponent(`Quisiera información sobre el próximo inicio: ${item.isCohort ? item.course?.name : item.name}`)}`}
                        target="_blank"
                      >
                        <Button variant="outline" className="w-full rounded-lg text-primary border-blue-200 hover:bg-primary/10 font-semibold">
                          Solicitar Información
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── INSTRUCTORES / DOCENTES ── */}
      <section className="px-6 py-32 bg-background relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 text-primary font-bold mb-4 uppercase tracking-widest text-sm bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
              <Users className="w-4 h-4" /> Equipo Docente
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-6">
              Aprende de los <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500">Mejores Expertos</span>
            </h2>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed">
              Nuestros instructores son profesionales activos en la industria tecnológica con amplia experiencia docente.
            </p>
          </div>

          {teachers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {teachers.slice(0, 8).map((teacher) => (
                <div
                  key={teacher.id}
                  className="group relative bg-card rounded-3xl border border-border/50 overflow-hidden shadow-sm hover:shadow-2xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-2"
                >
                  {/* Decorative gradient */}
                  <div className="h-28 bg-gradient-to-br from-primary/20 via-indigo-500/10 to-purple-500/20 relative">
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[size:200%_200%] group-hover:animate-shimmer"></div>
                  </div>

                  {/* Avatar */}
                  <div className="flex justify-center -mt-14 relative z-10">
                    <div className="w-24 h-24 rounded-full border-4 border-card bg-muted flex items-center justify-center overflow-hidden shadow-lg">
                      {teacher.profilePicture ? (
                        <Image
                          unoptimized
                          width={96}
                          height={96}
                          src={`${API_URL.replace('/api/v1', '')}${teacher.profilePicture}`}
                          alt={`${teacher.firstName} ${teacher.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-indigo-500/30 flex items-center justify-center">
                          <span className="text-2xl font-bold text-primary">
                            {teacher.firstName?.[0]}{teacher.lastName?.[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-6 pt-4 text-center">
                    <h3 className="text-lg font-bold text-foreground">
                      {teacher.firstName} {teacher.lastName}
                    </h3>
                    <p className="text-sm text-primary font-medium mt-1">Docente</p>
                    {teacher.courses?.length > 0 && (
                      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                        {teacher.courses.slice(0, 2).map((course: string, ci: number) => (
                          <span key={ci} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                            {course}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { name: "Carlos Mendoza", specialty: "Python & IA" },
                { name: "María García", specialty: "JavaScript Full-Stack" },
                { name: "Luis Quispe", specialty: "Data Science" },
                { name: "Ana Torres", specialty: "UX/UI Design" },
              ].map((teacher, i) => (
                <div
                  key={i}
                  className="group relative bg-card rounded-3xl border border-border/50 overflow-hidden shadow-sm hover:shadow-2xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="h-28 bg-gradient-to-br from-primary/20 via-indigo-500/10 to-purple-500/20 relative">
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[size:200%_200%] group-hover:animate-shimmer"></div>
                  </div>
                  <div className="flex justify-center -mt-14 relative z-10">
                    <div className="w-24 h-24 rounded-full border-4 border-card overflow-hidden shadow-lg">
                      <Image
                        unoptimized
                        width={96}
                        height={96}
                        src={`https://i.pravatar.cc/200?img=${i + 10}`}
                        alt={teacher.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="p-6 pt-4 text-center">
                    <h3 className="text-lg font-bold text-foreground">{teacher.name}</h3>
                    <p className="text-sm text-primary font-medium mt-1">Docente</p>
                    <span className="inline-block mt-3 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                      {teacher.specialty}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── MÉTODOS DE PAGO ── */}
      <section className="py-24 bg-muted/20 border-y border-border">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 text-primary font-bold mb-4 uppercase tracking-widest text-sm">
              <ShieldCheck className="w-4 h-4" /> Pagos Seguros
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-6">
              Paga como prefieras
            </h2>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed">
              Aceptamos múltiples métodos de pago para tu comodidad. Todos procesados de forma segura con Culqi.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Tarjeta */}
            <div className="group bg-card rounded-2xl border border-border/50 p-8 text-center hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/20 transition-colors overflow-hidden">
                <Image src="/cards-logo.png" alt="Visa y Mastercard" width={56} height={56} className="object-contain" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-1">Tarjeta</h3>
              <p className="text-sm text-muted-foreground">Visa, Mastercard, Amex</p>
            </div>

            {/* Yape */}
            <div className="group bg-card rounded-2xl border border-border/50 p-8 text-center hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 flex items-center justify-center mb-5 group-hover:bg-purple-500/20 transition-colors overflow-hidden">
                <Image src="/yape-logo.png" alt="Yape" width={56} height={56} className="object-contain" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-1">Yape</h3>
              <p className="text-sm text-muted-foreground">Escanea y paga al instante</p>
            </div>

            {/* Plin */}
            <div className="group bg-card rounded-2xl border border-border/50 p-8 text-center hover:border-green-500/50 hover:shadow-xl hover:shadow-green-500/5 transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center mb-5 group-hover:bg-green-500/20 transition-colors overflow-hidden">
                <Image src="/plin-logo.png" alt="Plin" width={56} height={56} className="object-contain" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-1">Plin</h3>
              <p className="text-sm text-muted-foreground">Transferencia inmediata</p>
            </div>

            {/* Efectivo */}
            <div className="group bg-card rounded-2xl border border-border/50 p-8 text-center hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5 group-hover:bg-amber-500/20 transition-colors overflow-hidden">
                <Image src="/efectivo-logo.png" alt="Efectivo" width={56} height={56} className="object-contain" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-1">Efectivo</h3>
              <p className="text-sm text-muted-foreground">Depósito y sube voucher</p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            <span>Todos los pagos son procesados de forma segura por <strong className="text-foreground">Culqi</strong>, pasarela líder en Perú.</span>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="px-6 py-32 bg-background relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-primary font-bold mb-4 uppercase tracking-widest text-sm bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
              <MessageSquare className="w-4 h-4" /> FAQ
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-6">
              Preguntas Frecuentes
            </h2>
            <p className="text-xl text-muted-foreground font-medium">
              Encuentra respuestas a las preguntas más comunes sobre nuestra academia.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "¿Cómo son las clases?",
                a: "Las clases son 100% en vivo a través de Google Meet. Además, todas las sesiones quedan grabadas para que puedas repasar el contenido en cualquier momento. También contamos con materiales descargables, repositorios de código y foros de discusión."
              },
              {
                q: "¿Qué métodos de pago aceptan?",
                a: "Aceptamos pagos con tarjeta de crédito/débito (Visa, Mastercard, Amex), Yape, Plin y depósitos en efectivo. Todos los pagos con tarjeta y Yape son procesados de forma segura por Culqi."
              },
              {
                q: "¿Cómo obtengo mi certificado?",
                a: "Al completar todas las evaluaciones del curso con nota aprobatoria, tu certificado digital se genera automáticamente desde tu panel de estudiante. Incluye un código de validación único que cualquier empleador puede verificar."
              },
              {
                q: "¿Puedo acceder a las grabaciones después de que termine el curso?",
                a: "Sí. Una vez matriculado, tendrás acceso indefinido a todas las grabaciones y materiales del curso, incluso después de haber finalizado."
              },
              {
                q: "¿Qué pasa si no puedo asistir a una clase en vivo?",
                a: "¡No hay problema! Todas las sesiones se graban y se suben a la plataforma dentro de las 24 horas siguientes. Podrás verlas a tu propio ritmo."
              },
              {
                q: "¿Ofrecen descuentos o becas?",
                a: "Sí, periódicamente ofrecemos descuentos por tiempo limitado que aparecen directamente en nuestro catálogo. También puedes contactarnos para consultar sobre becas parciales para estudiantes destacados."
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`bg-card border rounded-2xl overflow-hidden transition-all duration-300 ${
                  openFaq === i ? "border-primary/50 shadow-lg shadow-primary/5" : "border-border/50 hover:border-border"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-bold text-foreground text-lg pr-4">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300 ${
                      openFaq === i ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openFaq === i ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="px-6 pb-6 text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORMULARIO DE CONTACTO ── */}
      <section id="contacto" className="px-4 sm:px-6 lg:px-8 py-28 bg-gradient-to-b from-background via-muted/30 to-background relative overflow-hidden border-t border-border/50">
        <div className="absolute left-0 bottom-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -ml-40 -mb-40" />
        <div className="absolute right-0 top-1/2 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Info Side */}
            <div className="lg:col-span-5 space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-widest mb-4 shadow-sm">
                  <Send className="w-3.5 h-3.5" />
                  <span>Atención Personalizada</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight mb-4 leading-tight">
                  ¿Tienes dudas sobre tus <span className="gradient-text">estudios o matrículas</span>?
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground font-normal leading-relaxed">
                  Estamos para orientarte. Completa el formulario o contáctanos directamente a través de nuestras vías oficiales.
                </p>
              </div>

              {/* Contact Info Cards */}
              <div className="space-y-4 pt-2">
                <a
                  href="https://wa.me/51987654321?text=Hola,%20quisiera%20información%20sobre%20los%20cursos"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">WhatsApp Directo</p>
                    <p className="text-foreground font-bold group-hover:text-emerald-500 transition-colors">+51 987 654 321</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                </a>

                <a
                  href="mailto:hola@academiavirtual.edu"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Correo Electrónico</p>
                    <p className="text-foreground font-bold group-hover:text-primary transition-colors">hola@academiavirtual.edu</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </a>

                <div className="flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sede Central</p>
                    <p className="text-foreground font-bold">Lima, Perú (Atención Global 100% Online)</p>
                  </div>
                </div>
              </div>

              {/* Schedule Indicator Badge */}
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-2 rounded-xl text-xs font-semibold">
                <Clock className="h-4 w-4" />
                <span>Horario de atención: Lun a Sáb (8:00 AM – 8:00 PM)</span>
              </div>
            </div>

            {/* Form Side */}
            <div className="lg:col-span-7 bg-card/90 backdrop-blur-md rounded-[2.5rem] border border-border/70 p-6 sm:p-10 shadow-2xl shadow-black/5">
              {contactSent ? (
                <div className="text-center py-14 px-4 space-y-5 animate-in fade-in">
                  <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-3xl font-black text-foreground">¡Mensaje Enviado con Éxito!</h3>
                  <p className="text-muted-foreground max-w-md mx-auto text-base">
                    Gracias por comunicarte con la Academia Virtual. Uno de nuestros asesores te responderá a <strong className="text-foreground">{contactForm.email}</strong> en menos de 24 horas.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setContactSent(false);
                      setContactForm({ name: "", email: "", phone: "", subject: "Información de Cursos", message: "" });
                    }}
                    className="rounded-full px-8 h-11 text-sm font-bold border-border hover:bg-muted"
                  >
                    Enviar otro mensaje
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setContactSending(true);
                    setTimeout(() => {
                      setContactSending(false);
                      setContactSent(true);
                    }, 1200);
                  }}
                  className="space-y-5"
                >
                  <div className="border-b border-border/60 pb-3 mb-2">
                    <h3 className="font-bold text-xl text-foreground">Envíanos un Mensaje</h3>
                    <p className="text-xs text-muted-foreground">Completa los datos requeridos para procesar tu consulta rápidamente.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contact-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Nombre Completo
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          id="contact-name"
                          type="text"
                          required
                          placeholder="Tu nombre y apellido"
                          value={contactForm.name}
                          onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background/60 focus:bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Correo Electrónico
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          id="contact-email"
                          type="email"
                          required
                          placeholder="tu@email.com"
                          value={contactForm.email}
                          onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background/60 focus:bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contact-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Teléfono / WhatsApp (Opcional)
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          id="contact-phone"
                          type="tel"
                          placeholder="+51 987 654 321"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background/60 focus:bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact-subject" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Motivo de Consulta
                      </label>
                      <select
                        id="contact-subject"
                        value={contactForm.subject}
                        onChange={(e) => setContactForm((f) => ({ ...f, subject: e.target.value }))}
                        className="w-full px-3.5 py-3 rounded-xl border border-border bg-background/60 focus:bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                      >
                        <option value="Información de Cursos">Información de Cursos</option>
                        <option value="Matrículas y Pagos">Matrículas y Pagos</option>
                        <option value="Becas y Descuentos">Becas y Descuentos</option>
                        <option value="Soporte Técnico">Soporte Técnico / Campus</option>
                        <option value="Otro Asunto">Otro Asunto</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Detalle de tu Consulta
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      placeholder="Escribe aquí tus preguntas sobre horarios, temarios, métodos de pago..."
                      value={contactForm.message}
                      onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background/60 focus:bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={contactSending}
                    className="w-full h-13 rounded-xl text-base font-bold shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-indigo-600 hover:opacity-95 gap-2 group"
                  >
                    {contactSending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    )}
                    <span>{contactSending ? "Enviando mensaje..." : "Enviar Consulta Ahora"}</span>
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section className="py-32 relative overflow-hidden bg-foreground text-background">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/80 rounded-full blur-[100px] opacity-40"></div>
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-purple-600/60 rounded-full blur-[100px] opacity-40"></div>
        
        <div className="container mx-auto max-w-4xl px-6 relative z-10 text-center">
          <h2 className="text-5xl md:text-6xl font-black mb-8 tracking-tight">El éxito te espera. <br/> <span className="text-primary">Comienza ahora.</span></h2>
          <p className="text-xl text-muted/80 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">Únete a nuestra comunidad educativa de más de 10,000 profesionales y da el siguiente salto cualitativo en tu carrera con nuestra metodología comprobada.</p>
          <Link href="/register">
            <Button size="lg" className="h-16 px-12 text-xl rounded-full bg-primary text-white hover:bg-primary/90 shadow-[0_0_40px_rgba(var(--primary),0.4)] font-bold transition-all hover:scale-105">
              Crear Cuenta Gratis <ArrowRight className="ml-3 w-6 h-6" />
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}
