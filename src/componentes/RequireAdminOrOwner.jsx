// src/componentes/RequireAdminOrOwner.jsx
// Vista Operación, Fase 4: Configuración es solo para owner/admin. El link ya
// se oculta en el menú, pero esto cierra el acceso directo por URL — un
// Staff que escriba /configuracion a mano cae de vuelta al Menú.
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAccess } from '@/context/AccessContext';

export default function RequireAdminOrOwner({ children }) {
  const { isStaff, loading } = useAccess() || {};
  if (loading) return null;
  if (isStaff) return <Navigate to="/menu" replace />;
  return children;
}
