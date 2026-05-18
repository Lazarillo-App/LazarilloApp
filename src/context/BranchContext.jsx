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
  const [activeBranchId, setActiveBranchId] = useState(null); // null = Todas
  const [loading, setLoading] = useState(false);

  // Rama virtual del negocio principal.
  // Usa los datos de la branch is_main si existe.
  // Si no existe aún, muestra datos mínimos SIN leer del negocio
  // para que editar el negocio no impacte en la card de la sucursal.
  const mainBranch = useMemo(() => {
    const stored = rawBranches.find(b => b.props?.is_main === true);
    if (stored) {
      return {
        ...stored,
        id: MAIN_BRANCH_ID,
        isMain: true,
      };
    }
    // Sin branch is_main aún — datos mínimos, sin leer del negocio
    return {
      id: MAIN_BRANCH_ID,
      business_id: activeBusinessId,
      name: activeBiz?.name || 'Principal',
      color: activeBiz?.props?.branding?.primary || 'var(--color-primary)',
      address: {},
      contacts: {},
      isMain: true,
      _sinDatosGuardados: true, // flag para que la card muestre "sin datos"
    };
  }, [activeBusinessId, activeBiz?.name, activeBiz?.props?.branding?.primary, rawBranches]);

  // Lista completa: principal siempre primero, luego las sucursales reales.
  // Excluir la branch is_main de rawBranches ya que la mostramos como mainBranch.
  const branches = useMemo(() => {
    const sinMain = rawBranches.filter(b => !b.props?.is_main);
    return [mainBranch, ...sinMain];
  }, [mainBranch, rawBranches]);

  // ✅ CAMBIO: hasBranches siempre true para que el selector aparezca siempre.
  const hasBranches = true;

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

      // Restaurar selección guardada — si no hay, usar Todas (null)
      const stored = localStorage.getItem(branchKey(id));
      if (!stored || stored === 'null') {
        setActiveBranchId(null); // Todas
      } else if (stored === MAIN_BRANCH_ID) {
        setActiveBranchId(MAIN_BRANCH_ID);
      } else {
        const storedNum = Number(stored);
        const exists    = storedNum && list.some(b => b.id === storedNum);
        setActiveBranchId(exists ? storedNum : null); // fallback → Todas
      }
    } catch (e) {
      console.error('[BranchContext] loadBranches:', e);
      setRawBranches([]);
      setActiveBranchId(null); // fallback → Todas
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
    const newId = (id === null || id === undefined) ? null
                : id === MAIN_BRANCH_ID ? MAIN_BRANCH_ID
                : Number(id);
    setActiveBranchId(newId);
    if (activeBusinessId) {
      if (newId === null) localStorage.removeItem(branchKey(activeBusinessId));
      else localStorage.setItem(branchKey(activeBusinessId), String(newId));
    }
  }, [activeBusinessId]);

  const activeBranch = useMemo(() => {
    if (activeBranchId === null) return null;
    if (activeBranchId === MAIN_BRANCH_ID) return mainBranch;
    return rawBranches.find(b => Number(b.id) === Number(activeBranchId)) || null;
  }, [activeBranchId, rawBranches, mainBranch]);

  const activeBranchFilter = useMemo(() => {
    if (activeBranchId === null) return { mode: 'all', branchId: null };
    if (activeBranchId === MAIN_BRANCH_ID) return { mode: 'main', branchId: null };
    return { mode: 'branch', branchId: activeBranchId };
  }, [activeBranchId]);

  const value = useMemo(() => ({
    branches,
    rawBranches,
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