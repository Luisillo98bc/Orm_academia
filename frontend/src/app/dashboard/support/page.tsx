"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, MessageSquare, Plus, Send, ShieldAlert } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";

type Ticket = { id: string; subject: string; description: string; status: string; priority: string; category: string; createdAt: string; requester?: { firstName: string; lastName: string }; assignee?: { firstName: string; lastName: string } | null; _count?: { messages: number } };
type TicketDetail = Ticket & { messages: Array<{ id: string; body: string; internalNote: boolean; createdAt: string; author: { firstName: string; lastName: string } }> };

const statusLabel: Record<string, string> = { OPEN: "Abierto", IN_PROGRESS: "En atención", WAITING_USER: "Esperando respuesta", RESOLVED: "Resuelto", CLOSED: "Cerrado" };
const statusBadgeClass: Record<string, string> = {
  OPEN: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  WAITING_USER: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  CLOSED: "bg-muted text-muted-foreground border-border",
};
const priorityLabel: Record<string, string> = { LOW: "Baja", NORMAL: "Media", MEDIUM: "Media", HIGH: "Alta", URGENT: "Urgente" };
const priorityBadgeClass: Record<string, string> = {
  LOW: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  NORMAL: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  MEDIUM: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  HIGH: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  URGENT: "bg-red-500/10 text-red-700 dark:text-red-300",
};

