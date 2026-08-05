"use client";

import type { Cohort } from "@/types/domain";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { CreditCard, Smartphone, Banknote, UploadCloud, CheckCircle2 } from "lucide-react";
import { formatMoney, moneyToNumber } from "@/lib/money";

interface CheckoutResult {
  payment?: { id: string };
  enrollment?: { id: string };
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [method, setMethod] = useState<string>("TARJETA");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<CheckoutResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Redirigir al login si no está logueado
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/register?cohortId=${params.id}`);
    }
  }, [user, loading, router, params.id]);

  useEffect(() => {
    fetchApi("/academic/cohorts")
      .then(data => {
        const found = (data || []).find((c: Cohort) => c.id === params.id);
        setCohort(found);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="p-20 text-center animate-pulse">Cargando pasarela...</div>;
  if (!cohort) return <div className="p-20 text-center">Curso no encontrado</div>;

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const res = await fetchApi("/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ cohortId: cohort.id, method }),
      });
      
      setPaymentResult(res);

      if (method === "TARJETA" || moneyToNumber(cohort.price) === 0) {
        // Redirigir directo porque la tarjeta se aprueba en el mock
        setTimeout(() => router.push("/dashboard/my-courses"), 2000);
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Error procesando el pago. Verifica si ya estás matriculado."));
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadVoucher = async () => {
    if (!selectedFile || !paymentResult?.payment) return;
    
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      await fetchApi(`/payments/${paymentResult.payment.id}/voucher`, {
        method: "POST",
        body: formData
      });
      
      alert("Comprobante subido exitosamente. Espera la validación de un administrador.");
      router.push("/dashboard/my-courses");
    } catch  {
      alert("Error subiendo voucher");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-6">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* DETALLES DE COMPRA */}
          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between font-medium">
                <span>Curso:</span>
                <span className="text-right">{cohort.course?.name} <br/> <span className="text-xs text-muted-foreground">{cohort.name}</span></span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-4 border-t border-border">
                <span>Total a Pagar:</span>
                <span className="text-primary">S/ {formatMoney(cohort.price)}</span>
              </div>
            </CardContent>
          </Card>

          {/* MÉTODOS DE PAGO */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Método de Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {paymentResult ? (
                <div className="text-center p-6 space-y-4">
                  {method === "TARJETA" || moneyToNumber(cohort.price) === 0 ? (
                    <>
                      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                      <h3 className="text-xl font-bold">¡Pago Exitoso!</h3>
                      <p className="text-muted-foreground">Redirigiendo a tus cursos...</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold">Sube tu Comprobante</h3>
                      <p className="text-sm text-muted-foreground">Para {method}, deposita S/ {formatMoney(cohort.price)} al número 999 888 777 y sube tu captura.</p>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      <div 
                        className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadCloud className="w-10 h-10 text-muted-foreground mb-2" />
                        <span className="text-sm">{selectedFile ? selectedFile.name : "Clic para seleccionar imagen"}</span>
                      </div>
                      
                      <Button className="w-full" disabled={!selectedFile || processing} onClick={handleUploadVoucher}>
                        {processing ? "Subiendo..." : "Enviar Comprobante"}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant={method === 'TARJETA' ? 'default' : 'outline'} 
                      className={`h-16 flex flex-col gap-1 ${method === 'TARJETA' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      onClick={() => setMethod('TARJETA')}
                    >
                      <CreditCard className="w-5 h-5" /> Tarjeta
                    </Button>
                    <Button 
                      variant={method === 'YAPE' ? 'default' : 'outline'} 
                      className={`h-16 flex flex-col gap-1 ${method === 'YAPE' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      onClick={() => setMethod('YAPE')}
                    >
                      <Smartphone className="w-5 h-5" /> Yape
                    </Button>
                    <Button 
                      variant={method === 'PLIN' ? 'default' : 'outline'} 
                      className={`h-16 flex flex-col gap-1 ${method === 'PLIN' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      onClick={() => setMethod('PLIN')}
                    >
                      <Smartphone className="w-5 h-5" /> Plin
                    </Button>
                    <Button 
                      variant={method === 'EFECTIVO' ? 'default' : 'outline'} 
                      className={`h-16 flex flex-col gap-1 ${method === 'EFECTIVO' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      onClick={() => setMethod('EFECTIVO')}
                    >
                      <Banknote className="w-5 h-5" /> Efectivo
                    </Button>
                  </div>
                  
                  {method === "TARJETA" && (
                    <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground border border-border">
                      Modo simulación: El pago se aprobará instantáneamente con cualquier tarjeta.
                    </div>
                  )}

                  <Button className="w-full h-12 text-lg" onClick={handleCheckout} disabled={processing}>
                    {processing ? "Procesando..." : "Confirmar Pago"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
