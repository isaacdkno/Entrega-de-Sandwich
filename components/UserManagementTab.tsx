import React, { useState, useEffect } from 'react';
import { AppUser, UserRole, UserSession } from '../types';
import { getAppUsers, saveAppUser, deleteAppUser } from '../services/storageService';
import { UserPlus, Trash2, Save, Edit2, Loader2, ShieldAlert, Activity, RefreshCw, DatabaseZap } from 'lucide-react';

interface UserManagementTabProps {
  currentUserSession: UserSession;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({ currentUserSession }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const interval = setInterval(fetchUsers, 60000);
    return () => clearInterval(interval);
  }, []);

  const [formData, setFormData] = useState<AppUser>({
    email: '',
    name: '',
    role: UserRole.CARGADOR
  });

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
    } catch (e: any) {
      setError(e.message || 'Error al guardar usuario.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (email === currentUserSession.email) return;
    if (!confirm(`¿Borrar acceso a ${email}?`)) return;
    setIsSaving(true);
    try {
      await deleteAppUser(email);
      await fetchUsers();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl mb-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
            <h2 className="text-2xl font-black flex items-center gap-2 uppercase tracking-tight">
              <ShieldAlert className="text-orange-500" /> Administración de Accesos
            </h2>
            <p className="text-slate-400 mt-1 text-[10px] font-black uppercase tracking-widest">Panel Maestro de Usuarios Autorizados</p>
        </div>
        <DatabaseZap className="absolute -right-4 -bottom-4 text-white/5" size={120} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Formulario de Usuarios */}
        <div className="lg:col-span-3 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter text-xs">
              {isEditing ? <Edit2 size={16} className="text-blue-600" /> : <UserPlus size={16} className="text-orange-600" />}
              {isEditing ? `Editando: ${formData.email}` : 'Vincular Nuevo Usuario'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Correo Electrónico</label>
                       <input
                        type="email" required placeholder="ejemplo@gmail.com"
                        className={`w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:border-orange-500 ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})}
                        disabled={isEditing || isSaving}
                       />
                    </div>
                    <div>
                       <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Nombre Completo</label>
                       <input
                        type="text" required placeholder="JUAN PEREZ"
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:border-orange-500 uppercase"
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                        disabled={isSaving}
                       />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Rol de Usuario</label>
                       <select 
                         className="w-full p-3 border border-slate-200 rounded-xl bg-white font-black text-xs outline-none cursor-pointer"
                         value={formData.role}
                         onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                         disabled={isSaving}
                       >
                         {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                    </div>
                    <div className="flex items-end gap-2">
                        <button type="submit" disabled={isSaving} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${isEditing ? 'bg-blue-600' : 'bg-slate-900'}`}>
                            {isSaving ? <Loader2 className="animate-spin" size={14} /> : isEditing ? <Save size={14} /> : <UserPlus size={14} />}
                            {isEditing ? 'Guardar Cambios' : 'Autorizar Usuario'}
                        </button>
                        {isEditing && (
                            <button type="button" onClick={handleCancel} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase">Cancelar</button>
                        )}
                    </div>
                </div>
                {error && <p className="text-rose-600 text-[10px] font-bold uppercase">{error}</p>}
            </form>
        </div>
      </div>

      {/* Lista de Personal */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <h3 className="font-black text-slate-700 uppercase tracking-widest text-[10px] flex items-center gap-2">
                <Activity size={14} className="text-orange-600" /> Personal Autorizado
            </h3>
            <button onClick={fetchUsers} className="text-slate-400 hover:text-orange-600 transition-colors">
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
         </div>
         
         <div className="divide-y divide-slate-100">
            {users.map((user) => (
                <div key={user.email} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 text-sm truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="hidden sm:inline-block px-2 py-1 bg-slate-100 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">
                            {user.role}
                        </span>
                        <div className="flex gap-1">
                            <button onClick={() => handleEdit(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete(user.email)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                    </div>
                </div>
            ))}
         </div>
      </div>
    </div>
  );
};