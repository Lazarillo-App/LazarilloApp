// src/hooks/useInsumosElaborados.js
/**
 * Hook para gestionar insumos elaborados
 * Facilita el uso de las funciones de elaborados con React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveBusiness } from '../context/BusinessContext';
import {
  toggleInsumoElaborado,
  toggleInsumosElaboradosBulk,
  listInsumosElaborados,
  getInsumoReceta,
  saveInsumoReceta,
  deleteInsumoReceta,
  moverElaboradosAGrupo,
  getElaboradosStats,
} from '../servicios/apiInsumosElaborados';

/**
 * Hook para listar insumos elaborados
 */
export function useListInsumosElaborados(params = {}) {
  const { businessId } = useActiveBusiness();

  return useQuery({
    queryKey: ['insumos-elaborados', businessId, params],
    queryFn: async () => {
      if (!businessId) return { data: [] };
      return listInsumosElaborados(businessId, params);
    },
    enabled: !!businessId,
    staleTime: 30000, // 30 segundos
    gcTime: 300000, // 5 minutos
  });
}

/**
 * Hook para obtener estadísticas de elaborados
 */
export function useElaboradosStats() {
  const { businessId } = useActiveBusiness();

  return useQuery({
    queryKey: ['insumos-elaborados-stats', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      return getElaboradosStats(businessId);
    },
    enabled: !!businessId,
    staleTime: 30000,
    gcTime: 300000,
  });
}

/**
 * Hook para obtener la receta de un insumo
 */
export function useInsumoReceta(insumoId) {
  const { businessId } = useActiveBusiness();

  return useQuery({
    queryKey: ['insumo-receta', businessId, insumoId],
    queryFn: async () => {
      if (!businessId || !insumoId) return null;
      return getInsumoReceta(insumoId, businessId);
    },
    enabled: !!businessId && !!insumoId,
    staleTime: 60000, // 1 minuto
    gcTime: 300000,
  });
}

/**
 * Hook para marcar/desmarcar un insumo como elaborado
 */
export function useToggleInsumoElaborado() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: ({ insumoId, esElaborado }) => 
      toggleInsumoElaborado(insumoId, esElaborado, businessId),
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados-stats', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-stats', businessId] });
    },
  });
}

/**
 * Hook para marcar/desmarcar múltiples insumos como elaborados
 */
export function useToggleInsumosElaboradosBulk() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: ({ insumoIds, esElaborado }) => 
      toggleInsumosElaboradosBulk(insumoIds, esElaborado, businessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados-stats', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-stats', businessId] });
    },
  });
}

/**
 * Hook para guardar la receta de un insumo
 */
export function useSaveInsumoReceta() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: ({ insumoId, recetaData }) => 
      saveInsumoReceta(insumoId, recetaData, businessId),
    onSuccess: (data, variables) => {
      // Invalidar la receta específica
      queryClient.invalidateQueries({ 
        queryKey: ['insumo-receta', businessId, variables.insumoId] 
      });
      // Invalidar lista de elaborados (para actualizar "tiene_receta")
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados-stats', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
    },
  });
}

/**
 * Hook para eliminar la receta de un insumo
 */
export function useDeleteInsumoReceta() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: (insumoId) => 
      deleteInsumoReceta(insumoId, businessId),
    onSuccess: (data, insumoId) => {
      queryClient.invalidateQueries({ 
        queryKey: ['insumo-receta', businessId, insumoId] 
      });
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados-stats', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
    },
  });
}

/**
 * Hook para mover todos los elaborados a un grupo
 */
export function useMoverElaboradosAGrupo() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: (groupId) => 
      moverElaboradosAGrupo(groupId, businessId),
    onSuccess: () => {
      // Invalidar queries de agrupaciones e insumos
      queryClient.invalidateQueries({ queryKey: ['insumo-groups', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-elaborados', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
    },
  });
}

/**
 * Hook para invalidar todas las queries de elaborados
 */
export function useInvalidateElaborados() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['insumos-elaborados', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumos-elaborados-stats', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumo-receta', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumos-stats', businessId] });
  };
}