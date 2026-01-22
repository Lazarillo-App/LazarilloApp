/**
 * Hook personalizado para gestionar divisiones
 */

import { useState, useEffect, useCallback } from 'react';
import * as apiDivisions from '../servicios/apiDivisions';

/**
 * Hook para gestionar divisiones de un negocio
 * @param {number} businessId - ID del negocio
 * @param {Object} options - Opciones (includeInactive, includeStats, autoLoad)
 */
export function useDivisions(businessId, options = {}) {
  const {
    includeInactive = false,
    includeStats = false,
    autoLoad = true,
  } = options;
  
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [hasMain, setHasMain] = useState(false);
  
  // Cargar divisiones
  const loadDivisions = useCallback(async () => {
    if (!businessId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiDivisions.getDivisions(businessId, {
        includeInactive,
        includeStats,
      });
      
      setDivisions(data.divisions || []);
      setTotal(data.total || 0);
      setHasMain(data.has_main_division || false);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando divisiones:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, includeInactive, includeStats]);
  
  // Crear división
  const createDivision = useCallback(async (divisionData) => {
    setError(null);
    
    try {
      const newDivision = await apiDivisions.createDivision(divisionData);
      setDivisions(prev => [...prev, newDivision]);
      setTotal(prev => prev + 1);
      return newDivision;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);
  
  // Actualizar división
  const updateDivision = useCallback(async (divisionId, updates) => {
    setError(null);
    
    try {
      const updated = await apiDivisions.updateDivision(divisionId, updates);
      setDivisions(prev =>
        prev.map(d => (d.id === divisionId ? updated : d))
      );
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);
  
  // Eliminar división
  const deleteDivision = useCallback(async (divisionId) => {
    setError(null);
    
    try {
      const result = await apiDivisions.deleteDivision(divisionId);
      setDivisions(prev => prev.filter(d => d.id !== divisionId));
      setTotal(prev => prev - 1);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);
  
  // Reordenar divisiones
  const reorderDivisions = useCallback(async (newOrder) => {
    setError(null);
    
    try {
      const reordered = await apiDivisions.reorderDivisions(businessId, newOrder);
      setDivisions(reordered);
      return reordered;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [businessId]);
  
  // Convertir agrupación a división
  const convertGroup = useCallback(async (conversionData) => {
    setError(null);
    
    try {
      const result = await apiDivisions.convertGroupToDivision(conversionData);
      setDivisions(prev => [...prev, result.division]);
      setTotal(prev => prev + 1);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);
  
  // Auto-cargar al montar
  useEffect(() => {
    if (autoLoad && businessId) {
      loadDivisions();
    }
  }, [autoLoad, businessId, loadDivisions]);
  
  return {
    divisions,
    loading,
    error,
    total,
    hasMain,
    loadDivisions,
    createDivision,
    updateDivision,
    deleteDivision,
    reorderDivisions,
    convertGroup,
  };
}

/**
 * Hook para obtener una división específica
 * @param {number} divisionId - ID de la división
 */
export function useDivision(divisionId) {
  const [division, setDivision] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const loadDivision = useCallback(async () => {
    if (!divisionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiDivisions.getDivisionById(divisionId);
      setDivision(data);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando división:', err);
    } finally {
      setLoading(false);
    }
  }, [divisionId]);
  
  useEffect(() => {
    if (divisionId) {
      loadDivision();
    }
  }, [divisionId, loadDivision]);
  
  return {
    division,
    loading,
    error,
    loadDivision,
  };
}