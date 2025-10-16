/* eslint-disable no-empty */
import { BASE } from './apiBase';

function authHeaders() {
  const t = localStorage.getItem('token') || '';
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function http(path, { method='GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text().catch(()=> '');
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch {}
  if (!res.ok) throw new Error((data && (data.error||data.message)) || txt || res.statusText);
  return data;
}

export const AdminAPI = {
  overview: () => http('/admin/overview'),
  listUsers: ({ q='', page=1, pageSize=20 } = {}) =>
    http(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  updateUser: (id, body) => http(`/admin/users/${id}`, { method:'PATCH', body }),
  deleteUser: (id) => http(`/admin/users/${id}`, { method:'DELETE' }),
  resetPassword: (id) => http(`/admin/users/${id}/reset-password`, { method:'POST' }),
  restoreUser: (id) => http(`/admin/users/${id}/restore`, { method:'POST' }), // ✅ nuevo
};
