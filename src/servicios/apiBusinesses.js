// src/servicios/apiBusinesses.js
import { BASE } from './apiBase';

/**
 * Construye headers de autenticación.
 * @param {Object} extra - Headers extra.
 * @param {Object} opts  - Opciones.
 * @param {boolean} opts.withBusinessId - Si agrega X-Business-Id (default: true).
 */
export function authHeaders(extra = {}, opts = { withBusinessId: true }) {
  const token = localStorage.getItem('token') || '';
  const bid   = localStorage.getItem('activeBusinessId') || '';
  const h = { 'Content-Type': 'application/json', ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  if (opts.withBusinessId && bid) h['X-Business-Id'] = bid;
  return h;
}

/**
 * Wrapper HTTP con manejo de 401 y parseo JSON seguro.
 */
async function http(path, { method = 'GET', body, withBusinessId = true } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders({}, { withBusinessId }),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    try { console.warn('Auth 401', await res.clone().json()); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    window.location.href = '/';
    throw new Error('invalid_token');
  }

  const txt = await res.text();
  let data;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message || data.detail)) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export { http };

/* =============== Helpers multi-negocio (nuevo) =============== */

/** Devuelve el businessId activo (string o null) */
export const getActiveBusinessId = () => localStorage.getItem('activeBusinessId');

/**
 * httpBiz: wrapea `http` agregando `/businesses/:bizId` al path.
 * - Usa `overrideBizId` si viene; si no, toma el activo de localStorage.
 * - Siempre envía `X-Business-Id` (withBusinessId: true).
 */
export function httpBiz(path, options = {}, overrideBizId) {
  const bizId = Number(overrideBizId ?? getActiveBusinessId());
  if (!Number.isFinite(bizId)) throw new Error('businessId activo no definido');
  const p = path.startsWith('/') ? path : `/${path}`;
  return http(`/businesses/${bizId}${p}`, { ...options, withBusinessId: true });
}

/* ======================= API Businesses ======================= */
/**
 * Regla:
 *  - Endpoints ADMIN (crear/listar/seleccionar/get/update/remove/credenciales) => withBusinessId: false
 *  - Endpoints de DATOS (artículos/ventas/sync) => withBusinessId: true
 */
export const BusinessesAPI = {
  // ----- ADMIN (sin X-Business-Id)
  listMine : async () =>
    (await http('/businesses', { withBusinessId: false }))?.items ?? [],
  create   : (payload) =>
    http('/businesses', { method: 'POST', body: payload, withBusinessId: false }),
  select   : (id) =>
    http(`/businesses/${id}/select`, { method: 'POST', withBusinessId: false }),
  get      : (id) =>
    http(`/businesses/${id}`, { withBusinessId: false }),
  update   : (id, body) =>
    http(`/businesses/${id}`, { method: 'PATCH', body, withBusinessId: false }),
  remove   : (id) =>
    http(`/businesses/${id}`, { method: 'DELETE', withBusinessId: false }),

  // Credenciales / estado de Maxi
  maxiStatus : (id) =>
    http(`/businesses/${id}/maxi-status`, { withBusinessId: false }),
  maxiSave   : (id, creds) =>
    http(`/businesses/${id}/maxi-credentials`, {
      method: 'POST',
      body: creds,
      withBusinessId: false,
    }),

  // ----- DATOS (con X-Business-Id)
  articlesFromDB : (id) =>
    http(`/businesses/${id}/articles`, { withBusinessId: true }),
  articlesTree   : (id) =>
    http(`/businesses/${id}/articles/tree`, { withBusinessId: true }),

  salesSummary   : (id, { from, to }) =>
    http(
      `/businesses/${id}/sales/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { withBusinessId: true }
    ),

  salesSeries    : (id, articuloId, { from, to, groupBy = 'day' }) =>
    http(
      `/businesses/${id}/sales/${articuloId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=${groupBy}`,
      { withBusinessId: true }
    ),

  syncNow        : (id, body) =>
    http(`/businesses/${id}/sync`, { method: 'POST', body, withBusinessId: true }),
};
