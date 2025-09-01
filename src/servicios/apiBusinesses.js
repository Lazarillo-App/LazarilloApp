import { BASE } from './apiBase';

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  const bid   = localStorage.getItem('activeBusinessId') || '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid)   h['X-Business-Id'] = bid;
  return h;
}

async function http(path, { method='GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('activeBusinessId');
      if (location.pathname !== '/login') location.href = '/login';
      throw new Error(data?.error || 'unauthorized');
    }
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

export const BusinessesAPI = {
  listMine: () => http('/businesses').then(d => d?.items ?? []),

  // CRUD negocio
  create: (payload) => http('/businesses', { method: 'POST', body: payload }),
  update: (id, body) => http(`/businesses/${id}`, { method: 'PATCH', body }),
  remove: (id) => http(`/businesses/${id}`, { method: 'DELETE' }),

  // activo / selección
  select: (id) => http(`/businesses/${id}/select`, { method: 'POST' }),

  // MaxiRest
  maxiStatus: (id) => http(`/businesses/${id}/maxi-status`),
  maxiSave: (id, creds) => http(`/businesses/${id}/maxi-credentials`, { method: 'POST', body: creds }),
  maxiArticles: (id, { from, to }) => http(`/businesses/${id}/maxi/articles?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};
