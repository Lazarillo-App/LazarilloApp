/* eslint-disable no-empty */
import { BASE } from './apiBase';

/* ───────── helpers de fecha (front) ───────── */
const pad2 = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };
function last7dUntilYesterday() {
  const y = yesterday();
  const from = new Date(y); from.setDate(from.getDate() - 6);
  return { from: iso(from), to: iso(y) };
}

/* ───────── utils ───────── */
function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
}

// Normaliza la respuesta del helper http (algunos devuelven {data}, otros body plano)
const pick = (r) => (r && typeof r === 'object' && 'data' in r ? r.data : r);

/* ───────── headers/auth ───────── */
export function authHeaders(
  extra = {},
  opts = { withBusinessId: true, includeAuth: true, isFormData: false }
) {
  const token = localStorage.getItem('token') || '';
  const bid = localStorage.getItem('activeBusinessId') || '';
  const user = getUser();

  const h = { ...extra };

  // ⛔ NO setear Content-Type si es FormData (dejar que el browser ponga boundary)
  if (!opts.isFormData) {
    h['Content-Type'] = 'application/json';
  }

  if (opts.includeAuth && token) h.Authorization = `Bearer ${token}`;

  if (opts.withBusinessId && bid && user?.role !== 'app_admin') {
    h['X-Business-Id'] = bid;
  }

  return h;
}

// src/servicios/apiBusinesses.js

