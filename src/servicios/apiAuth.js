/* eslint-disable no-empty */
// src/servicios/apiAuth.js
import { http } from './apiBusinesses';

function saveSession(data) {
  try {
    if (data?.token) localStorage.setItem('token', data.token);
    if (data?.user)  localStorage.setItem('user', JSON.stringify(data.user));

    const bid = data?.user?.active_business_id ?? data?.active_business_id;
    if (bid !== undefined && bid !== null && bid !== '') {
      localStorage.setItem('activeBusinessId', String(bid));
    }
  } catch {}
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('activeBusinessId');
  localStorage.removeItem('user');
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export const AuthAPI = {
  async login(email, password) {
    const data = await http('/auth/login', {
      method: 'POST',
      body: { email: String(email).trim(), password },
      withBusinessId: false,  // 👈 público
      noAuthRedirect: true,   // 👈 no redirigir en 401 de login
    });
    saveSession(data);
    return data;
  },

  async register({ name, email, password }) {
    const data = await http('/auth/register', {
      method: 'POST',
      body: { name: String(name).trim(), email: String(email).trim(), password },
      withBusinessId: false,
      noAuthRedirect: true,
    });
    saveSession(data);
    return data;
  },

  async me() {
    const data = await http('/auth/me', {
      withBusinessId: false,
      noAuthRedirect: true,
    });
    if (data) {
      localStorage.setItem('user', JSON.stringify(data));
      const bid = data?.active_business_id;
      if (bid !== undefined && bid !== null && bid !== '') {
        localStorage.setItem('activeBusinessId', String(bid));
      }
    }
    return data;
  },

  async requestPasswordReset(email) {
    // usamos http() para heredar BASE y manejo de errores
    const res = await http('/auth/forgot-password', {
      method: 'POST',
      body: { email: String(email).trim() },
      withBusinessId: false,
      noAuthRedirect: true,
    });
    return res; // { ok, (token_preview|previewUrl) según tu back }
  },

  async resetPassword({ token, password }) {
    return await http('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
      withBusinessId: false,
      noAuthRedirect: true,
    });
  },

  logout() {
    clearSession();
  },
};
