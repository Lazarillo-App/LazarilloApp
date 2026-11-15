// src/componentes/RequireSeccion.jsx
// Roles a medida: si el rol del negocio activo no ve la sección, vuelve al Inicio.
// Sin rol a medida (dueño, admin completo, staff) no cambia nada.
import React, { useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAccess } from '@/context/AccessContext';

export default function RequireSeccion({ seccion, children }) {
  const { puedeVer, loading } = useAccess() || {};
  // Solo se espera la PRIMERA carga de permisos. Cuando se recargan (guardar en Editar acceso,
  // cambiar de negocio) la página sigue montada: antes se desmontaba y, por ejemplo, se cerraba
  // Editar acceso al guardar (Diego 15/11/2026).
  const listo = useRef(false);
  if (loading && !listo.current) return null;
  listo.current = true;
  const secciones = Array.isArray(seccion) ? seccion : [seccion];
  if (puedeVer && !secciones.some((s) => puedeVer(s))) return <Navigate to="/inicio" replace />;
  return children;
}
