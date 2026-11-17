"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { API_URL, fetchApi, getTabAccessToken } from "@/lib/api";
import { getMediaUrl } from "@/lib/media";
import { useAuth } from "@/components/auth-provider";
import { io, Socket } from "socket.io-client";
import Image from "next/image";
import {
  MessageCircle, Send, Loader2, Search, Users, CheckCheck, Check, Wifi, WifiOff, ArrowLeft
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  DOCENTE: "Docente",
  ESTUDIANTE: "Estudiante",
  RRHH: "Admisión / RRHH",
};

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  roles: string[];
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

const API_BASE = API_URL.replace("/api/v1", "");

export default function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const selectedContactRef = useRef<string | null>(null);
  const skipScrollRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // ── SOCKET.IO CONNECTION ──
  useEffect(() => {
    if (!user?.id) return;

    const socket = io(`${API_BASE}/chat`, {
      withCredentials: true,
      auth: (cb) => {
        cb({ token: getTabAccessToken() });
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
    });
    let reconnectTimer: number | undefined;
    let disposed = false;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      if (reason === "io server disconnect") {
        reconnectTimer = window.setTimeout(() => {
          void fetchApi("/users/me").then(() => { if (!disposed) socket.connect(); }).catch(() => {});
        }, 1000);
      }
    });

    // Recibir mensajes nuevos en tiempo real
    socket.on("newMessage", (message: Message) => {
      if (message.receiverId === user.id && message.senderId !== selectedContactRef.current) setUnread(current => ({ ...current, [message.senderId]: (current[message.senderId] || 0) + 1 }));
      if (message.senderId !== selectedContactRef.current && message.receiverId !== selectedContactRef.current) return;
      setMessages((prev) => {
        // Evitar duplicados
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (message.senderId === selectedContactRef.current && socket.connected) {
        socket.emit("markRead", { otherUserId: message.senderId });
      }
    });

    // Cuando el otro usuario leyó los mensajes
    socket.on("messagesRead", ({ readBy }: { readBy: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === user.id && m.receiverId === readBy
            ? { ...m, isRead: true }
            : m
        )
      );
    });

    socketRef.current = socket;

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  // Load contacts
  useEffect(() => {
    void fetchApi("/communication/direct-messages/unread-by-contact").then(setUnread).catch(() => undefined);
    fetchApi("/communication/direct-messages/contacts")
      .then(setContacts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load conversation with selected contact (initial load via REST)
  const loadConversation = useCallback(async (contactId: string) => {
    try {
      const data = await fetchApi(`/communication/direct-messages/${contactId}`);
      if (selectedContactRef.current !== contactId) return;
      setMessages(data);
      setUnread(current => ({ ...current, [contactId]: 0 }));
      setMessageSearch("");
      setHasOlderMessages(data.length === 50);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const synchronize = () => {
      const contactId = selectedContactRef.current;
      if (!contactId) return;
      void fetchApi(`/communication/direct-messages/${contactId}`).then((data: Message[]) => {
        if (selectedContactRef.current !== contactId) return;
        setMessages((current) => {
          const byId = new Map(current.map((message) => [message.id, message]));
          for (const message of data) {
            const existing = byId.get(message.id);
            byId.set(message.id, { ...message, isRead: message.isRead || !!existing?.isRead });
          }
          return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
        socket.emit("markRead", { otherUserId: contactId });
      }).catch(console.error);
    };
    socket.on("connect", synchronize);
    return () => { socket.off("connect", synchronize); };
  }, [user?.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (selectedContact) {
      loadConversation(selectedContact.id);
      
      // Notificar al socket que estamos leyendo los mensajes de este contacto
      if (socketRef.current?.connected) {
      socketRef.current.emit("markRead", { otherUserId: selectedContact.id });
      }
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedContact, loadConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (skipScrollRef.current) { skipScrollRef.current = false; return; }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadOlderMessages = async () => {
    if (!selectedContact || !messages.length || loadingOlder) return;
    const contactId = selectedContact.id;
    setLoadingOlder(true);
    try {
      const older: Message[] = await fetchApi(`/communication/direct-messages/${contactId}?before=${encodeURIComponent(messages[0].id)}`);
      if (selectedContactRef.current !== contactId) return;
      skipScrollRef.current = true;
      setMessages((current) => [...older, ...current.filter((message) => !older.some((item) => item.id === message.id))]);
      setHasOlderMessages(older.length === 50);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar los mensajes anteriores.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedContact) return;
    setSendingMsg(true);
    try {
      // Enviar vía WebSocket si está conectado
      if (socketRef.current?.connected) {
        await socketRef.current.timeout(10000).emitWithAck("sendMessage", {
          receiverId: selectedContact.id,
          content: newMessage.trim(),
        });
      } else {
        // Fallback: enviar por REST API
        const sent = await fetchApi("/communication/direct-messages", {
          method: "POST",
          body: JSON.stringify({
            receiverId: selectedContact.id,
            content: newMessage.trim(),
          }),
        });
        setMessages((prev) => [...prev, sent]);
      }
      setNewMessage("");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo confirmar el envío. Comprueba la conexión antes de reintentar.");
    } finally {
      setSendingMsg(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    const full = `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase();
    return full.includes(searchTerm.toLowerCase()) && (!roleFilter || c.roles.includes(roleFilter)) && (!unreadOnly || unread[c.id] > 0);
  }).sort((a, b) => (unread[b.id] || 0) - (unread[a.id] || 0));
  const visibleMessages = messages.filter(message => message.content.toLowerCase().includes(messageSearch.toLowerCase()));

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hoy";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Comunicación" title="Mensajes directos" description="Mantén conversaciones con estudiantes, docentes y el equipo de la academia." actions={<div className="flex items-center gap-1.5 text-xs font-medium">
          {isConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600">En vivo</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-amber-600">Reconectando...</span>
            </>
          )}
        </div>} />

      <div className="flex min-h-[420px] rounded-xl border border-border/50 bg-card overflow-hidden" style={{ height: "min(760px, calc(100dvh - 220px))" }}>
        {/* Contacts Sidebar */}
        <div className={`${selectedContact ? "hidden md:flex" : "flex w-full"} md:w-80 border-r border-border/50 flex-col shrink-0`}>
          <div className="p-3 border-b border-border/30">
            <div className="mb-3 flex flex-wrap items-center gap-2"><select aria-label="Filtrar contactos por rol" value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-xs"><option value="">Todos los roles</option>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} />Sin leer</label></div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                aria-label="Buscar contacto"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar contacto..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No hay contactos disponibles
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => { if (selectedContactRef.current !== contact.id) { selectedContactRef.current = contact.id; setMessages([]); setHasOlderMessages(false); setSelectedContact(contact); } }}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors border-b border-border/20 ${
                    selectedContact?.id === contact.id
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary overflow-hidden">
                    {getMediaUrl(contact.profilePicture) ? (
                      <Image
                        unoptimized
                        fill
                        sizes="40px"
                        src={getMediaUrl(contact.profilePicture)!}
                        alt={`${contact.firstName} ${contact.lastName}`}
                        className="object-cover"
                      />
                    ) : (
                      getInitials(contact.firstName, contact.lastName)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                  {unread[contact.id] > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground" aria-label={`${unread[contact.id]} mensajes sin leer`}>{unread[contact.id]}</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                    {ROLE_LABELS[contact.roles[0]] || contact.roles[0]}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${selectedContact ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Selecciona un contacto</p>
                <p className="text-sm">para comenzar una conversación</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 p-4 border-b border-border/30">
                <button
                  type="button"
                  onClick={() => {
                    selectedContactRef.current = null;
                    setSelectedContact(null);
                  }}
                  aria-label="Volver a contactos"
                  className="md:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary overflow-hidden shrink-0">
                  {getMediaUrl(selectedContact.profilePicture) ? (
                    <Image
                      unoptimized
                      fill
                      sizes="40px"
                      src={getMediaUrl(selectedContact.profilePicture)!}
                      alt={`${selectedContact.firstName} ${selectedContact.lastName}`}
                      className="object-cover"
                    />
                  ) : (
                    getInitials(selectedContact.firstName, selectedContact.lastName)
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {selectedContact.firstName} {selectedContact.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[selectedContact.roles[0]] || selectedContact.roles[0]}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="border-b border-border px-4 py-2"><input aria-label="Buscar en mensajes cargados" value={messageSearch} onChange={event => setMessageSearch(event.target.value)} placeholder="Buscar en los mensajes cargados…" className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm" />{messageSearch && <p role="status" className="mt-1 text-xs text-muted-foreground">{visibleMessages.length} coincidencias. Carga mensajes anteriores para ampliar la búsqueda.</p>}</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {hasOlderMessages && <button type="button" disabled={loadingOlder} onClick={() => void loadOlderMessages()} className="block mx-auto text-sm font-medium text-primary disabled:opacity-50">{loadingOlder ? "Cargando mensajes..." : "Ver mensajes anteriores"}</button>}
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No hay mensajes aún. ¡Envía el primero!
                  </p>
                ) : (
                  <>
                    {visibleMessages.map((msg, i) => {
                      const isMine = msg.senderId === user?.id;
                      const showDate =
                        i === 0 ||
                        formatDate(msg.createdAt) !== formatDate(visibleMessages[i - 1].createdAt);

                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="text-center my-3">
                              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                                {formatDate(msg.createdAt)}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-sm ${
                                isMine
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-muted rounded-bl-md"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
                                <span className={`text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                  {formatTime(msg.createdAt)}
                                </span>
                                {isMine && (
                                  msg.isRead
                                    ? <CheckCheck className="h-3 w-3 text-primary-foreground/60" />
                                    : <Check className="h-3 w-3 text-primary-foreground/40" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="p-3 border-t border-border/30">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    aria-label="Mensaje"
                    maxLength={5000}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-4 py-2.5 rounded-lg bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="submit"
                    aria-label="Enviar mensaje"
                    disabled={!newMessage.trim() || sendingMsg}
                    className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {sendingMsg ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
