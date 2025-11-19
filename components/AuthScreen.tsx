import React, { useState } from 'react';
import { UserSession, ProductionBranch } from '../types';
import { saveSession, verifyUserRole } from '../services/storageService';
import { PRODUCTION_BRANCHES } from '../constants';
import { ChefHat, Loader2, LockKeyhole } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (session: UserSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [branch, setBranch] = useState<ProductionBranch>(ProductionBranch.CENTRAL);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoggingIn(true);
    setError(null);

    try {
      // Verify role against database
      const role = await verifyUserRole(email);

      if (!role) {
        setError('Acceso denegado: El correo no está registrado en el sistema.');
        setIsLoggingIn(false);
        return;
      }

      const session: UserSession = {
        email,
        role,
        currentProductionBranch: branch
      };
      
      saveSession(session);
      onLogin(session);
    } catch (err) {
      console.error(err);
      setError('Error de conexión al verificar usuario.');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ChefHat className="text-orange-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Sándwich Manager</h1>
          <p className="text-slate-500">Sistema de Gestión de Pedidos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Correo Electrónico Autorizado
            </label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoggingIn}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sucursal de Trabajo (Fabrica)
            </label>
            <select
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={branch}
              onChange={(e) => setBranch(e.target.value as ProductionBranch)}
              disabled={isLoggingIn}
            >
              {PRODUCTION_BRANCHES.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Esto determinará el origen de las comandas que cargue.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Verificando...
              </>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center">
           <p className="text-xs text-slate-400">
             Solo personal autorizado. Si no tiene cuenta, contacte al Administrador.
           </p>
        </div>
      </div>
    </div>
  );
};