"use client";

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { fetchApi, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { Attempt } from './types';

export function QuizRunner({ attempt, onFinished, onClose }: { attempt: Attempt; onFinished: () => Promise<void>; onClose: () => void }) {
  const [answers, setAnswers] = useState(attempt.answers);
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - new Date(attempt.serverTime).getTime()) / 1000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('Respuestas guardadas');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(false);
  const latestAnswers = useRef(answers);
  const version = useRef(0);
  const finishing = useRef(false);
  const initialRemaining = useRef(remaining);
  const started = useRef(0);
  async function finish() {
    if (finishing.current) return;
    finishing.current = true; setBusy(true); setError('');
    try {
      await queue.current;
      await fetchApi(`/classroom/attempts/${attempt.id}/finish`, { method: 'POST', body: JSON.stringify({ answers }) });
      await onFinished(); onClose();
    } catch (err) { setError(getErrorMessage(err)); finishing.current = false; } finally { setBusy(false); }
  }
  const expire = useEffectEvent(() => { void finish(); });
  useEffect(() => {
    started.current = Date.now();
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, initialRemaining.current - Math.floor((Date.now() - started.current) / 1000));
      setRemaining(seconds);
      if (seconds === 0) { window.clearInterval(timer); expire(); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  function save(next: typeof answers) {
    const revision = ++version.current;
    pending.current = true;
    setSaved('Guardando…');
    queue.current = queue.current.then(async () => {
      try {
        await fetchApi(`/classroom/attempts/${attempt.id}`, { method: 'PATCH', body: JSON.stringify({ answers: next }) });
        if (revision === version.current) {
          pending.current = false;
          setSaved('Respuestas guardadas');
          setError('');
        }
      } catch (err) {
        if (revision === version.current) {
          setSaved('Hay respuestas sin guardar. Reintenta antes de salir.');
          setError(getErrorMessage(err));
        }
      }
    });
  }
  const retryOnReconnect = useEffectEvent(() => {
    if (pending.current) save(latestAnswers.current);
  });
  useEffect(() => {
    window.addEventListener('online', retryOnReconnect);
    return () => window.removeEventListener('online', retryOnReconnect);
  }, []);
  function choose(index: number, value: number) {
    const next = answers.map((old, i) => i === index ? value : old);
    latestAnswers.current = next;
    setAnswers(next);
    save(next);
  }
  return <section className="space-y-5 rounded-2xl border border-primary/30 bg-card p-5 sm:p-6" aria-label="Responder cuestionario">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Intento {attempt.number}</h2><p className="text-sm text-muted-foreground" aria-live="polite">{saved}</p></div><p className="rounded-lg bg-primary/10 px-3 py-2 font-mono font-semibold" role="timer" aria-label="Tiempo restante">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p></div>
    <p className="text-sm text-muted-foreground">Al vencer el tiempo se califican las respuestas guardadas. Puedes salir y retomar este intento; el reloj sigue corriendo.</p>
    <fieldset disabled={busy || remaining === 0} className="space-y-5">{attempt.questions.map((question, index) => <fieldset key={index} className="space-y-2 border-t pt-4"><legend className="px-1 font-semibold">{index + 1}. {question.prompt} <span className="text-xs font-normal text-muted-foreground">({question.points} puntos)</span></legend>{question.options.map((option, optionIndex) => <label key={optionIndex} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${answers[index] === optionIndex ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}><input type="radio" name={`question-${index}`} value={optionIndex} checked={answers[index] === optionIndex} onChange={() => choose(index, optionIndex)} />{option}</label>)}</fieldset>)}</fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void finish()}>{busy ? 'Enviando…' : 'Finalizar y calificar'}</Button><Button variant="outline" disabled={busy} onClick={async () => { await queue.current; if (pending.current) { setError('Hay respuestas sin guardar. Reintenta antes de salir.'); return; } onClose(); }}>Salir y continuar después</Button>{saved.startsWith('Hay respuestas') && <Button variant="outline" disabled={busy} onClick={() => save(latestAnswers.current)}>Reintentar guardado</Button>}</div>
  </section>;
}
