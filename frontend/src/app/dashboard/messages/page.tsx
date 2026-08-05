"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { io, Socket } from "socket.io-client";
import {
  MessageCircle, Send, Loader2, Search, Users, CheckCheck, Check, Wifi, WifiOff
} from "lucide-react";

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:4000";

export default function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // ── SOCKET.IO CONNECTION ──
  useEffect(() => {
    if (!user?.id) return;

    const socket = io(`${API_BASE}/chat`, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Recibir mensajes nuevos en tiempo real
    socket.on("newMessage", (message: Message) => {
      setMessages((prev) => {
        // Evitar duplicados
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
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
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  // Load contacts
  useEffect(() => {
    fetchApi("/communication/direct-messages/contacts")
      .then(setContacts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load conversation with selected contact (initial load via REST)
  const loadConversation = useCallback(async (contactId: string) => {
    try {
      const data = await fetchApi(`/communication/direct-messages/${contactId}`);
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedContact) return;
    setSendingMsg(true);
    try {
      // Enviar vía WebSocket si está conectado
      if (socketRef.current?.connected) {
        socketRef.current.emit("sendMessage", {
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
    } finally {
      setSendingMsg(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    const full = `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase();
    return full.includes(searchTerm.toLowerCase());
  });

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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          Mensajes Directos
        </h2>
        <div className="flex items-center gap-1.5 text-xs font-medium">
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
        </div>
      </div>

      <div className="flex rounded-xl border border-border/50 bg-card overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
        {/* Contacts Sidebar */}
        <div className="w-80 border-r border-border/50 flex flex-col shrink-0">
          <div className="p-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
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
                  onClick={() => setSelectedContact(contact)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors border-b border-border/20 ${
                    selectedContact?.id === contact.id
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                    {getInitials(contact.firstName, contact.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                    {contact.roles[0]}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
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
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {getInitials(selectedContact.firstName, selectedContact.lastName)}
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {selectedContact.firstName} {selectedContact.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedContact.roles[0]}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No hay mensajes aún. ¡Envía el primero!
                  </p>
                ) : (
                  <>
                    {messages.map((msg, i) => {
                      const isMine = msg.senderId === user?.id;
                      const showDate =
                        i === 0 ||
                        formatDate(msg.createdAt) !== formatDate(messages[i - 1].createdAt);

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
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-4 py-2.5 rounded-lg bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="submit"
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
