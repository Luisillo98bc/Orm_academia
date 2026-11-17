"use client";

import { useState, useEffect, useRef, useEffectEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
import { Input } from "@/components/ui/input";
import { EditContentModal, type EditableContent } from "@/components/teacher/edit-content-modal";
import { cn } from "@/lib/utils";
import {
  Loader2,
  MessageSquare,
  Send,
  ArrowLeft,
  Plus,
  Calendar,
  Trash2,
  CornerDownRight,
  X,
  Reply,
  Clock,
  ChevronRight,
  Pencil,
} from "lucide-react";

interface ForumMessage {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
  replies?: ForumMessage[];
}

interface Forum {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  author?: { id: string; firstName: string; lastName: string };
  _count: { messages: number };
}

export default function ClassForumPage() {
  const params = useParams();
  const router = useRouter();
  const cohortId = params.id as string;
  const { user } = useAuth();
  const confirmAction = useConfirm();

  const [forums, setForums] = useState<Forum[]>([]);
  const [selectedForum, setSelectedForum] = useState<Forum | null>(null);
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Creation States
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Message Sending States
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ForumMessage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingForum, setEditingForum] = useState<EditableContent | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const role = user?.roles?.[0];
  const isTeacherOrAdmin = role === "DOCENTE" || role === "ADMIN";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadForums = async () => {
    setLoading(true);
    try {
      const data = await fetchApi(`/communication/cohorts/${cohortId}/forums`);
      setForums(data || []);
      
      // Auto-select first forum if available
      if (data && data.length > 0) {
        setSelectedForum(data[0]);
      } else {
        setSelectedForum(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

    const loadForumsEffect = useEffectEvent(loadForums);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadForumsEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cohortId]);

  const loadMessages = async (forumId: string) => {
    setLoadingMessages(true);
    try {
      const data = await fetchApi(`/communication/forums/${forumId}/messages`);
      setMessages(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (selectedForum) {
      loadMessages(selectedForum.id);
      } else {
      setMessages([]);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedForum]);

  const handleCreateForum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;

    setCreating(true);
    try {
      const created = await fetchApi(`/communication/cohorts/${cohortId}/forums`, {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
        }),
      });
      setNewTitle("");
      setNewDescription("");
      setShowCreate(false);
      
      // Reload forums list and select the new one
      const updatedList = await fetchApi(`/communication/cohorts/${cohortId}/forums`);
      setForums(updatedList || []);
      const matched = updatedList?.find((forum: Forum) => forum.id === created.id) || created;
      setSelectedForum(matched);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleEditForum = (forum: Forum, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingForum({ kind: "forum", id: forum.id, title: forum.title, description: forum.description });
  };

  const handleDeleteForum = async (forum: Forum, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!(await confirmAction({ title: "Eliminar foro", description: `Se eliminará “${forum.title}” junto con sus mensajes. Esta acción no se puede deshacer.`, confirmLabel: "Eliminar foro" }))) return;

    try {
      await fetchApi(`/communication/forums/${forum.id}`, { method: "DELETE" });
      await loadForums();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar el foro");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedForum || sending) return;

    setSending(true);
    try {
      await fetchApi(`/communication/forums/${selectedForum.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: newMessage,
          parentId: replyingTo?.id || undefined,
        }),
      });
      setNewMessage("");
      setReplyingTo(null);
      await loadMessages(selectedForum.id);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!(await confirmAction({ title: "Eliminar mensaje", description: "El mensaje se eliminará del foro y no podrá recuperarse.", confirmLabel: "Eliminar mensaje" }))) return;
    setDeletingId(messageId);
    try {
      await fetchApi(`/communication/forums/messages/${messageId}`, {
        method: "DELETE",
      });
      if (selectedForum) {
        await loadMessages(selectedForum.id);
      }
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar el mensaje");
    } finally {
      setDeletingId(null);
    }
  };

  const handleReplyClick = (msg: ForumMessage) => {
    setReplyingTo(msg);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return "ahora";
    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHrs < 24) return `hace ${diffHrs}h`;
    if (diffDays < 7) return `hace ${diffDays}d`;
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-pink-500",
      "bg-orange-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const renderMessage = (msg: ForumMessage, isReply: boolean = false) => {
    const isMe = msg.author.id === user?.id;
    const fullName = `${msg.author.firstName} ${msg.author.lastName}`;

    return (
      <div key={msg.id} className={`flex gap-3 group relative ${isReply ? "ml-10 mt-2" : "mt-5"}`}>
        {isReply && (
          <div className="absolute -left-7 top-4 w-5 h-5 border-l-2 border-b-2 border-border/50 rounded-bl-lg"></div>
        )}
        
        <div className="w-8 shrink-0">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${getAvatarColor(fullName)}`}
            title={fullName}
          >
            {getInitials(msg.author.firstName, msg.author.lastName)}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={cn("text-xs font-semibold", isMe ? "text-primary" : "text-foreground")}>
              {isMe ? "Tú" : fullName}
            </span>
            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2 w-2" />
              {formatTime(msg.createdAt)}
            </span>
            
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 ml-2">
              {!isReply && (
                <button
                  onClick={() => handleReplyClick(msg)}
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5 text-[10px] font-medium"
                >
                  <Reply className="h-2.5 w-2.5" /> Responder
                </button>
              )}
              {isMe && (
                <button
                  onClick={() => handleDeleteMessage(msg.id)}
                  disabled={deletingId === msg.id}
                  className="text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5 text-[10px] font-medium ml-1.5"
                >
                  {deletingId === msg.id ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-2.5 w-2.5" /> Eliminar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          
          <div
            className={cn(
              "inline-block max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
              isMe
                ? "bg-primary text-primary-foreground rounded-tl-sm"
                : "bg-muted text-foreground rounded-tl-sm border border-border/55"
            )}
          >
            {msg.content}
          </div>

          {msg.replies && msg.replies.length > 0 && (
            <div className="mt-1 relative">
              {msg.replies.map((reply) => renderMessage(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="border-b border-border/50 pb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Foros del Curso
            </h2>
            <p className="text-muted-foreground text-sm">Discusiones y tareas propuestas en clase</p>
          </div>
        </div>
      </div>

      {/* Split Pane Layout */}
      <div className="flex-1 grid md:grid-cols-[280px_1fr] gap-6 min-h-0">
        
        {/* Left Side: Forums List */}
        <div className="flex flex-col gap-4 bg-card rounded-xl border border-border/50 glass p-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Temas de Discusión</h3>
            {isTeacherOrAdmin && (
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 rounded-lg"
                onClick={() => setShowCreate(!showCreate)}
                title="Nuevo Foro / Tarea"
              >
                {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>

          {showCreate && (
            <form onSubmit={handleCreateForum} className="space-y-3 bg-muted/30 p-3 rounded-lg border border-border/50">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Título del Foro</label>
                <Input
                  required
                  placeholder="Ej: Debate Semana 4"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Instrucciones / Tarea</label>
                <textarea
                  required
                  placeholder="Escribe las instrucciones aquí..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <Button type="submit" size="sm" className="w-full text-xs h-8" disabled={creating}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                Crear Foro
              </Button>
            </form>
          )}

          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {forums.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">No hay foros creados.</p>
            ) : (
              forums.map((f) => (
                <div
                  key={f.id}
                  className={cn(
                    "w-full p-3 rounded-xl border transition-all text-xs flex items-center justify-between group",
                    selectedForum?.id === f.id
                      ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                      : "hover:bg-muted/50 border-transparent text-foreground"
                  )}
                >
                  <button type="button" onClick={() => setSelectedForum(f)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">{f.title}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5 shrink-0" />
                      {new Date(f.createdAt).toLocaleDateString("es-ES")}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    {isTeacherOrAdmin && (
                      <>
                        <button type="button" onClick={(event) => handleEditForum(f, event)} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label={`Editar ${f.title}`} title="Editar foro">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={(event) => handleDeleteForum(f, event)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Eliminar ${f.title}`} title="Eliminar foro">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Active Discussion */}
        <div className="flex flex-col bg-card rounded-xl border border-border/50 glass overflow-hidden min-h-0">
          
          {selectedForum ? (
            <>
              {/* Forum Banner Header */}
              <div className="p-4 bg-primary/5 border-b border-border/50 text-xs text-foreground shrink-0 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px] shrink-0">
                    {selectedForum.author ? `${selectedForum.author.firstName.charAt(0)}${selectedForum.author.lastName.charAt(0)}`.toUpperCase() : "D"}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-primary leading-tight">{selectedForum.title}</h3>
                    <p className="text-[9px] text-muted-foreground">
                      Publicado por: {selectedForum.author ? `${selectedForum.author.firstName} ${selectedForum.author.lastName}` : "Docente"} • {new Date(selectedForum.createdAt).toLocaleString("es-ES")}
                    </p>
                  </div>
                </div>
                {selectedForum.description && (
                  <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground bg-background/50 p-2.5 rounded-lg border border-border/20 text-xs">
                    {selectedForum.description}
                  </p>
                )}
              </div>

              {/* Comments Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {loadingMessages ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-70 py-12">
                    <MessageSquare className="h-10 w-10 mb-2" />
                    <p className="text-xs">No hay comentarios en este foro. ¡Sé el primero en responder!</p>
                  </div>
                ) : (
                  messages.map((msg) => renderMessage(msg, false))
                )}
                <div ref={messagesEndRef} className="h-2" />
              </div>

              {/* Message Input Form */}
              <div className="p-3 bg-muted/10 border-t border-border/50 shrink-0">
                {replyingTo && (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-t-lg px-3 py-1.5 -mt-3 mb-2 text-[10px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <CornerDownRight className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">Respondiendo a <span className="font-semibold text-foreground">{replyingTo.author.firstName}</span>:</span>
                      <span className="text-muted-foreground italic truncate max-w-[200px]">{`“${replyingTo.content}”`}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe una respuesta a la tarea..."
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none min-h-[36px] max-h-[80px]"
                    style={{ height: "auto" }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${Math.min(target.scrollHeight, 80)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                  <Button type="submit" size="icon" className="h-9 w-9 rounded-lg shrink-0" disabled={!newMessage.trim() || sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <MessageSquare className="h-12 w-12 mb-2" />
              <p className="text-sm">Selecciona o crea un foro de discusión para ver su contenido.</p>
            </div>
          )}
          
        </div>
      </div>

      <EditContentModal
        key={editingForum ? `${editingForum.kind}-${editingForum.id}` : "edit-forum-closed"}
        content={editingForum}
        onClose={() => setEditingForum(null)}
        onSuccess={async () => {
          await loadForums();
        }}
      />
    </div>
  );
}
