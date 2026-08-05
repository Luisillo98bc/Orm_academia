"use client";

import type { Worker } from "@/types/domain";
import { formatMoney } from "@/lib/money";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { CreateWorkerModal } from "@/components/rrhh/create-worker-modal";
import { DataTable, DataTableColumn, DataTableFilter } from "@/components/ui/data-table";
import { useRouter } from "next/navigation";

export default function RrhhWorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/rrhh/workers");
      setWorkers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadWorkers();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

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
          worker.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 
          worker.status === 'VACATION' ? 'bg-yellow-500/10 text-yellow-500' : 
          'bg-red-500/10 text-red-500'
        }`}>
          {worker.status === 'ACTIVE' ? 'Activo' : 
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Gestión de Personal</h2>
          <p className="text-muted-foreground mt-1">Administra los trabajadores, docentes y staff de la academia.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nuevo Trabajador
        </Button>
      </div>

      <DataTable
        data={workers}
        columns={columns}
        filters={filters}
        loading={loading}
        searchPlaceholder="Buscar por nombre, email, cargo..."
        emptyMessage="No hay trabajadores registrados"
        emptyIcon={<Users className="h-12 w-12 text-muted-foreground mb-2" />}
        pageSize={8}
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
