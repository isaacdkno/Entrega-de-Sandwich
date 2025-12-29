
import React, { useState, useEffect, useCallback } from 'react';
import { UserSession, Order, UserRole } from './types';
import { AuthScreen } from './components/AuthScreen';
import { Tabs } from './components/Tabs';
import { LoadTab } from './components/LoadTab';
import { LocateTab } from './components/LocateTab';
import { DeliverTab } from './components/DeliverTab';
import { StatsTab } from './components/StatsTab';
import { UserManagementTab } from './components/UserManagementTab';
import { getSession, clearSession, getOrders, updateUserActivity } from './services/storageService';
import { supabase, isSupabaseConfigured } from './services/client';
import { PICKUP_DATES } from './constants';
import { LogOut, AlertTriangle, Lock, WifiOff, Menu, Calendar } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState('carga');
  const [globalDate, setGlobalDate] = useState(PICKUP_DATES[0]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const refreshOrders = useCallback(async (dateOverride?: string) => {
    if (!isSupabaseConfigured()) {
      setConfigError(true);
      return;
    }
    setLoading(true);
    try {
      // Pedimos al servidor solo los pedidos de la fecha seleccionada
      // Esto soluciona el límite de 1000 registros y acelera la app
      const data = await getOrders(dateOverride || globalDate);
      setOrders(data);
    } catch (error) {
      console.error("Failed to fetch orders", error);
    } finally {
      setLoading(false);
    }
  }, [globalDate]);

  const handleDateChange = (newDate: string) => {
    setGlobalDate(newDate);
    refreshOrders(newDate);
  };

  const canAccessTab = (role: UserRole, tabId: string, email: string) => {
     if (tabId === 'usuarios') return email.toLowerCase() === 'isaacgomez78@gmail.com';
     if (role === UserRole.ADMIN) return true;
     if (role === UserRole.OPERATOR && ['carga', 'ubicar', 'entregar'].includes(tabId)) return true;
     if (role === UserRole.CARGADOR && tabId === 'carga') return true;
     if (role === UserRole.UBICADOR && tabId === 'ubicar') return true;
     if (role === UserRole.ENTREGADOR && tabId === 'entregar') return true;
     if (role === UserRole.LOCATOR_DELIVERER && ['ubicar', 'entregar'].includes(tabId)) return true;
     return false;
  };

  const getDefaultTabForRole = (role: UserRole) => {
      switch(role) {
          case UserRole.UBICADOR: return 'ubicar';
          case UserRole.ENTREGADOR: return 'entregar';
          case UserRole.LOCATOR_DELIVERER: return 'ubicar';
          default: return 'carga';
      }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (session?.email) {
      updateUserActivity(session.email);
      const interval = setInterval(() => {
        updateUserActivity(session.email);
      }, 300000); 
      return () => clearInterval(interval);
    }
  }, [session?.email]);

  useEffect(() => {
    const storedSession = getSession();
    if (storedSession) {
      if (!storedSession.role) clearSession();
      else {
          setSession(storedSession);
          setActiveTab(getDefaultTabForRole(storedSession.role));
      }
    }
    refreshOrders();
    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refreshOrders())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [refreshOrders]);

  if (configError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-slate-50">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Configuración Faltante</h1>
        <p className="text-slate-600 mt-2 max-w-md">No se detectó la conexión a Supabase.</p>
      </div>
    );
  }

  if (!session) return <AuthScreen onLogin={setSession} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!isOnline && (
        <div className="bg-red-600 text-white p-2 text-center text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-[60] shadow-md">
            <WifiOff size={16} /> SIN CONEXIÓN - Los cambios podrían no guardarse.
        </div>
      )}

      <header className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center shadow-md sticky top-0 z-[55] sm:relative">
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 p-1.5 rounded-lg">
             <Menu size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-black text-sm sm:text-lg tracking-tight leading-none">SÁNDWICH PRO</h1>
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">{session.role}</p>
          </div>
        </div>

        {/* Selector de Fecha Global - Maestro */}
        <div className="flex items-center bg-slate-800 rounded-xl px-3 py-1.5 border border-slate-700">
          <Calendar size={14} className="text-orange-500 mr-2" />
          <select 
            value={globalDate} 
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-transparent text-[11px] font-black uppercase outline-none text-white cursor-pointer"
          >
            {PICKUP_DATES.map(d => <option key={d} value={d} className="bg-slate-800">{d}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
                <p className="text-xs font-bold text-slate-300">{session.email}</p>
            </div>
            <button onClick={handleLogout} className="bg-slate-800 p-2 rounded-xl text-slate-400 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <Tabs 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          userRole={session.role} 
          userEmail={session.email}
        />

        <main className="flex-1 overflow-x-hidden pt-4 pb-24 sm:pb-8 container mx-auto px-4 max-w-6xl">
          {activeTab === 'carga' && canAccessTab(session.role, 'carga', session.email) && (
            <LoadTab session={session} onSessionUpdate={setSession} refreshData={refreshOrders} />
          )}
          {activeTab === 'ubicar' && canAccessTab(session.role, 'ubicar', session.email) && (
            <LocateTab orders={orders} refreshData={refreshOrders} selectedDate={globalDate} />
          )}
          {activeTab === 'entregar' && canAccessTab(session.role, 'entregar', session.email) && (
            <DeliverTab orders={orders} refreshData={refreshOrders} selectedDate={globalDate} />
          )}
          {activeTab === 'estadisticas' && canAccessTab(session.role, 'estadisticas', session.email) && (
            <StatsTab orders={orders} selectedDate={globalDate} />
          )}
          {activeTab === 'usuarios' && canAccessTab(session.role, 'usuarios', session.email) && (
            <UserManagementTab currentUserSession={session} />
          )}

          {!canAccessTab(session.role, activeTab, session.email) && (
              <div className="flex flex-col items-center justify-center pt-20 text-slate-400">
                  <Lock size={64} className="mb-4 opacity-20" />
                  <h2 className="text-xl font-bold">Acceso Restringido</h2>
                  <p className="text-sm">Consulte con el administrador por permisos.</p>
              </div>
          )}
        </main>
      </div>
    </div>
  );

  function handleLogout() {
    clearSession();
    setSession(null);
  }
};

export default App;
