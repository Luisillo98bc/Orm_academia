import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ page, pageSize, total, onPageChange }: TablePaginationProps) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
      <span>Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" aria-label="Página anterior" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" />Anterior</Button>
        <span className="flex items-center px-1" aria-live="polite">{page}/{pages}</span>
        <Button variant="outline" size="sm" aria-label="Página siguiente" onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page >= pages}>Siguiente<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
