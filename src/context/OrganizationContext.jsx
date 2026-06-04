/* eslint-disable react-refresh/only-export-components */
// src/context/OrganizationContext.jsx (CORREGIDO según feedback PDF)
//
// Cambios críticos:
// 1. NO hay parent_id (todos los businesses son hermanos)
// 2. Cada business puede tener maxi_codcli_override
// 3. "Sin Agrupación" temporal en sub-negocios (no confundir con la global)

import React, {
  createContext, useCallback, useContext,
  useEffect, useMemo, useRef, useState,
} from 'react';

import { useBusiness } from './BusinessContext';
import { useAuth } from './AuthContext';
import {
  getMyOrganization,
  createOrganization,
  updateOrganization,
  createBusinessFromGroup,
} from '@/servicios/apiOrganizations';

const OrgCtx = createContext(null);

export const useOrganization = () => useContext(OrgCtx);

export function OrganizationProvider({ children }) {
  const { isLogged, booting } = useAuth();
  const { activeId, activeBusinessId, refetchBusinesses, items: bizItems } = useBusiness() || {};

  const [organization, setOrganization] = useState(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState(null);

  // Para evitar fetch duplicado cuando cambia activeId
  const lastFetchedBizId = useRef(null);

  /* ─────────────────────────────────────────────────
     FETCH organización
  ───────────────────────────────────────────────── */
  const refetchOrg = useCallback(async () => {
    if (!isLogged) return;
    const currentBizId = Number(activeId || activeBusinessId);
    if (!currentBizId) return;

    setOrgLoading(true);
    setOrgError(null);
    try {
      const org = await getMyOrganization();

      if (org?.businesses?.length > 0) {
        const orgBizIds = new Set(org.businesses.map(b => Number(b.id)));
        if (!orgBizIds.has(currentBizId)) {
          setOrganization(null);
          return;
        }
      }

      setOrganization(org);
    } catch (e) {
      setOrgError(e?.message || 'error_loading_org');
    } finally {
      setOrgLoading(false);
    }
  }, [isLogged, activeId, activeBusinessId]);

  // Cargar al montar y cuando cambia negocio activo
  useEffect(() => {
    if (booting || !isLogged) return;
    lastFetchedBizId.current = null;
    refetchOrg();
  }, [booting, isLogged, activeId, refetchOrg]);

  // Limpiar al logout
  useEffect(() => {
    const onLogout = () => {
      setOrganization(null);
      setOrgError(null);
      lastFetchedBizId.current = null;
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  // Recargar cuando cambia el negocio activo, se crea o se borra uno
  useEffect(() => {
    const onRefresh = () => {
      lastFetchedBizId.current = null;
      refetchOrg();
    };
    window.addEventListener('business:switched', onRefresh);
    window.addEventListener('business:deleted', onRefresh);
    window.addEventListener('business:created', onRefresh);
    return () => {
      window.removeEventListener('business:switched', onRefresh);
      window.removeEventListener('business:deleted', onRefresh);
      window.removeEventListener('business:created', onRefresh);
    };
  }, [refetchOrg]);

  /* ─────────────────────────────────────────────────
     ONBOARDING: crear organización
  ───────────────────────────────────────────────── */
  const createOrg = useCallback(async (name, maxiCodCli) => {
    const bizId = activeId || activeBusinessId;
    if (!bizId) throw new Error('No hay negocio activo');
    if (!name?.trim()) throw new Error('El nombre es requerido');

    const org = await createOrganization({
      name: name.trim(),
      businessId: Number(bizId),
      maxiCodCli: maxiCodCli?.trim() || null,
    });

    setOrganization(org);
    console.log('[OrganizationContext] ✅ Org creada:', org?.name);
    return org;
  }, [activeId, activeBusinessId]);

  /* ─────────────────────────────────────────────────
     Editar organización
  ───────────────────────────────────────────────── */
  const updateOrg = useCallback(async (name, displayName, maxiCodCli) => {
    if (!organization?.id) throw new Error('No hay organización');
    if (!name?.trim()) throw new Error('El nombre es requerido');

    const updated = await updateOrganization(organization.id, {
      name: name.trim(),
      displayName: displayName?.trim() || null,
      maxiCodCli: maxiCodCli?.trim() || null,
    });

    setOrganization(prev => prev ? { ...prev, ...updated } : updated);
    console.log('[OrganizationContext] ✅ Org actualizada:', updated?.name);
    return updated;
  }, [organization?.id]);

  /* ─────────────────────────────────────────────────
     Crear sub-negocio desde agrupación
     
     IMPORTANTE: maxiCodCli ahora es maxiCodCliOverride
     (código propio del sub-negocio, no de la org)
  ───────────────────────────────────────────────── */
  const createSubBusiness = useCallback(async ({
    sourceGroupId,
    name,
    colorHex,
    maxiCodCli,
    branding,
    contact,
    description,
    address,
    social,
    organizationId, // override para cuando se acaba de crear la org y el estado aún no se propagó
  }) => {
    // organizationId puede pasarse directamente como override (cuando se acaba de crear
    // la org y el estado de React aún no se actualizó en este closure)
    const resolvedOrgId = organizationId || organization?.id;
    if (!resolvedOrgId) throw new Error('No hay organización');
    if (!sourceGroupId) throw new Error('sourceGroupId es requerido');
    if (!name?.trim()) throw new Error('El nombre es requerido');

    const newBiz = await createBusinessFromGroup(resolvedOrgId, {
      sourceGroupId,
      name: name.trim(),
      colorHex: colorHex || branding?.primary || null,
      maxiCodCliOverride: maxiCodCli?.trim() || null,
      branding,
      contact,
      description,
      address,
      social,
    });

    // Recargar org para que aparezca el nuevo sub-negocio
    lastFetchedBizId.current = null;
    await refetchOrg();

    // Recargar lista de negocios en BusinessContext
    if (typeof refetchBusinesses === 'function') {
      await refetchBusinesses();
    }

    console.log('[OrganizationContext] ✅ Sub-negocio creado:', newBiz?.name);
    return newBiz;
  }, [organization?.id, refetchOrg, refetchBusinesses]);

  /* ─────────────────────────────────────────────────
     Helpers derivados (SIN parent_id, todos hermanos)
  ───────────────────────────────────────────────── */

  // TODOS los businesses son hermanos, no hay parent_id
  // DESPUÉS
  const allBusinesses = useMemo(() => {
    // Con org: solo los negocios de ESA org
    if (organization?.businesses?.length > 0) return organization.businesses;

    // Sin org (negocio independiente): solo el negocio activo
    const activoNum = Number(activeId || activeBusinessId);
    const lista = Array.isArray(bizItems) ? bizItems : [];
    const activo = lista.find(b => Number(b.id) === activoNum);
    return activo ? [activo] : [];
  }, [organization, bizItems, activeId, activeBusinessId]);

  const subBusinesses = allBusinesses;

  const rootBusiness = useMemo(() => {
    if (allBusinesses.length === 0) return null;
    return allBusinesses.slice().sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    )[0] || null;
  }, [allBusinesses]);

  const hasSubBusinesses = allBusinesses.length > 1;

  /* ─────────────────────────────────────────────────
     Value
  ───────────────────────────────────────────────── */
  const value = useMemo(() => ({
    organization,
    orgLoading,
    orgError,
    refetchOrg,
    createOrg,
    updateOrg,
    createSubBusiness,

    // Helpers
    allBusinesses,      // ✅ TODOS los negocios (sin distinción de padre/hijo)
    subBusinesses,      // alias de allBusinesses para compat
    rootBusiness,       // el más antiguo (solo convención)
    hasSubBusinesses,   // si hay más de 1 negocio
  }), [
    organization,
    orgLoading,
    orgError,
    refetchOrg,
    createOrg,
    updateOrg,
    createSubBusiness,
    allBusinesses,
    subBusinesses,
    rootBusiness,
    hasSubBusinesses,
  ]);

  return (
    <OrgCtx.Provider value={value}>
      {children}
    </OrgCtx.Provider>
  );
}