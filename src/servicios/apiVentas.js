/* eslint-disable no-unused-vars */

// src/servicios/apiVentas.js
import { http, BusinessesAPI } from './apiBusinesses';

/* ============================== Helpers ============================== */
const TIMEOUT_MS = 200000; // 200s (Render puede estar lerdo)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readRole() {
  try { return JSON.parse(localStorage.getItem('user') || 'null')?.role || null; }
  catch { return null; }
}
function getActiveBizId() {
  return localStorage.getItem('activeBusinessId') || '';
}
function ventasHeaders(businessId) {
  const role = readRole();
  const bid = String(businessId ?? getActiveBizId());
  const h = {};
  // Ventas SIEMPRE requieren X-Business-Id (salvo app_admin, que está prohibido)
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

/* ======================= Manejo de auth errors ======================= */
function handleAuthErrorLike(err) {
  // `http()` ya redirige en 401, pero si algo bubbla, cubrimos:
  if (String(err?.message || '').includes('invalid_token')) return true;
  return false;
}

/* ============================== Ventas ============================== */
/**
 * Serie de ventas (por artículo / código / búsqueda), agrupada por día/semana/mes.
 * Back esperado: { total, items:[{label, qty}] }
 * Front devuelto: { total, items:[{label, qty}] }
 */
export async function obtenerVentas({
  articuloId,
  codigo,
  q,
  from,
  to,
  groupBy = 'day',
  ignoreZero = true,   // hoy no se usa, mantenemos firma
  businessId,          // opcional: consultar otro local explícitamente
  signal,              // opcional: cancelación externa
  timeoutMs = TIMEOUT_MS,
}) {
  if ((!articuloId && !codigo && !q) || !from || !to) {
    return { total: 0, items: [] };
  }

  const bid = String(businessId ?? getActiveBizId());

  const key = [
    bid,
    articuloId ?? '',
    codigo ?? '',
    q ?? '',
    from,
    to,
    groupBy,
    ignoreZero ? 1 : 0,
  ].join('|');

  const cached = cacheGet(key);
  if (cached) return cached;

  const qs = new URLSearchParams();
  if (articuloId != null) qs.set('articuloId', String(articuloId));
  if (codigo != null)     qs.set('codigo', String(codigo));
  if (q != null)          qs.set('q', String(q));
  qs.set('from', from);
  qs.set('to', to);
  qs.set('groupBy', groupBy);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await http(
        `/ventas/by-article?${qs.toString()}`,
        {
          withBusinessId: false,
          headers: ventasHeaders(businessId),
          timeoutMs,
          signal,
        }
      );

      const total = Number(data?.total || 0);
      const items = Array.isArray(data?.items)
        ? data.items.map(d => ({ label: String(d.label), qty: Number(d.qty || 0) }))
        : [];

      const res = { total, items };
      cacheSet(key, res);
      return res;
    } catch (err) {
      if (handleAuthErrorLike(err)) break;
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

/* =============================== Peek =============================== */
/**
 * GET /api/ventas?peek=true&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100
 * Devuelve top items agregados (rápido para pintar UI).
 */
export async function obtenerPeek({
  from,
  to,
  limit = 100,
  businessId,
  signal,
  timeoutMs = TIMEOUT_MS,
}) {
  const bid = String(businessId ?? getActiveBizId());
  const key = `peek|${bid}|${from}|${to}|${String(limit)}`;

  const cached = cacheGet(key);
  if (cached) return cached;

  const qs = new URLSearchParams({
    peek: 'true',
    from,
    to,
    limit: String(limit),
  });

  try {
    const data = await http(
      `/ventas?${qs.toString()}`,
      {
        withBusinessId: false,
        headers: ventasHeaders(businessId),
        timeoutMs,
        signal,
      }
    );

    const items = Array.isArray(data?.peek) ? data.peek : [];
    const res = {
      count: Number((data && data.count) != null ? data.count : items.length),
      items, // [{ articuloId, qty }]
      from: data?.rango?.from ?? from,
      to:   data?.rango?.to   ?? to,
    };
    cacheSet(key, res);
    return res;
  } catch (err) {
    handleAuthErrorLike(err);
    console.warn('[apiVentas.obtenerPeek] error:', err?.message || err);
    return { count: 0, items: [], from, to };
  }
}

/* ===================== Ventas por Agrupación (fallback) ===================== */
/**
 * Hace fan-out por artículo y suma totales.
 * Sugerencia: usar endpoints agregados si el back los expone.
 */
export async function obtenerVentasAgrupacion({
  agrupacionId,
  from,
  to,
  articuloIds = [],
  groupBy = 'day',
  ignoreZero = true,
  businessId,
  signal,
  timeoutMs = TIMEOUT_MS,
}) {
  if (!agrupacionId || !from || !to || !articuloIds.length) {
    return { total: 0, items: [], mapa: new Map(), from, to };
  }

  // Para evitar cancelar todo el batch si se aborta uno,
  // no compartimos el mismo signal en los hijos (a menos que lo quieras).
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
            // podrías pasar `signal` si querés abortar en cadena
            timeoutMs,
          })
        )
      );
      grupo.forEach((id, idx) => {
        const t = Number(resps[idx]?.total || 0);
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

/* ============================== Legacy ============================== */
/**
 * Compat: /ventas/:articuloId/series?from&to
 * Devuelve { total, items:[{label, qty}] }
 */
export async function obtenerVentasLegacy({ articuloId, from, to, businessId, signal, timeoutMs = TIMEOUT_MS }) {
  const qs = new URLSearchParams({ from, to });
  const data = await http(
    `/ventas/${encodeURIComponent(articuloId)}/series?${qs.toString()}`,
    {
      withBusinessId: false,
      headers: ventasHeaders(businessId),
      timeoutMs,
      signal,
    }
  );

  const items = Array.isArray(data?.data)
    ? data.data.map(d => ({ label: String(d.date), qty: Number(d.qty || 0) }))
    : [];
  const total = items.reduce((a, x) => a + x.qty, 0);
  return { total, items };
}

// ================= Ventas por artículo usando /businesses/:id/sales/:articuloId =================
/**
 * Usa el endpoint nuevo:
 *   GET /api/businesses/:id/sales/:articuloId?from&to&groupBy
 * y lo adapta al shape { total, items:[{label, qty, amount}] }.
 */
export async function obtenerVentasSeriesDB({
  articuloId,
  from,
  to,
  groupBy = 'day',
  businessId,
}) {
  if (!articuloId || !from || !to) {
    return { total: 0, items: [] };
  }

  const bid = Number(businessId ?? getActiveBizId());
  if (!Number.isFinite(bid)) {
    console.warn('[obtenerVentasSeriesDB] businessId inválido');
    return { total: 0, items: [] };
  }

  const key = `seriesDB|${bid}|${articuloId}|${from}|${to}|${groupBy}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const raw = await BusinessesAPI.salesSeries(bid, articuloId, { from, to, groupBy });

    // 1) Elegimos el array correcto: items / series / data.items
    const itemsRaw =
      (Array.isArray(raw?.items) && raw.items) ||
      (Array.isArray(raw?.series) && raw.series) ||
      (Array.isArray(raw?.data?.items) && raw.data.items) ||
      [];

    const items = itemsRaw.map((d) => ({
      label: String(d.label ?? d.date ?? d.fecha ?? ''),
      qty: Number(
        d.qty ??
        d.cantidad ??
        d.unidades ??
        d.total_u ??
        0
      ),
      amount: Number(
        d.amount ??
        d.total ??
        d.importe ??
        0
      ),
    }));

    // 2) Total “candidato” que pueda mandar el back
    const totalCandidate =
      raw?.total ??
      raw?.total_u ??
      raw?.total_qty ??
      raw?.resumen?.total ??
      raw?.resumen?.total_u ??
      raw?.resumen?.total_qty;

    // 3) Si no hay total confiable, lo calculamos sumando qty
    const totalFromItems = items.reduce((acc, x) => {
      const v = Number(x.qty);
      return acc + (Number.isNaN(v) ? 0 : v);
    }, 0);

    const total =
      typeof totalCandidate === 'number' && !Number.isNaN(totalCandidate)
        ? totalCandidate
        : totalFromItems;

    const res = { total, items };
    cacheSet(key, res);
    return res;
  } catch (err) {
    console.warn('[apiVentas.obtenerVentasSeriesDB] error:', err?.message || err);
    const last = cacheGet(key);
    if (last) return last;
    return { total: 0, items: [] };
  }
}
