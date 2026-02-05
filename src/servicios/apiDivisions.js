/* eslint-disable no-empty */
/**
 * API Service - Divisiones (Subnegocios)
 * ✅ CORREGIDO: assignGroupToDivision con groupId (no agrupacionId)
 * ✅ ACTUALIZADO: assignInsumoGroupToDivision mejorado para consistencia
 */

import { getAuthToken } from './apiAuth';
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api';

/* ==================== HELPERS ==================== */

function getHeaders(opts = {}) {
  const token = getAuthToken();
  const { businessId, divisionId } = opts;

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(businessId != null ? { 'X-Business-Id': String(businessId) } : {}),
    ...(divisionId != null ? { 'X-Division-Id': String(divisionId) } : {}),
  };
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text(); // leemos una sola vez

  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (res.ok) return data;

  throw new Error(data?.error || data?.message || text || `HTTP ${res.status}`);
}

/* ==================== CRUD DIVISIONES ==================== */

/**
 * Obtener divisiones de un negocio
 */
export async function getDivisions(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId }) });
}

/**
 * Obtener una división por ID
 */
export async function getDivisionById(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ divisionId }) });
}

/**
 * Obtener división principal (is_main: true)
 */
export async function getMainDivision(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/main`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId }) });
}

/**
 * Crear nueva división
 * Backend espera: { businessId, name, description?, isMain? }
 */
export async function createDivision({ businessId, name, description = null, isMain = false }) {
  const url = `${API_BASE}/divisions`;

  return fetchJson(url, {
    method: 'POST',
    headers: getHeaders({ businessId }),
    body: JSON.stringify({
      businessId,
      name,
      description,
      isMain,
    }),
  });
}

/**
 * Actualizar división
 */
export async function updateDivision(divisionId, updates) {
  const url = `${API_BASE}/divisions/${divisionId}`;
  return fetchJson(url, {
    method: 'PUT',
    headers: getHeaders({ divisionId }),
    body: JSON.stringify(updates),
  });
}

/**
 * Eliminar división
 */
export async function deleteDivision(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}`;
  return fetchJson(url, { method: 'DELETE', headers: getHeaders({ divisionId }) });
}

/* ==================== GRUPOS (business_groups) EN DIVISIONES ==================== */

/**
 * Obtener grupos asignados a una división
 */
export async function getGroupsByDivision(divisionId, businessId) {
  const url = `${API_BASE}/divisions/${divisionId}/groups`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId, divisionId }) });
}

/**
 * ✅ CORRECTO: Asignar un grupo (business_group) a una división
 * POST /api/divisions/:divisionId/assign-group
 * Body: { groupId } (NO agrupacionId)
 */
export async function assignGroupToDivision({ businessId, groupId, divisionId }) {
  const isPrincipal =
    divisionId === null || divisionId === 'principal' || divisionId === '' || divisionId === undefined;

  const url = isPrincipal
    ? `${API_BASE}/divisions/unassign-group`
    : `${API_BASE}/divisions/${divisionId}/assign-group`;

  console.log('[apiDivisions] assignGroupToDivision:', {
    url,
    businessId,
    groupId,
    divisionId,
    isPrincipal,
  });

  return fetchJson(url, {
    method: 'POST',
    headers: getHeaders({ businessId, divisionId: isPrincipal ? null : divisionId }),
    body: JSON.stringify({ groupId }), // ✅ groupId (no agrupacionId)
  });
}

/**
 * Asignar una agrupación de artículos a una división
 * POST /api/divisions/:divisionId/assign-agrupacion
 * Body: { agrupacion_id }
 */
export async function assignAgrupacionToDivision({ businessId, agrupacionId, divisionId }) {
  const isPrincipal =
    divisionId === null || divisionId === 'principal' || divisionId === '' || divisionId === undefined;

  const url = isPrincipal
    ? `${API_BASE}/divisions/unassign-agrupacion`
    : `${API_BASE}/divisions/${divisionId}/assign-agrupacion`;

  return fetchJson(url, {
    method: 'POST',
    headers: getHeaders({ businessId, divisionId: isPrincipal ? null : divisionId }),
    body: JSON.stringify({
      businessId,
      agrupacion_id: Number(agrupacionId),
    }),
  });
}

/**
 * Quitar un grupo de una división (vuelve a Principal)
 * DELETE /api/divisions/:divisionId/groups/:groupId
 */
export async function removeGroupFromDivision(divisionId, groupId) {
  const url = `${API_BASE}/divisions/${divisionId}/groups/${groupId}`;
  return fetchJson(url, { method: 'DELETE', headers: getHeaders({ divisionId }) });
}

/* ==================== CREACIÓN DESDE GRUPO ==================== */

