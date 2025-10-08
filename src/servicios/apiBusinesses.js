/* eslint-disable no-empty */
// src/servicios/apiBusinesses.js
import { BASE } from './apiBase';

/** Headers comunes (Bearer + X-Business-Id opcional) */
export function authHeaders(extra = {}, opts = { withBusinessId: true }) {
  const token = localStorage.getItem('token') || '';
  const bid   = localStorage.getItem('activeBusinessId') || '';
  const h = { 'Content-Type': 'application/json', ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  if (opts.withBusinessId && bid) h['X-Business-Id'] = bid;
  return h;
}

/** fetch con parseo seguro y manejo de 401 */
export async function http(
  path,
  { method = 'GET', body, withBusinessId = true, headers, noAuthRedirect } = {}
) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(headers, { withBusinessId }),
    body: body ? JSON.stringify(body) : undefined,
  });

  const isAuthPublic = String(path || '').startsWith('/auth/');

  if (res.status === 401 && !(noAuthRedirect || isAuthPublic)) {
    try { console.warn('Auth 401', await res.clone().json()); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    window.location.href = '/login';
    throw new Error('invalid_token');
  }

  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message || data.detail)) ||
      text || res.statusText || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* Helpers multi-negocio */
export const getActiveBusinessId = () => localStorage.getItem('activeBusinessId');
export function httpBiz(path, options = {}, overrideBizId) {
  const bizId = Number(overrideBizId ?? getActiveBusinessId());
  if (!Number.isFinite(bizId)) throw new Error('businessId activo no definido');
  const p = String(path || '').startsWith('/') ? path : `/${path}`;
  return http(`/businesses/${bizId}${p}`, { ...options, withBusinessId: true });
}

/* ======================= API Businesses ======================= */
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
      method: 'POST', body: creds, withBusinessId: false,
    }),

  // ----- DATOS (con X-Business-Id)
  // Catálogo
  articlesFromDB : (id) => http(`/businesses/${id}/articles`,       { withBusinessId: true }),
  articlesTree   : (id) => http(`/businesses/${id}/articles/tree`,  { withBusinessId: true }),

  // Ventas: usamos tu backend /api/ventas (peek & series)
  salesSummary   : (_id, { from, to, limit = 500 }) =>
    http(`/ventas?peek=true&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`,
         { withBusinessId: true }),

  salesSeries    : (_id, articuloId, { from, to, groupBy = 'day' }) =>
    http(`/ventas?articuloId=${encodeURIComponent(articuloId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=${groupBy}`,
         { withBusinessId: true }),

  // Negocio activo (bootstrap después de login / F5)
  getActive : () => http('/businesses/active', { withBusinessId: false }),
  setActive : (businessId) =>
    http('/businesses/active', { method: 'PATCH', body: { businessId }, withBusinessId: false }),

  // Sync
  syncNow        : (id, body) =>
    http(`/businesses/${id}/sync`, { method: 'POST', body, withBusinessId: true }),
};
