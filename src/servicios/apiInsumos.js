// src/servicios/apiInsumos.js
/**
 * 🔥 API CLIENT PARA INSUMOS
 * Espejo exacto de la estructura de Artículos/Agrupaciones
 * Fecha: 2026-01-29
 */

import { BASE } from './apiBase';
import { getActiveBusinessId } from './apiBusinesses';

// ==================== HELPERS ====================

function authHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const bidRaw = bizId ?? getActiveBusinessId() ?? localStorage.getItem('activeBusinessId') ?? '';
  const bidNum = Number(bidRaw);
  const bid = Number.isFinite(bidNum) && bidNum > 0 ? bidNum : '';
  
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid) h['X-Business-Id'] = String(bid);
  
  return h;
}

function qs(params = {}) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    u.append(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

// ==================== NUEVOS ENDPOINTS (OPTIMIZADOS) ====================

/**
 * 🆕 GET /api/insumos/tree-view
 * Vista de árbol para sidebar (Elaborados/No Elaborados + Rubros)
 */
export const insumosTreeView = async (bizId) => {
  const url = `${BASE}/insumos/tree-view`;
  const res = await fetch(url, { headers: authHeaders(bizId) });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Error al obtener vista de árbol');
  }
  
  return res.json();
};

/**
 * 🆕 GET /api/insumos/stats
 * Estadísticas para dashboard y badges
 */
export const insumosStats = async (bizId) => {
  const url = `${BASE}/insumos/stats`;
  const res = await fetch(url, { headers: authHeaders(bizId) });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Error al obtener estadísticas');
  }
  
  return res.json();
};

// ==================== CRUD INSUMOS ====================

/**
 * GET /api/insumos
 * Lista insumos con filtros avanzados (ahora con datos enriquecidos)
 */
export const insumosList = async (bizId, params = {}) => {
  const queryString = qs(params);
  const url = `${BASE}/insumos${queryString}`;
  
  const res = await fetch(url, { headers: authHeaders(bizId) });
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error al listar insumos');
  }
  
  return data;
};

/**
 * POST /api/insumos
 * Crea un insumo manual
 */
export const insumoCreate = async (payload) => {
  const url = `${BASE}/insumos`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error al crear insumo');
  }
  
  return data;
};

/**
 * PUT /api/insumos/:id
 * Actualiza un insumo
 */
export const insumoUpdate = async (id, payload) => {
  const url = `${BASE}/insumos/${id}`;
  
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error al actualizar insumo');
  }
  
  return data;
};

/**
 * DELETE /api/insumos/:id
 * Discontinúa un insumo (soft delete)
 */
export const insumoDelete = async (id) => {
  const url = `${BASE}/insumos/${id}`;
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error al eliminar insumo');
  }
  
  return data;
};

// ==================== BULK OPERATIONS ====================

/**
 * POST /api/insumos/bulk
 * Carga masiva JSON
 */
export const insumosBulkJSON = async (items) => {
  const url = `${BASE}/insumos/bulk`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(items),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error en bulk JSON');
  }
  
  return data;
};

/**
 * POST /api/insumos/bulk-csv
 * Carga masiva CSV
 */
export const insumosBulkCSV = async (file) => {
  const url = `${BASE}/insumos/bulk-csv`;
  const fd = new FormData();
  fd.append('file', file);
  
  const headers = authHeaders();
  delete headers['Content-Type']; // Dejar que el browser setee boundary
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: fd,
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error en bulk CSV');
  }
  
  return data;
};

/**
 * POST /api/insumos/admin/cleanup-null
 * Limpia insumos con datos nulos/duplicados
 */
export const insumosCleanup = async () => {
  const url = `${BASE}/insumos/admin/cleanup-null`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error en cleanup');
  }
  
  return data;
};

// ==================== MAXI SYNC ====================

/**
 * POST /api/insumos/maxi-sync
 * Sincroniza insumos desde Maxi
 */
export const insumosSyncMaxi = async (bizId) => {
  const url = `${BASE}/insumos/maxi-sync`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(bizId),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al sincronizar insumos');
  }
  
  return data;
};

/**
 * GET /api/insumos/maxi
 * Lista insumos sincronizados desde Maxi
 */
export const insumosListMaxi = async (bizId) => {
  const url = `${BASE}/insumos/maxi`;
  
  const res = await fetch(url, {
    headers: authHeaders(bizId),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok) {
    throw new Error((data && data.error) || 'Error al listar insumos Maxi');
  }
  
  return data;
};

// ==================== RUBROS MAXI ====================

/**
 * GET /api/insumos/maxi/rubros
 * Lista rubros de insumos
 */
export const insumosRubrosList = async (businessId) => {
  const url = `${BASE}/insumos/maxi/rubros`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(businessId),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al listar rubros de insumos');
  }
  
  return data;
};

/**
 * POST /api/insumos/maxi/rubros/sync
 * Sincroniza rubros desde Maxi
 */
export const insumosRubrosSync = async (bizId) => {
  const url = `${BASE}/insumos/maxi/rubros/sync`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(bizId),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al sincronizar rubros de insumos');
  }
  
  return data;
};

// ==================== AGRUPACIONES (GROUPS) ====================

/**
 * GET /api/insumos/groups
 * Lista agrupaciones de insumos
 */
