/**
 * useDivisionFilter - Hook para aplicar filtros de división automáticamente
 * 
 * Este hook agrega automáticamente los `groupIds` a las queries cuando
 * el usuario está viendo una división que no es la principal.
 * 
 * Uso:
 * const params = useDivisionFilter({ from: '2024-01-01', to: '2024-12-31' });
 * // Si está en división "Cafetería" con grupos [5,6,7]:
 * // → { from: '2024-01-01', to: '2024-12-31', groupIds: '5,6,7' }
 */

import { useMemo } from 'react';
import { useBusiness } from '../context/BusinessContext';

export function useDivisionFilter(baseParams = {}) {
  const {
    activeDivisionGroupIds = [],
    isMainDivision = false,
  } = useBusiness() || {};

  return useMemo(() => {
    // Si es división principal o no hay grupos, devolver params sin modificar
    if (isMainDivision || activeDivisionGroupIds.length === 0) {
      return baseParams;
    }

    // Agregar groupIds como string separado por comas
    return {
      ...baseParams,
      groupIds: activeDivisionGroupIds.join(','),
    };
  }, [baseParams, activeDivisionGroupIds, isMainDivision]);
}

/**
 * useDivisionFilterArray - Variante que devuelve groupIds como array
 * Útil cuando necesitas el array directamente en lugar del string
 */
export function useDivisionFilterArray(baseParams = {}) {
  const {
    activeDivisionGroupIds = [],
    isMainDivision = false,
  } = useBusiness() || {};

  return useMemo(() => {
    if (isMainDivision || activeDivisionGroupIds.length === 0) {
      return { ...baseParams, groupIds: null };
    }

    return {
      ...baseParams,
      groupIds: activeDivisionGroupIds,
    };
  }, [baseParams, activeDivisionGroupIds, isMainDivision]);
}

/**
 * useIsFiltered - Hook simple para saber si hay filtro activo
 */
export function useIsFiltered() {
  const { isMainDivision = false, activeDivisionGroupIds = [] } = useBusiness() || {};
  return !isMainDivision && activeDivisionGroupIds.length > 0;
}

/**
 * useDivisionContext - Hook que devuelve todo el contexto de división
 */
export function useDivisionContext() {
  const ctx = useBusiness() || {};
  
  return {
    divisionId: ctx.activeDivisionId || '',
    division: ctx.activeDivision || null,
    groupIds: ctx.activeDivisionGroupIds || [],
    isMainDivision: ctx.activeDivision?.is_main === true,
    isFiltered: !ctx.activeDivision?.is_main && (ctx.activeDivisionGroupIds?.length || 0) > 0,
  };
}