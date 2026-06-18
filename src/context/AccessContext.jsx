/* eslint-disable no-empty */
/* eslint-disable react-refresh/only-export-components */
// src/context/AccessContext.jsx
//
// Provee al frontend la lista de negocios accesibles y el rol efectivo
// del usuario en cada uno. Reemplaza la lectura de `user.role` legacy.
//
// Uso típico:
//   const { businessesAccessibles, currentRole, canDo } = useAccess();
//   if (canDo('manage_team')) { ... }

import React, {
  createContext, useCallback, useContext,
  useEffect, useMemo, useState,
} from 'react';

import { useAuth } from './AuthContext';
import { useBusiness } from './BusinessContext';
import { MeAPI } from '../servicios/apiMe';

const AccessCtx = createContext(null);
export const useAccess = () => useContext(AccessCtx);

// Matriz mínima de permisos por rol. Se puede expandir sin tocar el resto del front.
const PERMISSIONS = {
  owner: new Set([
    'manage_team', 'invite_admin', 'invite_staff',
    'create_business', 'update_organization', 'delete_business',
    'manage_articles', 'manage_insumos', 'manage_recetas', 'manage_agrupaciones',
    'manage_listas', 'view_sales', 'view_purchases', 'view_audit',
    'manage_branches', 'manage_settings',
  ]),
  admin: new Set([
    'manage_team', 'invite_staff',                       // NO invite_admin
    'manage_articles', 'manage_insumos', 'manage_recetas', 'manage_agrupaciones',
    'manage_listas', 'view_sales', 'view_purchases', 'view_audit',
    'manage_branches', 'manage_settings',
  ]),
  staff: new Set([
    'view_sales', 'view_purchases',
    'manage_articles', 'manage_insumos',  // configurable, por ahora amplio
  ]),
};

export function AccessProvider({ children }) {
  const { isLogged, booting } = useAuth();
  const { activeId, activeBusinessId } = useBusiness() || {};

  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  // Carga inicial de /me/access
  const refetch = useCallback(async () => {
    if (!isLogged) { setData(null); return; }
    setLoading(true); setError(null);
    try {
      const res = await MeAPI.getAccess();
      setData(res || null);
    } catch (e) {
      console.error('[AccessContext] error:', e);
      setError(e?.message || 'error_loading_access');
    } finally {
      setLoading(false);
    }
  }, [isLogged]);

  useEffect(() => {
    if (booting) return;
    refetch();
  }, [booting, isLogged, refetch]);

  // Refrescar cuando cambia el negocio activo o pasan eventos relevantes
  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener('business:switched', onRefresh);
    window.addEventListener('business:created',  onRefresh);
    window.addEventListener('business:deleted',  onRefresh);
    window.addEventListener('team:changed',      onRefresh);
    return () => {
      window.removeEventListener('business:switched', onRefresh);
      window.removeEventListener('business:created',  onRefresh);
      window.removeEventListener('business:deleted',  onRefresh);
      window.removeEventListener('team:changed',      onRefresh);
    };
  }, [refetch]);

  // Limpiar al logout
  useEffect(() => {
    const onLogout = () => setData(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  // ─── derivados ───
  const businesses = data?.businesses || [];
  const currentBizId = Number(activeId || activeBusinessId || data?.active_business_id || 0);

  const currentBusiness = useMemo(
    () => businesses.find(b => Number(b.id) === currentBizId) || null,
    [businesses, currentBizId]
  );

  const currentRole = currentBusiness?.role || null;     // 'owner' | 'admin' | 'staff' | null
  const currentAlias = currentBusiness?.alias || null;

  const canDo = useCallback((permission) => {
    const set = PERMISSIONS[currentRole];
    if (!set) return false;
    return set.has(permission);
  }, [currentRole]);

  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin';
  const isStaff = currentRole === 'staff';

  // Setear negocio activo en backend + disparar evento
  const switchToBusiness = useCallback(async (bizId) => {
    await MeAPI.setActiveBusiness(Number(bizId));
    try {
      window.dispatchEvent(new CustomEvent('business:switched', { detail: { id: Number(bizId) } }));
    } catch {}
    return bizId;
  }, []);

  const value = useMemo(() => ({
    loading,
    error,
    refetch,
    user: data?.user || null,
    businesses,
    organizations: data?.organizations || [],
    activeBusinessId: data?.active_business_id ?? null,
    suggestedActiveBusinessId: data?.suggested_active_business_id ?? null,
    needsSelector: !!data?.needs_selector,
    currentBusiness,
    currentRole,
    currentAlias,
    canDo,
    isOwner,
    isAdmin,
    isStaff,
    switchToBusiness,
  }), [
    loading, error, refetch, data,
    businesses, currentBusiness, currentRole, currentAlias,
    canDo, isOwner, isAdmin, isStaff, switchToBusiness,
  ]);

  return <AccessCtx.Provider value={value}>{children}</AccessCtx.Provider>;
}