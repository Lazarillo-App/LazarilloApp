/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { useAuth } from './AuthContext';
import { useBoot } from './BootContext'; // 👈 NUEVO

const BizCtx = createContext(null);
export const useBusiness = () => useContext(BizCtx);

// 🔹 NUEVO: hook unificado para obtener el negocio activo
export function useActiveBusiness() {
  const bizCtx = useBusiness();
  const { activeBusinessId } = useBoot() || {};

  const active = bizCtx?.active || null;
  const activeIdFromCtx = bizCtx?.activeId || '';
  const activeIdFromBoot = activeBusinessId || '';
  const activeIdFromStorage = localStorage.getItem('activeBusinessId') || '';

  const businessId =
    active?.id ||
    activeIdFromCtx ||
    activeIdFromBoot ||
    activeIdFromStorage ||
    '';

  return {
    businessId,      // 👈 esto es lo que usa useVentasSeries
    business: active,
  };
}

export function BusinessProvider({ children }) {
  const { isLogged } = useAuth();
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLogged) { setItems([]); setActiveId(''); return; }
    let alive = true;
    setLoading(true);
    BusinessesAPI.listMine()
      .then(list => {
        if (!alive) return;
        setItems(list || []);
        if (!activeId && list?.[0]?.id) {
          localStorage.setItem('activeBusinessId', list[0].id);
          setActiveId(list[0].id);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [isLogged]);

  const active = useMemo(
    () => items.find(b => String(b.id) === String(activeId)) || null,
    [items, activeId]
  );

  const select = async (id) => {
    await BusinessesAPI.select(id);
    localStorage.setItem('activeBusinessId', id);
    setActiveId(id);
  };

  const addBusiness = (biz) => {
    setItems(prev => [biz, ...prev]);
    localStorage.setItem('activeBusinessId', biz.id);
    setActiveId(biz.id);
  };

  return (
    <BizCtx.Provider value={{ items, active, activeId, select, addBusiness, loading }}>
      {children}
    </BizCtx.Provider>
  );
}
