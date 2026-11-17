"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirmation extends ConfirmOptions {
  resolve: (accepted: boolean) => void;
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
  }, []);

  const close = useCallback((accepted: boolean) => {
    pending?.resolve(accepted);
    setPending(null);
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <Modal title={pending.title} onClose={() => close(false)} alert>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="confirm-title" className="text-lg font-bold text-foreground">{pending.title}</h2>
                  <p id="confirm-description" className="mt-2 text-sm leading-6 text-muted-foreground">{pending.description}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => close(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => close(false)}>{pending.cancelLabel || "Cancelar"}</Button>
              <Button variant={pending.destructive === false ? "default" : "destructive"} onClick={() => close(true)}>
                {pending.confirmLabel || "Confirmar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm debe utilizarse dentro de ConfirmProvider");
  return confirm;
}
