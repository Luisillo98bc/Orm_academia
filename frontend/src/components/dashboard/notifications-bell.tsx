"use client";

import { useState, useEffect, useEffectEvent, useRef, useId } from "react";
import { API_ORIGIN, fetchApi, getErrorMessage } from "@/lib/api";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { io } from "socket.io-client";
import { toast } from "sonner";

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString('es-ES');
}

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string | null;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

function resolveNotificationUrl(actionUrl: string | null, role?: string) {
  if (!actionUrl) return null;
  if (role !== "ESTUDIANTE" && actionUrl.startsWith("/dashboard/my-courses")) return "/dashboard";
  if (role !== "ESTUDIANTE" && actionUrl.startsWith("/dashboard/my-payments")) return "/dashboard/payments";
  return actionUrl;
}

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleOutside = (event: Event) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutside, true);
    document.addEventListener("focusin", handleOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutside, true);
      document.removeEventListener("focusin", handleOutside);
    };
  }, [open]);

  const fetchNotifications = async () => {
    try {
      const data = await fetchApi("/communication/notifications");
      setNotifications((data || []).map((item: Notification) => ({
        ...item,
        actionUrl: resolveNotificationUrl(item.actionUrl, user?.roles?.[0]),
      })));
    } catch (err: unknown) {
      if (getErrorMessage(err) !== "Unauthorized") {
        console.error("Failed to load notifications", err);
      }
    }
  };

  const fetchNotificationsEffect = useEffectEvent(fetchNotifications);

  useEffect(() => {
    if (!user) return;

    const timeoutId = window.setTimeout(() => void fetchNotificationsEffect(), 0);
    
    // Connect to WebSocket using the unified API base URL
    const socket = io(`${API_ORIGIN}/notifications`, {
      withCredentials: true,
    });
    let reconnectTimer: number | undefined;
    let disposed = false;

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        reconnectTimer = window.setTimeout(() => {
          void fetchApi('/users/me').then(() => { if (!disposed) socket.connect(); }).catch(() => {});
        }, 1000);
      }
    });

    socket.on('connect', () => {
      void fetchNotificationsEffect();
      window.dispatchEvent(new Event('academy:data-changed'));
    });

    socket.on('newNotification', (newNotif: Notification) => {
      window.dispatchEvent(new Event('academy:data-changed'));
      setNotifications(prev => [newNotif, ...prev.filter(item => item.id !== newNotif.id)].slice(0, 50));
      // Show toast notification
      const href = resolveNotificationUrl(newNotif.actionUrl, user?.roles?.[0]);
      toast.info(newNotif.title, {
        description: newNotif.message,
        action: href ? {
          label: "Ver",
          onClick: () => { router.push(href); }
        } : undefined
      });
    });

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(timeoutId);
      socket.disconnect();
    };
  }, [user, router]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      await fetchApi(`/communication/notifications/${id}/read`, { method: "PATCH" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch  {}
  };

  const markAllAsRead = async () => {
    try {
      await fetchApi("/communication/notifications/read-all", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch  {}
  };

  return (
    <div ref={containerRef} className="relative">
      <Button 
        ref={triggerRef}
        variant="ghost" 
        size="icon" 
        className="relative" 
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (!open) void fetchNotifications();
          setOpen(!open);
        }}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div id={panelId} role="region" tabIndex={-1} aria-label="Notificaciones recientes" className="fixed right-4 top-16 sm:absolute sm:right-0 sm:top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-background rounded-xl border shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h3 className="font-semibold">Notificaciones</h3>
              <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={markAllAsRead}>
                  <Check className="h-3 w-3 mr-1" /> Marcar leídas
                </Button>
              )}
              <Button variant="ghost" size="icon" aria-label="Cerrar notificaciones" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>
                <X className="h-4 w-4" />
              </Button>
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No tienes notificaciones
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "p-4 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/50 relative group",
                      !n.isRead && "bg-primary/5"
                    )}
                  >
                    {!n.isRead && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                    )}
                    <div className={cn("ml-2", !n.isRead ? "pl-2" : "")}>
                      <div className="flex justify-between items-start mb-1">
                        <p className={cn("text-sm font-medium", !n.isRead && "text-primary")}>{n.title}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      {n.message && <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>}
                      
                      <div className="flex gap-2 mt-2 items-center">
                        {n.actionUrl && (
                          <Link href={n.actionUrl} onClick={() => { setOpen(false); markAsRead(n.id); }} className="text-xs font-medium text-primary hover:underline">
                            Ver detalles
                          </Link>
                        )}
                        {!n.isRead && (
                          <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px] ml-auto opacity-0 group-hover:opacity-100" onClick={() => markAsRead(n.id)}>
                            Marcar leída
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-border/50 bg-muted/30 px-4 py-2.5 text-center">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver todas las notificaciones
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
