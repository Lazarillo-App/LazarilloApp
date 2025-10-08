// src/servicios/apiVentas.js
import axios from 'axios';
import { BASE } from './apiBase';

// --- Auth headers centralizados (Bearer + x-business-id) ---
function authHeaders() {
  const token = localStorage.getItem('token') || '';
  const bid = localStorage.getItem('activeBusinessId') || '';
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid) h['x-business-id'] = bid;
  return h;
}

// --- Cache con TTL ---
const ventasCache = new Map();
const TTL_MS = 10 * 60 * 1000; // 10m
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

/**
 * Serie de ventas (por artículo / código / búsqueda), agrupada (day).
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
}) {
  if ((!articuloId && !codigo && !q) || !from || !to) {
    return { total: 0, items: [] };
  }

  const bid = localStorage.getItem('activeBusinessId') || '';
  const key = `${bid}|${articuloId ?? ''}|${codigo ?? ''}|${q ?? ''}|${from}|${to}|${groupBy}|${ignoreZero ? 1 : 0}`;

  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    ...(articuloId ? { articuloId: String(articuloId) } : {}),
    ...(codigo ? { codigo: String(codigo) } : {}),
    ...(q ? { q: String(q) } : {}),
    from,
    to,
    groupBy,
    ignoreZero: ignoreZero ? 'true' : 'false',
  });

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(`${BASE}/ventas?${params.toString()}`, {
        timeout: TIMEOUT_MS,
        headers: authHeaders(),
      });

      const total = Number(data?.totals?.qty ?? 0);
      const items = Array.isArray(data?.data)
        ? data.data.map((d) => ({
          label: String(d.date),
          qty: Number(d.qty || 0),
        }))
        : [];

      const res = { total, items };
      cacheSet(key, res);
      return res;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(150 * (attempt + 1));
        continue;
      }
      console.warn('[apiVentas.obtenerVentas] error:', err?.message || err);
      const last = cacheGet(key);
      if (last) return last;
      return { total: 0, items: [] };
    }
  }
}

// --- Peek (ranking de artículos en el rango) ---
// GET /api/ventas?peek=true&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100
export async function obtenerPeek({ from, to, limit = 100 }) {
  const bid = localStorage.getItem('activeBusinessId') || '';
  const key = `peek|${bid}|${from}|${to}|${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({ peek: 'true', from, to, limit: String(limit) });
  try {
    const { data } = await axios.get(`${BASE}/ventas?${params.toString()}`, {
      timeout: TIMEOUT_MS,
      headers: authHeaders(),     // ✅ faltaba esto
    });

    const items = Array.isArray(data?.peek) ? data.peek : [];
    const res = {
      count: Number(data?.count ?? items.length),
      items,                           // [{ articuloId, qty }]
      from: data?.rango?.from,
      to: data?.rango?.to,
    };
    cacheSet(key, res);
    return res;
  } catch (err) {
    console.warn('[apiVentas.obtenerPeek] error:', err?.message || err);
    return { count: 0, items: [], from, to };
  }
}

/* ========================== Ventas por Agrupación (fallback) ========================== */
export async function obtenerVentasAgrupacion({
  agrupacionId,
  from,
  to,
  articuloIds = [],
  groupBy = 'day',
  ignoreZero = true,
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
          })
        )
      );
      grupo.forEach((id, idx) => {
        const t = Number(resps[idx]?.total ?? 0);
        mapa.set(Number(id), t);
        total += t;
      });
    }
  } catch (err) {
    console.warn('[apiVentas.obtenerVentasAgrupacion] fallback error:', err?.message || err);
  }

  const items = Array.from(mapa.entries()).map(([articuloId, cantidad]) => ({
    articuloId,
    cantidad,
  }));
  return { total, items, mapa, from, to };
}