export default function SupportPage() {
  const { user } = useAuth();
  const isStaff = Boolean(user?.roles.some((role) => ["ADMIN", "RRHH", "DOCENTE"].includes(role)));
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [priority, setPriority] = useState("");
  const [showCreate, setShowCreate] = useState(!user?.roles.includes("ADMIN"));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = new URLSearchParams({ page: String(page), ...(priority ? { priority } : {}), ...(status ? { status } : {}), ...(debouncedSearch ? { search: debouncedSearch } : {}) }).toString();

  const load = async () => {
    setLoading(true);
    try { const result: Ticket[] = await fetchApi(`/support/tickets?${query}`); setTickets(result.slice(0, 20)); setHasNext(result.length > 20); } catch { toast.error("No se pudieron cargar los tickets"); } finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    void fetchApi(`/support/tickets?${query}`)
      .then((data: Ticket[]) => { if (!cancelled) { setTickets(data.slice(0, 20)); setHasNext(data.length > 20); } })
      .catch(() => { if (!cancelled) toast.error("No se pudieron cargar los tickets"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const openTicket = async (id: string) => { try { setSelected(await fetchApi(`/support/tickets/${id}`)); } catch { toast.error("No se pudo abrir el ticket"); } };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try { const ticket = await fetchApi("/support/tickets", { method: "POST", body: JSON.stringify({ subject, description }) }); setSubject(""); setDescription(""); setSelected(ticket); await load(); toast.success("Ticket creado"); } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo crear"); } finally { setCreating(false); }
  };
  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || reply.trim().length < 2 || sendingReply) return;
    setSendingReply(true);
    try { await fetchApi(`/support/tickets/${selected.id}/messages`, { method: "POST", body: JSON.stringify({ body: reply, internalNote: isStaff && internalNote }) }); setReply(""); setInternalNote(false); await openTicket(selected.id); await load(); } catch { toast.error("No se pudo enviar el mensaje"); } finally { setSendingReply(false); }
  };

  const updateTicket = async (values: { status?: string; assigneeId?: string }) => {
    if (!selected) return;
    try { await fetchApi(`/support/tickets/${selected.id}`, { method: "PATCH", body: JSON.stringify(values) }); await openTicket(selected.id); await load(); toast.success("Solicitud actualizada"); } catch { toast.error("No se pudo actualizar la solicitud"); }
  };

  return <div className="space-y-6">
    <PageHeader eyebrow="Centro de ayuda" title="Soporte y seguimiento" description="Prioriza solicitudes, asigna responsables y consulta las respuestas del equipo." actions={<Button onClick={() => setShowCreate(!showCreate)} variant={showCreate ? "outline" : "default"}><Plus className="mr-2 h-4 w-4" />{showCreate ? "Ocultar formulario" : "Nueva solicitud"}</Button>} />
    <SummaryStrip items={[{ label: "En esta página", value: tickets.length }, { label: "Sin resolver en esta página", value: tickets.filter(ticket => !["RESOLVED", "CLOSED"].includes(ticket.status)).length }, { label: "Prioridad alta / urgente", value: tickets.filter(ticket => ["HIGH", "URGENT"].includes(ticket.priority)).length }]} />
    <div className="workspace-toolbar"><label>Prioridad<select value={priority} onChange={event => { setPriority(event.target.value); setPage(1); }}><option value="">Todas</option><option value="LOW">Baja</option><option value="NORMAL">Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label><p className="text-xs text-muted-foreground">Consulta las solicitudes con mayor prioridad y su responsable.</p></div>
    <div className={`grid gap-6 ${showCreate ? "lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]" : ""}`}>
      <Card className={showCreate ? "" : "hidden"}><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Nueva solicitud</CardTitle></CardHeader><CardContent><form onSubmit={create} className="space-y-4"><Input aria-label="Asunto" placeholder="¿En qué necesitas ayuda?" value={subject} onChange={(e) => setSubject(e.target.value)} required /><textarea aria-label="Descripción" placeholder="Describe el problema con el mayor detalle posible" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} required className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" /><Button disabled={creating} className="w-full">{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar solicitud</Button></form></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Solicitudes</CardTitle><div className="flex flex-wrap gap-2"><Input aria-label="Buscar solicitudes" placeholder="Buscar solicitudes" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><select aria-label="Filtrar por estado" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-md border bg-background p-2 text-sm"><option value="">Todos los estados</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></CardHeader><CardContent>{loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : tickets.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No hay solicitudes para estos filtros.</p> : <div className="space-y-2">{tickets.map((ticket) => <button key={ticket.id} onClick={() => void openTicket(ticket.id)} className={`w-full rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-muted/40 ${selected?.id === ticket.id ? "border-primary bg-primary/5" : ""}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><p className="font-semibold">{ticket.subject}</p><div className="flex items-center gap-1.5 shrink-0"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityBadgeClass[ticket.priority] || "bg-muted text-muted-foreground"}`}>{priorityLabel[ticket.priority] || ticket.priority}</span><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass[ticket.status] || "bg-muted text-muted-foreground"}`}>{statusLabel[ticket.status] || ticket.status}</span></div></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p><p className="mt-3 text-xs text-muted-foreground">{ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : "Sin responsable"} · {ticket._count?.messages || 0} mensajes · {new Date(ticket.createdAt).toLocaleDateString("es-PE")}</p></button>)}</div>}<div className="mt-4 flex items-center justify-between gap-2"><Button type="button" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-sm">Página {page}</span><Button type="button" variant="outline" disabled={!hasNext} onClick={() => setPage(page + 1)}>Siguiente</Button></div></CardContent></Card>
    </div>
    {selected && <Card><CardHeader><CardTitle>{selected.subject}</CardTitle><div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass[selected.status] || "bg-muted"}`}>{statusLabel[selected.status] || selected.status}</span><span>·</span><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityBadgeClass[selected.priority] || "bg-muted"}`}>Prioridad: {priorityLabel[selected.priority] || selected.priority}</span></div>{isStaff && <div className="flex flex-wrap gap-2"><select aria-label="Cambiar estado" value={selected.status} onChange={(event) => void updateTicket({ status: event.target.value })} className="rounded-md border bg-background p-2 text-sm">{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button type="button" variant="outline" onClick={() => user && void updateTicket({ assigneeId: user.id })}>Asignarme</Button></div>}</CardHeader><CardContent><div className="max-h-96 space-y-3 overflow-y-auto rounded-xl bg-muted/30 p-4">{selected.messages.map((message) => <div key={message.id} className="rounded-lg border bg-card p-3"><div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span className="font-medium">{message.author.firstName} {message.author.lastName}{message.internalNote && <><ShieldAlert className="ml-1 inline h-3 w-3" /> Nota interna</>}</span><span>{new Date(message.createdAt).toLocaleString("es-PE")}</span></div><p className="whitespace-pre-wrap text-sm">{message.body}</p></div>)}</div><form onSubmit={sendReply} className="mt-4 space-y-2">{isStaff && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={internalNote} onChange={(event) => setInternalNote(event.target.checked)} /> Nota interna, visible solo para el equipo</label>}<div className="flex gap-2"><textarea aria-label="Respuesta" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe una respuesta" rows={2} required className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" /><Button type="submit" size="icon" disabled={sendingReply} aria-label="Enviar respuesta">{sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div></form></CardContent></Card>}
  </div>;
}
