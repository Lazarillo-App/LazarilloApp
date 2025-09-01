import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth() {
  const { isLogged, booting } = useAuth();
  const loc = useLocation();
  if (booting) return <div style={{padding:20}}>Cargando…</div>;
  if (!isLogged) return <Navigate to="/login" replace state={{ from: loc }} />;
  return <Outlet />;
}