export const insumoGroupsList = async (bizId) => {
  const url = `${BASE}/insumos/groups`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(bizId),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al listar agrupaciones de insumos');
  }
  
  return data;
};

/**
 * GET /api/insumos/groups/:id
 * Obtiene una agrupación por ID
 */
export const insumoGroupGetOne = async (id) => {
  const url = `${BASE}/insumos/groups/${id}`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al obtener agrupación');
  }
  
  return data;
};

/**
 * POST /api/insumos/groups
 * Crea una nueva agrupación
 */
export const insumoGroupCreate = async (payload) => {
  const url = `${BASE}/insumos/groups`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al crear agrupación');
  }
  
  return data;
};

/**
 * PUT /api/insumos/groups/:id
 * Actualiza una agrupación
 */
export const insumoGroupUpdate = async (id, payload) => {
  const url = `${BASE}/insumos/groups/${id}`;
  
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al actualizar agrupación');
  }
  
  return data;
};

/**
 * DELETE /api/insumos/groups/:id
 * Elimina una agrupación
 */
export const insumoGroupDelete = async (id) => {
  const url = `${BASE}/insumos/groups/${id}`;
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al eliminar agrupación');
  }
  
  return data;
};

// ==================== ITEMS DENTRO DE AGRUPACIONES ====================

/**
 * POST /api/insumos/groups/:id/items
 * Agrega un insumo a una agrupación
 */
export const insumoGroupAddItem = async (groupId, insumoId) => {
  const url = `${BASE}/insumos/groups/${groupId}/items`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ insumoId }),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al agregar insumo');
  }
  
  return data;
};

/**
 * POST /api/insumos/groups/:id/items/bulk
 * Agrega múltiples insumos a una agrupación
 */
export const insumoGroupAddMultipleItems = async (groupId, insumoIds) => {
  const url = `${BASE}/insumos/groups/${groupId}/items/bulk`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ insumoIds }),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || `Error ${res.status}: ${data?.error || 'unknown'}`);
  }
  
  return data;
};

/**
 * DELETE /api/insumos/groups/:id/items/:insumoId
 * Quita un insumo de una agrupación
 */
export const insumoGroupRemoveItem = async (groupId, insumoId) => {
  const url = `${BASE}/insumos/groups/${groupId}/items/${insumoId}`;
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al quitar insumo');
  }
  
  return data;
};

/**
 * PUT /api/insumos/groups/:id/items
 * Reemplaza todos los items de una agrupación
 */
export const insumoGroupReplaceItems = async (groupId, insumoIds) => {
  const url = `${BASE}/insumos/groups/${groupId}/items`;
  
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ insumoIds }),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al reemplazar items');
  }
  
  return data;
};

// ==================== EXCLUSIONES ====================

/**
 * GET /api/insumos/groups/:id/exclusions
 * Obtiene exclusiones de una agrupación
 */
export const insumoGroupGetExclusions = async (groupId) => {
  const url = `${BASE}/insumos/groups/${groupId}/exclusions`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al obtener exclusiones');
  }
  
  return data;
};

/**
 * POST /api/insumos/groups/:id/exclusions
 * Agrega exclusiones a una agrupación
 */
export const insumoGroupAddExclusions = async (groupId, exclusions) => {
  const url = `${BASE}/insumos/groups/${groupId}/exclusions`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ exclusions }),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al agregar exclusiones');
  }
  
  return data;
};

/**
 * DELETE /api/insumos/groups/:id/exclusions
 * Quita exclusiones de una agrupación
 */
export const insumoGroupRemoveExclusions = async (groupId, ids, scope = 'insumo') => {
  const url = `${BASE}/insumos/groups/${groupId}/exclusions`;
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ ids, scope }),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al quitar exclusiones');
  }
  
  return data;
};

// ==================== CREATE OR MOVE ====================

/**
 * POST /api/insumos/groups/create-or-move
 * Crea una agrupación o mueve insumos a una existente
 */
export const insumoGroupCreateOrMove = async (nombre, ids) => {
  const url = `${BASE}/insumos/groups/create-or-move`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ nombre, ids }),
  });
  
  const data = await res.json().catch(() => null);
  
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || 'Error al crear/mover agrupación');
  }
  
  return data;
};

// ==================== EXPORTS ====================

export default {
  // Tree & Stats
  insumosTreeView,
  insumosStats,
  
  // CRUD
  insumosList,
  insumoCreate,
  insumoUpdate,
  insumoDelete,
  
  // Bulk
  insumosBulkJSON,
  insumosBulkCSV,
  insumosCleanup,
  
  // Maxi
  insumosSyncMaxi,
  insumosListMaxi,
  insumosRubrosList,
  insumosRubrosSync,
  
  // Agrupaciones
  insumoGroupsList,
  insumoGroupGetOne,
  insumoGroupCreate,
  insumoGroupUpdate,
  insumoGroupDelete,
  
  // Items
  insumoGroupAddItem,
  insumoGroupAddMultipleItems,
  insumoGroupRemoveItem,
  insumoGroupReplaceItems,
  
  // Exclusiones
  insumoGroupGetExclusions,
  insumoGroupAddExclusions,
  insumoGroupRemoveExclusions,
  
  // Create or Move
  insumoGroupCreateOrMove,
};