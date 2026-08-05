"use client";

import { useEffect, useState, useRef, useEffectEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  Loader2,
  ArrowLeft,
  Send,
  MessageSquare,
  Clock,
  Trash2,
  CornerDownRight,
  X,
  Reply,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ForumMessage {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
  replies?: ForumMessage[];
}

interface ForumDetail {
  id: string;
  title: string;
  description?: string;
  cohortId: string;
  createdAt: string;
  author?: { id: string; firstName: string; lastName: string };
  cohort?: { name: string; course: { name: string } };
}

export default function ForumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const forumId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [forumDetail, setForumDetail] = useState<ForumDetail | null>(null);
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ForumMessage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadForumData = async () => {
    setLoading(true);
    try {
      const [detailData, messagesData] = await Promise.all([
        fetchApi(`/communication/forums/${forumId}/detail`),
        fetchApi(`/communication/forums/${forumId}/messages`),
      ]);
      setForumDetail(detailData);
      setMessages(messagesData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

    const loadForumDataEffect = useEffectEvent(loadForumData);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadForumDataEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [forumId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      await fetchApi(`/communication/forums/${forumId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: newMessage,
          parentId: replyingTo?.id || undefined,
        }),
      });
      setNewMessage("");
      setReplyingTo(null);
      await loadForumData();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este mensaje?")) return;
    setDeletingId(messageId);
    try {
      await fetchApi(`/communication/forums/messages/${messageId}`, {
        method: "DELETE",
      });
      await loadForumData();
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el mensaje");
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
      "bg-blue-500",
      "bg-purple-500",
      "bg-green-500",
      "bg-pink-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-indigo-500",
      "bg-rose-500",
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
      <div key={msg.id} className={`flex gap-3 group relative ${isReply ? "ml-12 mt-2" : "mt-6"}`}>
        {isReply && (
          <div className="absolute -left-8 top-4 w-6 h-6 border-l-2 border-b-2 border-border/50 rounded-bl-xl"></div>
        )}
        
        {/* Avatar */}
        <div className="w-9 shrink-0">
          <div
            className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${getAvatarColor(fullName)}`}
            title={fullName}
          >
            {getInitials(msg.author.firstName, msg.author.lastName)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-sm font-semibold ${isMe ? "text-primary" : "text-foreground"}`}>
              {isMe ? "Tú" : fullName}
            </span>
            <span
              className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-help"
              title={new Date(msg.createdAt).toLocaleString("es-ES")}
            >
              <Clock className="h-2.5 w-2.5" />
              {formatTime(msg.createdAt)}
            </span>
            
            {/* Hover actions */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2">
              {!isReply && (
                <button
                  onClick={() => handleReplyClick(msg)}
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-[11px] font-medium"
                >
                  <Reply className="h-3 w-3" /> Responder
                </button>
              )}
              {isMe && (
                <button
                  onClick={() => handleDelete(msg.id)}
                  disabled={deletingId === msg.id}
                  className="text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 text-[11px] font-medium ml-2"
                >
                  {deletingId === msg.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3" /> Eliminar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          
          <div
            className={`inline-block max-w-[90%] md:max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              isMe
                ? "bg-primary text-primary-foreground rounded-tl-sm"
                : "bg-muted/70 text-foreground rounded-tl-sm border border-border/50"
            }`}
          >
            {msg.content}
          </div>

          {/* Replies */}
          {msg.replies && msg.replies.length > 0 && (
            <div className="mt-2 relative">
              {msg.replies.map((reply) => renderMessage(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Cargando foro...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] relative">
      {/* Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-border/50 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/forums")}
          className="shrink-0 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-primary/10 shadow-sm">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight truncate text-foreground">
              {forumDetail?.title || "Foro de Discusión"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {messages.length + messages.reduce((acc, msg) => acc + (msg.replies?.length || 0), 0)} mensaje(s) en total
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 custom-scrollbar px-2">
        {/* Forum Main Topic Box / Task Instructions */}
        {forumDetail && (
          <div className="bg-card border border-primary/20 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                {forumDetail.author ? `${forumDetail.author.firstName.charAt(0)}${forumDetail.author.lastName.charAt(0)}`.toUpperCase() : "D"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {forumDetail.author ? `${forumDetail.author.firstName} ${forumDetail.author.lastName}` : "Docente"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Tema de discusión en: {forumDetail.cohort?.name || "Clase"}</span>
                  <span>•</span>
                  <span>{new Date(forumDetail.createdAt).toLocaleDateString("es-ES")}</span>
                </p>
              </div>
            </div>
            <div className="space-y-2 border-t border-border/50 pt-4 mt-2">
              <h3 className="font-bold text-lg text-primary">{forumDetail.title}</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {forumDetail.description || "Sin descripción proporcionada."}
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-border/50 pt-6 mt-6">
          <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">
            Respuestas y Comentarios
          </h4>
          
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-card/30 rounded-xl border border-dashed border-border p-6">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-semibold mb-1">
                No hay comentarios aún
              </h3>
              <p className="text-xs text-muted-foreground">
                Sé el primero en participar en la discusión de esta tarea.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => renderMessage(msg, false))}
            </div>
          )}
        </div>
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="shrink-0 pt-4 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        {replyingTo && (
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-t-xl px-4 py-2 -mb-2 pb-4">
            <div className="flex items-center gap-2 text-sm">
              <CornerDownRight className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Respondiendo a <span className="font-semibold text-foreground">{replyingTo.author.firstName}</span>:</span>
              <span className="text-muted-foreground truncate max-w-[200px] italic">{`“${replyingTo.content}”`}</span>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="relative z-20 bg-background rounded-xl">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                rows={1}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[48px] max-h-[120px] shadow-sm transition-all"
                style={{ height: "auto", overflow: "hidden" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              className="h-12 w-12 rounded-xl shadow-md shrink-0 transition-transform active:scale-95"
              disabled={sending || !newMessage.trim()}
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
