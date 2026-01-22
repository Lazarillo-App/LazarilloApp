/**
 * API Service - Divisiones (Subnegocios)
 * Versión actualizada para modelo de filtros
 */

import { getAuthToken } from './apiAuth';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api';

function getHeaders(opts = {}) {
  const token = getAuthToken();
  const { divisionId } = opts;

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(divisionId != null ? { 'X-Division-Id': String(divisionId) } : {}),
  };
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (res.ok) return res.json();

  let payload = null;
  try { payload = await res.json(); }
  catch {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }

  throw new Error(payload?.error || payload?.message || `HTTP ${res.status}`);
}

// ============================================================================
// DIVISIONES (SUBNEGOCIOS)
// ============================================================================

export async function getDivisions(businessId, options = {}) {
  const { includeInactive = false, includeStats = false } = options;

  const params = new URLSearchParams();
  if (includeInactive) params.set('includeInactive', 'true');
  if (includeStats) params.set('includeStats', 'true');

  const qs = params.toString();
  const url = `${API_BASE}/divisions/business/${businessId}${qs ? `?${qs}` : ''}`;

  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

export async function getDivisionById(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

export async function getMainDivision(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/main`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

export async function createDivision(data) {
  const url = `${API_BASE}/divisions`;
  return fetchJson(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
}

export async function updateDivision(divisionId, updates) {
  const url = `${API_BASE}/divisions/${divisionId}`;
  return fetchJson(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
}

export async function deleteDivision(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}`;
  return fetchJson(url, { method: 'DELETE', headers: getHeaders() });
}

// ============================================================================
// 🆕 GRUPOS EN DIVISIONES (ESENCIAL PARA FILTROS)
// ============================================================================

/**
 * Obtener grupos asignados a una división
 * Estos IDs se usan para filtrar artículos/ventas
 */
export async function getGroupsByDivision(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}/groups`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

/**
 * Asignar un grupo a una división (solo crea la relación)
 */
export async function assignGroupToDivision(divisionId, groupId) {
  const url = `${API_BASE}/divisions/${divisionId}/assign-group`;
  return fetchJson(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ groupId }),
  });
}

/**
 * Remover grupo de una división
 */
export async function removeGroupFromDivision(divisionId, groupId) {
  const url = `${API_BASE}/divisions/${divisionId}/groups/${groupId}`;
  return fetchJson(url, { method: 'DELETE', headers: getHeaders() });
}

// ============================================================================
// 🆕 ARTÍCULOS FILTRADOS POR DIVISIÓN
// ============================================================================

/**
 * Obtener artículos de una división (filtrados por grupos asignados)
 */
export async function getArticlesByDivision(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}/articles`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

/**
 * Estadísticas de una división
 */
export async function getDivisionStats(divisionId) {
  const url = `${API_BASE}/divisions/${divisionId}/stats`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

// ============================================================================
// 🆕 CREAR DIVISIÓN DESDE GRUPO
// ============================================================================

/**
 * Crear una división nueva desde un grupo existente
 * El grupo se asigna automáticamente a la nueva división
 */
export async function createDivisionFromGroup(data) {
  const url = `${API_BASE}/divisions/create-from-group`;
  return fetchJson(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
}

// ============================================================================
// LEGACY - Para compatibilidad con código existente
// ============================================================================

export async function getBusinessHierarchy(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/hierarchy`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

export async function getAllSubnegocios(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/all-subnegocios`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

export async function getStatsWithSubnegocios(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/stats`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

/**
 * 🆕 Mover agrupación completa a división
 * IMPORTANTE: Este endpoint ahora solo ASIGNA el grupo, no mueve datos físicamente
 */
export async function moveAgrupacionComplete(body, opts = {}) {
  const url = `${API_BASE}/divisions/move-agrupacion-complete`;
  return fetchJson(url, {
    method: 'POST',
    headers: getHeaders(opts),
    body: JSON.stringify(body),
  });
}

// ============================================================================
// INSUMOS (LEGACY - probablemente no se usen más)
// ============================================================================

export async function getInsumosStats(businessId) {
  const url = `${API_BASE}/divisions/business/${businessId}/insumos-stats`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

export async function getInsumosByRubro(businessId, includeSubnegocios = false) {
  const params = includeSubnegocios ? '?includeSubnegocios=true' : '';
  const url = `${API_BASE}/divisions/business/${businessId}/insumos-by-rubro${params}`;
  return fetchJson(url, { method: 'GET', headers: getHeaders() });
}

// ============================================================================
// EXPORTS LEGACY (compatibilidad)
// ============================================================================

export {
  getDivisions as getSubnegocios,
  createDivision as createSubnegocio,
  updateDivision as updateSubnegocio,
  deleteDivision as deleteSubnegocio,
};