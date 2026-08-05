import { useState, useEffect } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";
import type { Role, User } from "@/types/domain";

interface WorkerCandidate extends Omit<User, "roles"> {
  roles?: Array<{ role: Role }>;
}

export function CreateWorkerModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [isExistingUser, setIsExistingUser] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<WorkerCandidate[]>([]);

  const [formData, setFormData] = useState({
    userId: "",
    firstName: "", lastName: "", email: "", password: "",
    dni: "", position: "Profesor", department: "Docencia", 
    baseSalary: "1500.00", hireDate: new Date().toISOString().split('T')[0], roleName: "DOCENTE"
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (isOpen) {
      // Basic roles fetch (simulate or real)
      setRoles([
      { id: 'DOCENTE', name: 'DOCENTE' },
      { id: 'ADMIN', name: 'ADMIN' },
      { id: 'RRHH', name: 'RRHH' }
      ]);
      
      // Fetch available users
      fetchApi("/rrhh/available-users").then(data => {
      setAvailableUsers(data || []);
      if (data && data.length > 0) {
      setFormData(prev => ({ ...prev, userId: data[0].id }));
      }
      }).catch(err => console.error("Error fetching available users", err));
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.dni.length < 8) {
      setError("El DNI debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      // If creating new, userId should not be sent
      const workerFields = {
        dni: formData.dni,
        position: formData.position,
        department: formData.department,
        baseSalary: formData.baseSalary,
        hireDate: formData.hireDate,
      };
      const newUserFields = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        roleName: formData.roleName,
      };
      const payload = isExistingUser
        ? { ...workerFields, userId: formData.userId }
        : { ...workerFields, ...newUserFields };
      
      await fetchApi("/rrhh/workers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al registrar al trabajador"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto pt-20 pb-20">
      <Card className="w-full max-w-xl glass border-white/20 relative mt-10">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Registrar Nuevo Trabajador</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="flex gap-4 border-b border-border pb-4">
              <Button 
                type="button" 
                variant={isExistingUser ? "default" : "outline"} 
                onClick={() => setIsExistingUser(true)}
                className="flex-1"
              >
                Usuario Existente
              </Button>
              <Button 
                type="button" 
                variant={!isExistingUser ? "default" : "outline"} 
                onClick={() => setIsExistingUser(false)}
                className="flex-1"
              >
                Crear Nuevo Usuario
              </Button>
            </div>

            {isExistingUser ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-primary border-b border-border pb-1">Seleccionar Usuario</h3>
                <div className="space-y-2">
                  <label className="text-sm">Usuario Registrado</label>
                  <select 
                    value={formData.userId} 
                    onChange={(e) => setFormData({...formData, userId: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm glass"
                    required
                  >
                    {availableUsers.length === 0 && <option value="">No hay usuarios disponibles</option>}
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email}) - Rol: {u.roles?.[0]?.role.name || "Sin rol"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-primary border-b border-border pb-1">Datos de Usuario (Acceso)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm">Nombre</label>
                    <Input required value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm">Apellido</label>
                    <Input required value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm">Email Corporativo</label>
                    <Input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm">Contraseña Temporal</label>
                    <Input type="password" required minLength={8} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm">Rol en el Sistema</label>
                  <select 
                    value={formData.roleName} 
                    onChange={(e) => setFormData({...formData, roleName: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm glass"
                  >
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </>
            )}

            <h3 className="font-semibold text-primary border-b border-border pb-1 mt-6">Datos Laborales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm">DNI</label>
                <Input required value={formData.dni} onChange={(e) => setFormData({...formData, dni: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Fecha de Ingreso</label>
                <Input type="date" required value={formData.hireDate} onChange={(e) => setFormData({...formData, hireDate: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm">Cargo</label>
                <Input required value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Área / Departamento</label>
                <select 
                  value={formData.department} 
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm glass"
                >
                  <option value="Docencia">Docencia</option>
                  <option value="Administración">Administración</option>
                  <option value="Soporte IT">Soporte IT</option>
                  <option value="RRHH">Recursos Humanos</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm">Sueldo Base (Mensual en S/)</label>
              <Input type="number" required min={0} step="0.01" value={formData.baseSalary} onChange={(e) => setFormData({...formData, baseSalary: e.target.value})} />
            </div>

            {error && <p className="text-sm text-destructive font-medium bg-destructive/10 p-2 rounded">{error}</p>}
            
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Registrar Trabajador
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
