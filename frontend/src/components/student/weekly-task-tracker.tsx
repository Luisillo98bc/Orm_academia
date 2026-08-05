"use client";

import type { Evaluation } from "@/types/domain";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  FileText,
  Calendar,
  Award,
  Filter,
} from "lucide-react";
import { SubmitDeliverableModal } from "./submit-deliverable-modal";

interface WeeklyTaskTrackerProps {
  evaluations: Evaluation[];
  onRefresh: () => void;
}

export function WeeklyTaskTracker({ evaluations, onRefresh }: WeeklyTaskTrackerProps) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "SUBMITTED">("ALL");
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);

  const getTaskStatus = (evalItem: Evaluation) => {
    const deliverable = evalItem.deliverables?.[0];
    if (deliverable) {
      if (deliverable.score !== null && deliverable.score !== undefined) {
        return {
          type: "GRADED",
          label: `Calificado: ${deliverable.score}/20`,
          color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
          icon: Award,
          deliverable,
        };
      }
      return {
        type: "SUBMITTED",
        label: "Entregado (Pendiente de Nota)",
        color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
        icon: CheckCircle2,
        deliverable,
      };
    }

    const dueDate = new Date(evalItem.dueDate);
    const now = new Date();
    const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 0) {
      return {
        type: "OVERDUE",
        label: "Vencida",
        color: "bg-rose-500/10 text-rose-500 border-rose-500/30",
        icon: AlertTriangle,
      };
    } else if (diffHours <= 48) {
      return {
        type: "URGENT",
        label: `Vence pronto (${Math.ceil(diffHours)}h restantes)`,
        color: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        icon: Clock,
      };
    }
    return {
      type: "PENDING",
      label: "Pendiente",
      color: "bg-slate-500/10 text-slate-400 border-slate-500/30",
      icon: Clock,
    };
  };

  const filteredEvals = evaluations.filter((ev) => {
    const status = getTaskStatus(ev);
    if (filter === "PENDING") return status.type === "PENDING" || status.type === "URGENT" || status.type === "OVERDUE";
    if (filter === "SUBMITTED") return status.type === "SUBMITTED" || status.type === "GRADED";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4 text-primary" />
          <span>Filtrar Tareas:</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "ALL"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas ({evaluations.length})
          </button>
          <button
            onClick={() => setFilter("PENDING")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "PENDING"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Por Entregar ({evaluations.filter(e => !e.deliverables?.[0]).length})
          </button>
          <button
            onClick={() => setFilter("SUBMITTED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "SUBMITTED"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Completadas ({evaluations.filter(e => e.deliverables?.[0]).length})
          </button>
        </div>
      </div>

      {/* Lista de Evaluaciones / Tareas */}
      {filteredEvals.length === 0 ? (
        <div className="text-center p-8 border rounded-xl bg-card/50 text-muted-foreground">
          No hay tareas en esta categoría.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredEvals.map((ev) => {
            const status = getTaskStatus(ev);
            const StatusIcon = status.icon;

            return (
              <div
                key={ev.id}
                className="bg-card border border-border/60 rounded-xl p-4 shadow-sm hover:border-primary/40 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-base">{ev.title}</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {ev.description || "Sin descripción adicional"}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Fecha Límite: {new Date(ev.dueDate).toLocaleString("es-ES")}
                    </span>
                    <span>Puntaje Máximo: {ev.maxScore || 20} pts</span>
                  </div>
                  {/* Feedback si fue calificado */}
                  {status.deliverable?.feedback && (
                    <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                      <strong>Comentario del Profesor:</strong> {`“${status.deliverable.feedback}”`}
                    </div>
                  )}
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  {!status.deliverable ? (
                    <Button
                      size="sm"
                      onClick={() => setSelectedEval(ev)}
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    >
                      <Upload className="h-4 w-4" />
                      Subir Tarea
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedEval(ev)}
                      className="w-full sm:w-auto text-xs gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Reenviar / Ver Entrega
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Entrega */}
      {selectedEval && (
        <SubmitDeliverableModal
          isOpen={!!selectedEval}
          onClose={() => setSelectedEval(null)}
          onSuccess={() => {
            setSelectedEval(null);
            onRefresh();
          }}
          evaluation={selectedEval}
        />
      )}
    </div>
  );
}
