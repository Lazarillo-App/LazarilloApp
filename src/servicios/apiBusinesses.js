/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import { BASE } from './apiBase';

/* ───────── helpers de fecha (front) ───────── */
//const pad2 = (n) => String(n).padStart(2, '0');
// const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };
// function last7dUntilYesterday() {
//   const y = yesterday();
//   const from = new Date(y); from.setDate(from.getDate() - 6);
//   return { from: iso(from), to: iso(y) };
// }

/* ───────── utils ───────── */
function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
}

// Normaliza la respuesta del helper http (algunos devuelven {data}, otros body plano)
const pick = (r) => (r && typeof r === 'object' && 'data' in r ? r.data : r);

const normalizeDivisionId = (divisionId) => {
  const n = Number(divisionId);
  // Principal => null
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};


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
  // 🔥 Si es FormData, ELIMINAR cualquier Content-Type que venga en extra
  else if (h['Content-Type']) {
    delete h['Content-Type'];
  }

  if (opts.includeAuth && token) h.Authorization = `Bearer ${token}`;

  if (opts.withBusinessId && bid && user?.role !== 'app_admin') {
    h['X-Business-Id'] = bid;
  }

  return h;
}

// src/servicios/apiBusinesses.js

// ─────────────────────────────────────────────────────────────
// Cache + deduplicación de GETs (perf: evita pedir el mismo dato N veces).
// - inFlight: si una GET idéntica ya está en vuelo, se cuelga de la misma promesa.
// - cache: guarda la última respuesta por URL con TTL corto.
// - Cualquier mutación (POST/PUT/PATCH/DELETE) limpia todo el cache (simple y seguro).
// - Eventos de datos (articulos:updated, etc.) también lo limpian.
// TTL corto: solo colapsa las ráfagas de requests simultáneos/cercanos, no sirve stale viejo.
// ─────────────────────────────────────────────────────────────
const __httpCacheTTL = 4000; // ms
const __httpCache = new Map();
const __httpInFlight = new Map();

export function invalidateHttpCache() {
  __httpCache.clear();
}
if (typeof window !== 'undefined') {
  ['articulos:updated', 'insumos:updated', 'business:switched', 'business:synced',
   'article:links-changed', 'recetas:bulk-added', 'recetas:bulk-deleted', 'team:changed']
    .forEach(ev => window.addEventListener(ev, invalidateHttpCache));
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
    signal,
    cache = true, // permite desactivar cache por llamada si hiciera falta
  } = {}
) {
  const user = getUser();

  const p = String(path || '');
  const isBusinessScoped =
    withBusinessId ||
    p.startsWith('/businesses') ||
    p.startsWith('/ventas');

  // app_admin puede operar en rutas /businesses/:id cuando gestiona negocios concretos

  const url = `${BASE}${p}`;

  // Solo cacheamos/deduplicamos GETs (las mutaciones invalidan, ver abajo).
  const isGet = method === 'GET';
  const cacheKey = isGet ? `${url}|${getActiveBusinessId() || ''}` : null;

  if (isGet && cache) {
    // 1) Cache fresco
    const hit = __httpCache.get(cacheKey);
    if (hit && (Date.now() - hit.ts) < __httpCacheTTL) {
      return hit.data;
    }
    // 2) Request idéntica ya en vuelo → colgarse de la misma
    const pending = __httpInFlight.get(cacheKey);
    if (pending) return pending;
  }

  // Las mutaciones invalidan el cache (los datos cambiaron)
  if (!isGet) invalidateHttpCache();

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

  // Ejecuta el fetch real y devuelve el JSON parseado (o lanza error).
  const doFetch = async () => {
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
  };

  // GET con cache: registrar la promesa en vuelo (dedupe) y guardar el resultado.
  if (isGet && cache) {
    const promise = (async () => {
      try {
        const data = await doFetch();
        __httpCache.set(cacheKey, { ts: Date.now(), data });
        return data;
      } finally {
        __httpInFlight.delete(cacheKey);
      }
    })();
    __httpInFlight.set(cacheKey, promise);
    return promise;
  }

  // GET sin cache, o mutación: fetch directo.
  return doFetch();
}

const getActiveBusinessIdKey = () => {
  try {
    const user = getUser();
    const userId = user?.id;
    return userId ? `activeBusinessId:${userId}` : 'activeBusinessId';
  } catch {
    return 'activeBusinessId';
  }
};

