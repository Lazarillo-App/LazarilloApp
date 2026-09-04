// src/hooks/useInsumos.js
/**
 * 🔥 Hooks optimizados para Insumos
 * Consume los nuevos endpoints del backend optimizado
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveBusiness } from '../context/BusinessContext';
import {
  insumosList,
  insumoCreate,
  insumoUpdate,
  insumoDelete,
  insumoGroupsList,
  insumoGroupCreate,
  insumoGroupUpdate,
  insumoGroupDelete,
  insumosRubrosList,
} from '../servicios/apiInsumos';
import { BASE } from '../servicios/apiBase';

/* ================== HELPERS ================== */
function authHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const bidRaw = bizId ?? localStorage.getItem('activeBusinessId') ?? '';
  const bidNum = Number(bidRaw);
  const bid = Number.isFinite(bidNum) && bidNum > 0 ? bidNum : '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid) h['X-Business-Id'] = String(bid);
  return h;
}

/* ================== NUEVOS ENDPOINTS ================== */

/**
 * 🆕 GET /api/insumos/tree-view
 * Vista de árbol para el sidebar (Elaborados/No Elaborados)
 */
export function useInsumosTreeView() {
  const { businessId } = useActiveBusiness();

  return useQuery({
    queryKey: ['insumos-tree-view', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const url = `${BASE}/insumos/tree-view`;
      const res = await fetch(url, { headers: authHeaders(businessId) });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Error al obtener vista de árbol');
      }

      return res.json();
    },
    enabled: !!businessId,
    staleTime: 30000, // 30 segundos
    gcTime: 300000, // 5 minutos
  });
}

/**
 * 🆕 GET /api/insumos/stats
 * Estadísticas generales para el dashboard
 */
export function useInsumosStats() {
  const { businessId } = useActiveBusiness();

  return useQuery({
    queryKey: ['insumos-stats', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const url = `${BASE}/insumos/stats`;
      const res = await fetch(url, { headers: authHeaders(businessId) });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Error al obtener estadísticas');
      }

      return res.json();
    },
    enabled: !!businessId,
    staleTime: 30000, // 30 segundos
    gcTime: 300000, // 5 minutos
  });
}

/* ================== LISTADO OPTIMIZADO ================== */

/**
 * Hook principal para listar insumos con filtros
 * Ahora aprovecha los datos enriquecidos del backend
 */
export function useInsumosList(filters = {}) {
  const { businessId: activeBusinessId } = useActiveBusiness();

  const {
    page = 1,
    limit = 50,
    search = '',
    rubro = null,
    unidadMed = null,
    origen = null,
    orderBy = 'nombre',
    order = 'ASC',
    elaborados = null, // true/false/null
    estado = 'activo', // activo/discontinuado/all
    sinAgrupacion = false,
    groupId = null,
    // Negocio explícito a usar en vez del "activo" del contexto — necesario en
    // sub-negocios, donde el negocio donde viven los insumos (rootBusiness) difiere
    // del negocio activo (InsumosMain.jsx calcula esto como `resolvedBizId`).
    bizIdOverride = null,
  } = filters;
  const businessId = bizIdOverride ?? activeBusinessId;

  return useQuery({
    queryKey: [
      'insumos-list',
      businessId,
      page,
      limit,
      search,
      rubro,
      unidadMed,
      origen,
      orderBy,
      order,
      elaborados,
      estado,
      sinAgrupacion,
      groupId,
    ],
    queryFn: async () => {
      if (!businessId) return { data: [], pagination: { total: 0, pages: 1 } };

      const params = {
        page,
        limit,
        search,
        orderBy,
        order,
      };

      // Agregar filtros opcionales
      if (rubro !== null) params.rubro = rubro;
      if (unidadMed) params.unidadMed = unidadMed;
      if (origen) params.origen = origen;
      if (elaborados !== null) params.elaborados = elaborados;
      if (estado !== 'all') params.estado = estado;
      if (sinAgrupacion) params.sinAgrupacion = true;
      if (groupId !== null) params.groupId = groupId;

      return insumosList(businessId, params);
    },
    enabled: !!businessId,
    staleTime: 10000, // 10 segundos
    gcTime: 300000, // 5 minutos
  });
}

/* ================== RUBROS ================== */

/**
 * Hook para obtener rubros de insumos
 */
