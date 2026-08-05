"use client";

import type { Contract, Payroll, Worker } from "@/types/domain";
import { formatMoney } from "@/lib/money";

import { useState, useEffect, useEffectEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi, getErrorMessage } from "@/lib/api";
import {
  Loader2,
  ArrowLeft,
  UserCircle2,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Mail,
  Phone,
  Plus,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [activeTab, setActiveTab] = useState<"perfil" | "contratos" | "nominas">("perfil");
  const [showContractForm, setShowContractForm] = useState(false);

  // Contract form state
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractData, setContractData] = useState({
    type: "FIXED_TERM",
    startDate: "",
    endDate: "",
    agreedSalary: "",
    observations: "",
  });

  const loadWorker = async () => {
    setLoading(true);
    try {
      const data = await fetchApi(`/rrhh/workers/${workerId}`);
      setWorker(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

    const loadWorkerEffect = useEffectEvent(loadWorker);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadWorkerEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [workerId]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingContract(true);
    try {
      await fetchApi(`/rrhh/workers/${workerId}/contracts`, {
        method: "POST",
        body: JSON.stringify(contractData),
      });
      setShowContractForm(false);
      setContractData({
        type: "FIXED_TERM",
        startDate: "",
        endDate: "",
        agreedSalary: "",
        observations: "",
      });
      await loadWorker();
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Error al crear contrato"));
    } finally {
      setCreatingContract(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Cargando perfil del trabajador...
        </p>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Trabajador no encontrado.</p>
        <Button onClick={() => router.push("/dashboard/rrhh/workers")} variant="outline">
          Volver a la lista
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === "ACTIVE") return "bg-green-500/10 text-green-500";
    if (status === "INACTIVE") return "bg-red-500/10 text-red-500";
    if (status === "VACATION") return "bg-yellow-500/10 text-yellow-500";
    return "bg-slate-500/10 text-slate-500";
  };

  const getStatusLabel = (status: string) => {
    if (status === "ACTIVE") return "Activo";
    if (status === "INACTIVE") return "Inactivo";
    if (status === "VACATION") return "Vacaciones";
    if (status === "LEAVE") return "Permiso";
    return status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-border/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/rrhh/workers")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold shrink-0">
            {worker.user?.firstName?.[0]}{worker.user?.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              {worker.user?.firstName} {worker.user?.lastName}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(worker.status)}`}>
                {getStatusLabel(worker.status)}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {worker.position} en {worker.department}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50">
        <button
          onClick={() => setActiveTab("perfil")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "perfil"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Perfil y Datos
        </button>
        <button
          onClick={() => setActiveTab("contratos")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "contratos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Contratos ({worker.contracts?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("nominas")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "nominas"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Historial Nóminas
        </button>
      </div>

      {/* Tab Content: Perfil */}
      {activeTab === "perfil" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <UserCircle2 className="h-5 w-5 text-primary" />
              Datos Personales
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </span>
                <span className="col-span-2 font-medium">{worker.user?.email}</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" /> DNI
                </span>
                <span className="col-span-2 font-medium">{worker.dni}</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Teléfono
                </span>
                <span className="col-span-2 font-medium">{worker.personalPhone || "No registrado"}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Datos Laborales
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Building className="h-4 w-4" /> Departamento
                </span>
                <span className="col-span-2 font-medium">{worker.department}</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Cargo
                </span>
                <span className="col-span-2 font-medium">{worker.position}</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Fecha Contrato
                </span>
                <span className="col-span-2 font-medium">
                  {new Date(worker.hireDate).toLocaleDateString("es-ES")}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Salario Base
                </span>
                <span className="col-span-2 font-medium">S/ {formatMoney(worker.baseSalary)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Contratos */}
      {activeTab === "contratos" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Historial de Contratos</h3>
            <Button onClick={() => setShowContractForm(!showContractForm)} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Contrato
            </Button>
          </div>

          {showContractForm && (
            <form onSubmit={handleCreateContract} className="bg-muted/30 p-6 rounded-xl border border-border/50 space-y-4">
              <h4 className="font-medium flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-primary" /> Añadir Contrato
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Tipo de Contrato</Label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={contractData.type}
                    onChange={(e) => setContractData({ ...contractData, type: e.target.value })}
                    required
                  >
                    <option value="INDEFINITE">Indefinido</option>
                    <option value="FIXED_TERM">Plazo Fijo</option>
                    <option value="INTERNSHIP">Prácticas</option>
                    <option value="FREELANCE">Honorarios / Recibo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Salario Acordado (S/)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={contractData.agreedSalary}
                    onChange={(e) => setContractData({ ...contractData, agreedSalary: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fecha de Inicio</Label>
                  <Input
                    type="date"
                    required
                    value={contractData.startDate}
                    onChange={(e) => setContractData({ ...contractData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fecha de Fin (Opcional)</Label>
                  <Input
                    type="date"
                    value={contractData.endDate}
                    onChange={(e) => setContractData({ ...contractData, endDate: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Observaciones</Label>
                  <Input
                    value={contractData.observations}
                    onChange={(e) => setContractData({ ...contractData, observations: e.target.value })}
                    placeholder="Detalles adicionales..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowContractForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creatingContract} className="gap-2">
                  {creatingContract && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar Contrato
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {(worker.contracts?.length ?? 0) > 0 ? (
              worker.contracts?.map((contract: Contract, index: number) => (
                <div key={contract.id} className="bg-card border border-border/50 rounded-xl p-5 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">
                          {contract.type === "INDEFINITE" && "Contrato Indefinido"}
                          {contract.type === "FIXED_TERM" && "Contrato a Plazo Fijo"}
                          {contract.type === "INTERNSHIP" && "Convenio de Prácticas"}
                          {contract.type === "FREELANCE" && "Locación de Servicios"}
                        </h4>
                        {contract.isActive && index === 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500">
                            VIGENTE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>Inicio: {new Date(contract.startDate).toLocaleDateString("es-ES")}</span>
                        {contract.endDate && (
                          <>
                            <span>→</span>
                            <span>Fin: {new Date(contract.endDate).toLocaleDateString("es-ES")}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right md:text-left flex flex-col items-end md:items-start">
                    <span className="text-sm text-muted-foreground">Sueldo Acordado</span>
                    <span className="font-bold text-lg">S/ {formatMoney(contract.agreedSalary)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground">
                No hay contratos registrados para este trabajador.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Nóminas */}
      {activeTab === "nominas" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Historial de Nóminas Pagadas</h3>
          {(worker.payrolls?.length ?? 0) > 0 ? (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border/50">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Período</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Fecha de Pago</th>
                    <th className="px-4 py-3 font-medium text-right">Total Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {worker.payrolls?.map((payroll: Payroll) => (
                    <tr key={payroll.id} className="bg-card hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{payroll.period}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          payroll.status === "PAID" ? "bg-green-500/10 text-green-500" :
                          payroll.status === "PENDING" ? "bg-amber-500/10 text-amber-500" :
                          "bg-slate-500/10 text-slate-500"
                        }`}>
                          {payroll.status === "PAID" ? "Pagado" : "Pendiente"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {payroll.paymentDate ? new Date(payroll.paymentDate).toLocaleDateString("es-ES") : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        S/ {formatMoney(payroll.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground">
              El trabajador no tiene un historial de nóminas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
