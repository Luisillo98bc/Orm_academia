"use client";

import type { Worker } from "@/types/domain";
import { formatMoney } from "@/lib/money";

import { useState, useEffect, useCallback } from "react";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { CreateWorkerModal } from "@/components/rrhh/create-worker-modal";
import { DataTable, DataTableColumn, DataTableFilter } from "@/components/ui/data-table";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";

export default function RrhhWorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const pageSize = 20;
  const router = useRouter();

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search.trim()) query.set("search", search.trim());
      if (activeFilters.status && activeFilters.status !== "__all__") query.set("status", activeFilters.status);
      if (activeFilters.department && activeFilters.department !== "__all__") query.set("department", activeFilters.department);
      const response = await fetchApi(`/rrhh/workers?${query}`);
      const rows = response?.data || response || [];
      setWorkers(rows);
      setTotal(response?.pagination?.total || rows.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el personal");
    } finally {
      setLoading(false);
    }
  }, [activeFilters, page, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadWorkers();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadWorkers]);

  const columns: DataTableColumn<Worker>[] = [
    {
      key: "name",
      header: "Trabajador",
      render: (worker) => (
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 h-9 w-9 rounded-full flex items-center justify-center text-primary font-bold text-xs shrink-0">
            {worker.user?.firstName?.[0]}{worker.user?.lastName?.[0]}
          </div>
          <div>
            <p className="font-medium">{worker.user?.firstName} {worker.user?.lastName}</p>
            <p className="text-xs text-muted-foreground">{worker.user?.email}</p>
            {worker.user?.deletedAt && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Cuenta eliminada · solo historial
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "position",
      header: "Cargo",
      render: (worker) => (
        <div>
          <p className="font-medium">{worker.position}</p>
          <p className="text-xs text-muted-foreground">{worker.department}</p>
        </div>
      ),
    },
    {
      key: "baseSalary",
      header: "Sueldo Base",
      render: (worker) => (
        <span className="font-mono font-medium">S/ {formatMoney(worker.baseSalary)}</span>
      ),
      className: "text-right",
    },
    {
      key: "status",
      header: "Estado",
      render: (worker) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          worker.user?.deletedAt ? 'bg-slate-500/10 text-slate-500' :
          worker.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 
          worker.status === 'VACATION' ? 'bg-yellow-500/10 text-yellow-500' : 
          'bg-red-500/10 text-red-500'
        }`}>
          {worker.user?.deletedAt ? 'Cuenta eliminada' :
           worker.status === 'ACTIVE' ? 'Activo' :
           worker.status === 'INACTIVE' ? 'Inactivo' : 
           worker.status === 'VACATION' ? 'Vacaciones' : worker.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (worker) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push(`/dashboard/rrhh/workers/${worker.id}`)}>Ver Perfil</Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  const filters: DataTableFilter[] = [
    {
      key: "status",
      label: "Estado",
      options: [
        { value: "ACTIVE", label: "Activo" },
        { value: "INACTIVE", label: "Inactivo" },
        { value: "VACATION", label: "Vacaciones" },
        { value: "LEAVE", label: "Permiso" },
      ],
    },
    {
      key: "department",
      label: "Departamento",
      options: [...new Set(workers.map(w => w.department).filter(Boolean))].map(d => ({
        value: d,
        label: d,
      })),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Recursos humanos" title="Gestión de personal" description="Administra los trabajadores, docentes y staff de la academia." actions={<Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2"><Plus className="h-4 w-4" />Nuevo trabajador</Button>} />
      <SummaryStrip items={[{ label: "Personal encontrado", value: total }, { label: "Activo en esta página", value: workers.filter(worker => worker.status === "ACTIVE").length }, { label: "Departamentos en esta página", value: new Set(workers.map(worker => worker.department)).size }]} />
      {error && <div role="alert" className="workspace-note">{error}<Button variant="outline" size="sm" className="ml-3" onClick={loadWorkers}>Reintentar</Button></div>}

      <DataTable
        data={workers}
        columns={columns}
        filters={filters}
        serverPagination={{
          page,
          pageSize,
          total,
          search,
          filters: activeFilters,
          onPageChange: setPage,
          onSearchChange: (value) => { setSearch(value); setPage(1); },
          onFilterChange: (key, value) => {
            setActiveFilters((current) => ({ ...current, [key]: value }));
            setPage(1);
          },
        }}
        loading={loading}
        searchPlaceholder="Buscar por nombre, email, cargo..."
        emptyMessage="No hay trabajadores registrados"
        emptyIcon={<Users className="h-12 w-12 text-muted-foreground mb-2" />}
        pageSize={pageSize}
      />

      <CreateWorkerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          setIsModalOpen(false);
          loadWorkers();
        }} 
      />
    </div>
  );
}