/**
 * Crear una división desde un grupo
 * POST /api/divisions/create-from-group
 * Body: { businessId, groupId, name? }
 */
export async function createDivisionFromGroup(businessId, groupId, name) {
  const url = `${API_BASE}/divisions/create-from-group`;

  const data = await fetchJson(url, {
    method: 'POST',
    headers: getHeaders({ businessId }),
    body: JSON.stringify({
      businessId,
      groupId,
      ...(name ? { name } : {}),
    }),
  });

  if (!data?.ok) throw new Error(data?.error || 'create_division_from_group_failed');
  return data; // { ok:true, division, group }
}

/* ==================== STATS Y ARTÍCULOS ==================== */

export async function getDivisionStats(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}/stats`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ divisionId }) });
}

export async function getArticlesByDivision(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}/articles`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ divisionId }) });
}

/* ==================== AGRUPACIONES (ARTÍCULOS) EN DIVISIONES ==================== */

/**
 * Obtener agrupaciones asignadas a una división
 */
export async function getAgrupacionesByDivision(divisionId, businessId) {
  const url = `${API_BASE}/divisions/${divisionId}/agrupaciones`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId, divisionId }) });
}

/**
 * Obtener agrupaciones visibles en Principal (no asignadas)
 */
export async function getPrincipalAgrupaciones(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/principal-agrupaciones`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId }) });
}

/* ==================== GRUPOS GENÉRICOS (business_groups) ==================== */

/**
 * Obtener grupos (business_groups) visibles en Principal
 */
export async function getPrincipalGroups(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/principal-groups`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId }) });
}

/* ==================== INSUMO GROUPS EN DIVISIONES ==================== */

/**
 * Obtener insumo_groups asignados a una división
 * GET /api/divisions/:divisionId/insumo-groups
 */
export async function getInsumoGroupsByDivision(divisionId, businessId) {
  const url = `${API_BASE}/divisions/${divisionId}/insumo-groups`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId, divisionId }) });
}

/**
 * Obtener insumo_groups visibles en Principal (no asignados a ninguna división)
 * GET /api/divisions/business/:businessId/principal-insumo-groups
 */
export async function getPrincipalInsumoGroups(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/principal-insumo-groups`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId }) });
}

/**
 * ✅ MEJORADO: Asignar un insumo_group a una división
 * POST /api/divisions/:divisionId/assign-insumo-group
 * Body: { insumoGroupId } (también acepta insumo_group_id)
 *
 * Si divisionId es "principal" => lo desasigna global (vuelve a Principal)
 * POST /api/divisions/unassign-insumo-group
 */
export async function assignInsumoGroupToDivision({ businessId, insumoGroupId, divisionId }) {
  if (!businessId || !insumoGroupId) {
    throw new Error('businessId y insumoGroupId son requeridos');
  }

  const isPrincipal =
    divisionId === null || divisionId === 'principal' || divisionId === '' || divisionId === undefined;

  const url = isPrincipal
    ? `${API_BASE}/divisions/unassign-insumo-group`
    : `${API_BASE}/divisions/${divisionId}/assign-insumo-group`;

  console.log('[apiDivisions] assignInsumoGroupToDivision:', {
    url,
    businessId,
    insumoGroupId,
    divisionId,
    isPrincipal,
  });

  return fetchJson(url, {
    method: 'POST',
    headers: getHeaders({ businessId, divisionId: isPrincipal ? null : divisionId }),
    body: JSON.stringify({ 
      insumoGroupId: Number(insumoGroupId),
      insumo_group_id: Number(insumoGroupId), // ✅ enviar ambos por compatibilidad
    }),
  });
}

/**
 * Remover insumo_group de una división (por division + group)
 * DELETE /api/divisions/:divisionId/insumo-groups/:insumoGroupId
 */
export async function removeInsumoGroupFromDivision(divisionId, insumoGroupId) {
  if (!divisionId || !insumoGroupId) {
    throw new Error('divisionId y insumoGroupId son requeridos');
  }

  const url = `${API_BASE}/divisions/${divisionId}/insumo-groups/${insumoGroupId}`;
  return fetchJson(url, { method: 'DELETE', headers: getHeaders({ divisionId }) });
}

/**
 * Obtener insumos filtrados por división
 * GET /api/divisions/:divisionId/insumos
 */
export async function getInsumosByDivision(divisionId, businessId) {
  const url = `${API_BASE}/divisions/${divisionId}/insumos`;
  return fetchJson(url, { method: 'GET', headers: getHeaders({ businessId, divisionId }) });
}

/* ==================== ALIASES (compatibilidad) ==================== */

export const getSubnegocios = getDivisions;
export const createSubnegocio = createDivision;
export const updateSubnegocio = updateDivision;
export const deleteSubnegocio = deleteDivision;