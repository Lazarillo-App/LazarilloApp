/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback
} from 'react';

import { BusinessesAPI } from '../servicios/apiBusinesses';
import { useAuth } from './AuthContext';
import * as apiDivisions from '../servicios/apiDivisions';
import { setActiveBusiness as setActiveBusinessSvc } from '../servicios/setActiveBusiness';
import {
  getActiveDivisionId as getActiveDivisionIdLS,
  setActiveDivisionId as setActiveDivisionIdLS,
  clearActiveDivisionId as clearActiveDivisionIdLS,
} from '@/servicios/activeDivision';

const BizCtx = createContext(null);
export const useBusiness = () => useContext(BizCtx);

export function useActiveBusiness() {
  const bizCtx = useBusiness();
  const active = bizCtx?.active || null;
  const activeIdFromCtx = bizCtx?.activeId || '';
  const activeIdFromStorage = localStorage.getItem('activeBusinessId') || '';
  const businessId = active?.id || activeIdFromCtx || activeIdFromStorage || '';
  return { businessId, business: active };
}

export function BusinessProvider({ children }) {
  const { isLogged, booting } = useAuth();

  // Negocios
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [loading, setLoading] = useState(false);

  // Divisiones
  const [divisions, setDivisions] = useState([]);
  const [activeDivisionId, setActiveDivisionIdState] = useState(null);

  // Artículos: legacy groups (business_groups)
  const [activeDivisionGroupIds, setActiveDivisionGroupIds] = useState([]);
  const [assignedGroupIds, setAssignedGroupIds] = useState([]);

  // Artículos: agrupaciones
  const [activeDivisionAgrupacionIds, setActiveDivisionAgrupacionIds] = useState([]);
  const [assignedAgrupacionIds, setAssignedAgrupacionIds] = useState([]);

  // ✅ NUEVO: Insumos groups (insumo_groups)
  const [activeDivisionInsumoGroupIds, setActiveDivisionInsumoGroupIds] = useState([]);
  const [assignedInsumoGroupIds, setAssignedInsumoGroupIds] = useState([]);

  const [divisionsLoading, setDivisionsLoading] = useState(false);

  const pickInsumoGroupList = (res) => {
    return (
      res?.groups ??
      res?.insumo_groups ??
      res?.insumoGroups ??
      res?.content?.groups ??
      res?.content?.insumo_groups ??
      res?.content?.insumoGroups ??
      res?.items ??
      res?.data ??
      []
    );
  };

  /* ===========================
   *  LOADERS: ARTÍCULOS (legacy)
   * =========================== */
  const loadDivisionGroups = useCallback(async (divisionId) => {
    if (!divisionId) {
      setActiveDivisionGroupIds([]);
      return;
    }
    try {
      console.log('[BusinessContext] 📦 Cargando grupos (ARTÍCULOS) para división:', divisionId);

      const result = await apiDivisions.getGroupsByDivision(divisionId, activeId);
      const groupIds = result?.groups?.map(g => Number(g.id)).filter(Boolean) || [];

      console.log('[BusinessContext] ✅ activeDivisionGroupIds:', groupIds);
      setActiveDivisionGroupIds(groupIds);
    } catch (error) {
      console.error('[BusinessContext] ❌ Error cargando grupos (ARTÍCULOS):', error);
      setActiveDivisionGroupIds([]);
    }
  }, [activeId]);

  const loadAssignedGroupIds = useCallback(async (divisionsList) => {
    try {
      console.log('[BusinessContext] 📦 Cargando assignedGroupIds (ARTÍCULOS)...');

      const union = new Set();
      for (const d of divisionsList || []) {
        if (d.is_main) continue;

        const res = await apiDivisions.getGroupsByDivision(d.id, activeId);
        (res?.groups || []).forEach(g => {
          const n = Number(g.id);
          if (Number.isFinite(n) && n > 0) union.add(n);
        });
      }

      const finalIds = Array.from(union);
      console.log('[BusinessContext] ✅ assignedGroupIds:', finalIds);
      setAssignedGroupIds(finalIds);
    } catch (e) {
      console.error('[BusinessContext] ❌ Error cargando assignedGroupIds (ARTÍCULOS):', e);
      setAssignedGroupIds([]);
    }
  }, [activeId]);

  /* ===========================
   *  LOADERS: AGRUPACIONES (ARTÍCULOS)
   * =========================== */
  const loadDivisionAgrupaciones = useCallback(async (divisionId) => {
    if (!divisionId) {
      setActiveDivisionAgrupacionIds([]);
      return;
    }

    try {
      console.log('[BusinessContext] 📦 Cargando AGRUPACIONES (ARTÍCULOS) para división:', divisionId);

      const result = await apiDivisions.getAgrupacionesByDivision(divisionId, activeId);
      const ids = (result?.agrupaciones || [])
        .map(a => Number(a.id ?? a.agrupacion_id))
        .filter(n => Number.isFinite(n) && n > 0);

      console.log('[BusinessContext] ✅ activeDivisionAgrupacionIds:', ids);
      setActiveDivisionAgrupacionIds(ids);
    } catch (e) {
      console.error('[BusinessContext] ❌ Error cargando agrupaciones (ARTÍCULOS) de división:', e);
      setActiveDivisionAgrupacionIds([]);
    }
  }, [activeId]);

  const loadAssignedAgrupacionIds = useCallback(async (divisionsList) => {
    try {
      console.log('[BusinessContext] 📦 Cargando assignedAgrupacionIds (ARTÍCULOS)...');

      const union = new Set();

      for (const d of divisionsList || []) {
        if (d.is_main) continue;

        const res = await apiDivisions.getAgrupacionesByDivision(d.id, activeId);
        (res?.agrupaciones || []).forEach(a => {
          const n = Number(a.id ?? a.agrupacion_id);
          if (Number.isFinite(n) && n > 0) union.add(n);
        });
      }

      const finalIds = Array.from(union);
      console.log('[BusinessContext] ✅ assignedAgrupacionIds:', finalIds);
      setAssignedAgrupacionIds(finalIds);
    } catch (e) {
      console.error('[BusinessContext] ❌ Error cargando assignedAgrupacionIds (ARTÍCULOS):', e);
      setAssignedAgrupacionIds([]);
    }
  }, [activeId]);

  /* ===========================
   *  ✅ LOADERS: INSUMOS (insumo_groups)
   * =========================== */
  const loadDivisionInsumoGroups = useCallback(async (divisionId) => {
    if (!divisionId) {
      setActiveDivisionInsumoGroupIds([]);
      return;
    }
    try {
      console.log('[BusinessContext] 📦 Cargando grupos (INSUMOS) para división:', divisionId);

      const result = await apiDivisions.getInsumoGroupsByDivision(divisionId, activeId);

      // 🔎 debug para ver la forma real (te salva la vida 1 vez)
      console.log('[BusinessContext] 🧩 getInsumoGroupsByDivision keys:', Object.keys(result || {}), result);

      const list = pickInsumoGroupList(result);

      const ids = (Array.isArray(list) ? list : [])
        .map((g) => Number(g?.id ?? g?.insumo_group_id))
        .filter((n) => Number.isFinite(n) && n > 0);

      console.log('[BusinessContext] ✅ activeDivisionInsumoGroupIds:', ids);
      setActiveDivisionInsumoGroupIds(ids);
    } catch (error) {
      console.error('[BusinessContext] ❌ Error cargando grupos (INSUMOS):', error);
      setActiveDivisionInsumoGroupIds([]);
    }
  }, [activeId]);

  const loadAssignedInsumoGroupIds = useCallback(async (divisionsList) => {
    try {
      console.log('[BusinessContext] 📦 Cargando assignedInsumoGroupIds (INSUMOS)...');

      const union = new Set();

      for (const d of divisionsList || []) {
        if (d.is_main) continue;

        const res = await apiDivisions.getInsumoGroupsByDivision(d.id, activeId);
        const list = pickInsumoGroupList(res);

        (Array.isArray(list) ? list : []).forEach((g) => {
          const n = Number(g?.id ?? g?.insumo_group_id);
          if (Number.isFinite(n) && n > 0) union.add(n);
        });
      }

      const finalIds = Array.from(union);
      console.log('[BusinessContext] ✅ assignedInsumoGroupIds:', finalIds);
      setAssignedInsumoGroupIds(finalIds);
    } catch (e) {
      console.error('[BusinessContext] ❌ Error cargando assignedInsumoGroupIds (INSUMOS):', e);
      setAssignedInsumoGroupIds([]);
    }
  }, [activeId]);

  /* ===========================
   *  SET DIVISION
   * =========================== */
  const setDivision = useCallback(async (divisionId) => {
    const newId =
      (divisionId === null || divisionId === '' || divisionId === undefined)
        ? null
        : Number(divisionId);

    // state primero
    setActiveDivisionIdState(Number.isFinite(newId) ? newId : null);

    if (!activeId) return;

    if (newId === null || !Number.isFinite(newId)) {
      clearActiveDivisionIdLS(activeId);

      // artículos legacy
      setActiveDivisionGroupIds([]);

      // artículos agrupaciones
      setActiveDivisionAgrupacionIds([]);

      // ✅ insumos
      setActiveDivisionInsumoGroupIds([]);

      return;
    }

    setActiveDivisionIdLS(activeId, newId);

    // artículos legacy
    await loadDivisionGroups(newId);

    // artículos agrupaciones
    await loadDivisionAgrupaciones(newId);

    // ✅ insumos
    await loadDivisionInsumoGroups(newId);
  }, [
    activeId,
    loadDivisionGroups,
    loadDivisionAgrupaciones,
    loadDivisionInsumoGroups,
  ]);

  /* ===========================
   *  Sync active business from LS
   * =========================== */
  useEffect(() => {
    if (booting) return;
    const lsActive = String(localStorage.getItem('activeBusinessId') || '').trim();
    if (lsActive && lsActive !== String(activeId || '').trim()) {
      setActiveId(lsActive);
    }
  }, [booting, activeId]);

  /* ===========================
   *  Load businesses on login
   * =========================== */
  useEffect(() => {
    if (booting) return;

    if (!isLogged) {
      setItems([]);
      setActiveId('');
      setDivisions([]);
      setActiveDivisionIdState(null);

      setActiveDivisionGroupIds([]);
      setAssignedGroupIds([]);

      setActiveDivisionAgrupacionIds([]);
      setAssignedAgrupacionIds([]);

      // ✅ insumos reset
      setActiveDivisionInsumoGroupIds([]);
      setAssignedInsumoGroupIds([]);

      return;
    }

    const token = localStorage.getItem('token') || '';
    if (!token) return;

    let alive = true;
    setLoading(true);

    BusinessesAPI.listMine()
      .then(list => {
        if (!alive) return;

        const arr = Array.isArray(list) ? list : [];
        setItems(arr);

        setActiveId(prev => {
          const prevTrim = String(prev || '').trim();
          if (prevTrim) return prevTrim;

          const stored = String(localStorage.getItem('activeBusinessId') || '').trim();
          if (stored) return stored;

          const first = arr?.[0]?.id ? String(arr[0].id) : '';
          if (first) localStorage.setItem('activeBusinessId', first);
          return first;
        });
      })
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [isLogged, booting]);

  /* ===========================
   *  Listen business:switched
   * =========================== */
  useEffect(() => {
    const onSwitched = (ev) => {
      const bizId = ev?.detail?.bizId;
      if (!bizId) return;

      setActiveId(String(bizId));
      localStorage.setItem('activeBusinessId', String(bizId));

      const biz = ev?.detail?.biz;
      if (biz?.id) {
        setItems(prev =>
          prev.map(b => String(b.id) === String(biz.id) ? { ...b, ...biz } : b)
        );
      }

      // reset división al cambiar negocio
      setActiveDivisionIdState(null);

      // reset scopes por división
      setActiveDivisionGroupIds([]);
      setActiveDivisionAgrupacionIds([]);
      setActiveDivisionInsumoGroupIds([]);
    };

    window.addEventListener('business:switched', onSwitched);
    return () => window.removeEventListener('business:switched', onSwitched);
  }, []);

  /* ===========================
   *  Load divisions when active business changes
   * =========================== */
  useEffect(() => {
    if (booting) return;

    const token = localStorage.getItem('token') || '';
    if (!token) return;

    if (!activeId) {
      setDivisions([]);
      setActiveDivisionIdState(null);

      setActiveDivisionGroupIds([]);
      setAssignedGroupIds([]);

      setActiveDivisionAgrupacionIds([]);
      setAssignedAgrupacionIds([]);

      // ✅ insumos
      setActiveDivisionInsumoGroupIds([]);
      setAssignedInsumoGroupIds([]);

      return;
    }

    let alive = true;
    setDivisionsLoading(true);

    apiDivisions.getDivisions(activeId)
      .then(async (result) => {
        if (!alive) return;

        const divisionsList = result?.divisions || [];
        setDivisions(divisionsList);

        // ARTÍCULOS legacy
        await loadAssignedGroupIds(divisionsList);

        // AGRUPACIONES artículos
        await loadAssignedAgrupacionIds(divisionsList);

        // ✅ INSUMOS
        await loadAssignedInsumoGroupIds(divisionsList);

        // restaurar división guardada
        const saved = getActiveDivisionIdLS(activeId);
        if (saved && saved !== 'null') {
          const savedId = Number(saved);
          const exists = divisionsList.some(d => Number(d.id) === Number(savedId));
          if (exists) {
            setActiveDivisionIdState(savedId);

            // ARTÍCULOS legacy
            await loadDivisionGroups(savedId);

            // AGRUPACIONES artículos
            await loadDivisionAgrupaciones(savedId);

            // ✅ INSUMOS
            await loadDivisionInsumoGroups(savedId);

            return;
          }
        }

        // si no hay saved válido => principal
        setActiveDivisionIdState(null);

        setActiveDivisionGroupIds([]);
        setActiveDivisionAgrupacionIds([]);
        setActiveDivisionInsumoGroupIds([]);
      })
      .catch((error) => {
        if (!alive) return;
        console.error('[BusinessContext] ❌ Error cargando divisiones:', error);

        setDivisions([]);
        setActiveDivisionIdState(null);

        setActiveDivisionGroupIds([]);
        setAssignedGroupIds([]);

        setActiveDivisionAgrupacionIds([]);
        setAssignedAgrupacionIds([]);

        setActiveDivisionInsumoGroupIds([]);
        setAssignedInsumoGroupIds([]);
      })
      .finally(() => {
        if (alive) setDivisionsLoading(false);
      });

    return () => { alive = false; };
  }, [
    activeId,
    loadDivisionGroups,
    loadAssignedGroupIds,
    loadDivisionAgrupaciones,
    loadAssignedAgrupacionIds,
    loadDivisionInsumoGroups,
    loadAssignedInsumoGroupIds,
    booting
  ]);

  /* ===========================
   *  Derivados
   * =========================== */
  const active = useMemo(
    () => items.find(b => String(b.id) === String(activeId)) || null,
    [items, activeId]
  );

  const activeDivision = useMemo(() => {
    if (activeDivisionId === null) return null;
    return divisions.find(d => Number(d.id) === Number(activeDivisionId)) || null;
  }, [activeDivisionId, divisions]);

  const isMainDivision = activeDivisionId === null;

  const activeDivisionName = useMemo(() => {
    if (isMainDivision) return 'Principal';
    return activeDivision?.name || 'Principal';
  }, [isMainDivision, activeDivision]);

  /* ===========================
   *  Select business
   * =========================== */
  const select = useCallback(async (id) => {
    const { id: finalId, biz } = await setActiveBusinessSvc(id, { fetchBiz: true, broadcast: true });

    setActiveId(String(finalId));
    localStorage.setItem('activeBusinessId', String(finalId));

    if (biz?.id) {
      setItems(prev =>
        prev.map(b => String(b.id) === String(biz.id) ? { ...b, ...biz } : b)
      );
    }

    // Resetear división
    setActiveDivisionIdState(null);
    setActiveDivisionGroupIds([]);
    setActiveDivisionAgrupacionIds([]);
    setActiveDivisionInsumoGroupIds([]);
  }, []);

  const addBusiness = useCallback((biz) => {
    setItems(prev => [biz, ...prev]);
    localStorage.setItem('activeBusinessId', String(biz.id));
    setActiveId(String(biz.id));
  }, []);

  const selectBusiness = useCallback(async (id) => select(id), [select]);
  const selectDivision = useCallback(async (divisionId) => setDivision(divisionId), [setDivision]);

  /* ===========================
   *  Refetch helpers
   * =========================== */
  const refetchAssignedGroups = useCallback(async () => {
    if (!activeId) return;

    console.log('[BusinessContext] 🔄 Recargando assignedGroupIds (ARTÍCULOS)...');

    try {
      const result = await apiDivisions.getDivisions(activeId);
      const divisionsList = result?.divisions || [];
      setDivisions(divisionsList);

      await loadAssignedGroupIds(divisionsList);

      if (activeDivisionId) {
        await loadDivisionGroups(activeDivisionId);
      }

      console.log('[BusinessContext] ✅ assignedGroupIds recargados');
    } catch (err) {
      console.error('[BusinessContext] ❌ Error recargando assignedGroupIds:', err);
    }
  }, [activeId, activeDivisionId, loadAssignedGroupIds, loadDivisionGroups]);

  const refetchAssignedAgrupaciones = useCallback(async () => {
    if (!activeId) return;

    console.log('[BusinessContext] 🔄 Recargando assignedAgrupacionIds (ARTÍCULOS)...');

    try {
      const result = await apiDivisions.getDivisions(activeId);
      const divisionsList = result?.divisions || [];
      setDivisions(divisionsList);

      await loadAssignedAgrupacionIds(divisionsList);

      if (activeDivisionId) {
        await loadDivisionAgrupaciones(activeDivisionId);
      } else {
        setActiveDivisionAgrupacionIds([]);
      }

      console.log('[BusinessContext] ✅ assignedAgrupacionIds recargados');
    } catch (e) {
      console.error('[BusinessContext] ❌ Error recargando assignedAgrupacionIds:', e);
    }
  }, [activeId, activeDivisionId, loadAssignedAgrupacionIds, loadDivisionAgrupaciones]);

  // ✅ NUEVO: Insumos
  const refetchAssignedInsumoGroups = useCallback(async () => {
    if (!activeId) return;

    console.log('[BusinessContext] 🔄 Recargando assignedInsumoGroupIds (INSUMOS)...');

    try {
      const result = await apiDivisions.getDivisions(activeId);
      const divisionsList = result?.divisions || [];
      setDivisions(divisionsList);

      await loadAssignedInsumoGroupIds(divisionsList);

      if (activeDivisionId) {
        await loadDivisionInsumoGroups(activeDivisionId);
      } else {
        setActiveDivisionInsumoGroupIds([]);
      }

      console.log('[BusinessContext] ✅ assignedInsumoGroupIds recargados');
    } catch (e) {
      console.error('[BusinessContext] ❌ Error recargando assignedInsumoGroupIds:', e);
    }
  }, [activeId, activeDivisionId, loadAssignedInsumoGroupIds, loadDivisionInsumoGroups]);

  /* ===========================
   *  Value
   * =========================== */
  const value = useMemo(() => ({
    items,
    active,
    activeId,
    activeBusinessId: activeId,
    select,
    selectBusiness,
    addBusiness,
    loading,

    divisions,
    activeDivisionId,
    activeDivision,
    activeDivisionName,
    isMainDivision,
    divisionsLoading,

    // ARTÍCULOS legacy
    activeDivisionGroupIds,
    assignedGroupIds,
    refetchAssignedGroups,

    // AGRUPACIONES artículos
    activeDivisionAgrupacionIds,
    assignedAgrupacionIds,
    refetchAssignedAgrupaciones,

    // ✅ INSUMOS groups
    activeDivisionInsumoGroupIds,
    assignedInsumoGroupIds,
    refetchAssignedInsumoGroups,

    setDivision,
    selectDivision,
  }), [
    items,
    active,
    activeId,
    select,
    selectBusiness,
    addBusiness,
    loading,
    divisions,
    activeDivisionId,
    activeDivision,
    activeDivisionName,
    isMainDivision,
    divisionsLoading,
    activeDivisionGroupIds,
    assignedGroupIds,
    refetchAssignedGroups,
    activeDivisionAgrupacionIds,
    assignedAgrupacionIds,
    refetchAssignedAgrupaciones,
    activeDivisionInsumoGroupIds,
    assignedInsumoGroupIds,
    refetchAssignedInsumoGroups,
    setDivision,
    selectDivision,
  ]);

  return <BizCtx.Provider value={value}>{children}</BizCtx.Provider>;
}
