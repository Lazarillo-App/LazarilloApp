// src/servicios/apiAccess.js
import { http } from './apiBusinesses';

export const AccessAPI = {

  async getStatus() {
    return http('/access/status', { withBusinessId: false });
  },

  async redeemCode(code) {
    return http('/access/redeem', {
      method: 'POST',
      body: { code: String(code).trim().toUpperCase() },
      withBusinessId: false,
    });
  },

  // ── Admin ──────────────────────────────────────────────────────────────

  async listUsers() {
    return http('/access/admin/users', { withBusinessId: false });
  },

  async activateUser(userId, { type = 'trial', duration_days, notes } = {}) {
    return http(`/access/admin/users/${userId}/activate`, {
      method: 'POST',
      body: { type, duration_days, notes },
      withBusinessId: false,
    });
  },

  async suspendUser(userId, { notes } = {}) {
    return http(`/access/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: { notes },
      withBusinessId: false,
    });
  },

  async listCodes() {
    return http('/access/admin/codes', { withBusinessId: false });
  },

  async createCode({ type = 'trial', duration_days, max_uses = 1, notes, expires_at, prefix } = {}) {
    return http('/access/admin/codes', {
      method: 'POST',
      body: { type, duration_days, max_uses, notes, expires_at, prefix },
      withBusinessId: false,
    });
  },

  async deactivateCode(codeId) {
    return http(`/access/admin/codes/${codeId}`, {
      method: 'DELETE',
      withBusinessId: false,
    });
  },
};