import React, { createContext, useEffect, useState, useContext } from 'react';
import { me, login as apiLogin, logout as apiLogout } from '../servicios/apiAuth';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem('token')) {
          const u = await me();
          setUser(u);
        }
      } catch {
        apiLogout();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, booting, login, logout, isLogged: !!user }}>
      {children}
    </AuthCtx.Provider>
  );
}
