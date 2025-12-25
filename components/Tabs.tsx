
import React from 'react';
import { ClipboardList, MapPin, PackageCheck, BarChart3, Users } from 'lucide-react';
import { UserRole } from '../types';

interface TabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  userEmail: string;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab, userRole, userEmail }) => {
  const allTabs = [
    { id: 'carga', label: 'Carga', icon: ClipboardList, roles: [UserRole.ADMIN, UserRole.CARGADOR, UserRole.OPERATOR] },
    { id: 'ubicar', label: 'Ubicar', icon: MapPin, roles: [UserRole.ADMIN, UserRole.UBICADOR, UserRole.OPERATOR, UserRole.LOCATOR_DELIVERER] },
    { id: 'entregar', label: 'Entregar', icon: PackageCheck, roles: [UserRole.ADMIN, UserRole.ENTREGADOR, UserRole.OPERATOR, UserRole.LOCATOR_DELIVERER] },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3, roles: [UserRole.ADMIN] },
    { id: 'usuarios', label: 'Usuarios', icon: Users, roles: [] },
  ];

  const visibleTabs = allTabs.filter(tab => {
    if (tab.id === 'usuarios') {
        return userEmail.toLowerCase() === 'isaacgomez78@gmail.com';
    }
    return tab.roles.includes(userRole);
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] sm:relative sm:bottom-auto sm:border-t-0 sm:border-b sm:shadow-none sm:sticky sm:top-0">
      <div className="flex justify-around items-stretch max-w-4xl mx-auto h-16 sm:h-auto pb-safe">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 w-full tab-transition relative ${
                isActive
                  ? 'text-orange-600 sm:border-b-4 sm:border-orange-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-orange-50 sm:bg-transparent' : ''}`}>
                <Icon size={isActive ? 26 : 24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-tighter mt-0.5 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {tab.label}
              </span>
              {/* Indicador visual móvil */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-orange-600 rounded-b-full sm:hidden" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
