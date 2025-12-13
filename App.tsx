
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
import { LogOut, AlertTriangle, Lock, WifiOff, Wifi } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState('carga');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(false);
  
  // Network Status State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
     
     // Operator Permissions (All operational tabs)
     if (role === UserRole.OPERATOR && ['carga', 'ubicar', 'entregar'].includes(tabId)) return true;

     // Specific Role Permissions
     if (role === UserRole.CARGADOR && tabId === 'carga') return true;
     if (role === UserRole.UBICADOR && tabId === 'ubicar') return true;
     if (role === UserRole.ENTREGADOR && tabId === 'entregar') return true;
     
     // New Hybrid Role
     if (role === UserRole.LOCATOR_DELIVERER && ['ubicar', 'entregar'].includes(tabId)) return true;
     
     return false;
  };

  const getDefaultTabForRole = (role: UserRole) => {
      switch(role) {
          case UserRole.UBICADOR: return 'ubicar';
          case UserRole.ENTREGADOR: return 'entregar';
          case UserRole.LOCATOR_DELIVERER: return 'ubicar'; // Defaults to Locate
          // Admin, Cargador, and Operator default to 'carga'
          default: return 'carga';
      }
  };

  // Network Monitor Effect
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
    return (
        <>
            {!isOnline && (
                <div className="bg-red-600 text-white p-3 text-center font-bold flex items-center justify-center gap-2 fixed top-0 w-full z-50 shadow-md">
                    <WifiOff size={20} />
                    SIN CONEXIÓN A INTERNET - Verifique su red
                </div>
            )}
            <AuthScreen onLogin={handleLogin} />
        </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Offline Warning Banner */}
      {!isOnline && (
        <div className="bg-red-600 text-white p-2 text-center text-sm font-bold flex items-center justify-center gap-2 animate-pulse sticky top-0 z-50 shadow-md">
            <WifiOff size={18} />
            ⚠️ SIN CONEXIÓN - No intente guardar o entregar pedidos hasta que vuelva la red.
        </div>
      )}
      {isOnline && (
         // Optional: Brief Green flash or just hidden
         null
      )}

      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md relative">
        <div>
          <h1 className="font-bold text-lg leading-none">Sándwich Manager Pro</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : isOnline ? 'bg-green-400' : 'bg-red-500'}`}></span>
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

      <main className={`mt-4 animate-fade-in ${!isOnline ? 'opacity-80 pointer-events-none blur-[1px]' : ''}`}>
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
