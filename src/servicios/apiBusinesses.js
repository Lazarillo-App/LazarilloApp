// src/servicios/apiBusinesses.js
import { BASE } from './apiBase';

export function authHeaders(extra = {}) {
  const token = localStorage.getItem('token') || '';
  const bid   = localStorage.getItem('activeBusinessId') || '';
  const h = { 'Content-Type': 'application/json', ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid && !h['X-Business-Id']) h['X-Business-Id'] = bid;
  return h;
}
// src/servicios/apiBusinesses.js
async function http(path, { method='GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!res.ok) {
    const msg = data?.detail ? `${data.error}: ${data.detail}` : (data?.error || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

export const BusinessesAPI = {
  listMine : async () => (await http('/businesses'))?.items ?? [],
  get      : (id) => http(`/businesses/${id}`),
  create   : (payload) => http('/businesses', { method: 'POST', body: payload }),
  update   : (id, body) => http(`/businesses/${id}`, { method: 'PATCH', body }),
  remove   : (id) => http(`/businesses/${id}`, { method: 'DELETE' }),
  select   : (id) => http(`/businesses/${id}/select`, { method: 'POST' }),

  maxiStatus : (id) => http(`/businesses/${id}/maxi-status`),
  maxiSave   : (id, creds) => http(`/businesses/${id}/maxi-credentials`, { method: 'POST', body: creds }),

  // DB-first
  articlesFromDB : (id) => http(`/businesses/${id}/articles`),

  salesSummary   : (id, { from, to }) =>
    http(`/businesses/${id}/sales/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  salesSeries    : (id, articuloId, { from, to, groupBy='day' }) =>
    http(`/businesses/${id}/sales/${articuloId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=${groupBy}`),

  syncNow        : (id, body) => http(`/businesses/${id}/sync`, { method: 'POST', body }),

  // --- Aliases opcionales de compatibilidad (podés borrarlos si ya migraste) ---
  maxiArticles : (id) => http(`/businesses/${id}/articles`),
  salesFromDB  : (id, { from, to }) =>
    http(`/businesses/${id}/sales/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};

