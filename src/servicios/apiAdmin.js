// Usa tu http() de apiBusinesses para heredar Authorization + X-Business-Id y manejo de 401
import { http } from './apiBusinesses';

export const AdminAPI = {
  overview() {
    return http('/admin/overview'); // GET
  },
  listUsers({ q = '', page = 1, pageSize = 20 } = {}) {
    const p = new URLSearchParams({ q, page, pageSize });
    return http(`/admin/users?${p.toString()}`);
  },
  updateUser(id, payload) {
    return http(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  deleteUser(id) {
    return http(`/admin/users/${id}`, { method: 'DELETE' });
  },
  resetPassword(id) {
    return http(`/admin/users/${id}/reset-password`, { method: 'POST' });
  }
};
