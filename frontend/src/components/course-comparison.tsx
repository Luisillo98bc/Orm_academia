"use client";

import { useState } from "react";
import Link from "next/link";
import type { Course, Cohort } from "@/types/domain";
import { getCohortPricing, formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function CourseComparison({ items, clear }: {
  items: Array<{ course: Course; cohort?: Cohort }>; clear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice("Enlace copiado."); }
    catch { setNotice("Copia la dirección de la barra del navegador para compartir esta selección."); }
  }
  const rows: Array<{ label: string; value: (item: typeof items[number]) => string }> = [
    { label: "Nivel", value: ({ course }) => ({ BEGINNER: "Inicial", INTERMEDIATE: "Intermedio", ADVANCED: "Avanzado" })[course.level] || "Por confirmar" },
    { label: "Duración", value: ({ course }) => course.durationHours > 0 ? `${course.durationHours} horas` : "Por confirmar" },
    { label: "Inversión", value: ({ cohort }) => cohort ? `S/ ${formatMoney(getCohortPricing(cohort).finalPrice)}` : "Por confirmar" },
    { label: "Modalidad", value: ({ cohort }) => ({ ONLINE: "En línea", PRESENCIAL: "Presencial", HIBRIDA: "Híbrida" })[cohort?.modality || ""] || "Por confirmar" },
    { label: "Inicio", value: ({ cohort }) => cohort ? new Date(cohort.startDate).toLocaleDateString("es-PE") : "Próximamente" },
    { label: "Horario", value: ({ cohort }) => cohort?.schedule || "Por confirmar" },
  ];
  return <>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300" role="status">
        {items.length ? <strong className="font-semibold text-slate-950 dark:text-white">{items.length} de 3 programas seleccionados</strong> : "Selecciona de 2 a 3 programas para comparar."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void share()}>Compartir búsqueda</Button>
        {items.length > 0 && <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={clear}>Quitar selección</Button>}
        <Button type="button" size="sm" className="rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-45" disabled={items.length < 2} onClick={() => setOpen(true)}>Comparar programas</Button>
      </div>
      {notice && <p className="w-full text-xs text-blue-700 dark:text-blue-300" role="status">{notice}</p>}
    </div>
    {open && <Modal title="Comparar programas" onClose={() => setOpen(false)}>
      <div className="w-full max-w-4xl min-w-0 rounded-2xl border bg-card p-4 shadow-xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Comparar programas</h2><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cerrar comparador</Button></div>
        <p className="mb-4 text-sm text-muted-foreground">Se muestra la próxima edición abierta de cada programa. Desplaza la tabla para ver todas las opciones.</p>
        <div className="overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Tabla comparativa de programas">
          <table className="w-full min-w-[580px] text-left text-sm">
            <caption className="sr-only">Nivel, duración, precio y horario de los programas seleccionados</caption>
            <thead><tr className="bg-muted/50"><th scope="col" className="sticky left-0 bg-card p-3">Característica</th>{items.map(({ course }) => <th key={course.id} scope="col" className="min-w-44 p-3">{course.name}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.label} className="border-t"><th scope="row" className="sticky left-0 bg-card p-3 font-medium">{row.label}</th>{items.map((item) => <td key={item.course.id} className="p-3">{row.value(item)}</td>)}</tr>)}
              <tr className="border-t"><th scope="row" className="sticky left-0 bg-card p-3">Detalles</th>{items.map(({ course }) => <td key={course.id} className="p-3"><Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" href={`/programas/${course.id}`}>Ver {course.name}</Link></td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>}
  </>;
}
