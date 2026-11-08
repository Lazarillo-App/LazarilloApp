// src/componentes/RequireSeccion.jsx
// Roles a medida: si el rol del negocio activo no ve la sección, vuelve al Inicio.
// Sin rol a medida (dueño, admin completo, staff) no cambia nada.
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAccess } from '@/context/AccessContext';

export default function RequireSeccion({ seccion, children }) {
  const { puedeVer, loading } = useAccess() || {};
  if (loading) return null;
  const secciones = Array.isArray(seccion) ? seccion : [seccion];
  if (puedeVer && !secciones.some((s) => puedeVer(s))) return <Navigate to="/inicio" replace />;
  return children;
}
