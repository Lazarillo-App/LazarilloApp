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
  if (!res.ok) {
    const err = new Error((data && (data.error||data.message)) || txt || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const AdminAPI = {
  overview: () => http('/admin/overview'),
  listUsers: ({ q='', page=1, pageSize=20 } = {}) =>
    http(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  getUser: (id) => http(`/admin/users/${id}`),
  updateUser: (id, body) => http(`/admin/users/${id}`, { method:'PATCH', body }),
  deleteUser: (id, { confirm = false } = {}) =>
    http(`/admin/users/${id}${confirm ? '?confirm=1' : ''}`, { method:'DELETE' }),
  createUser: (body) => http('/admin/users', { method:'POST', body }),
  resetPassword: (id) => http(`/admin/users/${id}/reset-password`, { method:'POST' }),
  restoreUser: (id) => http(`/admin/users/${id}/restore`, { method:'POST' }),
  userBusinesses: (id) => http(`/admin/users/${id}/businesses`).then(r => r?.businesses || []),
  userActivity: (id) => http(`/admin/users/${id}/activity`).then(r => r?.activity || []),

  listBusinesses: ({ q='', page=1, pageSize=20 } = {}) =>
    http(`/admin/businesses?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  getBusiness: (id) => http(`/admin/businesses/${id}`),
  updateBusiness: (id, body) => http(`/admin/businesses/${id}`, { method:'PATCH', body }),
  pauseBusiness: (id, reason) => http(`/admin/businesses/${id}/pause`, { method:'POST', body: { reason } }),
  resumeBusiness: (id) => http(`/admin/businesses/${id}/resume`, { method:'POST' }),
  reassignOwner: (id, newOwnerUserId) => http(`/admin/businesses/${id}/reassign-owner`, { method:'POST', body: { newOwnerUserId } }),

  revokeAssignment: (id) => http(`/admin/assignments/${id}`, { method:'DELETE' }),
  updateAssignmentRole: (id, role) => http(`/admin/assignments/${id}`, { method:'PATCH', body: { role } }),

  peekMaxiStatus: (id) => http(`/admin/businesses/${id}/maxi-status`),
  peekVentasSummary: (id) => http(`/admin/businesses/${id}/ventas/summary`),

  dashboardProblemas: () => http('/admin/dashboard/problemas'),

  listOrganizations: ({ q='', page=1, pageSize=20 } = {}) =>
    http(`/admin/organizations?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  getOrganization: (id) => http(`/admin/organizations/${id}`),

  getMaintenance: () => http('/admin/maintenance'),
  setMaintenance: (enabled, message) => http('/admin/maintenance', { method:'POST', body: { enabled, message } }),

  listAudit: ({ entityType='', userId='', businessId='', page=1, pageSize=30 } = {}) => {
    const p = new URLSearchParams();
    if (entityType) p.set('entityType', entityType);
    if (userId) p.set('userId', userId);
    if (businessId) p.set('businessId', businessId);
    p.set('page', page); p.set('pageSize', pageSize);
    return http(`/admin/audit?${p.toString()}`);
  },
};
