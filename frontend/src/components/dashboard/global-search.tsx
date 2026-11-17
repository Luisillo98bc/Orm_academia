"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { fetchApi } from "@/lib/api";
import { Search, BookOpen, Users, Calendar, X, Loader2, ContactRound, CreditCard, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

interface SearchResults {
  courses: Array<{ id: string; code: string; name: string; level: string }>;
  users: Array<{ id: string; email: string; firstName: string; lastName: string; roles: string[] }>;
  cohorts: Array<{ id: string; name: string; isActive: boolean; course: { name: string } }>;
  prospects: Array<{ id: string; name: string; email?: string; status: string }>;
  payments: Array<{ id: string; amount: string | number; status: string; enrollment: { user: { firstName: string; lastName: string }; cohort: { name: string } } }>;
  supportTickets: Array<{ id: string; subject: string; status: string; priority: string }>;
}

export function GlobalSearch() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const primaryRole = currentUser?.roles?.[0] || "ESTUDIANTE";

  const courseUrlForRole = useCallback(
    (courseId: string) => {
      if (primaryRole === "ADMIN") return `/dashboard/courses`;
      if (primaryRole === "DOCENTE") return `/dashboard/classes`;
      return `/programas/${courseId}`;
    },
    [primaryRole],
  );

  const cohortUrlForRole = useCallback(
    (cohortId: string) => {
      if (primaryRole === "ESTUDIANTE") return `/dashboard/my-courses/${cohortId}`;
      if (primaryRole === "DOCENTE") return `/dashboard/classes/${cohortId}`;
      return `/dashboard/classes/${cohortId}`;
    },
    [primaryRole],
  );

  const flatUrls = useMemo(() => {
    if (!results) return [];
    return [
      ...results.courses.map((c) => courseUrlForRole(c.id)),
      ...results.users.map(() => `/dashboard/users`),
      ...results.cohorts.map((c) => cohortUrlForRole(c.id)),
      ...results.prospects.map((p) => `/dashboard/prospects?search=${encodeURIComponent(p.name)}`),
      ...results.payments.map((p) => `/dashboard/payments?search=${p.id}`),
      ...results.supportTickets.map((t) => `/dashboard/support?ticket=${t.id}`),
    ];
  }, [results, courseUrlForRole, cohortUrlForRole]);

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        setResults(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchApi(`/search?q=${encodeURIComponent(searchQuery)}`);
      setResults(data);
    } catch (err) {
      console.error("Search error", err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => doSearch(value), 300);
  };

  const navigate = (url: string) => {
    router.push(url);
    setIsOpen(false);
    setQuery("");
    setResults(null);
    setActiveIndex(-1);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatUrls.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatUrls.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? flatUrls.length - 1 : prev - 1));
    } else if (e.key === "Enter" && activeIndex >= 0 && flatUrls[activeIndex]) {
      e.preventDefault();
      navigate(flatUrls[activeIndex]);
    }
  };

  const totalResults = results
    ? results.courses.length + results.users.length + results.cohorts.length + results.prospects.length + results.payments.length + results.supportTickets.length
    : 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger button */}
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/50 text-muted-foreground text-sm",
          "hover:bg-muted hover:border-border transition-colors cursor-pointer",
          "hidden sm:flex"
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Buscar...</span>
        <kbd className="ml-4 text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border border-border/50">
          Ctrl+K
        </kbd>
      </button>

      {/* Mobile search icon */}
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="sm:hidden p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Buscar"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Search dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 z-50 w-auto sm:w-[420px] bg-background rounded-xl border border-border/50 shadow-2xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar cursos, usuarios, cohortes..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setResults(null); }}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}

              {!loading && query.length >= 2 && totalResults === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No se encontraron resultados para &quot;{query}&quot;
                </div>
              )}

              {!loading && results && totalResults > 0 && (
                <div className="py-2">
                  {/* Courses */}
                  {results.courses.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Cursos
                      </div>
                      {results.courses.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => navigate(courseUrlForRole(course.id))}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{course.name}</p>
                            <p className="text-xs text-muted-foreground">{course.code} · {course.level}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Users */}
                  {results.users.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Usuarios
                      </div>
                      {results.users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => navigate(`/dashboard/users`)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
                            <p className="text-xs text-muted-foreground">{user.email} · {user.roles.join(", ")}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Cohorts */}
                  {results.cohorts.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Cohortes
                      </div>
                      {results.cohorts.map((cohort) => (
                        <button
                          key={cohort.id}
                          onClick={() => navigate(cohortUrlForRole(cohort.id))}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                            <Calendar className="h-4 w-4 text-green-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{cohort.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {cohort.course?.name} · {cohort.isActive ? "Activa" : "Inactiva"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.prospects.length > 0 && <div><div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prospectos</div>{results.prospects.map((prospect) => <button key={prospect.id} onClick={() => navigate(`/dashboard/prospects?search=${encodeURIComponent(prospect.name)}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"><div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0"><ContactRound className="h-4 w-4 text-orange-500" /></div><div className="min-w-0"><p className="text-sm font-medium truncate">{prospect.name}</p><p className="text-xs text-muted-foreground">{prospect.email || "Sin correo"} · {prospect.status}</p></div></button>)}</div>}

                  {results.payments.length > 0 && <div><div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pagos</div>{results.payments.map((payment) => <button key={payment.id} onClick={() => navigate(`/dashboard/payments?search=${payment.id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"><div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><CreditCard className="h-4 w-4 text-emerald-500" /></div><div className="min-w-0"><p className="text-sm font-medium truncate">{payment.enrollment.user.firstName} {payment.enrollment.user.lastName}</p><p className="text-xs text-muted-foreground">S/ {payment.amount} · {payment.status}</p></div></button>)}</div>}

                  {results.supportTickets.length > 0 && <div><div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Soporte</div>{results.supportTickets.map((ticket) => <button key={ticket.id} onClick={() => navigate(`/dashboard/support?ticket=${ticket.id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"><div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0"><LifeBuoy className="h-4 w-4 text-violet-500" /></div><div className="min-w-0"><p className="text-sm font-medium truncate">{ticket.subject}</p><p className="text-xs text-muted-foreground">{ticket.status} · {ticket.priority}</p></div></button>)}</div>}
                </div>
              )}

              {!loading && !results && query.length < 2 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Escribe al menos 2 caracteres para buscar
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
