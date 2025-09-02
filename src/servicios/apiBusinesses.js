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

async function http(path, { method='GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const BusinessesAPI = {
  // ← SIEMPRE array
  listMine : async () => (await http('/businesses'))?.items ?? [],

  get      : (id) => http(`/businesses/${id}`),
  create   : (payload) => http('/businesses', { method: 'POST', body: payload }),
  update   : (id, body) => http(`/businesses/${id}`, { method: 'PATCH', body }),
  remove   : (id) => http(`/businesses/${id}`, { method: 'DELETE' }),
  select   : (id) => http(`/businesses/${id}/select`, { method: 'POST' }),

  maxiStatus : (id) => http(`/businesses/${id}/maxi-status`),
  maxiSave   : (id, creds) => http(`/businesses/${id}/maxi-credentials`, { method: 'POST', body: creds }),

  // ← NUEVO
  maxiArticles : (id, { from, to }) =>
    http(`/businesses/${id}/maxi-articles?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};
