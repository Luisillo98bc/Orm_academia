"use client";

import type { Announcement } from "@/types/domain";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Bell, Info, AlertTriangle, CheckCircle } from "lucide-react";

export function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const loadAnnouncements = async () => {
    try {
      const data = await fetchApi("/communication/announcements");
      setAnnouncements(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAnnouncements();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (announcements.length === 0) return null;

  return (
    <section className="mb-8 space-y-4" aria-labelledby="announcements-title">
      <h3 id="announcements-title" className="text-xl font-bold flex items-center gap-2 text-foreground">
        <Bell className="h-5 w-5" /> Tablón de Anuncios
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        {announcements.map((announcement) => {
          let Icon = Info;
          let colorClass = "bg-blue-500/10 text-blue-500 border-blue-500/20";
          
          if (announcement.type === 'warning') {
            Icon = AlertTriangle;
            colorClass = "bg-amber-500/10 text-amber-500 border-amber-500/20";
          } else if (announcement.type === 'success') {
            Icon = CheckCircle;
            colorClass = "bg-green-500/10 text-green-500 border-green-500/20";
          }

          return (
            <div key={announcement.id} className={`dashboard-panel flex gap-4 p-5 ${colorClass}`}>
              <div className="mt-1">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">{announcement.title}</h4>
                <p className="text-sm text-foreground/80 mt-1">{announcement.content}</p>
                <div className="mt-2 text-xs opacity-70">
                  {new Date(announcement.createdAt).toLocaleDateString()} • Por {announcement.author?.firstName} {announcement.author?.lastName}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
