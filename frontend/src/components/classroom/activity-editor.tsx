"use client";

import { useState } from 'react';
import { fetchApi, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Activity, Criterion, Question } from './types';
import { localDate } from './types';

const blankQuestion = (): Question => ({ prompt: '', options: ['', '', '', ''], correctIndex: 0, points: 1 });
const field = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm';

export function QuestionFields({ question, onChange }: { question: Question; onChange: (q: Question) => void }) {
  return <div className="space-y-3">
    <label className="block text-sm font-medium">Pregunta<textarea required maxLength={4000} value={question.prompt} onChange={(e) => onChange({ ...question, prompt: e.target.value })} className={field} /></label>
    <div className="grid gap-3 sm:grid-cols-2">{question.options.map((option, i) => <label className="block text-sm" key={i}>Opción {i + 1}<Input required value={option} maxLength={1000} onChange={(e) => onChange({ ...question, options: question.options.map((v, index) => index === i ? e.target.value : v) })} /></label>)}</div>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">Respuesta correcta<select className={field} value={question.correctIndex} onChange={(e) => onChange({ ...question, correctIndex: Number(e.target.value) })}>{question.options.map((_, i) => <option key={i} value={i}>Opción {i + 1}</option>)}</select></label><label className="text-sm">Puntos<Input required type="number" min={0.01} max={100} step="0.01" value={question.points} onChange={(e) => onChange({ ...question, points: Number(e.target.value) })} /></label></div>
  </div>;
}

