// src/componentes/RequireAdminOrOwner.jsx
// Vista Operación, Fase 4: Configuración es solo para owner/admin. El link ya
// se oculta en el menú, pero esto cierra el acceso directo por URL — un
// Staff que escriba /configuracion a mano cae de vuelta al Menú.
import React, { useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAccess } from '@/context/AccessContext';

export default function RequireAdminOrOwner({ children }) {
  const { isStaff, loading } = useAccess() || {};
  // Solo se espera la PRIMERA carga de permisos. Cuando se recargan (guardar en Editar acceso,
  // cambiar de negocio) la página sigue montada: antes se desmontaba y, por ejemplo, se cerraba
  // Editar acceso al guardar (Diego 15/11/2026).
  const listo = useRef(false);
  if (loading && !listo.current) return null;
  listo.current = true;
  if (isStaff) return <Navigate to="/menu" replace />;
  return children;
}