export const getActiveBusinessId = () => {
  const key = getActiveBusinessIdKey();
  return localStorage.getItem(key);
};

const setActiveBusinessIdLS = (bizId) => {
  const key = getActiveBusinessIdKey();
  if (bizId) {
    localStorage.setItem(key, String(bizId));
    // También guardamos en la key global para compatibilidad
    localStorage.setItem('activeBusinessId', String(bizId));
  } else {
    localStorage.removeItem(key);
    localStorage.removeItem('activeBusinessId');
  }
};

const removeActiveBusinessIdLS = () => {
  const key = getActiveBusinessIdKey();
  localStorage.removeItem(key);
  // NO borramos la key global, solo la del usuario
};

/**
 * Rutas que ya llevan /businesses/:id → no mandamos X-Business-Id
 * (evita duplicidad y mantiene single source of truth en el :id de la URL)
 */
export function httpBiz(path, options = {}, overrideBizId) {
  // app_admin puede operar con overrideBizId explícito (está gestionando un negocio concreto)
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

  // Negocio activo: backend como verdad + sincroniza localStorage
  async getActive() {
    try {
      // 1) Preguntamos al backend
      const data = await http('/businesses/active', { withBusinessId: false });
      const id = data?.activeBusinessId ?? null;

      if (id) {
        setActiveBusinessIdLS(id);
      } else {
        localStorage.removeItem('activeBusinessId');
      }

      return { activeBusinessId: id, business: data?.business ?? null };
    } catch (e) {
      console.warn('[BusinessesAPI.getActive] backend falló, uso LS', e);
      // 2) Fallback: lo que haya en LS
      const idStr = localStorage.getItem('activeBusinessId');
      const id = idStr ? Number(idStr) : null;
      return { activeBusinessId: id, business: null };
    }
  },

  // Cambiar negocio activo: backend + localStorage + user en LS
  async setActive(businessId) {
    const id = Number(businessId);
    if (!Number.isFinite(id)) throw new Error('businessId inválido');

    // 1) Avisar al backend: PATCH /businesses/active
    let serverResp = null;
    try {
      serverResp = await http('/businesses/active', {
        method: 'PATCH',
        body: { businessId: id },
        withBusinessId: false,
      });
    } catch (e) {
      console.warn('[BusinessesAPI.setActive] PATCH /businesses/active falló, sigo con LS', e);
    }

    // 2) Guardar en localStorage (fuente de verdad para el front)
    setActiveBusinessIdLS(id);

    // 3) Actualizar también el user cacheado en localStorage (por si alguien usa active_business_id)
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        u.active_business_id = id;
        localStorage.setItem('user', JSON.stringify(u));
      }
    } catch {
      // no rompemos nada
    }

    // 4) Best-effort: mantener también la ruta vieja /businesses/:id/select
    try {
      if (typeof BusinessesAPI.select === 'function') {
        await BusinessesAPI.select(id);
      }
    } catch (e) {
      const msg = String(e?.message || '');
      if (!msg.startsWith('not_found')) {
        console.warn('[BusinessesAPI.setActive] fallo select (legacy), pero seguimos', e);
      }
    }

    return serverResp || { activeBusinessId: id };
  },

  // ---- Logo: subir archivo (FormData) ----
  uploadLogo: async (id, file) => {
    const fd = new FormData();
    fd.append('file', file, file?.name || 'logo.png');

    // 🔍 Verificar que el FormData tenga el archivo
    for (let [key, value] of fd.entries()) {
    }

    const token = localStorage.getItem('token') || '';

    const url = `${BASE}/businesses/${id}/logo`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // ⚠️ NO incluir Content-Type - el browser lo setea automáticamente con boundary
      },
      body: fd,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('❌ Error del servidor:', error);
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;
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

  // ───────── ✅ NUEVO: Serie de ventas por artículo ─────────
  /**
   * GET /businesses/:id/sales/:articuloId?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day
   * 
   * Devuelve serie de ventas para un artículo específico de un negocio.
   * Respuesta esperada: { total?, items: [{label, qty, amount}] }
   * 
   * @param {number} businessId - ID del negocio
   * @param {number|string} articuloId - ID del artículo
   * @param {object} options - { from, to, groupBy }
   * @returns {Promise} Respuesta del servidor con la serie de ventas
   */
  salesSeries: (businessId, articuloId, { from, to, groupBy = 'day' } = {}) => {
    if (!businessId || !articuloId || !from || !to) {
      throw new Error('salesSeries requiere: businessId, articuloId, from, to');
    }

    const qs = new URLSearchParams({
      from,
      to,
      groupBy,
    });

    return http(
      `/businesses/${encodeURIComponent(businessId)}/sales/${encodeURIComponent(articuloId)}?${qs.toString()}`,
      {
        method: 'GET',
        withBusinessId: false, // Ya está en la URL
      }
    );
  },

  // Sync catálogo (Maxi → DB)
  syncNow: (id, body) =>
    http(`/businesses/${id}/sync`, {
      method: 'POST',
      body,
      withBusinessId: false,
    }),

  // Restaurar nombres/rubros/subrubros a los valores originales de MaxiRest
  restoreMaxi: (id) =>
    http(`/businesses/${id}/restore-maxi`, {
      method: 'POST',
      withBusinessId: false,
    }),

  async getViewPrefs(businessId, { divisionId = null, scope = null } = {}) {
    if (!businessId) return { ok: true, byGroup: {} };

    try {
      const div = normalizeDivisionId(divisionId);

      const qs = new URLSearchParams();
      if (div != null) qs.set('divisionId', String(div));
      if (scope) qs.set('scope', String(scope)); // ✅ 'articulo' | 'insumo'

      const resp = await http(
        `/businesses/${businessId}/view-prefs${qs.toString() ? `?${qs}` : ''}`,
        { method: 'GET', withBusinessId: false }
      );

      return resp || { ok: true, byGroup: {} };
    } catch (e) {
      console.error('[BusinessesAPI.getViewPrefs] Error:', e);
      return { ok: false, byGroup: {} };
    }
  },

  async saveViewPref(businessId, { agrupacionId, viewMode, divisionId = null, scope = null }) {
    if (!businessId || !agrupacionId || !viewMode) return;

    try {
      const div = normalizeDivisionId(divisionId);

      await http(`/businesses/${businessId}/view-prefs`, {
        method: 'POST',
        body: {
          agrupacionId,
          viewMode,
          divisionId: div,
          scope: scope || null, // ✅ 'articulo' | 'insumo' | null
        },
        withBusinessId: false,
      });
    } catch (e) {
      console.error('saveViewPref failed', e);
    }
  },

  async getFavoriteGroup(businessId, { scope = 'articulo', divisionId = null } = {}) {
    if (!businessId) return { ok: true, favoriteGroupId: null };

    try {
      const div = normalizeDivisionId(divisionId);

      const qs = new URLSearchParams();
      qs.set('scope', scope);
      if (div != null) qs.set('divisionId', String(div));

      // ✅ Usar httpBiz que ya maneja /businesses/:id automáticamente
      const resp = await httpBiz(
        `/fav-group?${qs.toString()}`,
        { method: 'GET' },
        businessId
      );

      return resp || { ok: true, favoriteGroupId: null };
    } catch (e) {
      console.error('[getFavoriteGroup] Error:', e);
      return { ok: false, favoriteGroupId: null };
    }
  },

  async createManualArticle(businessId, { nombre, precio, rubro, subrubro }) {
    return http(`/businesses/${businessId}/articles/manual`, {
      method: 'POST',
      body: JSON.stringify({ nombre, precio, rubro, subrubro }),
    });
  },

  async deleteManualArticle(businessId, articleId) {
    return http(`/businesses/${businessId}/articles/${articleId}`, {
      method: 'DELETE',
    });
  },

  async saveFavoriteGroup(businessId, agrupacionId, { scope = 'articulo', divisionId = null } = {}) {
    if (!businessId) return;

    try {
      const div = normalizeDivisionId(divisionId);

      // ✅ Usar httpBiz
      await httpBiz(
        '/fav-group',
        {
          method: 'POST',
          body: {
            agrupacionId: agrupacionId ?? null,
            scope,
            divisionId: div,
          },
        },
        businessId
      );
    } catch (e) {
      console.error('[saveFavoriteGroup] Error:', e);
      throw e;
    }
  },
};


