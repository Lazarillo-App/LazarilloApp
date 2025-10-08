import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';

// Asume que tu guard ya mete req.user.role en el token; acá leemos localStorage
const isAdmin = () => {
  try {
    const raw = localStorage.getItem('user') || '{}';
    const u = JSON.parse(raw);
    return u?.role === 'admin';
  } catch { return false; }
};

export default function AdminApp() {
  if (!isAdmin()) return <Navigate to="/login" replace />;

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/usuarios" element={<AdminUsers />} />
      </Routes>
    </AdminLayout>
  );
}
