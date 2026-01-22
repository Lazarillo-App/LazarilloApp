/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useBusiness } from './BusinessContext';
import { DivisionsAPI } from '../servicios/apiDivisions';

const DivisionCtx = createContext(null);

/**
 * Hook para consumir el contexto de divisiones
 */
export const useDivision = () => {
  const ctx = useContext(DivisionCtx);
  if (!ctx) {
    throw new Error('useDivision debe usarse dentro de DivisionProvider');
  }
  return ctx;
};

/**
 * Provider de divisiones/subnegocios
 * Maneja el filtrado visual de agrupaciones por división
 */
export function DivisionProvider({ children }) {
  const { activeId: businessId } = useBusiness();
  
  const [divisions, setDivisions] = useState([]); // Lista de divisiones del negocio activo
  const [activeDivisionId, setActiveDivisionIdState] = useState(null); // null = Principal
  const [loading, setLoading] = useState(false);

  // Clave para localStorage: "activeDivisionId:businessId:31"
  const storageKey = useMemo(() => {
    return businessId ? `activeDivisionId:businessId:${businessId}` : null;
  }, [businessId]);

  console.log('[DivisionContext] 🏗️ Render:', {
    businessId,
    activeDivisionId,
    divisionsCount: divisions.length,
    storageKey,
  });

  // ============================================================================
  // CARGAR DIVISIONES cuando cambia el negocio activo
  // ============================================================================
  useEffect(() => {
    if (!businessId) {
      console.log('[DivisionContext] ⚠️ No hay businessId, limpiando divisiones');
      setDivisions([]);
      setActiveDivisionIdState(null);
      return;
    }

    let alive = true;
    setLoading(true);

    console.log('[DivisionContext] 🔄 Cargando divisiones para negocio:', businessId);

    DivisionsAPI.listByBusiness(businessId)
      .then((result) => {
        if (!alive) return;
        
        const divisionsList = result?.divisions || [];
        console.log('[DivisionContext] ✅ Divisiones cargadas:', divisionsList.length);
        
        setDivisions(divisionsList);

        // Restaurar división activa desde localStorage
        if (storageKey) {
          const saved = localStorage.getItem(storageKey);
          if (saved && saved !== 'null') {
            const savedId = Number(saved);
            // Verificar que la división guardada existe en la lista
            const exists = divisionsList.some(d => d.id === savedId);
            if (exists) {
              console.log('[DivisionContext] 📂 Restaurando división guardada:', savedId);
              setActiveDivisionIdState(savedId);
              return;
            }
          }
        }

        // Si no hay división guardada o no existe, resetear a Principal
        console.log('[DivisionContext] 🏠 Reseteando a Principal (null)');
        setActiveDivisionIdState(null);
      })
      .catch((error) => {
        if (!alive) return;
        console.error('[DivisionContext] ❌ Error cargando divisiones:', error);
        setDivisions([]);
        setActiveDivisionIdState(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [businessId, storageKey]);

  // ============================================================================
  // FUNCIÓN: Cambiar división activa
  // ============================================================================
  const setActiveDivisionId = (divisionId) => {
    const newId = divisionId === null ? null : Number(divisionId);
    
    console.log('[DivisionContext] 🔄 Cambiando división:', {
      anterior: activeDivisionId,
      nueva: newId,
    });

    setActiveDivisionIdState(newId);

    // Guardar en localStorage
    if (storageKey) {
      if (newId === null) {
        localStorage.removeItem(storageKey);
        console.log('[DivisionContext] 🗑️ División Principal, removiendo de localStorage');
      } else {
        localStorage.setItem(storageKey, String(newId));
        console.log('[DivisionContext] 💾 División guardada en localStorage:', newId);
      }
    }
  };

  // ============================================================================
  // VALORES DERIVADOS
  // ============================================================================
  
  // División activa completa (objeto)
  const activeDivision = useMemo(() => {
    if (activeDivisionId === null) return null;
    return divisions.find(d => d.id === activeDivisionId) || null;
  }, [activeDivisionId, divisions]);

  // ¿Estamos viendo la división principal?
  const isMainDivision = activeDivisionId === null;

  // Nombre de la división activa (para mostrar en UI)
  const activeDivisionName = useMemo(() => {
    if (isMainDivision) return 'Principal';
    return activeDivision?.name || 'Principal';
  }, [isMainDivision, activeDivision]);

  // ============================================================================
  // PROVIDER VALUE
  // ============================================================================
  const value = useMemo(
    () => ({
      // Estado
      divisions,
      activeDivisionId,
      activeDivision,
      loading,
      
      // Valores derivados
      isMainDivision,
      activeDivisionName,
      
      // Acciones
      setActiveDivisionId,
    }),
    [divisions, activeDivisionId, activeDivision, loading, isMainDivision, activeDivisionName]
  );

  return <DivisionCtx.Provider value={value}>{children}</DivisionCtx.Provider>;
}