export function useInsumosRubros(bizIdOverride = null) {
  const { businessId: activeBusinessId } = useActiveBusiness();
  const businessId = bizIdOverride ?? activeBusinessId;

  return useQuery({
    queryKey: ['insumos-rubros', businessId],
    queryFn: async () => {
      if (!businessId) return { items: [] };
      return insumosRubrosList(businessId);
    },
    enabled: !!businessId,
    staleTime: 60000, // 1 minuto
    gcTime: 600000, // 10 minutos
  });
}

/**
 * Hook para crear un Map de rubros (código -> info)
 */
export function useInsumosRubrosMap() {
  const { data } = useInsumosRubros();

  const rubrosMap = new Map();

  if (data?.items) {
    data.items.forEach((rubro) => {
      const codigo = String(rubro.codigo);
      rubrosMap.set(codigo, {
        codigo: rubro.codigo,
        nombre: rubro.nombre || `Rubro ${codigo}`,
        es_elaborador: rubro.es_elaborador === true,
      });
    });
  }

  return rubrosMap;
}

/* ================== AGRUPACIONES ================== */

/**
 * Hook para listar agrupaciones de insumos
 */
export function useInsumoGroups(bizIdOverride = null) {
  const { businessId: activeBusinessId } = useActiveBusiness();
  const businessId = bizIdOverride ?? activeBusinessId;

  return useQuery({
    queryKey: ['insumo-groups', businessId],
    queryFn: async () => {
      if (!businessId) return { data: [] };
      return insumoGroupsList(businessId);
    },
    enabled: !!businessId,
    staleTime: 30000, // 30 segundos
    gcTime: 300000, // 5 minutos
  });
}

/* ================== MUTACIONES CRUD ================== */

/**
 * Hook para crear un insumo
 */
export function useCreateInsumo() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: (payload) => insumoCreate(payload),
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-stats', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
    },
  });
}

/**
 * Hook para actualizar un insumo
 */
export function useUpdateInsumo() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: ({ id, payload }) => insumoUpdate(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-stats', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
    },
  });
}

/**
 * Hook para eliminar (discontinuar) un insumo
 */
export function useDeleteInsumo() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: (id) => insumoDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-stats', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
    },
  });
}

/* ================== MUTACIONES AGRUPACIONES ================== */

/**
 * Hook para crear una agrupación
 */
export function useCreateInsumoGroup() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: (payload) => insumoGroupCreate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumo-groups', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
    },
  });
}

/**
 * Hook para actualizar una agrupación
 */
export function useUpdateInsumoGroup() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: ({ id, payload }) => insumoGroupUpdate(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumo-groups', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
    },
  });
}

/**
 * Hook para eliminar una agrupación
 */
export function useDeleteInsumoGroup() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return useMutation({
    mutationFn: (id) => insumoGroupDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumo-groups', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
      queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
    },
  });
}

/* ================== INVALIDACIÓN MASIVA ================== */

/**
 * Hook para invalidar todas las queries relacionadas con insumos
 * Útil después de operaciones masivas (sync, bulk, etc.)
 */
export function useInvalidateInsumos() {
  const queryClient = useQueryClient();
  const { businessId } = useActiveBusiness();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['insumos-list', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumos-stats', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumos-tree-view', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumo-groups', businessId] });
    queryClient.invalidateQueries({ queryKey: ['insumos-rubros', businessId] });
  };
}

/* ================== HELPERS PARA GRUPOS ESPECIALES ================== */

/**
 * Helper para detectar grupo "Todo"
 */
export function isTodoGroup(group) {
  if (!group) return false;
  const nombre = String(group.nombre || '').trim().toUpperCase();
  return (
    nombre === 'TODO' ||
    nombre === 'SIN AGRUPACION' ||
    nombre === 'SIN AGRUPACIÓN' ||
    nombre === 'SIN AGRUPAR' ||
    nombre === 'SIN GRUPO'
  );
}

/**
 * Helper para detectar grupo "Discontinuados"
 */
export function isDiscontinuadosGroup(group) {
  if (!group) return false;
  const nombre = String(group.nombre || '').trim().toUpperCase();
  return nombre === 'DISCONTINUADOS' || nombre === 'DESCONTINUADOS';
}

/**
 * Hook para obtener IDs de grupos especiales
 */
export function useSpecialGroupIds() {
  const { data } = useInsumoGroups();
  const groups = data?.data || [];

  const todoGroup = groups.find(isTodoGroup);
  const discontinuadosGroup = groups.find(isDiscontinuadosGroup);

  return {
    todoGroupId: todoGroup?.id || null,
    discontinuadosGroupId: discontinuadosGroup?.id || null,
  };
}