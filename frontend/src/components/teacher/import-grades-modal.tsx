"use client";

import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import type { Evaluation, User } from "@/types/domain";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ImportRow = {
  studentEmail: string;
  score: number;
  feedback?: string;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if ((char === "," || char === ";") && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function downloadTemplate(students: User[]) {
  const header = "studentEmail,score,feedback";
  const rows = students.map((student) => `${student.email},,`);
  const blob = new Blob(["\uFEFF", [header, ...rows].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-notas.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportGradesModal({
  isOpen,
  onClose,
  cohortId,
  evaluations,
  students,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  cohortId: string;
  evaluations: Evaluation[];
  students: User[];
  onSuccess: () => void;
}) {
  const [evaluationId, setEvaluationId] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("El CSV no contiene filas de notas");
      const header = parsed[0].map((value) => value.toLowerCase());
      const emailIndex = header.findIndex((value) => ["studentemail", "email", "correo"].includes(value));
      const scoreIndex = header.findIndex((value) => ["score", "nota", "calificacion"].includes(value));
      const feedbackIndex = header.findIndex((value) => ["feedback", "comentario", "observacion"].includes(value));
      if (emailIndex < 0 || scoreIndex < 0) {
        throw new Error("El archivo debe incluir las columnas studentEmail y score");
      }

      const importedRows = parsed.slice(1).map((values, index) => {
        const email = values[emailIndex]?.trim().toLowerCase();
        const score = Number(String(values[scoreIndex] || "").replace(",", "."));
        if (!email || !Number.isFinite(score)) {
          throw new Error(`Fila ${index + 2}: email o nota inválida`);
        }
        return {
          studentEmail: email,
          score,
          feedback: feedbackIndex >= 0 ? values[feedbackIndex]?.trim() || undefined : undefined,
        };
      });
      setRows(importedRows);
    } catch (requestError: unknown) {
      setRows([]);
      setError(getErrorMessage(requestError, "No se pudo leer el CSV"));
    }
  };

  const handleSubmit = async () => {
    if (!evaluationId) {
      setError("Selecciona la evaluación que deseas calificar");
      return;
    }
    if (!rows.length) {
      setError("Selecciona un CSV con al menos una nota");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await fetchApi(`/academic/cohorts/${cohortId}/grades/import`, {
        method: "POST",
        body: JSON.stringify({ evaluationId, rows }),
      });
      onSuccess();
      onClose();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "No se pudo importar las notas"));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title="Importar notas" onClose={() => { if (!saving) onClose(); }}>

      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Carga académica</p>
            <h2 id="import-grades-title" className="mt-1 flex items-center gap-2 text-xl font-bold">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> Importar notas desde CSV
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Las notas se publican inmediatamente y actualizan el promedio del estudiante.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar importación">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="grade-evaluation" className="mb-1.5 block text-sm font-semibold">Evaluación</label>
            <select id="grade-evaluation" value={evaluationId} onChange={(event) => setEvaluationId(event.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Selecciona una evaluación</option>
              {evaluations.map((evaluation) => <option key={evaluation.id} value={evaluation.id}>{evaluation.title} · máximo {evaluation.maxScore}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="text-sm"><p className="font-semibold">Formato esperado</p><p className="text-muted-foreground">studentEmail, score, feedback</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate(students)} className="gap-2"><Download className="h-4 w-4" /> Descargar plantilla</Button>
          </div>

          <label htmlFor="grades-csv" className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-border bg-muted/20 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
            <Upload className="h-7 w-7 text-primary" />
            <span className="mt-2 text-sm font-semibold">Seleccionar archivo CSV</span>
            <span className="mt-1 text-xs text-muted-foreground">{fileName || "CSV UTF-8 con las columnas studentEmail, score y feedback"}</span>
            <input id="grades-csv" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} />
          </label>

          {rows.length > 0 && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{rows.length} fila(s) listas para importar.</p>}
          {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-border/50 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || !rows.length} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {saving ? "Importando…" : "Importar notas"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
