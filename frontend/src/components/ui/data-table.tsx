"use client";

import { isValidElement, useId, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Loader2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  filters?: DataTableFilter[];
  searchPlaceholder?: string;
  loading?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  serverPagination?: {
    page: number;
    pageSize: number;
    total: number;
    search: string;
    filters: Record<string, string>;
    onPageChange: (page: number) => void;
    onSearchChange: (value: string) => void;
    onFilterChange: (key: string, value: string) => void;
  };
}

function getProperty<T extends object>(item: T, key: string): unknown {
  return key in item ? (item as Record<string, unknown>)[key] : undefined;
}

function renderCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "";
  if (isValidElement(value)) return value;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return "";
}

export function DataTable<T extends object>({
  data,
  columns,
  filters = [],
  searchPlaceholder = "Buscar...",
  loading = false,
  pageSize = 10,
  emptyMessage = "No hay datos disponibles",
  emptyIcon,
  serverPagination,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const filterId = useId();
  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const isServerPaginated = Boolean(serverPagination);
  const currentSearch = serverPagination?.search ?? search;
  const currentFilters = serverPagination?.filters ?? activeFilters;

  // Client-side filtering is disabled when the API owns search/filtering.
  const filtered = isServerPaginated ? data : data.filter((item) => {
    // Text search
    if (currentSearch.trim()) {
      const term = currentSearch.toLowerCase();
      const matches = Object.values(item).some((val) => {
        if (typeof val === "string") return val.toLowerCase().includes(term);
        if (typeof val === "number") return val.toString().includes(term);
        if (val && typeof val === "object") {
          return Object.values(val).some(
            (v) => typeof v === "string" && v.toLowerCase().includes(term)
          );
        }
        return false;
      });
      if (!matches) return false;
    }

    // Active filters
    for (const [key, value] of Object.entries(currentFilters)) {
      if (value && value !== "__all__") {
        const itemValue = getProperty(item, key);
        if (typeof itemValue === "string" && itemValue !== value) return false;
        if (typeof itemValue === "boolean" && String(itemValue) !== value) return false;
      }
    }

    return true;
  });

  const total = serverPagination?.total ?? filtered.length;
  const effectivePageSize = serverPagination?.pageSize ?? pageSize;
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize));
  const safeCurrentPage = serverPagination?.page ?? Math.min(page, totalPages);
  const paginatedData = serverPagination ? data : filtered.slice(
    (safeCurrentPage - 1) * effectivePageSize,
    safeCurrentPage * effectivePageSize
  );

  const hasActiveFilters = Object.values(currentFilters).some((v) => v && v !== "__all__");

  return (
    <div className="space-y-4">
      {/* Toolbar: Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={currentSearch}
            onChange={(e) => {
              if (serverPagination) {
                serverPagination.onSearchChange(e.target.value);
              } else {
                setSearch(e.target.value);
                setPage(1);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-11 w-full rounded-lg border border-border/70 bg-card pl-10 pr-4 text-sm shadow-sm transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Filter toggle */}
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls={filterId}
            className={cn(
              "flex h-11 items-center gap-2 rounded-lg border px-4 text-sm transition-colors",
              hasActiveFilters
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted"
            )}
          >
            <Filter className="h-4 w-4" />
            Filtros {hasActiveFilters && `(${Object.values(currentFilters).filter(v => v && v !== "__all__").length})`}
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      {showFilters && filters.length > 0 && (
        <div id={filterId} className="flex flex-wrap gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          {filters.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${filterId}-${filter.key}`}>{filter.label}</label>
              <select
                id={`${filterId}-${filter.key}`}
                value={currentFilters[filter.key] || "__all__"}
                onChange={(e) => {
                  if (serverPagination) {
                    serverPagination.onFilterChange(filter.key, e.target.value);
                  } else {
                    setActiveFilters((prev) => ({ ...prev, [filter.key]: e.target.value }));
                    setPage(1);
                  }
                }}
                className="h-10 rounded-lg border border-border/70 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="__all__">Todos</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
          {hasActiveFilters && (
            <button
              onClick={() => {
                if (serverPagination) {
                  for (const key of Object.keys(currentFilters)) serverPagination.onFilterChange(key, "__all__");
                } else {
                  setActiveFilters({});
                  setPage(1);
                }
              }}
              className="self-end text-xs text-primary hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div role="status" aria-label="Cargando registros" className="dashboard-panel flex min-h-52 items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedData.length === 0 ? (
        <div className="empty-state">
          {emptyIcon}
          <p className="text-muted-foreground mt-2">{currentSearch || hasActiveFilters ? "No hay resultados con estos filtros." : emptyMessage}</p>
          {(currentSearch || hasActiveFilters) && <button type="button" className="mt-3 text-sm font-semibold text-primary hover:underline" onClick={() => {
            if (serverPagination) { serverPagination.onSearchChange(""); for (const key of Object.keys(currentFilters)) serverPagination.onFilterChange(key, "__all__"); }
            else { setSearch(""); setActiveFilters({}); setPage(1); }
          }}>Limpiar búsqueda y filtros</button>}
        </div>
      ) : (
        <div className="dashboard-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn("px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground", col.className)}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((item, idx) => {
                  const itemId = getProperty(item, "id");
                  return (
                  <tr
                    key={typeof itemId === "string" || typeof itemId === "number" ? itemId : idx}
                    className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/25"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3", col.className)}>
                        {col.render ? col.render(item) : renderCellValue(getProperty(item, col.key))}
                      </td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > effectivePageSize && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Mostrando {(safeCurrentPage - 1) * effectivePageSize + 1}–{Math.min(safeCurrentPage * effectivePageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const nextPage = Math.max(1, safeCurrentPage - 1);
                if (serverPagination) serverPagination.onPageChange(nextPage);
                else setPage(nextPage);
              }}
              disabled={safeCurrentPage === 1}
              aria-label="Página anterior"
              className="rounded-lg p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (safeCurrentPage <= 3) {
                pageNum = i + 1;
              } else if (safeCurrentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = safeCurrentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  aria-label={`Página ${pageNum}`}
                  aria-current={safeCurrentPage === pageNum ? "page" : undefined}
              onClick={() => {
                if (serverPagination) serverPagination.onPageChange(pageNum);
                else setPage(pageNum);
              }}
                  className={cn(
                    "h-9 w-9 rounded-lg text-xs font-semibold transition-colors",
                    safeCurrentPage === pageNum
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => {
                const nextPage = Math.min(totalPages, safeCurrentPage + 1);
                if (serverPagination) serverPagination.onPageChange(nextPage);
                else setPage(nextPage);
              }}
              disabled={safeCurrentPage === totalPages}
              aria-label="Página siguiente"
              className="rounded-lg p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
