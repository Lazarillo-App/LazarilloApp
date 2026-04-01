// src/context/BranchContext.jsx
/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { BranchesAPI } from '@/servicios/apiBranches';
import { useBusiness } from './BusinessContext';

export const BranchCtx = createContext(null);

// ID especial para la "sucursal principal" (datos sin branch_id)
export const MAIN_BRANCH_ID = 'main';

const branchKey = (bizId) => `activeBranchId_${bizId || 'default'}`;

export function BranchProvider({ children }) {
  const { activeBusinessId, active: activeBiz } = useBusiness() || {};

  const [rawBranches, setRawBranches] = useState([]); // sucursales reales de DB
  const [activeBranchId, setActiveBranchId] = useState(MAIN_BRANCH_ID);
  const [loading, setLoading] = useState(false);

  // Rama virtual del negocio principal (sin branch_id en DB)
  const mainBranch = useMemo(() => ({
    id: MAIN_BRANCH_ID,
    business_id: activeBusinessId,
    name: activeBiz?.name || 'Principal',
    color: activeBiz?.props?.branding?.primary || 'var(--color-primary)',
    address: activeBiz?.props?.address || {},
    contacts: activeBiz?.props?.contact || {},
    isMain: true,   // flag para distinguirla
  }), [activeBusinessId, activeBiz]);

  // Lista completa: principal siempre primero, luego las sucursales reales
  const branches = useMemo(() => {
    if (rawBranches.length === 0) return [];          // sin sucursales reales → no mostrar selector
    return [mainBranch, ...rawBranches];
  }, [mainBranch, rawBranches]);

  const hasBranches = rawBranches.length > 0;         // solo true cuando hay sucursales reales

  const loadBranches = useCallback(async (bizId) => {
    const id = bizId || activeBusinessId;
    if (!id) {
      setRawBranches([]);
      setActiveBranchId(MAIN_BRANCH_ID);
      return;
    }
    setLoading(true);
    try {
      const res  = await BranchesAPI.list(id);
      const list = res?.branches || [];
      setRawBranches(list);

      // Restaurar selección guardada — si no hay, usar principal
      const stored    = localStorage.getItem(branchKey(id));
      if (stored === MAIN_BRANCH_ID) {
        setActiveBranchId(MAIN_BRANCH_ID);
      } else {
        const storedNum = stored ? Number(stored) : null;
        const exists    = storedNum && list.some(b => b.id === storedNum);
        // Default: principal (no "Todas") — esto soluciona el bug de la imagen
        setActiveBranchId(exists ? storedNum : MAIN_BRANCH_ID);
      }
    } catch (e) {
      console.error('[BranchContext] loadBranches:', e);
      setRawBranches([]);
      setActiveBranchId(MAIN_BRANCH_ID);
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId]);

  useEffect(() => { loadBranches(activeBusinessId); }, [activeBusinessId]); // eslint-disable-line

  useEffect(() => {
    const onChanged = () => loadBranches(activeBusinessId);
    window.addEventListener('branch:created', onChanged);
    window.addEventListener('branch:updated', onChanged);
    window.addEventListener('branch:deleted', onChanged);
    return () => {
      window.removeEventListener('branch:created', onChanged);
      window.removeEventListener('branch:updated', onChanged);
      window.removeEventListener('branch:deleted', onChanged);
    };
  }, [activeBusinessId, loadBranches]);

  useEffect(() => {
    const onSwitched = (ev) => {
      const newBizId = ev?.detail?.bizId;
      if (newBizId) loadBranches(newBizId);
    };
    window.addEventListener('business:switched', onSwitched);
    return () => window.removeEventListener('business:switched', onSwitched);
  }, [loadBranches]);

  const setActiveBranch = useCallback((id) => {
    // id puede ser MAIN_BRANCH_ID ('main'), null (todas), o un number (sucursal real)
    const newId = (id === null || id === undefined) ? null
                : id === MAIN_BRANCH_ID ? MAIN_BRANCH_ID
                : Number(id);
    setActiveBranchId(newId);
    if (activeBusinessId) {
      if (newId === null) localStorage.removeItem(branchKey(activeBusinessId));
      else localStorage.setItem(branchKey(activeBusinessId), String(newId));
    }
  }, [activeBusinessId]);

  // activeBranch: null = todas, mainBranch = principal, branch = sucursal real
  const activeBranch = useMemo(() => {
    if (activeBranchId === null) return null;
    if (activeBranchId === MAIN_BRANCH_ID) return mainBranch;
    return rawBranches.find(b => b.id === activeBranchId) || null;
  }, [activeBranchId, rawBranches, mainBranch]);

  // branch_id para usar en queries: null = todas, undefined = sin filtro (principal = sin branch_id)
  // Para filtrar el principal: no enviar branch_id (datos sin sucursal asignada)
  const activeBranchFilter = useMemo(() => {
    if (activeBranchId === null) return { mode: 'all', branchId: null };
    if (activeBranchId === MAIN_BRANCH_ID) return { mode: 'main', branchId: null };
    return { mode: 'branch', branchId: activeBranchId };
  }, [activeBranchId]);

  const value = useMemo(() => ({
    branches,          // [mainBranch, ...realBranches] — solo cuando hay sucursales reales
    rawBranches,       // solo las sucursales reales (sin main virtual)
    activeBranchId,
    activeBranch,
    activeBranchFilter,
    hasBranches,
    loading,
    setActiveBranch,
    loadBranches,
    MAIN_BRANCH_ID,
  }), [
    branches, rawBranches, activeBranchId, activeBranch,
    activeBranchFilter, hasBranches, loading, setActiveBranch, loadBranches,
  ]);

  return <BranchCtx.Provider value={value}>{children}</BranchCtx.Provider>;
}