/* ======================= Recetas Costos ======================= */
export const RecetasAPI = {
  // GET /businesses/:id/recetas-costos
  // Devuelve { [articleId]: { costoTotal, porciones, tieneAlerta, insumosAlerta } }
  getCostos: (businessId) =>
    http(`/businesses/${businessId}/recetas-costos`, { withBusinessId: false }),

  // GET /businesses/:id/recetas-alertas
  // Devuelve lista de insumos con compras vencidas usados en recetas
  getAlertas: (businessId) =>
    http(`/businesses/${businessId}/recetas-alertas`, { withBusinessId: false }),

  // GET /businesses/:id/recetas/bulk-preview?tipo=...&filtroScope=...&agrupacionId=...
  // Devuelve { count } — cuántas recetas se borrarían con esos filtros
  previewBulkDelete: (businessId, { tipo, filtroScope = 'all', agrupacionId = null } = {}) => {
    const qs = new URLSearchParams({ tipo, filtroScope });
    if (agrupacionId != null) qs.set('agrupacionId', String(agrupacionId));
    return http(`/businesses/${businessId}/recetas/bulk-preview?${qs}`, { withBusinessId: false });
  },

  // DELETE /businesses/:id/recetas/bulk
  // Body: { tipo: 'articulo'|'elaborado', filtroScope: 'all'|'agrupacion', agrupacionId? }

  bulkDelete: (businessId, { tipo, filtroScope = 'all', agrupacionId = null } = {}) =>
    http(`/businesses/${businessId}/recetas/bulk`, {
      method: 'DELETE',
      body: { tipo, filtroScope, agrupacionId },
      withBusinessId: false,
    }),

  // POST /businesses/:id/recetas/bulk-add-insumo
  // Body: { articleIds, insumoId, cantidad, unidad }
  // Devuelve { ok, agregados, salteados, recetasCreadas, insumo }
  bulkAddInsumo: (businessId, { articleIds, insumoId, cantidad = 0, unidad = null }) =>
    http(`/businesses/${businessId}/recetas/bulk-add-insumo`, {
      method: 'POST',
      body: { articleIds, insumoId, cantidad, unidad },
      withBusinessId: false,
    }),

    // POST /businesses/:id/recetas/insumos-usados
  // Body: { articleIds } → { data: [{insumo_id, nombre, en_cuantos, ...}], total }
  insumosUsados: (businessId, articleIds) =>
    http(`/businesses/${businessId}/recetas/insumos-usados`, {
      method: 'POST',
      body: { articleIds },
    }),

  // GET /businesses/:id/recetas/promo-components → { ids: [...] }
  getPromoComponents: (businessId) =>
    http(`/businesses/${businessId}/recetas/promo-components`, { withBusinessId: false }),

  getPromoIds: (businessId) =>
    http(`/businesses/${businessId}/recetas/promo-ids`, { withBusinessId: false }),

  getVentaSinPromo: (businessId) =>
    http(`/businesses/${businessId}/recetas/venta-sin-promo`, { withBusinessId: false }),
};

