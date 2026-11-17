"use client";

import { useEffect, useEffectEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useConfirm } from '@/components/confirm-provider';
import { fetchApi, getErrorMessage, resolveFileUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSubmissionDraft } from '@/lib/use-submission-draft';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { ActivityEditor, QuestionFields } from './activity-editor';
import { QuizRunner } from './quiz-runner';
import { type Activity, type Attempt, type ClassroomPost, type Question, type Submission, dateLabel, localDate } from './types';

const textarea = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm';
const statusLabel: Record<string, string> = { PENDING: 'En revisión', LATE: 'Entregado con retraso', RETURNED: 'Devuelto para corregir', GRADED: 'Calificado' };

function SubmissionForm({ activity, onSaved }: { activity: Activity; onSaved: () => Promise<void> }) {
  const { draft, updateDraft, clearDraft, notice, ready } = useSubmissionDraft(activity.id);
  const { fileUrl, comment } = draft;
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useUnsavedChanges(Boolean(fileUrl || comment || file));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError('');
    try {
      if (file) {
        if (file.size > 100 * 1024 * 1024) throw new Error('El archivo debe pesar como máximo 100 MB');
        const body = new FormData(); body.append('file', file); body.append('comment', comment);
        await fetchApi(`/classroom/evaluations/${activity.id}/upload`, { method: 'POST', body });
      } else await fetchApi(`/classroom/evaluations/${activity.id}/submit`, { method: 'POST', body: JSON.stringify({ fileUrl, comment }) });
      clearDraft();
      setFile(null);
      form.reset();
      await onSaved();
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-muted/30 p-4" aria-label={`Entregar ${activity.title}`}>
    <p className="text-sm font-semibold">{activity.deliverables.length ? 'Enviar una nueva versión' : 'Entregar trabajo'}</p>
    <fieldset disabled={busy || !ready} className="space-y-3">
    <label className="block text-sm">Enlace a tu trabajo<Input type="url" required={!file} disabled={Boolean(file)} value={fileUrl} onChange={(e) => updateDraft({ ...draft, fileUrl: e.target.value })} placeholder="https://github.com/… o https://drive.google.com/…" /></label>
    <label className="block text-sm">O adjunta un archivo (hasta 100 MB)<Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.png,.jpg,.jpeg,.webp,.mp4,.webm" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
    <label className="block text-sm">Comentario al docente<textarea className={textarea} maxLength={10000} value={comment} onChange={(e) => updateDraft({ ...draft, comment: e.target.value })} /></label>
    <p className="text-xs text-muted-foreground">Los enlaces y comentarios se conservan en esta pestaña. Los archivos deben seleccionarse de nuevo al volver.</p>
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar entrega'}</Button>
    </fieldset>
  </form>;
}

function GradeForm({ activity, submission, onSaved }: { activity: Activity; submission: Submission; onSaved: () => Promise<void> }) {
  const [score, setScore] = useState(submission.grade?.score ?? 0);
  const [feedback, setFeedback] = useState(submission.grade?.feedback || '');
  const [rubricScores, setRubricScores] = useState<number[]>(submission.grade?.rubricScores || activity.rubric.map(() => 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function grade(action: 'draft' | 'publish' | 'return') {
    setBusy(true); setError('');
    try {
      if (action === 'return' && !feedback.trim()) throw new Error('Explica qué debe corregir el estudiante');
      await fetchApi(`/classroom/deliverables/${submission.id}/${action === 'return' ? 'return' : 'grade'}`, { method: 'POST', body: JSON.stringify(action === 'return' ? { feedback } : { score, feedback, rubricScores: activity.rubric.length ? rubricScores : undefined, draft: action === 'draft' }) });
      await onSaved();
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-3">
    {activity.rubric.length ? activity.rubric.map((c, i) => <label key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">{c.title} · máximo {c.points}<Input aria-label={`Puntaje: ${c.title}`} className="w-28" type="number" min={0} max={c.points} step="0.01" value={rubricScores[i]} onChange={(e) => setRubricScores(rubricScores.map((old, index) => index === i ? Number(e.target.value) : old))} /></label>) : <label className="block text-sm">Nota (máximo {activity.maxScore})<Input type="number" min={0} max={activity.maxScore} step="0.01" value={score} onChange={(e) => setScore(Number(e.target.value))} /></label>}
    <label className="block text-sm">Retroalimentación<textarea className={textarea} value={feedback} maxLength={10000} onChange={(e) => setFeedback(e.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || submission.status === 'RETURNED'} onClick={() => void grade('publish')}>Publicar nota</Button><Button variant="outline" disabled={busy || submission.status === 'RETURNED'} onClick={() => void grade('draft')}>Guardar borrador</Button><Button variant="outline" disabled={busy} onClick={() => void grade('return')}>Devolver para corregir</Button></div>
  </div>;
}

function PostEditor({ cohortId, post, onClose, onSaved }: { cohortId: string; post?: ClassroomPost; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [publishedAt, setPublishedAt] = useState(localDate(post?.publishedAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await fetchApi(`/classroom/cohorts/${cohortId}/posts${post ? `/${post.id}` : ''}`, { method: post ? 'PATCH' : 'POST', body: JSON.stringify({ title, content, pinned, publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined }) });
      await onSaved(); onClose();
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-5" aria-label="Publicar anuncio del curso"><h2 className="text-lg font-semibold">{post ? 'Editar anuncio' : 'Nuevo anuncio del curso'}</h2><label className="block text-sm">Título<Input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="block text-sm">Mensaje<textarea className={textarea} required maxLength={10000} rows={4} value={content} onChange={(e) => setContent(e.target.value)} /></label><label className="block text-sm">Programar publicación (opcional)<Input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />Fijar al inicio</label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-2"><Button disabled={busy} type="submit">{busy ? 'Guardando…' : 'Guardar anuncio'}</Button><Button disabled={busy} type="button" variant="ghost" onClick={onClose}>Cancelar</Button></div></form>;
}

function QuestionBank({ cohortId, bank, onSaved }: { cohortId: string; bank: Question[]; onSaved: () => Promise<void> }) {
  const [question, setQuestion] = useState<Question>({ prompt: '', options: ['', '', '', ''], correctIndex: 0, points: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await fetchApi(`/classroom/cohorts/${cohortId}/questions`, { method: 'POST', body: JSON.stringify(question) });
      setQuestion({ prompt: '', options: ['', '', '', ''], correctIndex: 0, points: 1 }); await onSaved();
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!await confirm({ title: 'Quitar pregunta del banco', description: 'Los cuestionarios ya creados conservan su copia de esta pregunta.', confirmLabel: 'Quitar' })) return;
    try { await fetchApi(`/classroom/questions/${id}`, { method: 'DELETE' }); await onSaved(); } catch (err) { setError(getErrorMessage(err)); }
  }
  return <div className="space-y-5"><form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Banco de preguntas</h2><p className="text-sm text-muted-foreground">Prepara preguntas y reutilízalas al crear cuestionarios de este curso.</p><QuestionFields question={question} onChange={setQuestion} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar en el banco'}</Button></form><div className="divide-y rounded-xl border bg-card">{bank.length ? bank.map((q) => <div key={q.id} className="flex items-start justify-between gap-3 p-4"><div><p className="font-medium">{q.prompt}</p><p className="mt-1 text-sm text-muted-foreground">Correcta: {q.options[q.correctIndex]} · {q.points} puntos</p></div><Button variant="ghost" onClick={() => void remove(q.id!)}>Quitar</Button></div>) : <p className="p-5 text-sm text-muted-foreground">Todavía no hay preguntas guardadas.</p>}</div></div>;
}

export function ClassroomWorkspace({ cohortId }: { cohortId: string }) {
  const { user } = useAuth();
  const manager = Boolean(user?.roles.some((role) => ['ADMIN', 'DOCENTE'].includes(role)));
  const [tab, setTab] = useState<'activities' | 'posts' | 'bank'>('activities');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [posts, setPosts] = useState<ClassroomPost[]>([]);
  const [modules, setModules] = useState<{ id: string; title: string }[]>([]);
  const [bank, setBank] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<Activity | 'new' | null>(null);
  const [postEditor, setPostEditor] = useState<ClassroomPost | 'new' | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busyId, setBusyId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const confirm = useConfirm();
  async function load() {
    setError('');
    try {
      const [items, announcements, syllabus, questions] = await Promise.all([
        fetchApi(`/classroom/cohorts/${cohortId}/evaluations`), fetchApi(`/classroom/cohorts/${cohortId}/posts`), fetchApi(`/academic/cohorts/${cohortId}/modules`), manager ? fetchApi(`/classroom/cohorts/${cohortId}/questions`) : Promise.resolve([]),
      ]);
      setActivities(items); setPosts(announcements); setModules(syllabus); setBank(questions);
    } catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => {
    if (loading) return;
    const focusActivity = () => {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target?.id.startsWith('activity-')) { target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); }
    };
    const timer = window.setTimeout(focusActivity, 0);
    window.addEventListener('hashchange', focusActivity);
    return () => { window.clearTimeout(timer); window.removeEventListener('hashchange', focusActivity); };
  }, [loading, cohortId]);
  const loadEffect = useEffectEvent(load);
  useEffect(() => { if (user) { const timer = window.setTimeout(() => void loadEffect(), 0); return () => window.clearTimeout(timer); } }, [cohortId, user]);
  async function remove(path: string, title: string) {
    if (!await confirm({ title, description: 'El contenido dejará de estar visible para los estudiantes. Se conservarán las entregas para el registro académico.', confirmLabel: 'Retirar' })) return;
    setBusyId(path);
    try { await fetchApi(path, { method: 'DELETE' }); await load(); } catch (err) { setError(getErrorMessage(err)); } finally { setBusyId(''); }
  }
  async function start(activity: Activity) {
    setBusyId(activity.id); setError('');
    try { setAttempt(await fetchApi(`/classroom/evaluations/${activity.id}/attempts`, { method: 'POST' })); }
    catch (err) { setError(getErrorMessage(err)); } finally { setBusyId(''); }
  }
  const visible = activities.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || a.moduleId === filter || (filter === 'pending' && !a.deliverables.length) || (filter === 'review' && a.deliverables.some((d) => ['PENDING', 'LATE'].includes(d.status)))));
  return <section aria-label="Trabajo del curso" className="mx-auto w-full max-w-6xl space-y-6 pb-12">
    <header className="space-y-3 border-b pb-6"><Link className="text-sm font-medium text-primary hover:underline" href={manager ? `/dashboard/classes/${cohortId}` : `/dashboard/my-courses/${cohortId}`}>← Volver al curso</Link><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Aula virtual</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Trabajo del curso</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{manager ? 'Publica actividades, acompaña las entregas y comparte las novedades del curso.' : 'Organiza tus entregas, responde cuestionarios y consulta las novedades de tu curso.'}</p></div><Link href={`/dashboard/classes/${cohortId}/forum`}><Button variant="outline">Foros del curso</Button></Link></div></header>
    <nav className="flex flex-wrap gap-2" aria-label="Secciones del aula">{([{ key: 'activities', title: 'Actividades' }, { key: 'posts', title: 'Anuncios del curso' }, ...(manager ? [{ key: 'bank', title: 'Banco de preguntas' }] : [])] as { key: typeof tab; title: string }[]).map((item) => <Button key={item.key} variant={tab === item.key ? 'default' : 'outline'} aria-current={tab === item.key ? 'page' : undefined} onClick={() => setTab(item.key)}>{item.title}</Button>)}</nav>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" onClick={() => void load()}>Reintentar</Button></div>}
    {loading ? (
      <div role="status" aria-label="Cargando el aula" className="space-y-4 py-6">
        <div className="h-12 w-full rounded-xl shimmer-loading" />
        <div className="h-36 w-full rounded-2xl shimmer-loading" />
        <div className="h-36 w-full rounded-2xl shimmer-loading" />
      </div>
    ) : <>
      {tab === 'activities' && <>
        {attempt ? <QuizRunner key={attempt.id} attempt={attempt} onFinished={load} onClose={() => setAttempt(null)} /> : <>
          {editor && <ActivityEditor key={editor === 'new' ? 'new' : editor.id} cohortId={cohortId} activity={editor === 'new' ? undefined : editor} modules={modules} bank={bank} onSaved={load} onClose={() => setEditor(null)} />}
          <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm font-medium">Buscar actividad<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título de la tarea o cuestionario" /></label><label className="min-w-48 text-sm font-medium">Filtrar<select className={textarea} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Todas las actividades</option><option value={manager ? 'review' : 'pending'}>{manager ? 'Entregas por revisar' : 'Sin entregar'}</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>{manager && <Button onClick={() => setEditor('new')}>Crear actividad</Button>}</div>
          <p className="text-sm text-muted-foreground">{visible.length} actividades · {manager ? activities.reduce((sum, a) => sum + a.deliverables.filter((d) => ['PENDING', 'LATE'].includes(d.status)).length, 0) + ' entregas por revisar' : 'Las notas se muestran cuando el docente las publica.'}</p>
          {visible.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center"><h2 className="font-semibold">No hay actividades en esta vista</h2><p className="mt-2 text-sm text-muted-foreground">{manager ? 'Crea una tarea o un cuestionario para comenzar.' : 'Vuelve más tarde o revisa los filtros.'}</p></div>}
          {visible.map((activity) => {
            const submission = activity.deliverables[0];
            const canSubmit = !submission || submission.status === 'RETURNED' || (activity.allowResubmit && submission.grade?.status !== 'PUBLISHED');
            return <article id={`activity-${activity.id}`} tabIndex={-1} className="scroll-mt-5 overflow-hidden rounded-2xl border bg-card focus:outline-2 focus:outline-primary" key={activity.id}>
              <div className="space-y-4 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">{activity.kind === 'QUIZ' ? 'Cuestionario' : 'Tarea'}{manager && !activity.isPublished ? ' · Borrador' : ''}</p><h2 className="mt-1 text-xl font-semibold">{activity.title}</h2><p className="mt-2 text-xs text-muted-foreground">{activity.maxScore} puntos · Peso {activity.weight}% · {activity.dueDate ? `Hasta ${dateLabel(activity.dueDate)}` : 'Sin fecha límite'}</p></div>{manager && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditor(activity)}>Editar</Button><Button size="sm" variant="ghost" disabled={Boolean(busyId)} onClick={() => void remove(`/classroom/evaluations/${activity.id}`, 'Retirar actividad')}>Retirar</Button></div>}</div>
                {activity.description && <p className="whitespace-pre-wrap text-sm leading-relaxed">{activity.description}</p>}
                {activity.rubric?.length > 0 && <details className="rounded-lg bg-muted/30 p-3"><summary className="cursor-pointer text-sm font-semibold">Criterios de evaluación</summary><ul className="mt-3 space-y-2 text-sm">{activity.rubric.map((c, i) => <li className="flex justify-between gap-3" key={i}><span>{c.title}</span><span>{c.points} puntos</span></li>)}</ul></details>}
                {activity.kind === 'QUIZ' && <div className="space-y-3"><p className="text-sm text-muted-foreground">{activity.questionCount} preguntas · {activity.timeLimitMinutes} minutos · {activity.maxAttempts} intento(s)</p>{!manager && <Button disabled={busyId === activity.id || (activity.quizAttempts.length >= activity.maxAttempts && activity.quizAttempts.every((a) => a.submittedAt))} onClick={() => void start(activity)}>{activity.quizAttempts.some((a) => !a.submittedAt) ? 'Retomar intento' : 'Comenzar cuestionario'}</Button>}{activity.quizAttempts.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Historial de intentos ({activity.quizAttempts.length})</summary><ul className="mt-2 space-y-2 text-sm">{activity.quizAttempts.map((a) => <li key={a.id}>Intento {a.number}{manager ? ` · ${activity.deliverables.find((d) => d.studentId === a.studentId)?.student.firstName || 'Estudiante'}` : ''} · {a.submittedAt ? `${a.score}/${activity.maxScore}` : 'En curso'}</li>)}</ul></details>}</div>}
                {!manager && submission && <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="font-semibold">{statusLabel[submission.status] || submission.status}{submission.grade?.status === 'PUBLISHED' ? ` · ${submission.grade.score}/${activity.maxScore}` : ''}</p>{activity.kind === 'ASSIGNMENT' && <a className="text-sm text-primary underline" href={resolveFileUrl(submission.fileUrl)} target="_blank" rel="noreferrer">Ver trabajo entregado</a>}<p className="text-xs text-muted-foreground">Entregado: {dateLabel(submission.submittedAt)}</p>{(submission.grade?.feedback || submission.returnFeedback) && <p className="whitespace-pre-wrap text-sm">Comentario del docente: {submission.grade?.feedback || submission.returnFeedback}</p>}{submission.revisions.length > 0 && <details><summary className="cursor-pointer text-sm">Versiones anteriores ({submission.revisions.length})</summary><ul className="mt-2 space-y-2">{submission.revisions.map((r) => <li key={r.id}><a className="text-sm text-primary underline" href={resolveFileUrl(r.fileUrl)} target="_blank" rel="noreferrer">Entrega del {dateLabel(r.submittedAt)}</a></li>)}</ul></details>}</div>}
                {!manager && activity.kind === 'ASSIGNMENT' && canSubmit && <SubmissionForm key={`${activity.id}-${submission?.submittedAt || 'new'}`} activity={activity} onSaved={load} />}
              </div>
              {manager && <div className="border-t bg-muted/10 px-5 sm:px-6"><details className="py-4"><summary className="cursor-pointer text-sm font-semibold">Entregas y calificaciones ({activity.deliverables.length})</summary>{activity.deliverables.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Aún no hay entregas.</p>}<div className="mt-3 divide-y">{activity.deliverables.map((delivery) => <details key={`${delivery.id}-${delivery.submittedAt}-${delivery.grade?.status}-${delivery.status}`} className="py-4"><summary className="cursor-pointer text-sm font-medium">{delivery.student.firstName} {delivery.student.lastName} · {statusLabel[delivery.status]}{delivery.grade && !delivery.grade.status.includes('DELETED') ? ` · ${delivery.grade.score}/${activity.maxScore} (${delivery.grade.status === 'PUBLISHED' ? 'publicada' : 'borrador'})` : ''}</summary><div className="mt-3 space-y-2">{activity.kind === 'ASSIGNMENT' && <a className="text-sm text-primary underline" href={resolveFileUrl(delivery.fileUrl)} target="_blank" rel="noreferrer">Abrir entrega</a>}<p className="text-xs text-muted-foreground">{dateLabel(delivery.submittedAt)}</p>{delivery.comment && <p className="whitespace-pre-wrap text-sm">{delivery.comment}</p>}{delivery.revisions.map((r) => <div key={r.id} className="text-sm"><a href={resolveFileUrl(r.fileUrl)} className="text-primary underline" target="_blank" rel="noreferrer">Versión del {dateLabel(r.submittedAt)}</a>{r.gradeSnapshot && <span> · Nota anterior {r.gradeSnapshot.score}</span>}</div>)}{activity.kind === 'ASSIGNMENT' && <GradeForm activity={activity} submission={delivery} onSaved={load} />}</div></details>)}</div></details></div>}
            </article>;
          })}
        </>}
      </>}
      {tab === 'posts' && <div className="space-y-5">{manager && <Button onClick={() => setPostEditor('new')}>Publicar anuncio</Button>}{postEditor && <PostEditor key={postEditor === 'new' ? 'new' : postEditor.id} cohortId={cohortId} post={postEditor === 'new' ? undefined : postEditor} onSaved={load} onClose={() => setPostEditor(null)} />}{posts.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Todavía no hay anuncios del curso.</p>}{posts.map((post) => <article className="rounded-2xl border bg-card p-5 sm:p-6" key={post.id}><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-muted-foreground">{post.pinned ? 'Fijado · ' : ''}{post.author.firstName} {post.author.lastName} · {dateLabel(post.publishedAt)}</p><h2 className="mt-2 text-xl font-semibold">{post.title}</h2></div>{manager && <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => setPostEditor(post)}>Editar</Button><Button size="sm" variant="ghost" disabled={Boolean(busyId)} onClick={() => void remove(`/classroom/posts/${post.id}`, 'Retirar anuncio')}>Retirar</Button></div>}</div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p></article>)}</div>}
      {tab === 'bank' && manager && <QuestionBank cohortId={cohortId} bank={bank} onSaved={load} />}
    </>}
  </section>;
}
