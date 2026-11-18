import React, { useState } from 'react';
import { UserSession, ProductionBranch, UserRole } from '../types';
import { saveSession, verifyUserRole, registerPendingUser } from '../services/storageService';
import { supabase } from '../services/client';
import { PRODUCTION_BRANCHES } from '../constants';
import { ChefHat, Loader2, LockKeyhole, KeyRound, Eye, EyeOff, User } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (session: UserSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [branch, setBranch] = useState<ProductionBranch>(ProductionBranch.CENTRAL);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isRegisterMode && !fullName.trim()) {
      setError('Ingrese su nombre completo.');
      return;
    }
    
    setIsLoggingIn(true);
    setError(null);
    setInfoMessage(null);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isRegisterMode) {
        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres.');
          setIsLoggingIn(false);
          return;
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: fullName.trim().toUpperCase() }
          }
        });

        if (signUpError) {
          setError(signUpError.message);
          setIsLoggingIn(false);
          return;
        }

        if (signUpData.session) {
          await registerPendingUser(cleanEmail, fullName);
          await supabase.auth.signOut();
          setInfoMessage('Cuenta creada. Pide al administrador que apruebe tu usuario y asigne tus permisos.');
        } else {
          setInfoMessage('Cuenta creada. Si Supabase pide confirmación, revisa tu correo y luego pide al administrador que asigne tus permisos.');
        }

        setIsRegisterMode(false);
        setPassword('');
        setIsLoggingIn(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (authError || !authData.user) {
        setError('Correo o contraseña incorrectos.');
        setIsLoggingIn(false);
        return;
      }

      // Verify role against database
      let role = await verifyUserRole(cleanEmail);

      if (!role) {
        const metaName = (authData.user.user_metadata?.full_name as string) || '';
        await registerPendingUser(cleanEmail, metaName);
        role = UserRole.PENDING;
      }

      if (role === UserRole.PENDING) {
        await supabase.auth.signOut();
        setInfoMessage('Tu cuenta está pendiente de aprobación. Pide al administrador que te asigne un rol.');
        setIsLoggingIn(false);
        return;
      }

      const session: UserSession = {
        email: cleanEmail,
        role,
        currentProductionBranch: branch
      };
      
      saveSession(session);
      onLogin(session);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error de conexión al verificar usuario.');
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

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setIsRegisterMode(false); setError(null); setInfoMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${!isRegisterMode ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsRegisterMode(true); setError(null); setInfoMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${isRegisterMode ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}
          >
            Crear Cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegisterMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  required
                  className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 uppercase"
                  placeholder="JUAN PÉREZ"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoggingIn}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Correo Electrónico
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
              Contraseña
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full pl-10 pr-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoggingIn}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isRegisterMode && (
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
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded border border-amber-200">
              {infoMessage}
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
                {isRegisterMode ? 'Creando cuenta...' : 'Verificando...'}
              </>
            ) : (
              isRegisterMode ? 'Registrarme' : 'Ingresar al Sistema'
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