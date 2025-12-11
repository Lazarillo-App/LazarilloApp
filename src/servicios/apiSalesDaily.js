// src/servicios/apiSalesDaily.js
import { BASE } from './apiBase';

/**
 * Obtiene items de ventas sin agregación desde:
 * GET /api/businesses/:id/sales/items?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=5000
 * 
 * Devuelve: { ok: true, items: [...], totals: {...} }
 */
export async function fetchDailyItems({ 
  businessId, 
  from, 
  to, 
  limit = 5000, 
  signal 
}) {
  if (!businessId || !from || !to) {
    throw new Error('fetchDailyItems: faltan parámetros (businessId, from, to)');
  }

  const token = localStorage.getItem('token') || '';
  const qs = new URLSearchParams({ from, to, limit: String(limit) }).toString();
  
  const url = `${BASE}/businesses/${encodeURIComponent(businessId)}/sales/items?${qs}`;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };

  const resp = await fetch(url, { 
    method: 'GET', 
    headers,
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `Error ${resp.status} al obtener items de ventas`);
  }

  const data = await resp.json();
  return data; // { ok, items, totals }
}

/**
 * Agrupa las filas por article_id:
 * - suma qty
 * - suma amount
 * 
 * Devuelve: Array<{ articleId, title, qty, amount }>
 */
export function aggregateByArticle(items = []) {
  const map = new Map();

  for (const row of items) {
    const id = row.article_id;
    if (!id) continue;

    let acc = map.get(id);
    if (!acc) {
      acc = {
        articleId: id,
        title: row.article_title ?? row.nombre ?? '',
        qty: 0,
        amount: 0,
      };
      map.set(id, acc);
    }

    acc.qty += Number(row.qty || 0);
    acc.amount += Number(row.amount || 0);
  }

  return Array.from(map.values());
}

/**
 * Detecta si los amounts vienen en centavos (heurística).
 * Si la mediana de amount/qty es > 100, probablemente está en centavos.
 * Devuelve el factor de escala (1 = pesos, 100 = centavos).
 */
export function detectAmountScale(items = []) {
  const validItems = items.filter(
    (r) => Number(r.qty) > 0 && Number(r.amount) > 0
  );

  if (validItems.length < 3) return 1;

  const ratios = validItems
    .map((r) => Number(r.amount) / Number(r.qty))
    .slice(0, 20); // muestra

  const sorted = [...ratios].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  // Si median > 100, probablemente está en centavos
  return median > 100 ? 100 : 1;
}

/**
 * Normaliza los amounts dividiendo por la escala detectada.
 */
export function normalizeAmounts(items = [], scale = 1) {
  if (scale === 1) return items;

  return items.map((item) => ({
    ...item,
    amount: Number(item.amount) / scale,
  }));
}