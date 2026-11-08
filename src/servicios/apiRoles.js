// src/servicios/apiRoles.js — roles a medida del negocio (ver back: controllers/rolesController.js)
import { http } from './apiBusinesses';

const conNegocio = (bizId) => (bizId ? `?businessId=${encodeURIComponent(bizId)}` : '');

export const RolesAPI = {
  // bizId opcional: sin él, los del negocio activo. Con él, los de la organización de ese negocio.
  async list(bizId) {
    const data = await http(`/roles${conNegocio(bizId)}`, { withBusinessId: !bizId, cache: false });
    return data?.roles || [];
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
