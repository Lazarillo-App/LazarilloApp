/* eslint-disable no-empty */
// src/servicios/apiVentas.js
/* eslint-disable no-console */
import axios from 'axios';
import { BASE } from './apiBase';

/* ============================== Headers ============================== */
// Bearer + X-Business-Id (opcional override)
function authHeaders(overrideBizId) {
  const token = localStorage.getItem('token') || '';
  const fallbackBid = localStorage.getItem('activeBusinessId') || '';
  const bid = String(
    (overrideBizId !== undefined && overrideBizId !== null) ? overrideBizId : fallbackBid
  );
  let role = null;
  try { role = JSON.parse(localStorage.getItem('user') || 'null')?.role || null; } catch { }

  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid && role !== 'app_admin') h['X-Business-Id'] = bid;
  return h;
}

/* ============================== Cache ============================== */
const ventasCache = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 minutos
const now = () => Date.now();

function cacheGet(key) {
  const entry = ventasCache.get(key);
  if (!entry) return null;
  if (now() - entry.at > TTL_MS) {
    ventasCache.delete(key);
    return null;
  }
  return entry.data;
}
function cacheSet(key, data) {
  ventasCache.set(key, { at: now(), data });
}
export function clearVentasCache() {
  ventasCache.clear();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ======================= Manejo de auth errors ======================= */
function handleAuthError(err) {
  const status = err && err.response ? err.response.status : undefined;
  if (status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    window.location.href = '/login';
    return true; // ya redirigimos
  }
  if (status === 403) {
    // p.ej. no_access_to_business -> limpiar activo para forzar reelección
    localStorage.removeItem('activeBusinessId');
    window.dispatchEvent(new Event('business:switched'));
    return false;
  }
  return false;
}

/* ============================== Ventas ============================== */
/**
 * Serie de ventas (por artículo / código / búsqueda), agrupada por día.
 * Back: { totals:{qty,amount}, data:[{date, qty, amount}] }
 * Front: { total, items:[{label, qty}] }
 */
const TIMEOUT_MS = 200000;

export async function obtenerVentas({
  articuloId,
  codigo,
  q,
  from,
  to,
  groupBy = 'day',
  ignoreZero = true,
  businessId, // opcional: consultar otro local explícitamente
}) {
  if (!articuloId || !from || !to) {
    return { total: 0, items: [] };
  }

  const localBid = localStorage.getItem('activeBusinessId') || '';
  const bid = String((businessId !== undefined && businessId !== null) ? businessId : localBid);

  const key = [
    bid,
    (articuloId !== undefined && articuloId !== null) ? articuloId : '',
    (codigo !== undefined && codigo !== null) ? codigo : '',
    (q !== undefined && q !== null) ? q : '',
    from,
    to,
    groupBy,
    (ignoreZero ? 1 : 0),
  ].join('|');

  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    articuloId: String(articuloId),
    from,
    to,
    groupBy, // 'day' | 'week' | 'month'
  });

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(`${BASE}/ventas/by-article?${params.toString()}`, {
        timeout: TIMEOUT_MS,
        headers: authHeaders(businessId),
      });
      // Backend: { total, items:[{label, qty}] }
      const total = Number(data?.total || 0);
      const items = Array.isArray(data?.items)
        ? data.items.map(d => ({ label: String(d.label), qty: Number(d.qty || 0) }))
        : [];

      const res = { total, items };
      cacheSet(key, res);
      return res;
    } catch (err) {
      if (handleAuthError(err)) break;
      if (attempt < MAX_RETRIES) {
        await sleep(150 * (attempt + 1));
        continue;
      }
      console.warn('[apiVentas.obtenerVentas] error:', err && err.message ? err.message : err);
      const last = cacheGet(key);
      if (last) return last;
      return { total: 0, items: [] };
    }
  }
}

/* =============================== Peek =============================== */
// GET /api/ventas?peek=true&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100
export async function obtenerPeek({ from, to, limit = 100, businessId }) {
  const localBid = localStorage.getItem('activeBusinessId') || '';
  const bid = String((businessId !== undefined && businessId !== null) ? businessId : localBid);

  const key = `peek|${bid}|${from}|${to}|${String(limit)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    peek: 'true',
    from,
    to,
    limit: String(limit),
  });

  try {
    const { data } = await axios.get(`${BASE}/ventas?${params.toString()}`, {
      timeout: TIMEOUT_MS,
      headers: authHeaders(businessId),
    });

    const items = Array.isArray(data && data.peek) ? data.peek : [];
    const res = {
      count: Number((data && data.count) != null ? data.count : items.length),
      items, // [{ articuloId, qty }]
      from: data && data.rango ? data.rango.from : undefined,
      to: data && data.rango ? data.rango.to : undefined,
    };
    cacheSet(key, res);
    return res;
  } catch (err) {
    handleAuthError(err);
    console.warn('[apiVentas.obtenerPeek] error:', err && err.message ? err.message : err);
    return { count: 0, items: [], from, to };
  }
}

/* ===================== Ventas por Agrupación (fallback) ===================== */
export async function obtenerVentasAgrupacion({
  agrupacionId,
  from,
  to,
  articuloIds = [],
  groupBy = 'day',
  ignoreZero = true,
  businessId, // opcional
}) {
  if (!agrupacionId || !from || !to || !articuloIds.length) {
    return { total: 0, items: [], mapa: new Map(), from, to };
  }

  const chunk = (arr, size = 3) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const mapa = new Map();
  let total = 0;

  try {
    for (const grupo of chunk(articuloIds, 3)) {
      const resps = await Promise.all(
        grupo.map((id) =>
          obtenerVentas({
            articuloId: id,
            from,
            to,
            groupBy,
            ignoreZero,
            businessId,
          })
        )
      );
      grupo.forEach((id, idx) => {
        const t = Number(resps[idx] && resps[idx].total ? resps[idx].total : 0);
        mapa.set(Number(id), t);
        total += t;
      });
    }
  } catch (err) {
    console.warn('[apiVentas.obtenerVentasAgrupacion] fallback error:', err && err.message ? err.message : err);
  }

  const items = Array.from(mapa.entries()).map(([articuloId, cantidad]) => ({
    articuloId,
    cantidad,
  }));
  return { total, items, mapa, from, to };
}

export async function obtenerVentasLegacy({ articuloId, from, to }) {
  const { data } = await axios.get(`${BASE}/ventas/${encodeURIComponent(articuloId)}/series?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    timeout: TIMEOUT_MS,
    headers: authHeaders(),
  });
  // legacy shape: { data:[{date, qty}], ... }
  const items = Array.isArray(data?.data)
    ? data.data.map(d => ({ label: String(d.date), qty: Number(d.qty || 0) }))
    : [];
  const total = items.reduce((a, x) => a + x.qty, 0);
  return { total, items };
}
