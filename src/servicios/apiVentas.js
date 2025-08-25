import axios from 'axios';
import { BASE } from './apiBase';

// 🔧 toggle fast-path (dejalo en false hasta que exista el endpoint backend)
const FASTPATH_VENTAS_AGRUP = false;

/** Cache por artículo/rango para estabilizar fallback (y ahorrar requests) */
const ventasCache = new Map(); // key: `${id}|${from}|${to}|${groupBy}` -> { total, items }

/** delay util */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Obtiene ventas SOLO del artículo indicado, agrupadas por day|week|month.
 * Añade: cache + reintentos para estabilizar resultados.
 * @param {{articuloId:number|string, from:string, to:string, groupBy?:'day'|'week'|'month'}} params
 * @returns {{ total:number, items: {label:string, qty:number}[] }}
 */
export async function obtenerVentas({ articuloId, from, to, groupBy = 'day' }) {
  if (!articuloId || !from || !to) return { total: 0, items: [] };

  const key = `${articuloId}|${from}|${to}|${groupBy}`;
  if (ventasCache.has(key)) return ventasCache.get(key);

  const params = new URLSearchParams({
    articuloId: String(articuloId),
    from,
    to,
    groupBy
  });

  // Reintentos suaves por si el backend se estresa
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(`${BASE}/ventas?${params.toString()}`, { timeout: 15000 });

      const total = Number(data?.total ?? 0);
      const items = Array.isArray(data?.items)
        ? data.items.map(it => ({ label: String(it.label), qty: Number(it.qty || 0) }))
        : [];

      const res = { total, items };
      ventasCache.set(key, res);
      return res;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(150 * (attempt + 1)); // backoff cortito
        continue;
      }
      console.warn('[apiVentas.obtenerVentas] error:', err?.message || err);
      // Si teníamos algo previo en cache, preferimos eso antes que 0
      if (ventasCache.has(key)) return ventasCache.get(key);
      return { total: 0, items: [] };
    }
  }
}

/* ========================== Ventas por Agrupación ========================== */
/**
 * Obtiene ventas agregadas por agrupación.
 * Fast-path: GET /ventas/agrupacion (si existe en tu backend).
 * Fallback: suma por artículo usando obtenerVentas() (con cache + retries).
 */
export async function obtenerVentasAgrupacion({
  agrupacionId,
  from,
  to,
  articuloIds = [],
  groupBy = 'day'
}) {
  if (!agrupacionId || !from || !to) {
    return { total: 0, items: [], mapa: new Map(), from, to };
  }

  // ---------- Fast-path (desactivado hasta tener backend) ----------
  if (FASTPATH_VENTAS_AGRUP) {
    try {
      const params = new URLSearchParams({
        agrupacionId: String(agrupacionId),
        from,
        to,
        groupBy
      });

      const { data } = await axios.get(`${BASE}/ventas/agrupacion?${params.toString()}`, { timeout: 20000 });

      const arr = Array.isArray(data?.items) ? data.items : [];
      const items = arr
        .map(it => ({
          articuloId: Number(it.articuloId ?? it.id ?? it.articulo_id),
          cantidad: Number(it.cantidad ?? it.qty ?? it.total ?? 0)
        }))
        .filter(x => Number.isFinite(x.articuloId));

      const mapa = new Map(items.map(it => [it.articuloId, it.cantidad]));
      const total = Number.isFinite(Number(data?.total))
        ? Number(data.total)
        : items.reduce((acc, it) => acc + (it.cantidad || 0), 0);

      return { total, items, mapa, from, to };
    } catch (err) {
      const status = err?.response?.status;
      if (!status || status !== 404) {
        console.warn('[apiVentas.obtenerVentasAgrupacion] fast-path falló:', status, err?.message || err);
      }
      // cae a fallback
    }
  }

  // ---------- Fallback: sumar por artículo (concurrency + cache + retries) ----------
  if (!articuloIds.length) {
    return { total: 0, items: [], mapa: new Map(), from, to };
  }

  // Concurrencia baja para no saturar; ya tenemos cache y reintentos
  const chunk = (arr, size = 3) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const mapa = new Map();
  let total = 0;

  try {
    for (const grupo of chunk(articuloIds, 3)) {
      const reqs = grupo.map(id => obtenerVentas({ articuloId: id, from, to, groupBy }));
      const resps = await Promise.all(reqs);
      grupo.forEach((id, idx) => {
        const t = Number(resps[idx]?.total ?? 0);
        mapa.set(Number(id), t);
        total += t;
      });
    }
  } catch (err) {
    console.warn('[apiVentas.obtenerVentasAgrupacion] fallback error:', err?.message || err);
  }

  const items = [...mapa.entries()].map(([articuloId, cantidad]) => ({ articuloId, cantidad }));
  return { total, items, mapa, from, to };
}