"use client";

import { isValidElement, useState } from "react";
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
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Client-side filtering
  const filtered = data.filter((item) => {
    // Text search
    if (search.trim()) {
      const term = search.toLowerCase();
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
    for (const [key, value] of Object.entries(activeFilters)) {
      if (value && value !== "__all__") {
        const itemValue = getProperty(item, key);
        if (typeof itemValue === "string" && itemValue !== value) return false;
        if (typeof itemValue === "boolean" && String(itemValue) !== value) return false;
      }
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(page, totalPages);
  const paginatedData = filtered.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const hasActiveFilters = Object.values(activeFilters).some((v) => v && v !== "__all__");

  return (
    <div className="space-y-4">
      {/* Toolbar: Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border/50 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        {/* Filter toggle */}
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors",
              hasActiveFilters
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted"
            )}
          >
            <Filter className="h-4 w-4" />
            Filtros {hasActiveFilters && `(${Object.values(activeFilters).filter(v => v && v !== "__all__").length})`}
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 rounded-lg border border-border/50 bg-muted/20">
          {filters.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
              <select
                value={activeFilters[filter.key] || "__all__"}
                onChange={(e) => {
                  setActiveFilters((prev) => ({ ...prev, [filter.key]: e.target.value }));
                  setPage(1);
                }}
                className="px-3 py-1.5 text-sm rounded-md border border-border/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
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
              onClick={() => { setActiveFilters({}); setPage(1); }}
              className="self-end text-xs text-primary hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paginatedData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/50 rounded-xl bg-card">
          {emptyIcon}
          <p className="text-muted-foreground mt-2">{emptyMessage}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn("px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider", col.className)}
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
                    className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
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
      {!loading && filtered.length > pageSize && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Mostrando {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, safeCurrentPage - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "h-8 w-8 rounded-md text-xs font-medium transition-colors",
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
              onClick={() => setPage(Math.min(totalPages, safeCurrentPage + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