export function ActivityEditor({ cohortId, activity, modules, bank, onClose, onSaved }: { cohortId: string; activity?: Activity; modules: { id: string; title: string }[]; bank: Question[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ title: activity?.title || '', description: activity?.description || '', kind: activity?.kind || 'ASSIGNMENT', moduleId: activity?.moduleId || '', weight: activity?.weight ?? 0, maxScore: activity?.maxScore ?? 20, dueDate: localDate(activity?.dueDate), isPublished: activity?.isPublished ?? false, allowLate: activity?.allowLate ?? true, allowResubmit: activity?.allowResubmit ?? true, maxAttempts: activity?.maxAttempts ?? 1, timeLimitMinutes: activity?.timeLimitMinutes ?? 30 });
  const [questions, setQuestions] = useState<Question[]>(activity?.questions?.length ? activity.questions : [blankQuestion()]);
  const [rubric, setRubric] = useState<Criterion[]>(activity?.rubric || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const locked = Boolean(activity && (activity.deliverables.length || activity.quizAttempts.length));
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await fetchApi(`/classroom/cohorts/${cohortId}/evaluations${activity ? `/${activity.id}` : ''}`, { method: activity ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, moduleId: form.moduleId || undefined, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined, rubric: form.kind === 'ASSIGNMENT' ? rubric : [], questions: form.kind === 'QUIZ' ? questions.map(({ prompt, options, correctIndex, points }) => ({ prompt, options, correctIndex, points })) : [] }) });
      await onSaved(); onClose();
    } catch (err) { setError(getErrorMessage(err)); } finally { setSaving(false); }
  }
  return <form onSubmit={save} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6" aria-label={activity ? 'Editar actividad' : 'Crear actividad'}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{activity ? 'Editar actividad' : 'Nueva actividad'}</h2><Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cerrar</Button></div>
    {locked && <p className="text-sm text-muted-foreground">Ya hay entregas. Las preguntas, rúbrica y escala de notas se conservan para mantener los resultados.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm font-medium">Tipo<select disabled={locked} className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'ASSIGNMENT' | 'QUIZ' })}><option value="ASSIGNMENT">Tarea o proyecto</option><option value="QUIZ">Cuestionario autocorregible</option></select></label>
      <label className="space-y-1 text-sm font-medium">Módulo<select className={field} value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })}><option value="">Actividad general del curso</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
    </div>
    <label className="block space-y-1 text-sm font-medium">Título<Input required maxLength={300} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
    <label className="block space-y-1 text-sm font-medium">Instrucciones<textarea className={field} rows={4} maxLength={20000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm font-medium">Peso (%)<Input required type="number" min={0} max={100} step="0.01" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} /></label>
      <label className="text-sm font-medium">Nota máxima<Input disabled={locked} required type="number" min={1} max={100} step="0.01" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })} /></label>
      <label className="text-sm font-medium">Fecha límite<Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
    </div>
    {form.kind === 'QUIZ' ? <>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Intentos permitidos<Input required type="number" min={1} max={10} value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })} /></label><label className="text-sm">Tiempo por intento (minutos)<Input required type="number" min={1} max={240} value={form.timeLimitMinutes} onChange={(e) => setForm({ ...form, timeLimitMinutes: Number(e.target.value) })} /></label></div>
      <p className="text-sm text-muted-foreground">La mejor nota se incorpora al libro de calificaciones. Las respuestas correctas quedan visibles solo para el docente.</p>
      <fieldset disabled={locked || saving} className="space-y-4"><legend className="mb-3 font-semibold">Preguntas ({questions.length})</legend>
        {questions.map((question, i) => <div key={i} className="rounded-xl border bg-background p-4"><div className="mb-3 flex justify-between"><span className="text-sm font-semibold">Pregunta {i + 1}</span><Button type="button" size="sm" variant="ghost" disabled={questions.length === 1} onClick={() => setQuestions(questions.filter((_, index) => index !== i))}>Quitar</Button></div><QuestionFields question={question} onChange={(q) => setQuestions(questions.map((old, index) => index === i ? q : old))} /></div>)}
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={questions.length >= 100} onClick={() => setQuestions([...questions, blankQuestion()])}>Añadir pregunta</Button>{bank.length > 0 && <label className="text-sm">Añadir del banco<select aria-label="Añadir del banco" className={field} value="" onChange={(e) => { const q = bank.find((item) => item.id === e.target.value); if (q) setQuestions([...questions, { prompt: q.prompt, options: [...q.options], correctIndex: q.correctIndex, points: q.points }]); }}><option value="">Seleccionar pregunta</option>{bank.map((q) => <option key={q.id} value={q.id}>{q.prompt.slice(0, 80)}</option>)}</select></label>}</div>
      </fieldset>
    </> : <>
      <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.allowResubmit} onChange={(e) => setForm({ ...form, allowResubmit: e.target.checked })} />Permitir reemplazar antes de calificar</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.allowLate} onChange={(e) => setForm({ ...form, allowLate: e.target.checked })} />Aceptar entregas tardías</label></div>
      <fieldset disabled={locked || saving} className="space-y-3"><legend className="mb-2 font-semibold">Rúbrica de evaluación</legend><p className="text-sm text-muted-foreground">Los puntos de los criterios deben sumar {form.maxScore}. Puedes dejar la rúbrica vacía.</p>{rubric.map((c, i) => <div className="flex flex-wrap items-end gap-2" key={i}><label className="min-w-40 flex-1 text-sm">Criterio {i + 1}<Input required maxLength={200} value={c.title} onChange={(e) => setRubric(rubric.map((old, index) => index === i ? { ...old, title: e.target.value } : old))} /></label><label className="w-24 text-sm">Puntos<Input required type="number" min={0.01} max={100} step="0.01" value={c.points} onChange={(e) => setRubric(rubric.map((old, index) => index === i ? { ...old, points: Number(e.target.value) } : old))} /></label><Button type="button" variant="ghost" onClick={() => setRubric(rubric.filter((_, index) => index !== i))}>Quitar</Button></div>)}<Button type="button" variant="outline" disabled={rubric.length >= 20} onClick={() => setRubric([...rubric, { title: '', points: 1 }])}>Añadir criterio</Button></fieldset>
    </>}
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />Publicar para estudiantes</label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={saving} type="submit">{saving ? 'Guardando…' : form.isPublished ? 'Guardar y publicar' : 'Guardar borrador'}</Button>
  </form>;
}
