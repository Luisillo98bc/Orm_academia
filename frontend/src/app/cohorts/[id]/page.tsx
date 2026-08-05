"use client";

import type { Cohort, SyllabusModule, User } from "@/types/domain";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { formatMoney, moneyToNumber } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Clock, BookOpen, CheckCircle2, 
  Target, Calendar, Share2, Heart, Video, UserCheck, Shield
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import Image from "next/image";

export default function CohortLandingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [allCohorts, setAllCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchApi("/academic/cohorts")
      .then(data => {
        const found = (data || []).find((c: Cohort) => c.id === params.id);
        setCohort(found);
        setAllCohorts(data || []);
      })
      .catch(console.error);

    fetchApi(`/academic/cohorts/${params.id}/modules`)
      .then(data => setModules(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>;
  if (!cohort) return <div className="text-center p-20 text-xl font-bold">Clase no encontrada</div>;

  const handleBuy = () => {
    if (!user) {
      router.push(`/register?cohortId=${cohort.id}`);
    } else {
      router.push(`/checkout/${cohort.id}`);
    }
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const whatYouWillLearnList = cohort.course?.whatYouWillLearn ? cohort.course.whatYouWillLearn.split('\n').filter((item: string) => item.trim() !== '') : [];
  const getEmbedUrl = (url?: string | null) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };
  const videoEmbedUrl = getEmbedUrl(cohort.course?.promotionalVideoUrl);

  const mainTeacher = cohort.teachers?.[0];

  const suggestedCohorts = allCohorts.filter(c => c.id !== params.id).slice(0, 4);

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-white text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ── HEADER / HERO (Estilo Limpio, Amigable, Propio) ── */}
      <section className="pt-10 pb-12 px-6 lg:px-8 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="flex flex-col gap-6">
            
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold border border-indigo-100">
                {cohort.course?.level || "Nivel General"}
              </span>
              {cohort.course?.targetAudience && (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold border border-emerald-100 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> {cohort.course.targetAudience}
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] text-slate-900 tracking-tight">
              {cohort.course?.name}
            </h1>
            
            <p className="text-xl text-slate-600 leading-relaxed font-medium">
              {cohort.name} - {cohort.course?.description}
            </p>

            {/* Teacher Snippet */}
            <div className="flex items-center gap-4 mt-2">
               <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xl border-2 border-white shadow-sm overflow-hidden">
                 {mainTeacher?.profileImage ? (
                    <Image unoptimized width={56} height={56} src={mainTeacher.profileImage} alt="Docente" className="w-full h-full object-cover" />
                 ) : (
                    mainTeacher ? `${mainTeacher.firstName[0]}${mainTeacher.lastName[0]}` : '🎓'
                 )}
               </div>
               <div>
                  <p className="text-sm text-slate-500 font-medium">Ofrecido por</p>
                  <p className="text-lg font-bold text-slate-900">
                     {mainTeacher ? `${mainTeacher.firstName} ${mainTeacher.lastName}` : 'Equipo Académico'}
                  </p>
               </div>
            </div>

            <div className="flex gap-4 mt-4">
               <Button variant="outline" className="rounded-full border-slate-200 text-slate-600 hover:bg-slate-50 gap-2 h-12 px-6 font-bold shadow-sm">
                 <Heart className="w-5 h-5 text-rose-500" /> Guardar
               </Button>
               <Button variant="outline" className="rounded-full border-slate-200 text-slate-600 hover:bg-slate-50 gap-2 h-12 px-6 font-bold shadow-sm">
                 <Share2 className="w-5 h-5" /> Compartir
               </Button>
            </div>
          </div>
          
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-xl shadow-indigo-900/5 bg-slate-100 border border-slate-200/50">
            {videoEmbedUrl ? (
              <iframe 
                src={videoEmbedUrl} 
                className="w-full h-full border-0 absolute inset-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
            ) : (
              // Fallback image if there is no video
              <Image
                unoptimized
                width={800}
                height={450}
                src={cohort.course?.imageUrl || `https://picsum.photos/seed/${cohort.id}/800/450`} 
                alt={cohort.course?.name || cohort.name}
                className="w-full h-full object-cover absolute inset-0"
              />
            )}
          </div>

        </div>
      </section>

      {/* ── BANDA DE ATRIBUTOS ── */}
      <section className="border-b border-slate-100 bg-slate-50/50">
         <div className="container mx-auto max-w-6xl px-6 py-6 flex flex-wrap justify-center md:justify-start gap-4 md:gap-12">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-sm font-bold text-slate-500">Duración Total</p>
                  <p className="font-black text-slate-900">{cohort.course?.durationHours || 0} Horas</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-sm font-bold text-slate-500">Tamaño de Clase</p>
                  <p className="font-black text-slate-900">Máx {cohort.maxStudents} est.</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-sm font-bold text-slate-500">Formato</p>
                  <p className="font-black text-slate-900">En Vivo / Asíncrono</p>
               </div>
            </div>
         </div>
      </section>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="container mx-auto max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-3 gap-16 mt-12">
        
        {/* ── COLUMNA IZQUIERDA ── */}
        <div className="lg:col-span-2 space-y-14">
          
          {/* Descripción Ampliada */}
          <section>
              <h2 className="text-3xl font-black mb-6 text-slate-900">Sobre esta clase</h2>
              <div className="text-slate-600 space-y-5 text-lg leading-relaxed">
                  <p>{cohort.course?.description}</p>
                  {/* Se puede quitar el texto falso si prefieres, o dejarlo como ejemplo de por qué es bueno tener descripción larga */}
                  <p>Este curso, <strong>{cohort.name}</strong>, está diseñado para proporcionar una experiencia de aprendizaje completa y guiada. Nos enfocamos en brindar todas las herramientas necesarias para que cada estudiante pueda aplicar lo aprendido inmediatamente.</p>
              </div>
          </section>

          {/* Lo que aprenderás (Solo si hay datos) */}
          {whatYouWillLearnList.length > 0 && (
            <section>
              <h2 className="text-3xl font-black mb-6 text-slate-900">Objetivos de Aprendizaje</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {whatYouWillLearnList.map((item: string, idx: number) => (
                  <div key={idx} className="flex gap-4 items-start bg-indigo-50/50 p-4 rounded-2xl">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                       <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className="text-slate-700 font-medium leading-relaxed">{item.replace(/^- /, '')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Temario Acordeón (Siempre visible, con estado vacío si no hay datos) */}
          <section>
            <div className="flex items-end justify-between mb-6">
               <h2 className="text-3xl font-black text-slate-900">Plan de Estudios</h2>
            </div>
            
            <div className="space-y-4">
              {modules.length === 0 ? (
                <div className="p-10 text-center rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="font-bold text-slate-500">El plan de estudios detallado estará disponible pronto.</p>
                </div>
              ) : (
                modules.map((mod: SyllabusModule, idx: number) => (
                  <div key={mod.id} className={`rounded-3xl border-2 transition-all duration-200 ${expandedModules[mod.id] ? 'border-indigo-100 bg-white shadow-lg shadow-indigo-100/50' : 'border-slate-100 bg-white hover:border-indigo-100'}`}>
                    <button 
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center justify-between p-6 text-left focus:outline-none rounded-3xl"
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-colors ${expandedModules[mod.id] ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                           {idx + 1}
                        </div>
                        <h3 className="font-bold text-xl text-slate-900">{mod.title}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-slate-400">
                        {expandedModules[mod.id] ? "−" : "+"}
                      </div>
                    </button>
                    
                    {expandedModules[mod.id] && (
                      <div className="px-6 pb-6 pt-2 text-slate-600 ml-[4.5rem]">
                        {mod.description ? (
                           <p className="mb-4 text-lg leading-relaxed">{mod.description}</p>
                        ) : (
                           <p className="mb-4 italic text-slate-400">Sin descripción detallada para este módulo.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Docentes */}
          <section>
            <h2 className="text-3xl font-black mb-8 text-slate-900">Conoce al Profesor</h2>
            <div className="space-y-8">
              {cohort.teachers?.map((t: User) => (
                <div key={t.id} className="bg-indigo-50/30 p-8 rounded-3xl border border-indigo-50/50">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-white shadow-xl shadow-indigo-200/50 flex shrink-0 items-center justify-center font-black text-4xl text-indigo-600 border-4 border-white">
                          {t.profileImage ? (
                              <Image unoptimized width={128} height={128} src={t.profileImage} alt={t.firstName} className="w-full h-full object-cover" />
                          ) : (
                              `${t.firstName[0]}${t.lastName[0]}`
                          )}
                        </div>
                        <div className="text-center sm:text-left">
                           <h3 className="font-black text-2xl text-slate-900 mb-2">{t.firstName} {t.lastName}</h3>
                           <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm font-bold text-slate-600 mb-4">
                              <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm"><UserCheck className="w-4 h-4 text-indigo-500" /> Profesor Verificado</span>
                           </div>
                           <p className="text-slate-600 text-lg leading-relaxed">
                               {t.bio || "Instructor asignado a este cohorte. Comprometido con la enseñanza y el éxito de los estudiantes."}
                           </p>
                        </div>
                    </div>
                </div>
              ))}
              {(!cohort.teachers || cohort.teachers.length === 0) && (
                 <div className="p-8 text-center text-slate-500 font-bold border-2 border-dashed border-slate-200 rounded-3xl">Profesor por asignar</div>
              )}
            </div>
          </section>
        </div>

        {/* ── COLUMNA DERECHA: TARJETA DE COMPRA ── */}
        <div className="relative">
          <div className="sticky top-24">
            <Card className="rounded-[2rem] border-0 shadow-2xl shadow-indigo-900/10 overflow-hidden bg-white relative z-10 p-2">
              
              <div className="bg-gradient-to-br from-indigo-50 to-white rounded-[1.5rem] p-8">
                  
                  {cohort.discountPercentage > 0 ? (
                    <div className="mb-6">
                      <div className="inline-block bg-rose-100 text-rose-700 font-black px-3 py-1 rounded-full text-sm mb-3">
                         ¡Ahorras {cohort.discountPercentage}%!
                      </div>
                      <div className="flex flex-col">
                         <span className="text-slate-400 font-bold line-through text-lg">S/ {formatMoney(cohort.price)}</span>
                         <span className="text-5xl font-black text-indigo-600">
                           S/ {(moneyToNumber(cohort.price) * (1 - cohort.discountPercentage / 100)).toFixed(2)}
                         </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <div className="text-5xl font-black text-indigo-600">
                        {moneyToNumber(cohort.price) > 0 ? `S/ ${formatMoney(cohort.price)}` : '¡Gratis!'}
                      </div>
                    </div>
                  )}
                  
                  <Button size="lg" className="w-full text-lg h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/30 transition-transform hover:-translate-y-1" onClick={handleBuy}>
                    Inscribirse Ahora
                  </Button>
                  
                  <div className="flex items-center justify-center gap-2 mt-4 text-sm font-bold text-slate-500">
                     <Shield className="w-4 h-4 text-emerald-500" /> Compra 100% segura
                  </div>

                  <div className="mt-8 space-y-4">
                    <h4 className="font-bold text-slate-900 text-lg">La inscripción incluye:</h4>
                    <ul className="space-y-4 text-slate-600 font-medium">
                      <li className="flex items-start gap-3">
                         <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Video className="w-3.5 h-3.5" />
                         </div>
                         <span>Sesiones de clase</span>
                      </li>
                      <li className="flex items-start gap-3">
                         <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                            <BookOpen className="w-3.5 h-3.5" />
                         </div>
                         <span>Material de estudio</span>
                      </li>
                      <li className="flex items-start gap-3">
                         <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Users className="w-3.5 h-3.5" />
                         </div>
                         <span>Acceso a la plataforma</span>
                      </li>
                    </ul>
                  </div>

              </div>
            </Card>
          </div>
        </div>

      </div>

      {/* ── SECCIÓN DE SUGERENCIAS ── */}
      {suggestedCohorts.length > 0 && (
        <div className="container mx-auto max-w-6xl px-6 mt-20 border-t border-slate-100 pt-16">
           <h2 className="text-3xl font-black mb-8 text-slate-900">Clases que podrían interesarte</h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {suggestedCohorts.map((c: Cohort) => (
                 <Link href={`/cohorts/${c.id}`} key={c.id} className="group flex flex-col bg-white border border-slate-100 rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-indigo-900/5 transition-all hover:-translate-y-1">
                    <div className="aspect-video bg-slate-100 relative overflow-hidden">
                       {c.imageUrl ? (
                           <>
                             <Image
                                unoptimized
                                width={800}
                                height={450}
                                src={c.imageUrl} 
                                alt={c.courseName || c.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                             />
                             <div className="absolute inset-0 bg-indigo-900/10 group-hover:bg-transparent transition-colors" />
                           </>
                       ) : (
                           <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <BookOpen className="w-10 h-10 text-indigo-300" />
                           </div>
                       )}
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                       <span className="text-xs font-bold text-indigo-600 mb-2">{c.name}</span>
                       <h3 className="font-bold text-slate-900 leading-snug mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">{c.courseName}</h3>
                       <div className="mt-auto pt-4 flex items-center justify-between">
                          <span className="font-black text-slate-900">
                             {moneyToNumber(c.price) > 0 ? `S/ ${formatMoney(c.price)}` : 'Gratis'}
                          </span>
                          <span className="text-sm font-bold text-slate-400 flex items-center gap-1"><Users className="w-4 h-4"/> {c.enrollmentCount}</span>
                       </div>
                    </div>
                 </Link>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}
