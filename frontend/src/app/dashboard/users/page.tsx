"use client";

import type { Role, User } from "@/types/domain";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, PlusCircle, Mail, UserCircle, Pencil, Trash2, X, CheckCircle2 } from "lucide-react";
import { CreateUserModal } from "@/components/admin/create-user-modal";

export default function UsersPage() {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterRole, setFilterRole] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{ firstName: string, lastName: string, email: string, roles: string[] }>({ firstName: "", lastName: "", email: "", roles: [] });
  const [editLoading, setEditLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = filterRole ? `/users?role=${filterRole}` : "/users";
      const data = await fetchApi(endpoint);
      setUsersList(data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar los usuarios"));
    } finally {
      setLoading(false);
    }
  };

    const loadUsersEffect = useEffectEvent(loadUsers);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadUsersEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [filterRole]);

  const handleEdit = (u: User) => {
    setEditing(u);
    setEditForm({ 
      firstName: u.firstName, 
      lastName: u.lastName, 
      email: u.email,
      roles: (u.roles || []).map((r: string | Role) => typeof r === 'string' ? r : r.name)
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditLoading(true);
    try {
      await fetchApi(`/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setSuccess("Usuario actualizado correctamente");
      setEditing(null);
      loadUsers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al actualizar"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este usuario? Esta acción es irreversible.")) return;
    try {
      await fetchApi(`/users/${id}`, { method: "DELETE" });
      setSuccess("Usuario eliminado correctamente");
      loadUsers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al eliminar"));
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await fetchApi(`/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      setSuccess(`Usuario ${u.isActive ? "desactivado" : "activado"} correctamente`);
      loadUsers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cambiar estado"));
    }
  };

  if (loading && usersList.length === 0) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user || user.roles[0] !== "ADMIN") {
    return <div className="p-8 text-center text-red-500 font-bold">Acceso Denegado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Directorio de Usuarios</h2>
          <p className="text-muted-foreground mt-1">Gestión completa de docentes, estudiantes y administradores.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" /> Registrar Usuario
        </Button>
      </div>

      <div className="flex gap-2">
        {["", "ADMIN", "DOCENTE", "ESTUDIANTE", "RRHH"].map((r) => (
          <Button key={r} variant={filterRole === r ? "default" : "outline"} size="sm" onClick={() => setFilterRole(r)} className="rounded-full">
            {r === "" ? "Todos" : r}
          </Button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 text-green-600 bg-green-100 rounded-lg dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <p>{success}</p>
          <button onClick={() => setSuccess("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden glass">
        {loading ? (
           <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Nombre Completo</th>
                <th className="px-6 py-4 font-medium">Correo Electrónico</th>
                <th className="px-6 py-4 font-medium">Rol Principal</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserCircle className="h-8 w-8 text-muted-foreground/50" />
                        <span className="font-semibold text-foreground">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {u.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {(u.roles || []).map((r: string | Role, idx: number) => {
                          const roleName = typeof r === 'string' ? r : r.name;
                          return (
                            <span key={roleName || idx} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                              {roleName}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggleActive(u)} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span>{u.isActive ? "Activo" : "Inactivo"}</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(u)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(u.id)} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Edición Inline */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl border border-border/50 p-6 w-full max-w-md glass relative">
            <button onClick={() => setEditing(null)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            <h3 className="text-xl font-bold mb-4">Editar Usuario</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                <input className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm" value={editForm.firstName} onChange={(e) => setEditForm({...editForm, firstName: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Apellido</label>
                <input className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm" value={editForm.lastName} onChange={(e) => setEditForm({...editForm, lastName: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Correo</label>
                <input className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Accesos y Módulos</label>
                <div className="mt-2 space-y-2">
                  {["ADMIN", "DOCENTE", "ESTUDIANTE", "RRHH"].map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors w-fit">
                      <input 
                        type="checkbox" 
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                        checked={editForm.roles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({ ...editForm, roles: [...editForm.roles, role] });
                          } else {
                            setEditForm({ ...editForm, roles: editForm.roles.filter(r => r !== role) });
                          }
                        }}
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleSaveEdit} disabled={editLoading} className="w-full">
                {editLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateUserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => { loadUsers(); setIsModalOpen(false); }} 
      />
    </div>
  );
}
