"use client";

import { Modal } from "@/components/ui/modal";
import type { Cohort } from "@/types/domain";

import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X, Star, CheckCircle2, UserCheck, AlertCircle, Heart } from "lucide-react";

const RATING_LABELS: Record<number, { title: string; color: string }> = {
  1: { title: "Deficiente 👎", color: "text-red-500" },
  2: { title: "Regular 😐", color: "text-amber-500" },
  3: { title: "Bueno 👌", color: "text-blue-500" },
  4: { title: "Muy Bueno 👍", color: "text-indigo-500" },
  5: { title: "¡Excelente Profesor! 🌟", color: "text-emerald-500 font-black" },
};

export function EvaluateTeacherModal({
  isOpen,
  onClose,
  cohort,
}: {
  isOpen: boolean;
  onClose: () => void;
  cohort: Cohort;
}) {
  const [score, setScore] = useState(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const activeTeacher = cohort?.teachers?.[0];
  const teacherName = activeTeacher
    ? `${activeTeacher.firstName} ${activeTeacher.lastName}`
    : "Docente del Curso";
  const teacherId = activeTeacher?.id || cohort?.teacherId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await fetchApi(`/academic/cohorts/${cohort.id}/evaluate`, {
        method: "POST",
        body: JSON.stringify({
          teacherId: teacherId || undefined,
          score,
          comment: comment.trim() || undefined,
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setComment("");
        setScore(5);
      }, 2000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al registrar la evaluación"));
    } finally {
      setLoading(false);
    }
  };

  const displayScore = hoverScore !== null ? hoverScore : score;

  return (
    <Modal title="Evaluar docente" onClose={() => { if (!loading) onClose(); }}>

      <Card className="w-full max-w-lg bg-card border-border shadow-2xl relative rounded-3xl overflow-hidden">
        <button aria-label="Cerrar ventana"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-widest mb-2 w-fit">
            <Heart className="h-3.5 w-3.5 fill-primary" />
            <span>Encuesta de Calidad</span>
          </div>
          <CardTitle className="text-2xl font-black text-foreground">
            Evaluar Experiencia Docente
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Tu opinión es 100% anónima y nos ayuda a asegurar el mejor nivel académico.
          </p>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Teacher Info Card */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border/60">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Docente de la Cohorte
              </p>
              <p className="text-base font-bold text-foreground">{teacherName}</p>
              <p className="text-xs text-muted-foreground">{cohort?.name}</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-10 space-y-4 animate-in fade-in">
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-black text-foreground">¡Evaluación Registrada!</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Muchas gracias por tus comentarios. Tu feedback impulsa la excelencia de nuestra comunidad.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Star Rating Control */}
              <div className="text-center space-y-3 p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  ¿Cómo calificas la enseñanza del docente?
                </p>
                <div className="flex justify-center items-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onMouseEnter={() => setHoverScore(val)}
                      onMouseLeave={() => setHoverScore(null)}
                      onClick={() => setScore(val)}
                      className="p-1.5 transition-all duration-200 hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`h-9 w-9 transition-colors ${
                          displayScore >= val
                            ? "text-amber-400 fill-amber-400 drop-shadow-md"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="h-6 flex items-center justify-center">
                  <span className={`text-sm font-bold transition-all ${RATING_LABELS[displayScore]?.color}`}>
                    {RATING_LABELS[displayScore]?.title}
                  </span>
                </div>
              </div>

              {/* Comment Textarea */}
              <div className="space-y-2">
                <label htmlFor="student-evaluate-teacher-modal-0" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Comentarios Adicionales (Opcional)
                </label>
                <textarea
 id="student-evaluate-teacher-modal-0"                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background/60 focus:bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                  placeholder="¿Qué aspectos destacarías del profesor o qué sugerencias tienes para las clases?"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl px-7 shadow-lg shadow-primary/20 font-bold"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enviar Evaluación
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
