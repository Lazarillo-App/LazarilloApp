// src/servicios/apiRoles.js — roles a medida del negocio (ver back: controllers/rolesController.js)
import { http } from './apiBusinesses';

const conNegocio = (bizId) => (bizId ? `?businessId=${encodeURIComponent(bizId)}` : '');

export const RolesAPI = {
  // bizId opcional: sin él, los del negocio activo. Con él, los de la organización de ese negocio.
  async list(bizId) {
    const data = await http(`/roles${conNegocio(bizId)}`, { withBusinessId: !bizId, cache: false });
    return data?.roles || [];
  },
  // Subroles de Staff (Diego 11/11/2026): { base: {permisos}, subroles: [{id, nombre, permisos, personas}] }.
  async listStaff(bizId) {
    const data = await http(`/roles${conNegocio(bizId)}`, { withBusinessId: !bizId, cache: false });
    return data?.staff || { base: {}, subroles: [] };
  },
  createStaff(nombre, bizId) {
    return http(`/roles/staff${conNegocio(bizId)}`, { method: 'POST', body: { nombre }, withBusinessId: !bizId });
  },
  setStaffBase(permisos) {
    return http('/roles/staff/base', { method: 'PUT', body: { permisos } });
  },
  updateStaff(id, nombre, permisos) {
    return http(`/roles/staff/${id}`, { method: 'PUT', body: { nombre, permisos } });
  },
  // Lista + Administración (ajustada o "ve todo") para el editor de roles.
  async listCompleto() {
    const data = await http('/roles', { cache: false });
    return { roles: data?.roles || [], administracion: data?.administracion || null, staff: data?.staff || { base: {}, subroles: [] } };
  },
  setAdministracion(rol) {
    return http('/roles/administracion', { method: 'PUT', body: rol });
  },
  resetAdministracion() {
    return http('/roles/administracion', { method: 'DELETE' });
  },
  create(rol) {
    return http('/roles', { method: 'POST', body: rol });
  },
  update(id, rol) {
    return http(`/roles/${id}`, { method: 'PATCH', body: rol });
  },
  remove(id) {
    return http(`/roles/${id}`, { method: 'DELETE' });
  },
};
