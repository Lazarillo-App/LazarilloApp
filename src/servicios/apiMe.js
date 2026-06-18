// src/servicios/apiMe.js
//
// Cliente para los endpoints de "yo" — accesos y negocio activo.
// (Ojo: NO confundir con apiAccess.js que gestiona suscripciones / códigos.)

import { http } from './apiBusinesses';

export const MeAPI = {
  /**
   * GET /api/me/access
   * Devuelve businesses accesibles, rol efectivo en cada uno, organizations,
   * active_business_id, suggested_active_business_id, needs_selector.
   */
  async getAccess() {
    return http('/me/access', { withBusinessId: false });
  },

  /**
   * POST /api/me/active-business
   * Persiste el negocio activo del usuario.
   */
  async setActiveBusiness(businessId) {
    return http('/me/active-business', {
      method: 'POST',
      body: { businessId: Number(businessId) },
      withBusinessId: false,
    });
  },
};