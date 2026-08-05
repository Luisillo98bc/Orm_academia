"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchApi } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, CalendarDays, Video,
  ClipboardList, Loader2, ExternalLink
} from "lucide-react";

interface CalendarEvent {
  id: string;
  type: "class" | "evaluation";
  title: string;
  date: string;
  courseName: string;
  cohortName: string;
  meetLink?: string;
  weight?: number;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "class" | "evaluation">("all");

  useEffect(() => {
    fetchApi("/academic/calendar-events")
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6; // Sunday adjustment

    const days: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  }, [year, month]);

  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
        && (filter === "all" || e.type === filter);
    });
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Eventos del día seleccionado (hoy por defecto)
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendario Académico
          </h2>
          <p className="text-muted-foreground text-sm">Sesiones de clase y fechas de entrega</p>
        </div>
        <div className="flex gap-2">
          {(["all", "class", "evaluation"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f === "all" ? "Todos" : f === "class" ? "🎓 Clases" : "📝 Evaluaciones"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-semibold">
              {MONTH_NAMES[month]} {year}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                {d}
              </div>
            ))}
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dayEvents = getEventsForDay(day);
              const hasClass = dayEvents.some((e) => e.type === "class");
              const hasEval = dayEvents.some((e) => e.type === "evaluation");
              const selected = selectedDay === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative p-2 rounded-lg text-sm transition-all min-h-[52px] flex flex-col items-center ${
                    selected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : isToday(day)
                      ? "bg-primary/10 text-primary font-bold"
                      : "hover:bg-muted"
                  }`}
                >
                  <span>{day}</span>
                  {(hasClass || hasEval) && (
                    <div className="flex gap-0.5 mt-1">
                      {hasClass && (
                        <span className={`w-1.5 h-1.5 rounded-full ${selected ? "bg-white" : "bg-blue-500"}`} />
                      )}
                      {hasEval && (
                        <span className={`w-1.5 h-1.5 rounded-full ${selected ? "bg-white" : "bg-amber-500"}`} />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/30 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Clase</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Evaluación</span>
          </div>
        </div>

        {/* Day Detail Sidebar */}
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <h3 className="font-semibold mb-4">
            {selectedDay
              ? `${selectedDay} de ${MONTH_NAMES[month]}`
              : "Selecciona un día"}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay eventos para este día
            </p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    ev.type === "class"
                      ? "border-l-blue-500 bg-blue-500/5"
                      : "border-l-amber-500 bg-amber-500/5"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {ev.type === "class" ? (
                      <Video className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    ) : (
                      <ClipboardList className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">{ev.courseName}</p>
                      {ev.weight && (
                        <span className="text-xs text-amber-600">Peso: {ev.weight}%</span>
                      )}
                      {ev.meetLink && (
                        <a
                          href={ev.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Google Meet
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