export async function http(
  path,
  {
    method = 'GET',
    body,
    withBusinessId = true,
    headers,
    noAuthRedirect,
    timeoutMs = 20000,
    signal,
  } = {}
) {
  const user = getUser();

  const p = String(path || '');
    const isBusinessScoped =
    withBusinessId ||
    p.startsWith('/businesses') ||
    p.startsWith('/ventas');

  // app_admin nunca debe pegar a rutas scopeadas a negocio
  if (user?.role === 'app_admin' && isBusinessScoped) {
    throw new Error('forbidden_for_app_admin(client)');
  }

  const url = `${BASE}${p}`;
  // Solo estos son "públicos" (no llevan Authorization)
  const AUTH_PUBLIC_PATHS = new Set([
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
  ]);

  const isAuthPublic = AUTH_PUBLIC_PATHS.has(p);


  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;

  const hdrs = isAuthPublic
    ? authHeaders(headers, {
      withBusinessId: false,
      includeAuth: false,
      isFormData,
    })
    : authHeaders(headers, {
      withBusinessId,
      includeAuth: true,
      isFormData,
    });

  // AbortController + timeout + cancel externo
  const ctrl = new AbortController();
  if (signal && typeof signal.addEventListener === 'function') {
    signal.addEventListener('abort', () => {
      try {
        ctrl.abort(signal.reason || 'aborted_by_caller');
      } catch { }
    });
  }
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs);

  let res;

  try {
    res = await fetch(url, {
      method,
      headers: hdrs,
      body: body
        ? (isFormData ? body : JSON.stringify(body))
        : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  // 401 → limpiar sesión y redirigir a /login
  if (res.status === 401 && !(noAuthRedirect || isAuthPublic)) {
    try {
      console.warn('Auth 401', await res.clone().json());
    } catch { }
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    window.location.href = '/login';
    throw new Error('invalid_token');
  }

  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch { }

  if (!res.ok) {
    // 🔍 log de diagnóstico
    try {
      console.error('[HTTP FAIL]', {
        status: res.status,
        url,
        bodyText: text,
        bodyJson: data,
      });
    } catch { }

    const is404 = res.status === 404;
    const msg =
      (data &&
        ((data.error &&
          data.detail &&
          `${data.error}: ${data.detail}`) ||
          data.detail ||
          data.error ||
          data.message)) ||
      (is404
        ? `not_found: ${path}`
        : (text || res.statusText || `HTTP ${res.status}`));

    throw new Error(msg);
  }

  return data;
}

export const getActiveBusinessId = () => localStorage.getItem('activeBusinessId');

/**
 * Rutas que ya llevan /businesses/:id → no mandamos X-Business-Id
 * (evita duplicidad y mantiene single source of truth en el :id de la URL)
 */
export function httpBiz(path, options = {}, overrideBizId) {
  const user = getUser();
  if (user?.role === 'app_admin') throw new Error('forbidden_for_app_admin');
  const bizId = Number(overrideBizId ?? getActiveBusinessId());
  if (!Number.isFinite(bizId)) throw new Error('businessId activo no definido');
  const p = String(path || '').startsWith('/') ? path : `/${path}`;
  return http(`/businesses/${bizId}${p}`, { ...options, withBusinessId: false });
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

    // Negocio activo basado en localStorage (+ opcional fetch de detalles)
  async getActive() {
    const idStr = localStorage.getItem('activeBusinessId');
    const id = idStr ? Number(idStr) : null;

    if (!id) {
      return { activeBusinessId: null, business: null };
    }

    try {
      const biz = await BusinessesAPI.get(id);
      return { activeBusinessId: id, business: biz };
    } catch (e) {
      console.warn('[BusinessesAPI.getActive] no se pudo cargar business', e);
      return { activeBusinessId: id, business: null };
    }
  },

  // Cambiar negocio activo: solo front + POST /:id/select como best-effort
  async setActive(businessId) {
    const id = Number(businessId);
    if (!Number.isFinite(id)) throw new Error('businessId inválido');

    // 1) Guardar en localStorage (fuente de verdad para el front)
    localStorage.setItem('activeBusinessId', String(id));

    // 2) Avisar al backend si existe /businesses/:id/select
    try {
      if (typeof BusinessesAPI.select === 'function') {
        await BusinessesAPI.select(id);
      }
    } catch (e) {
      const msg = String(e?.message || '');
      // Si el back no tiene esa ruta, seguimos igual sin romper el flujo
      if (!msg.startsWith('not_found')) {
        console.warn('[BusinessesAPI.setActive] fallo select, pero seguimos con LS', e);
      }
    }

    return { activeBusinessId: id };
  },

  // ---- Logo: subir archivo (FormData) ----
  uploadLogo: (id, file) => {
    const fd = new FormData();
    // el backend acepta 'file', 'logo' o 'image'
    fd.append('file', file, file?.name || 'logo.png');

    return http(`/businesses/${id}/logo`, {
      method: 'POST',
      body: fd,
      withBusinessId: false,   // usamos :id en la ruta; no forzar header
      headers: undefined,      // ¡no metas Content-Type!
    });
  },

  // ---- Branding URL directa del logo (PATCH /:id/branding-url) ----
  setBrandingUrl: (id, logo_url) =>
    http(`/businesses/${id}/branding-url`, {
      method: 'PATCH',
      body: { logo_url },
      withBusinessId: false,
    }),

  // Credenciales / estado de Maxi
  maxiStatus: (id) =>
    http(`/businesses/${id}/maxi-status`, { withBusinessId: false }),
  maxiSave: (id, creds) =>
    http(`/businesses/${id}/maxi-credentials`, { method: 'POST', body: creds, withBusinessId: false }),

  // Catálogo desde DB
  // Lista PLANA: { items: [{ id, nombre, categoria, subrubro, precio, costo, raw }...] }
  articlesFromDB: async (id) => {
    const res = await http(`/businesses/${id}/articles`, { withBusinessId: false });
    const data = pick(res);
    return Array.isArray(data?.items) ? data : { items: [] };
  },

  // Árbol: { ok, resumen, tree: [{ subrubro, categorias: [{ categoria, articulos: [...] }] }] }
  articlesTree: async (id) => {
    const res = await http(`/businesses/${id}/articles/tree`, { withBusinessId: false });
    const data = pick(res);
    return {
      ok: !!data?.ok,
      resumen: data?.resumen ?? { subrubros: 0, categorias: 0, articulos: 0 },
      tree: Array.isArray(data?.tree) ? data.tree : [],
    };
  },

  // ───────── Ventas (requieren X-Business-Id, no llevan /:id en la URL base) ─────────
  salesSummary: (id, { from, to, limit = 1000 } = {}) =>
    http(
      `/businesses/${id}/sales/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${encodeURIComponent(limit)}`,
      { withBusinessId: false }
    ),
  salesSeries: (id, articuloId, { from, to, groupBy = 'day' } = {}) =>
    http(
      `/businesses/${id}/sales/${encodeURIComponent(articuloId)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=${encodeURIComponent(groupBy)}`,
      { withBusinessId: false }
    ),

    // ───────── Top artículos por ventas usando /businesses/:id/sales/summary ─────────
   async topArticulos(businessId, { from, to, limit = 100 } = {}) {
    if (!businessId) {
      const bid = Number(getActiveBusinessId());
      if (Number.isFinite(bid)) businessId = bid;
    }
    if (!businessId) {
      throw new Error('businessId requerido en topArticulos');
    }

    // Usamos la ruta que ya tenemos en el back:
    // GET /businesses/:id/sales/summary?from=...&to=...&limit=...
    const raw = await BusinessesAPI.salesSummary(businessId, { from, to, limit });
    const data = pick(raw);

    // Normalizamos a un array "items"
    const rows = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.ranking)
        ? data.ranking
        : Array.isArray(data?.peek)
          ? data.peek
          : [];

    const items = Array.isArray(rows) ? rows : [];

    // 🔍 log de diagnóstico: vas a ver en consola los primeros 5 registros
    try {
      console.log('[topArticulos] sample rows:', items.slice(0, 5));
    } catch {}

    return {
      ...data,
      items,
    };
  },

    // ───────── Totales simples de ventas por artículo (summary plano) ─────────
  async getSalesItems(businessId, { from, to, limit = 5000 } = {}) {
    // Si no me pasan id, intento usar el activo
    if (!businessId) {
      const bid = Number(getActiveBusinessId());
      if (Number.isFinite(bid)) businessId = bid;
    }
    if (!businessId) {
      throw new Error('businessId requerido en getSalesItems');
    }

    // Usamos la ruta ya existente: /businesses/:id/sales/summary
    const raw = await BusinessesAPI.salesSummary(businessId, { from, to, limit });
    const data = pick(raw);

    // Normalizamos a un array de filas
    const rows = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.ranking)
        ? data.ranking
        : Array.isArray(data?.peek)
          ? data.peek
          : [];

    return rows;
  },

  // Sync catálogo (Maxi → DB)
  syncNow: (id, body) =>
    http(`/businesses/${id}/sync`, {
      method: 'POST',
      body,
      withBusinessId: false,
    }),

  // Sync ventas
  syncSales: (id, { mode = 'auto', dryrun = false, from, to, maxiToken, signal } = {}) => {
    const qs = new URLSearchParams();
    if (mode) qs.set('mode', mode);
    if (dryrun) qs.set('dryrun', '1');
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);

    const extraHeaders = {
      'X-Business-Id': String(id),
      ...(maxiToken ? { 'X-Maxi-Token': maxiToken } : {}),
    };

    return http(`/businesses/${id}/sync-sales?${qs.toString()}`, {
      method: 'POST',
      withBusinessId: false,
      headers: extraHeaders,
      signal,
    });
  },

  // Helpers de conveniencia (front)
  syncSalesRange: (id, from, to, opts = {}) => {
    if (!(typeof from === 'string' && typeof to === 'string')) {
      return Promise.reject(new Error('from/to requeridos (YYYY-MM-DD)'));
    }
    return BusinessesAPI.syncSales(id, { ...opts, from, to });
  },

  syncSalesLast7d: (id, opts = {}) => {
    const { from, to } = last7dUntilYesterday();
    return BusinessesAPI.syncSales(id, { ...opts, from, to });
  },

  
};


/* ======================= API Admin (sin X-Business-Id) ======================= */
export const AdminAPI = {
  overview: () => http('/admin/overview', { withBusinessId: false }),
  users: ({ q = '', page = 1, pageSize = 20 } = {}) =>
    http(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`, { withBusinessId: false }),
  listUsers: (args) => AdminAPI.users(args),
  updateUser: (id, body) =>
    http(`/admin/users/${id}`, { method: 'PATCH', body, withBusinessId: false }),
  deleteUser: (id) =>
    http(`/admin/users/${id}`, { method: 'DELETE', withBusinessId: false }),
  resetPassword: (id) =>
    http(`/admin/users/${id}/reset-password`, { method: 'POST', withBusinessId: false }),
};
