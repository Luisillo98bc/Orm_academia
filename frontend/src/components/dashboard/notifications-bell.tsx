"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
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

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    try {
      const data = await fetchApi("/communication/notifications");
      setNotifications(data || []);
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
    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';
    const socket = io(`${socketUrl}/notifications`, {
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('Connected to notifications websocket');
    });

    socket.on('newNotification', (newNotif: Notification) => {
      setNotifications(prev => [newNotif, ...prev]);
      // Show toast notification
      toast.info(newNotif.title, {
        description: newNotif.message,
        action: newNotif.actionUrl ? {
          label: "Ver",
          onClick: () => window.location.href = newNotif.actionUrl as string
        } : undefined
      });
    });

    return () => {
      window.clearTimeout(timeoutId);
      socket.disconnect();
    };
  }, [user]);

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
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative" 
        onClick={() => setOpen(!open)}
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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-background rounded-md border shadow-md z-50 overflow-hidden glass">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h3 className="font-semibold">Notificaciones</h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={markAllAsRead}>
                  <Check className="h-3 w-3 mr-1" /> Marcar leídas
                </Button>
              )}
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
          </div>
        </>
      )}
    </div>
  );
}
