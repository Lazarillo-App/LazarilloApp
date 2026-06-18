/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useState, useContext } from 'react';
import { me, login as apiLogin, logout as apiLogout } from '../servicios/apiAuth';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] 🚀 Inicializando...');

    (async () => {
      try {
        const token = localStorage.getItem('token');

        if (token) {
          // ✅ OPTIMISTIC RESTORE: Leer user de localStorage INMEDIATAMENTE
          const userStr = localStorage.getItem('user');
          if (userStr) {
            try {
              const cachedUser = JSON.parse(userStr);
              console.log('[AuthContext] ⚡ Restauración optimista:', cachedUser.email);
              setUser(cachedUser); // ✅ Esto hace que isLogged sea true AHORA
            } catch (e) {
              console.warn('[AuthContext] ⚠️ Error parseando user cache:', e);
            }
          }

          // Luego validar con el backend (puede actualizar datos)
          console.log('[AuthContext] 🔄 Validando sesión con backend...');
          const freshUser = await me();
          console.log('[AuthContext] ✅ Sesión validada:', freshUser.email);

          // Actualizar con datos frescos del backend
          setUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser));
        } else {
          console.log('[AuthContext] ⚠️ Sin token, sesión vacía');
        }
      } catch (err) {
        console.error('[AuthContext] ❌ Error validando sesión:', err);
        apiLogout();
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onLogin = async (ev) => {
      try {
        // 1) set inmediato (optimista) desde el evento o localStorage
        const fromEvent = ev?.detail || null;
        if (fromEvent) setUser(fromEvent);
        else {
          const userStr = localStorage.getItem('user');
          if (userStr) setUser(JSON.parse(userStr));
        }

        // 2) validar con backend (si hay token)
        const token = localStorage.getItem('token');
        if (token) {
          const freshUser = await me();
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          }
        }
      } catch (e) {
        console.error('[AuthContext] ❌ Error post-login hydrate:', e);
      }
    };

    const onLogout = () => setUser(null);

    window.addEventListener('auth:login', onLogin);
    window.addEventListener('auth:logout', onLogout);

    return () => {
      window.removeEventListener('auth:login', onLogin);
      window.removeEventListener('auth:logout', onLogout);
    };
  }, []);

  const login = async (email, password) => {
    console.log('[AuthContext] 🔓 Login:', email);
    const u = await apiLogin(email, password);
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u)); // ✅ Guardar user en LS
    window.dispatchEvent(new Event('auth:login'));
    return u;
  };

  const logout = () => {
    console.log('[AuthContext] 🔒 Logout');
    apiLogout();
    setUser(null);
    localStorage.removeItem('user'); 
    localStorage.removeItem('activeBusinessId');
    window.dispatchEvent(new Event('auth:logout'));
  };

  const value = {
    user,
    booting,
    login,
    logout,
    isLogged: !!user,
  };

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  );
}
