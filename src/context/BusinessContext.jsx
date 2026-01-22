/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { useAuth } from './AuthContext';
import * as apiDivisions from '../servicios/apiDivisions';

const BizCtx = createContext(null);
export const useBusiness = () => useContext(BizCtx);

// 🔹 Hook unificado para obtener el negocio activo
export function useActiveBusiness() {
  const bizCtx = useBusiness();

  const active = bizCtx?.active || null;
  const activeIdFromCtx = bizCtx?.activeId || '';
  const activeIdFromStorage = localStorage.getItem('activeBusinessId') || '';

  const businessId =
    active?.id ||
    activeIdFromCtx ||
    activeIdFromStorage ||
    '';

  return {
    businessId,
    business: active,
  };
}

export function BusinessProvider({ children }) {
  const { isLogged } = useAuth();
  
  // Estados de negocios
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [loading, setLoading] = useState(false);

  // 🆕 Estados de divisiones
  const [divisions, setDivisions] = useState([]);
  const [activeDivisionId, setActiveDivisionId] = useState(null);
  const [activeDivisionGroupIds, setActiveDivisionGroupIds] = useState([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  console.log('[BusinessContext] 🏗️ Render:', {
    activeId,
    activeDivisionId,
    divisionsCount: divisions.length,
    groupIdsCount: activeDivisionGroupIds.length,
  });

  // ============================================================================
  // CARGAR NEGOCIOS
  // ============================================================================
  useEffect(() => {
    if (!isLogged) { 
      setItems([]);
      setActiveId(''); 
      setDivisions([]);
      setActiveDivisionId(null);
      return; 
    }
    
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
  }, [isLogged, activeId]);

  // ============================================================================
  // CARGAR DIVISIONES cuando cambia el negocio activo
  // ============================================================================
  useEffect(() => {
    if (!activeId) {
      console.log('[BusinessContext] ⚠️ No hay activeId, limpiando divisiones');
      setDivisions([]);
      setActiveDivisionId(null);
      setActiveDivisionGroupIds([]);
      return;
    }

    let alive = true;
    setDivisionsLoading(true);

    console.log('[BusinessContext] 🔄 Cargando divisiones para negocio:', activeId);

    apiDivisions.getDivisions(activeId)
      .then((result) => {
        if (!alive) return;
        
        const divisionsList = result?.divisions || [];
        console.log('[BusinessContext] ✅ Divisiones cargadas:', divisionsList.length);
        
        setDivisions(divisionsList);

        // Restaurar división activa desde localStorage
        const storageKey = `activeDivisionId:businessId:${activeId}`;
        const saved = localStorage.getItem(storageKey);
        
        if (saved && saved !== 'null') {
          const savedId = Number(saved);
          // Verificar que la división guardada existe en la lista
          const exists = divisionsList.some(d => d.id === savedId);
          
          if (exists) {
            console.log('[BusinessContext] 📂 Restaurando división guardada:', savedId);
            setActiveDivisionId(savedId);
            // Cargar groupIds de esta división
            loadDivisionGroups(savedId);
            return;
          }
        }

        // Si no hay división guardada o no existe, resetear a Principal
        console.log('[BusinessContext] 🏠 Reseteando a Principal (null)');
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

    return () => {
      alive = false;
    };
  }, [activeId]);

  // ============================================================================
  // FUNCIÓN: Cargar groupIds de una división
  // ============================================================================
  const loadDivisionGroups = async (divisionId) => {
    if (!divisionId) {
      setActiveDivisionGroupIds([]);
      return;
    }

    try {
      console.log('[BusinessContext] 📦 Cargando grupos de división:', divisionId);
      
      const result = await apiDivisions.getGroupsByDivision(divisionId);
      const groupIds = result?.groups?.map(g => g.id) || [];
      
      console.log('[BusinessContext] ✅ Grupos cargados:', groupIds.length);
      setActiveDivisionGroupIds(groupIds);
    } catch (error) {
      console.error('[BusinessContext] ❌ Error cargando grupos:', error);
      setActiveDivisionGroupIds([]);
    }
  };

  // ============================================================================
  // FUNCIÓN: Cambiar división activa
  // ============================================================================
  const setDivision = async (divisionId) => {
    const newId = divisionId === null ? null : Number(divisionId);
    
    console.log('[BusinessContext] 🔄 Cambiando división:', {
      anterior: activeDivisionId,
      nueva: newId,
    });

    setActiveDivisionId(newId);

    // Guardar en localStorage
    const storageKey = `activeDivisionId:businessId:${activeId}`;
    if (newId === null) {
      localStorage.removeItem(storageKey);
      setActiveDivisionGroupIds([]);
      console.log('[BusinessContext] 🗑️ División Principal, removiendo de localStorage');
    } else {
      localStorage.setItem(storageKey, String(newId));
      console.log('[BusinessContext] 💾 División guardada en localStorage:', newId);
      // Cargar groupIds de la nueva división
      await loadDivisionGroups(newId);
    }
  };

  // ============================================================================
  // VALORES DERIVADOS
  // ============================================================================
  
  const active = useMemo(
    () => items.find(b => String(b.id) === String(activeId)) || null,
    [items, activeId]
  );

  // División activa completa (objeto)
  const activeDivision = useMemo(() => {
    if (activeDivisionId === null) return null;
    return divisions.find(d => d.id === activeDivisionId) || null;
  }, [activeDivisionId, divisions]);

  // ¿Estamos viendo la división principal?
  const isMainDivision = activeDivisionId === null;

  // Nombre de la división activa
  const activeDivisionName = useMemo(() => {
    if (isMainDivision) return 'Principal';
    return activeDivision?.name || 'Principal';
  }, [isMainDivision, activeDivision]);

  // ============================================================================
  // FUNCIONES DE NEGOCIO (mantener existentes)
  // ============================================================================
  
  const select = async (id) => {
    await BusinessesAPI.select(id);
    localStorage.setItem('activeBusinessId', id);
    setActiveId(id);
    // Resetear división al cambiar de negocio
    setActiveDivisionId(null);
    setActiveDivisionGroupIds([]);
  };

  const addBusiness = (biz) => {
    setItems(prev => [biz, ...prev]);
    localStorage.setItem('activeBusinessId', biz.id);
    setActiveId(biz.id);
  };

  // ============================================================================
  // PROVIDER VALUE
  // ============================================================================
  
  const value = useMemo(
    () => ({
      // Negocios
      items,
      active,
      activeId,
      select,
      addBusiness,
      loading,
      
      // 🆕 Divisiones
      divisions,
      activeDivisionId,
      activeDivision,
      activeDivisionName,
      activeDivisionGroupIds,
      isMainDivision,
      divisionsLoading,
      setDivision,
    }),
    [
      items,
      active,
      activeId,
      loading,
      divisions,
      activeDivisionId,
      activeDivision,
      activeDivisionName,
      activeDivisionGroupIds,
      isMainDivision,
      divisionsLoading,
    ]
  );

  return (
    <BizCtx.Provider value={value}>
      {children}
    </BizCtx.Provider>
  );
}