export const PromocionesAPI = {
  crear: (businessId, body) =>
    http(`/businesses/${businessId}/promociones`, {
      method: 'POST', body, withBusinessId: false,
    }),
    
    actualizar: (businessId, promoId, body) =>
    http(`/businesses/${businessId}/promociones/${promoId}`, {
      method: 'PUT', body, withBusinessId: false,
    }),

    eliminar: (businessId, promoId) =>
    http(`/businesses/${businessId}/promociones/${promoId}`, { 
      method: 'DELETE', withBusinessId: false 
    }),
};

/* ======================= Article Price Config ======================= */
export const PriceConfigAPI = {
  // GET /businesses/:id/article-price-config
  getAll: (businessId) =>
    http(`/businesses/${businessId}/article-price-config`, { withBusinessId: false }),

  // POST /businesses/:id/article-price-config
  // { scope, scopeId, objetivo?, precioManual?, articleIds? }
  save: (businessId, body) =>
    http(`/businesses/${businessId}/article-price-config`, {
      method: 'POST',
      body,
      withBusinessId: false,
    }),

  // DELETE /businesses/:id/article-price-config
  // { scope, scopeId }
  remove: (businessId, body) =>
    http(`/businesses/${businessId}/article-price-config`, {
      method: 'DELETE',
      body,
      withBusinessId: false,
    }),
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