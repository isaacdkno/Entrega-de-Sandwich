
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
    { id: 'usuarios', label: 'Usuarios', icon: Users, roles: [] }, // Special handling for this tab
  ];

  const visibleTabs = allTabs.filter(tab => {
    // Special rule for Users tab: Only Isaac
    if (tab.id === 'usuarios') {
        return userEmail.toLowerCase() === 'isaacgomez78@gmail.com';
    }
    // Standard role check for other tabs
    return tab.roles.includes(userRole);
  });

  return (
    <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
      <div className="flex justify-around max-w-4xl mx-auto">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-3 px-2 w-full transition-colors ${
                isActive
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={24} className="mb-1" />
              <span className="text-xs font-medium hidden sm:block">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
