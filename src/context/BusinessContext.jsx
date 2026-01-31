/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback
} from 'react';

import { BusinessesAPI } from '../servicios/apiBusinesses';
import { useAuth } from './AuthContext';
import * as apiDivisions from '../servicios/apiDivisions';
import { setActiveBusiness as setActiveBusinessSvc } from '../servicios/setActiveBusiness';

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
  const { isLogged } = useAuth();

  // Negocios
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [loading, setLoading] = useState(false);

  // Divisiones
  const [divisions, setDivisions] = useState([]);
  const [activeDivisionId, setActiveDivisionId] = useState(null);
  const [activeDivisionGroupIds, setActiveDivisionGroupIds] = useState([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  const loadDivisionGroups = useCallback(async (divisionId) => {
    if (!divisionId) {
      setActiveDivisionGroupIds([]);
      return;
    }
    try {
      const result = await apiDivisions.getGroupsByDivision(divisionId);
      const groupIds = result?.groups?.map(g => g.id) || [];
      setActiveDivisionGroupIds(groupIds);
    } catch (error) {
      console.error('[BusinessContext] ❌ Error cargando grupos:', error);
      setActiveDivisionGroupIds([]);
    }
  }, []);

  const setDivision = useCallback(async (divisionId) => {
    const newId = divisionId === null || divisionId === '' ? null : Number(divisionId);

    setActiveDivisionId(newId);

    const storageKey = `activeDivisionId:businessId:${activeId}`;
    if (newId === null) {
      localStorage.removeItem(storageKey);
      setActiveDivisionGroupIds([]);
    } else {
      localStorage.setItem(storageKey, String(newId));
      await loadDivisionGroups(newId);
    }
  }, [activeId, loadDivisionGroups]);

  // Cargar negocios al login
  useEffect(() => {
    if (!isLogged) {
      setItems([]);
      setActiveId('');
      setDivisions([]);
      setActiveDivisionId(null);
      setActiveDivisionGroupIds([]);
      return;
    }

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
  }, [isLogged]);

  // 👂 Escuchar cambios globales (por si algo llama setActiveBusiness afuera del Context)
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
      setActiveDivisionId(null);
      setActiveDivisionGroupIds([]);
    };

    window.addEventListener('business:switched', onSwitched);
    return () => window.removeEventListener('business:switched', onSwitched);
  }, []);

  // Cargar divisiones cuando cambia el negocio activo
  useEffect(() => {
    if (!activeId) {
      setDivisions([]);
      setActiveDivisionId(null);
      setActiveDivisionGroupIds([]);
      return;
    }

    let alive = true;
    setDivisionsLoading(true);

    apiDivisions.getDivisions(activeId)
      .then(async (result) => {
        if (!alive) return;

        const divisionsList = result?.divisions || [];
        setDivisions(divisionsList);

        const storageKey = `activeDivisionId:businessId:${activeId}`;
        const saved = localStorage.getItem(storageKey);

        if (saved && saved !== 'null') {
          const savedId = Number(saved);
          const exists = divisionsList.some(d => d.id === savedId);
          if (exists) {
            setActiveDivisionId(savedId);
            await loadDivisionGroups(savedId);
            return;
          }
        }

        setActiveDivisionId(null);
        setActiveDivisionGroupIds([]);
      })
      .catch((error) => {
        if (!alive) return;
        console.error('[BusinessContext] ❌ Error cargando divisiones:', error);
        setDivisions([]);
        setActiveDivisionId(null);
        setActiveDivisionGroupIds([]);
      })
      .finally(() => {
        if (alive) setDivisionsLoading(false);
      });

    return () => { alive = false; };
  }, [activeId, loadDivisionGroups]);

  // Derivados
  const active = useMemo(
    () => items.find(b => String(b.id) === String(activeId)) || null,
    [items, activeId]
  );

  const activeDivision = useMemo(() => {
    if (activeDivisionId === null) return null;
    return divisions.find(d => d.id === activeDivisionId) || null;
  }, [activeDivisionId, divisions]);

  const isMainDivision = activeDivisionId === null;

  const activeDivisionName = useMemo(() => {
    if (isMainDivision) return 'Principal';
    return activeDivision?.name || 'Principal';
  }, [isMainDivision, activeDivision]);

  // ✅ ÚNICA forma de cambiar negocio (para Navbar + Cards + Perfil)
  const select = useCallback(async (id) => {
    const { id: finalId, biz } = await setActiveBusinessSvc(id, { fetchBiz: true, broadcast: true });

    setActiveId(String(finalId));
    localStorage.setItem('activeBusinessId', String(finalId));

    if (biz?.id) {
      setItems(prev =>
        prev.map(b => String(b.id) === String(biz.id) ? { ...b, ...biz } : b)
      );
    }

    // Resetear división al cambiar de negocio
    setActiveDivisionId(null);
    setActiveDivisionGroupIds([]);
  }, []);

  const addBusiness = useCallback((biz) => {
    setItems(prev => [biz, ...prev]);
    localStorage.setItem('activeBusinessId', String(biz.id));
    setActiveId(String(biz.id));
  }, []);

  // Alias “claros” para Navbar
  const selectBusiness = useCallback(async (id) => select(id), [select]);
  const selectDivision = useCallback(async (divisionId) => setDivision(divisionId), [setDivision]);

  const value = useMemo(() => ({
    items,
    active,
    activeId,
    activeBusinessId: activeId,
    select,           // si algo viejo lo usa
    selectBusiness,   // Navbar + Perfil + Cards
    addBusiness,
    loading,

    divisions,
    activeDivisionId,
    activeDivision,
    activeDivisionName,
    activeDivisionGroupIds,
    isMainDivision,
    divisionsLoading,

    setDivision,
    selectDivision,
  }), [
    items, active, activeId, select, selectBusiness, addBusiness, loading,
    divisions, activeDivisionId, activeDivision, activeDivisionName,
    activeDivisionGroupIds, isMainDivision, divisionsLoading,
    setDivision, selectDivision,
  ]);

  return <BizCtx.Provider value={value}>{children}</BizCtx.Provider>;
}
