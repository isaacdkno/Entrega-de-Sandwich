import React, { useState, useEffect } from 'react';
import { AppUser, UserRole, UserSession } from '../types';
import { getAppUsers, saveAppUser, deleteAppUser, deleteAllOrders } from '../services/storageService';
import { UserPlus, Trash2, Save, Edit2, Loader2, ShieldAlert, Mail, User, DatabaseZap } from 'lucide-react';

interface UserManagementTabProps {
  currentUserSession: UserSession;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({ currentUserSession }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<AppUser>({
    email: '',
    name: '',
    role: UserRole.CARGADOR
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getAppUsers();
      setUsers(data);
    } catch (e) {
      setError('Error al cargar usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: AppUser) => {
    setFormData(user);
    setIsEditing(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setFormData({ email: '', name: '', role: UserRole.CARGADOR });
    setIsEditing(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;

    setIsSaving(true);
    setError(null);
    try {
      await saveAppUser(formData);
      await fetchUsers();
      handleCancel();
    } catch (e) {
      setError('Error al guardar usuario. Verifique la conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (email === currentUserSession.email) {
      alert("No puedes eliminar tu propio usuario mientras estás conectado.");
      return;
    }
    if (!confirm(`¿Seguro que desea eliminar el acceso a ${email}?`)) return;

    setIsSaving(true);
    try {
      await deleteAppUser(email);
      await fetchUsers();
    } catch (e) {
      alert('Error al eliminar usuario.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWipeDatabase = async () => {
      const confirm1 = confirm("⚠️ ¡PELIGRO! ESTO BORRARÁ TODOS LOS PEDIDOS DE LA BASE DE DATOS.\n\n¿Estás absolutamente seguro?");
      if (!confirm1) return;
      
      const confirm2 = confirm("ÚLTIMA ADVERTENCIA.\n\nEsta acción es irreversible. Se borrarán todas las comandas y el historial.\n\nPresiona Aceptar para borrar todo.");
      if (!confirm2) return;

      setIsSaving(true);
      try {
          await deleteAllOrders();
          alert("Base de datos vaciada correctamente.");
      } catch(e) {
          alert("Error al vaciar la base de datos.");
          console.error(e);
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      <div className="bg-slate-800 text-white p-6 rounded-xl mb-6 shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="text-orange-400" />
          Gestión de Usuarios y Roles
        </h2>
        <p className="text-slate-300 mt-1 text-sm">
          Controle quién tiene acceso a la aplicación.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
          {isEditing ? <Edit2 size={20} /> : <UserPlus size={20} />}
          {isEditing ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
               <div className="relative">
                 <Mail className="absolute left-3 top-3 text-slate-400" size={16} />
                 <input
                  type="email"
                  required
                  placeholder="usuario@empresa.com"
                  className={`w-full pl-10 p-2.5 border rounded bg-slate-50 focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none ${isEditing ? 'text-slate-500 cursor-not-allowed' : ''}`}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  disabled={isEditing || isSaving}
                 />
               </div>
            </div>

            <div className="relative">
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Real</label>
               <div className="relative">
                 <User className="absolute left-3 top-3 text-slate-400" size={16} />
                 <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  className="w-full pl-10 p-2.5 border rounded focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  disabled={isSaving}
                 />
               </div>
            </div>

            <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol / Permisos</label>
               <select 
                 className="w-full p-2.5 border rounded bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                 value={formData.role}
                 onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                 disabled={isSaving}
               >
                 <option value={UserRole.CARGADOR}>Cargador (Solo Carga)</option>
                 <option value={UserRole.UBICADOR}>Ubicador (Solo Ubicar)</option>
                 <option value={UserRole.ENTREGADOR}>Entregador (Solo Entregar)</option>
                 <option value={UserRole.ADMIN}>Administrador (Acceso Total)</option>
               </select>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-orange-600 text-white px-6 py-2 rounded font-bold hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isEditing ? 'Actualizar Permisos' : 'Crear Usuario'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="bg-slate-200 text-slate-700 px-6 py-2 rounded font-bold hover:bg-slate-300"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-12">
         <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Usuarios Autorizados ({users.length})</h3>
            {isLoading && <Loader2 className="animate-spin text-orange-500" size={20} />}
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                  <tr>
                    <th className="p-4">Nombre</th>
                    <th className="p-4">Correo</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
               </thead>
               <tbody>
                  {users.map((user) => (
                    <tr key={user.email} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-900">{user.name}</td>
                      <td className="p-4 text-slate-500 font-mono">{user.email}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${
                          user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800 border-purple-200' :
                          user.role === UserRole.CARGADOR ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          user.role === UserRole.UBICADOR ? 'bg-orange-100 text-orange-800 border-orange-200' :
                          'bg-green-100 text-green-800 border-green-200'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-2">
                         <button 
                           onClick={() => handleEdit(user)}
                           className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors"
                           title="Editar"
                         >
                           <Edit2 size={16} />
                         </button>
                         <button 
                           onClick={() => handleDelete(user.email)}
                           className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-red-100 hover:text-red-600 transition-colors"
                           title="Eliminar acceso"
                         >
                           <Trash2 size={16} />
                         </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                        No se encontraron usuarios.
                      </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* DANGER ZONE - ONLY FOR ISAAC */}
      {currentUserSession.email.toLowerCase() === 'isaacgomez78@gmail.com' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-red-800 font-black text-lg mb-2">
                  <DatabaseZap size={24} />
                  ZONA DE PELIGRO (Solo Isaac)
              </div>
              <p className="text-red-600 mb-4">
                  Esta sección permite realizar acciones destructivas sobre la base de datos.
              </p>
              <button 
                onClick={handleWipeDatabase}
                disabled={isSaving}
                className="bg-red-600 text-white px-6 py-3 rounded font-bold hover:bg-red-700 flex items-center gap-2 shadow-lg"
              >
                 {isSaving ? <Loader2 className="animate-spin" /> : <Trash2 size={20} />}
                 VACIAR BASE DE DATOS (Eliminar todos los pedidos)
              </button>
          </div>
      )}
    </div>
  );
};