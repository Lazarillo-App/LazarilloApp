import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute() {
  const token = localStorage.getItem('token') || '';
  const loc = useLocation();

  if (!token) {
    // nunca devolver null: redireccioná
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return <Outlet />;
}
