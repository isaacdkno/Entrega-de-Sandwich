
import React, { useState, useEffect } from 'react';
import { AppUser, UserRole, UserSession } from '../types';
import { getAppUsers, saveAppUser, deleteAppUser, deleteAllOrders } from '../services/storageService';
// Added RefreshCw to imports
import { UserPlus, Trash2, Save, Edit2, Loader2, ShieldAlert, Mail, User, DatabaseZap, AlertTriangle, Terminal, Copy, CheckCircle2, ShieldCheck, Database, Activity, Clock, RefreshCw } from 'lucide-react';

interface UserManagementTabProps {
  currentUserSession: UserSession;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({ currentUserSession }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getAppUsers();
      setUsers(data);
      setDbStatus('ok');
    } catch (e) {
      setError('Error al cargar usuarios.');
      setDbStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // Auto-refresh cada minuto para ver actividad
    const interval = setInterval(fetchUsers, 60000);
    return () => clearInterval(interval);
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
    } catch (e: any) {
      setError(e.message || 'Error al guardar usuario. Verifique la conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (table: string) => {
    const sql = `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLastActive = (dateStr?: string) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Hace un instante';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOnline = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = (now.getTime() - date.getTime()) / 60000;
    return diffMins < 10; // Consideramos online si hubo actividad en los últimos 10 min
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
      } catch(e: any) {
          if (e.message.includes('42501')) {
              setError("PERMISO DENEGADO en la tabla 'orders'.");
          } else {
              alert("Error al vaciar la base de datos.");
          }
          console.error(e);
      } finally {
          setIsSaving(false);
      }
  };

  const [formData, setFormData] = useState<AppUser>({
    email: '',
    name: '',
    role: UserRole.CARGADOR
  });

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      <div className="bg-slate-800 text-white p-6 rounded-2xl mb-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-black flex items-center gap-2 uppercase tracking-tight">
                  <ShieldAlert className="text-orange-400" />
                  Gestión de Accesos
                </h2>
                {dbStatus === 'ok' ? (
                    <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest animate-pulse">
                        <ShieldCheck size={14} />
                        Monitor en Línea
                    </div>
                ) : (
                    <div className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <Database size={14} />
                        Reconectando...
                    </div>
                )}
            </div>
            <p className="text-slate-400 mt-2 text-xs font-bold uppercase tracking-wider">
              Control de personal y auditoría de última conexión.
            </p>
        </div>
        <DatabaseZap className="absolute -right-4 -bottom-4 text-white/5" size={120} />
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter text-sm">
          {isEditing ? <Edit2 size={18} className="text-blue-600" /> : <UserPlus size={18} className="text-orange-600" />}
          {isEditing ? `Modificar Permisos: ${formData.email}` : 'Vincular Nuevo Usuario'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Correo Autorizado</label>
               <div className="relative">
                 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input
                  type="email"
                  required
                  placeholder="ejemplo@gmail.com"
                  className={`w-full pl-10 p-3 border-2 border-slate-100 rounded-xl bg-slate-50 focus:bg-white focus:border-orange-500 outline-none font-bold transition-all ${isEditing ? 'text-slate-400 cursor-not-allowed opacity-50' : ''}`}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})}
                  disabled={isEditing || isSaving}
                 />
               </div>
            </div>

            <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre y Apellido</label>
               <div className="relative">
                 <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input
                  type="text"
                  required
                  placeholder="Ej: Luciana Pedro"
                  className="w-full pl-10 p-3 border-2 border-slate-100 rounded-xl focus:border-orange-500 outline-none font-bold transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                  disabled={isSaving}
                 />
               </div>
            </div>

            <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nivel de Acceso</label>
               <select 
                 className="w-full p-3 border-2 border-slate-100 rounded-xl bg-white focus:border-orange-500 outline-none font-black text-sm transition-all cursor-pointer"
                 value={formData.role}
                 onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                 disabled={isSaving}
               >
                 <option value={UserRole.CARGADOR}>Cargador (Solo Carga)</option>
                 <option value={UserRole.UBICADOR}>Ubicador (Solo Ubicar)</option>
                 <option value={UserRole.ENTREGADOR}>Entregador (Solo Entregar)</option>
                 <option value={UserRole.LOCATOR_DELIVERER}>Entregador + Ubicador</option>
                 <option value={UserRole.OPERATOR}>Operador (Carga, Ubica y Entrega)</option>
                 <option value={UserRole.ADMIN}>Administrador (Acceso Total)</option>
               </select>
            </div>
          </div>

          {error && (
            <div className="animate-fade-in space-y-4 pt-2">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800 text-xs font-bold flex items-start gap-3">
                  <AlertTriangle size={20} className="shrink-0 text-orange-600" />
                  <div>
                      <p className="text-sm mb-1 uppercase tracking-tight">Acción Requerida</p>
                      <p className="font-medium opacity-80">{error}</p>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
                    <div className="flex items-center gap-2 text-emerald-400 font-black mb-4 text-xs tracking-widest uppercase">
                        <Terminal size={18} />
                        SQL de Mantenimiento
                    </div>
                    <div className="space-y-3">
                        <div className="bg-black/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center group">
                            <code className="text-[10px] font-mono text-emerald-500">ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;</code>
                            <button onClick={() => copyToClipboard('app_users')} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all">
                                <Copy size={16} />
                            </button>
                        </div>
                        <div className="bg-black/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center group">
                            <code className="text-[10px] font-mono text-emerald-500">ALTER TABLE orders DISABLE ROW LEVEL SECURITY;</code>
                            <button onClick={() => copyToClipboard('orders')} className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all">
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 justify-center sm:justify-start">
            <button
              type="submit"
              disabled={isSaving}
              className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-2 ${isEditing ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'}`}
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : (isEditing ? <Save size={18} /> : <UserPlus size={18} />)}
              {isEditing ? 'Actualizar Permisos' : 'Confirmar Nuevo Usuario'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="bg-slate-100 text-slate-500 px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List - Monitor Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-12">
         <div className="p-5 border-b bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-black text-slate-700 uppercase tracking-tighter text-sm flex items-center gap-2">
                <Activity size={18} className="text-orange-600" /> Monitor de Actividad
                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] ml-1">{users.length}</span>
            </h3>
            <button onClick={fetchUsers} className="p-2 text-slate-400 hover:text-orange-600 transition-colors">
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-100/50 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="p-5">Personal</th>
                    <th className="p-5">Estado / Actividad</th>
                    <th className="p-5">Nivel</th>
                    <th className="p-5 text-right">Gestión</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {users.map((user) => {
                    const online = isOnline(user.lastActive);
                    return (
                    <tr key={user.email} className="group hover:bg-slate-50 transition-colors">
                      <td className="p-5">
                        <div className="font-black text-slate-800">{user.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                           {online ? (
                               <div className="relative flex h-2 w-2">
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                               </div>
                           ) : (
                               <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                           )}
                           <span className={`text-[10px] font-black uppercase tracking-widest ${online ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {online ? 'En Línea' : 'Desconectado'}
                           </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-400">
                           <Clock size={10} /> {formatLastActive(user.lastActive)}
                        </div>
                      </td>
                      <td className="p-5">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                          user.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          user.role === UserRole.OPERATOR ? 'bg-cyan-50 text-cyan-700 border-cyan-100' :
                          user.role === UserRole.CARGADOR ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          user.role === UserRole.UBICADOR ? 'bg-orange-50 text-orange-700 border-orange-100' :
                          user.role === UserRole.LOCATOR_DELIVERER ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                          'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(user)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                               <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(user.email)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                               <Trash2 size={16} />
                            </button>
                         </div>
                      </td>
                    </tr>
                    );
                  })}
               </tbody>
            </table>
         </div>
      </div>

      {/* DANGER ZONE - ONLY FOR ISAAC */}
      {currentUserSession.email.toLowerCase() === 'isaacgomez78@gmail.com' && (
          <div className="bg-rose-50 border-4 border-rose-100 rounded-3xl p-8 shadow-inner">
              <div className="flex items-center gap-3 text-rose-800 font-black text-xl mb-4 uppercase tracking-tighter">
                  <DatabaseZap size={32} className="text-rose-600" />
                  Mantenimiento Crítico
              </div>
              <p className="text-rose-700 mb-6 text-sm font-bold opacity-80 uppercase tracking-tight">
                  Atención: Esta sección eliminará permanentemente todos los registros de pedidos. No se puede deshacer.
              </p>
              <button 
                onClick={handleWipeDatabase}
                disabled={isSaving}
                className="w-full sm:w-auto bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-rose-700 flex items-center justify-center gap-3 shadow-xl shadow-rose-200 active:scale-95 transition-all"
              >
                 {isSaving ? <Loader2 className="animate-spin" /> : <Trash2 size={24} />}
                 VACIAR BASE DE DATOS COMPLETA
              </button>
          </div>
      )}
    </div>
  );
};
