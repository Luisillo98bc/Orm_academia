import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";

export function CreateUserModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", password: "", role: "DOCENTE" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validaciones
    if (formData.firstName.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }
    if (formData.lastName.trim().length < 2) {
      setError("El apellido debe tener al menos 2 caracteres");
      return;
    }
    if (!formData.email.includes("@")) {
      setError("Ingresa un correo electrónico válido");
      return;
    }
    if (formData.password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { role, ...dataToSend } = formData;
      await fetchApi("/users", {
        method: "POST",
        body: JSON.stringify({ ...dataToSend, roles: [role] }),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al crear usuario"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Registrar usuario" onClose={() => { if (!loading) onClose(); }}>

      <Card className="w-full max-w-md bg-background shadow-2xl border-border relative animate-scale-in">
        <button aria-label="Cerrar ventana" onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Registrar Nuevo Usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="admin-create-user-modal-0" className="text-sm">Nombre</label>
                <Input id="admin-create-user-modal-0" required value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label htmlFor="admin-create-user-modal-1" className="text-sm">Apellido</label>
                <Input id="admin-create-user-modal-1" required value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-create-user-modal-2" className="text-sm">Email</label>
              <Input id="admin-create-user-modal-2" type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-create-user-modal-3" className="text-sm">Contraseña</label>
              <Input id="admin-create-user-modal-3" type="password" required minLength={8} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-create-user-modal-4" className="text-sm">Rol</label>
              <select id="admin-create-user-modal-4"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="ESTUDIANTE">Estudiante</option>
                <option value="DOCENTE">Docente</option>
                <option value="ADMIN">Administrador</option>
                <option value="RRHH">Recursos Humanos</option>
              </select>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
