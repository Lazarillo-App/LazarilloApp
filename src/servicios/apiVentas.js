// src/servicios/apiVentas.js
import axios from 'axios';
import { BASE } from './apiBase';

// --- Auth headers centralizados (Bearer + x-business-id) ---
function authHeaders() {
  const token = localStorage.getItem('token') || '';
  const bid   = localStorage.getItem('activeBusinessId') || '';
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid)   h['x-business-id'] = bid;
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
 * Obtiene ventas del artículo o código o búsqueda por nombre, agrupadas por día.
 * Backend devuelve shape:
 *  { totals:{qty,amount}, data:[{date, qty, amount}] }
 * Devolvemos shape compatible con tus componentes: { total, items:[{label, qty}] }
 *
 * @param {{
 *   articuloId?: number|string,
 *   codigo?: string,
 *   q?: string,
 *   from: string,
 *   to: string,
 *   groupBy?: 'day',
 *   ignoreZero?: boolean
 * }}
 * @returns {{ total:number, items: {label:string, qty:number}[] }}
 */
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
        timeout: 20000,
        headers: authHeaders(),
      });

      // Backend nuevo:
      // data.totals.qty -> total unidades
      // data.data -> [{date, qty, amount}]
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

/* ========================== Ventas por Agrupación (fallback) ========================== */
/**
 * Suma ventas por cada artículo de la agrupación en paralelo moderado.
 * Devuelve también un Map(articuloId -> total) para ordenar/mostrar.
 */
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
