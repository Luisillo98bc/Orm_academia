"use client";

import type { Payroll } from "@/types/domain";

import { useState, useEffect } from "react";
import { downloadApiFile, fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Calculator, CheckCircle, FileText, Download, FileSpreadsheet } from "lucide-react";
import { exportToExcel } from "@/lib/export-utils";
import { formatMoney, moneyToNumber } from "@/lib/money";

export default function RrhhPayrollPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );

  const loadPayrolls = async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/rrhh/payroll");
      setPayrolls(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadPayrolls();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleGeneratePayroll = async () => {
    setGenerating(true);
    try {
      await fetchApi(`/rrhh/payroll/generate/${period}`, { method: "POST" });
      loadPayrolls();
    } catch (err) {
      console.error("Error generating payroll", err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePay = async (id: string) => {
    try {
      await fetchApi(`/rrhh/payroll/${id}/pay`, { method: "PATCH" });
      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: 'PAID' } : p));
    } catch (err) {
      console.error("Error paying payroll", err);
    }
  };

  const handleExport = () => {
    void downloadApiFile('/rrhh/export/payroll', 'nominas.csv');
  };

  // Filtrar nóminas por el periodo seleccionado
  const filteredPayrolls = payrolls.filter(p => p.period === period);
  const totalAmount = filteredPayrolls.reduce(
    (sum, payroll) => sum + moneyToNumber(payroll.totalAmount),
    0,
  );

  const handleExportExcel = () => {
    if (!filteredPayrolls.length) return;
    const exportData = filteredPayrolls.map((p) => ({
      Trabajador: `${p.worker?.user?.firstName} ${p.worker?.user?.lastName}`,
      Documento: p.worker?.documentNumber || 'N/A',
      Periodo: p.period,
      'Sueldo Base (S/)': p.baseSalary,
      'Bonificaciones (S/)': p.bonuses,
      'Descuentos (S/)': p.deductions,
      'Total Neto (S/)': p.totalAmount,
      Estado: p.status === 'PAID' ? 'PAGADO' : 'PENDIENTE',
    }));
    exportToExcel(exportData, `Nomina_${period}`, 'Planilla');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Nómina Mensual</h2>
          <p className="text-muted-foreground mt-1">Genera y administra los pagos del personal de la academia.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportExcel} className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>

          <input 
            type="month" 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm glass w-[150px]"
          />
          <Button onClick={handleGeneratePayroll} disabled={generating} className="flex items-center gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Generar Nómina
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filteredPayrolls.length === 0 ? (
        <div className="text-center p-12 border rounded-xl bg-card glass">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold">No hay nómina generada</h3>
          <p className="text-muted-foreground mt-2">No se encontró nómina para el periodo {period}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-primary">Resumen del Periodo: {period}</h3>
              <p className="text-sm text-muted-foreground">{filteredPayrolls.length} trabajadores procesados</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground font-semibold">Total a Pagar</p>
              <h2 className="text-3xl font-bold font-mono">S/ {totalAmount.toFixed(2)}</h2>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/50 overflow-hidden glass">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Trabajador</th>
                    <th className="px-6 py-3 font-medium">Sueldo Base</th>
                    <th className="px-6 py-3 font-medium">Bonos</th>
                    <th className="px-6 py-3 font-medium">Dsctos</th>
                    <th className="px-6 py-3 font-medium font-bold text-foreground">Total Neto</th>
                    <th className="px-6 py-3 font-medium">Estado</th>
                    <th className="px-6 py-3 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredPayrolls.map((payroll) => (
                    <tr key={payroll.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        {payroll.worker?.user?.firstName} {payroll.worker?.user?.lastName}
                      </td>
                      <td className="px-6 py-4">S/ {formatMoney(payroll.baseSalary)}</td>
                      <td className="px-6 py-4 text-green-500">+ {formatMoney(payroll.bonuses)}</td>
                      <td className="px-6 py-4 text-red-500">- {formatMoney(payroll.deductions)}</td>
                      <td className="px-6 py-4 font-bold font-mono">S/ {formatMoney(payroll.totalAmount)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${payroll.status === 'PAID' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {payroll.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          size="sm" 
                          variant={payroll.status === 'PAID' ? 'outline' : 'default'} 
                          disabled={payroll.status === 'PAID'}
                          onClick={() => handlePay(payroll.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" /> Pagar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
