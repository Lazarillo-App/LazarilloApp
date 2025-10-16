/* eslint-disable no-empty */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';

// Lee el rol desde localStorage (y opcionalmente desde el JWT)
const isAdmin = () => {
  try {
    const raw = localStorage.getItem('user') || '{}';
    const u = JSON.parse(raw);
    if (u?.role) return u.role === 'app_admin';

    // fallback: decodificar JWT si hiciera falta
    const tok = localStorage.getItem('token') || '';
    if (tok.includes('.')) {
      const [, payload] = tok.split('.');
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return json?.role === 'app_admin';
    }
  } catch {}
  return false;
};

export default function AdminApp() {
  if (!isAdmin()) return <Navigate to="/login" replace />;

  return (
    <AdminLayout>
      <Routes>
        {/* 👇 rutas relativas al prefijo /admin */}
        <Route index element={<AdminDashboard />} />
        <Route path="usuarios" element={<AdminUsers />} />
      </Routes>
    </AdminLayout>
  );
}
