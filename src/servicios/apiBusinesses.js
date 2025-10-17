/* eslint-disable no-empty */
import { BASE } from './apiBase';

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
}

export function authHeaders(
  extra = {},
  opts = { withBusinessId: true, includeAuth: true }
) {
  const token = localStorage.getItem('token') || '';
  const bid = localStorage.getItem('activeBusinessId') || '';
  const user = getUser();

  // base
  const h = { 'Content-Type': 'application/json', ...extra };

  // bearer
  if (opts.includeAuth && token) h.Authorization = `Bearer ${token}`;

  // X-Business-Id (nunca para app_admin)
  if (opts.withBusinessId && bid && user?.role !== 'app_admin') {
    h['X-Business-Id'] = bid;
  }

  // tip: si querés inyectar un token de Maxi a mano:
  // pásalo en `extra` como { 'X-Maxi-Token': '…' }
  return h;
}

export async function http(
  path,
  {
    method = 'GET',
    body,
    withBusinessId = true,
    headers,
    noAuthRedirect,
    timeoutMs = 20000,
  } = {}
) {
  const user = getUser();

  // ⛔ cortafuego: si es app_admin no dispares requests “scoped” a negocio
  const p = String(path || '');
  const isBusinessScoped =
    withBusinessId ||                // nos pidieron enviar X-Business-Id
    p.startsWith('/businesses') ||   // rutas de negocio explícitas
    p.startsWith('/ventas');         // backend exige negocio activo aquí

  if (user?.role === 'app_admin' && isBusinessScoped) {
    throw new Error('forbidden_for_app_admin(client)');
  }

  const url = `${BASE}${p}`;
  const isAuthPublic = p.startsWith('/auth/');

  const hdrs = isAuthPublic
    ? authHeaders(headers, { withBusinessId: false, includeAuth: false })
    : authHeaders(headers, { withBusinessId, includeAuth: true });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: hdrs,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (res.status === 401 && !(noAuthRedirect || isAuthPublic)) {
    try { console.warn('Auth 401', await res.clone().json()); } catch { }
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    window.location.href = '/login';
    throw new Error('invalid_token');
  }

  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { }

  if (!res.ok) {
    const is404 = res.status === 404;
    const msg =
      (data && (data.error || data.message || data.detail)) ||
      (is404 ? `not_found: ${path}` : (text || res.statusText || `HTTP ${res.status}`));
    throw new Error(msg);
  }
  return data;
}

export const getActiveBusinessId = () => localStorage.getItem('activeBusinessId');

export function httpBiz(path, options = {}, overrideBizId) {
  const user = getUser();
  if (user?.role === 'app_admin') throw new Error('forbidden_for_app_admin');
  const bizId = Number(overrideBizId ?? getActiveBusinessId());
  if (!Number.isFinite(bizId)) throw new Error('businessId activo no definido');
  const p = String(path || '').startsWith('/') ? path : `/${path}`;
  return http(`/businesses/${bizId}${p}`, { ...options, withBusinessId: true });
}

/* ======================= API Businesses ======================= */
export const BusinessesAPI = {
  // ----- ADMIN (sin X-Business-Id)
  listMine: async () =>
    (await http('/businesses', { withBusinessId: false }))?.items ?? [],
  create: (payload) =>
    http('/businesses', { method: 'POST', body: payload, withBusinessId: false }),
  select: (id) =>
    http(`/businesses/${id}/select`, { method: 'POST', withBusinessId: false }),
  get: (id) =>
    http(`/businesses/${id}`, { withBusinessId: false }),
  update: (id, body) =>
    http(`/businesses/${id}`, { method: 'PATCH', body, withBusinessId: false }),
  remove: (id) =>
    http(`/businesses/${id}`, { method: 'DELETE', withBusinessId: false }),
  // Credenciales / estado de Maxi
  maxiStatus: (id) =>
    http(`/businesses/${id}/maxi-status`, { withBusinessId: false }),
  maxiSave: (id, creds) =>
    http(`/businesses/${id}/maxi-credentials`, {
      method: 'POST', body: creds, withBusinessId: false,
    }),

  // ----- DATOS (con X-Business-Id)
  // Catálogo
  articlesFromDB: (id) =>
    http(`/businesses/${id}/articles`, { withBusinessId: true }),
  articlesTree: (id) =>
    http(`/businesses/${id}/articles/tree`, { withBusinessId: true }),

  // Ventas: backend /api/ventas (peek & series)
  salesSummary: (_id, { from, to, limit = 500 }) =>
    http(`/ventas?peek=true&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`,
      { withBusinessId: true }),
  salesSeries: (_id, articuloId, { from, to, groupBy = 'day' }) =>
    http(`/ventas/by-article?articuloId=${encodeURIComponent(articuloId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=${groupBy}`,
      { withBusinessId: true }),
  topArticulos: (_id, { limit = 200 } = {}) =>
    http(`/ventas/summary?limit=${limit}`, { withBusinessId: true }),
  // Negocio activo (bootstrap después de login / F5)
  getActive: () => http('/businesses/active', { withBusinessId: false }),
  setActive: (businessId) =>
    http('/businesses/active', {
      method: 'PATCH',
      body: { businessId },       // ✅ no activeBusinessId
      withBusinessId: false
    }),

  // Sync legacy
  syncNow: (id, body) =>
    http(`/businesses/${id}/sync`, { method: 'POST', body, withBusinessId: true }),

  // Ventas (nuevo sync): ?mode=auto | backfill_30d (+ opcional X-Maxi-Token)
  syncSales: (id, { mode = 'auto', dryrun = false, from, to, maxiToken } = {}) => {
    const qs = new URLSearchParams();
    if (mode) qs.set('mode', mode);
    if (dryrun) qs.set('dryrun', '1');
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const extraHeaders = maxiToken ? { 'X-Maxi-Token': maxiToken } : undefined;
    return http(`/businesses/${id}/sync-sales?${qs.toString()}`, {
      method: 'POST',
      withBusinessId: true,       // envía X-Business-Id
      headers: extraHeaders,      // opcional para forzar token Maxi
    });
  },
};

/* ======================= API Admin (sin X-Business-Id) ======================= */
export const AdminAPI = {
  overview: () => http('/admin/overview', { withBusinessId: false }),
  users: ({ q = '', page = 1, pageSize = 20 } = {}) =>
    http(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`, { withBusinessId: false }),
  updateUser: (id, body) =>
    http(`/admin/users/${id}`, { method: 'PATCH', body, withBusinessId: false }),
  deleteUser: (id) =>
    http(`/admin/users/${id}`, { method: 'DELETE', withBusinessId: false }),
  resetPassword: (id) =>
    http(`/admin/users/${id}/reset-password`, { method: 'POST', withBusinessId: false }),
};