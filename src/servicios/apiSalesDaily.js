// src/servicios/apiSalesDaily.js
import api from './apiBase'; 

export async function fetchDailyItems({ businessId, from, to, limit = 5000, signal }) {
  const res = await api.get(`/businesses/${businessId}/sales/items`, {
    params: { from, to, limit },
    signal,
  });
  return res.data; // { ok, items, totals, ... }
}

/**
 * Agrupa las filas por article_id:
 * - suma qty
 * - suma amount
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
        title: row.article_title ?? '',
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
