// src/routing/RequireActiveAccount.jsx
import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ACTIVE_STATUSES = ['active', 'trial'];

export default function RequireActiveAccount() {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return null;

  // app_admin pasa siempre
  if (user?.role === 'app_admin') return <Outlet />;

  const status = user?.account_status;

  // Sin status (usuario viejo) → dejar pasar
  if (!status) return <Outlet />;

  if (ACTIVE_STATUSES.includes(status)) return <Outlet />;

  // pending | expired | suspended → redirigir a /activar
  return <Navigate to="/activar" state={{ from: location }} replace />;
}