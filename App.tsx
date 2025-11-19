import React, { useState, useEffect, useCallback } from 'react';
import { UserSession, Order, UserRole } from './types';
import { AuthScreen } from './components/AuthScreen';
import { Tabs } from './components/Tabs';
import { LoadTab } from './components/LoadTab';
import { LocateTab } from './components/LocateTab';
import { DeliverTab } from './components/DeliverTab';
import { StatsTab } from './components/StatsTab';
import { UserManagementTab } from './components/UserManagementTab';
import { getSession, clearSession, getOrders } from './services/storageService';
import { supabase, isSupabaseConfigured } from './services/client';
import { LogOut, AlertTriangle, Lock } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState('carga');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(false);

  const refreshOrders = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setConfigError(true);
      return;
    }
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (error) {
      console.error("Failed to fetch orders", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check Permissions Helper
  const canAccessTab = (role: UserRole, tabId: string, email: string) => {
     // Special Rule for Users Tab
     if (tabId === 'usuarios') {
         return email.toLowerCase() === 'isaacgomez78@gmail.com';
     }

     if (role === UserRole.ADMIN) return true;
     if (role === UserRole.CARGADOR && tabId === 'carga') return true;
     if (role === UserRole.UBICADOR && tabId === 'ubicar') return true;
     if (role === UserRole.ENTREGADOR && tabId === 'entregar') return true;
     return false;
  };

  const getDefaultTabForRole = (role: UserRole) => {
      switch(role) {
          case UserRole.UBICADOR: return 'ubicar';
          case UserRole.ENTREGADOR: return 'entregar';
          default: return 'carga';
      }
  };

  useEffect(() => {
    // 1. Check local session
    const storedSession = getSession();
    if (storedSession) {
      // Validate if stored session has new Role field (migration check)
      if (!storedSession.role) {
          clearSession(); // Force re-login if old session format
      } else {
          setSession(storedSession);
          setActiveTab(getDefaultTabForRole(storedSession.role));
      }
    }
    
    // 2. Initial Fetch
    refreshOrders();

    // 3. Setup Realtime Subscription
    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('public:orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            console.log('Realtime update received:', payload);
            refreshOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [refreshOrders]);

  const handleLogin = (newSession: UserSession) => {
      setSession(newSession);
      setActiveTab(getDefaultTabForRole(newSession.role));
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  if (configError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-slate-50">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Configuración Faltante</h1>
        <p className="text-slate-600 mt-2 max-w-md">
          No se ha detectado la conexión a la base de datos (Supabase). 
          Por favor edita el archivo <code>services/client.ts</code> con tu URL y KEY del proyecto.
        </p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-bold text-lg leading-none">Sándwich Manager Pro</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></span>
            <div className="text-xs text-slate-400 flex flex-col">
                <span>{session.email}</span>
                <span className="uppercase font-bold text-orange-400 text-[10px]">{session.role}</span>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800">
          <LogOut size={20} />
        </button>
      </header>

      <Tabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={session.role} 
        userEmail={session.email}
      />

      <main className="mt-4 animate-fade-in">
        {activeTab === 'carga' && canAccessTab(session.role, 'carga', session.email) && (
          <LoadTab 
            session={session} 
            onSessionUpdate={setSession} 
            refreshData={refreshOrders}
          />
        )}
        {activeTab === 'ubicar' && canAccessTab(session.role, 'ubicar', session.email) && (
          <LocateTab orders={orders} refreshData={refreshOrders} />
        )}
        {activeTab === 'entregar' && canAccessTab(session.role, 'entregar', session.email) && (
          <DeliverTab orders={orders} refreshData={refreshOrders} />
        )}
        {activeTab === 'estadisticas' && canAccessTab(session.role, 'estadisticas', session.email) && (
          <StatsTab orders={orders} />
        )}
        {activeTab === 'usuarios' && canAccessTab(session.role, 'usuarios', session.email) && (
          <UserManagementTab currentUserSession={session} />
        )}

        {/* Access Denied State */}
        {!canAccessTab(session.role, activeTab, session.email) && (
            <div className="flex flex-col items-center justify-center pt-20 text-slate-400">
                <Lock size={48} className="mb-4" />
                <h2 className="text-xl font-bold">Acceso Restringido</h2>
                <p>Su cuenta no tiene permiso para ver esta sección.</p>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;