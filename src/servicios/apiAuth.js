/* eslint-disable no-empty */
// src/servicios/apiAuth.js
import { http } from './apiBusinesses';

function saveSession(data) {
  try {
    if (data?.token) localStorage.setItem('token', data.token);
    if (data?.user)  localStorage.setItem('user', JSON.stringify(data.user));

    const role = data?.user?.role;
    const bid  = data?.user?.active_business_id ?? data?.active_business_id;

    if (role === 'app_admin') {
      // ⛔ Admin global NO tiene negocio activo
      localStorage.removeItem('activeBusinessId');
    } else if (bid !== undefined && bid !== null && bid !== '') {
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
      withBusinessId: false,   // público
      noAuthRedirect: true,    // no redirigir en 401 de login
    });

    // Guarda token + user + active_business_id (si viene)
    saveSession(data);

    // notificar a la app
    try { window.dispatchEvent(new CustomEvent('auth:login', { detail: data.user })); } catch {}

    // 👈 devolvemos TODO (user + token + lo que envíe el back)
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
    try { window.dispatchEvent(new CustomEvent('auth:login', { detail: data.user })); } catch {}
    return data;
  },

  async me() {
    const data = await http('/auth/me', {
      withBusinessId: false,
      noAuthRedirect: true,
    });

    if (data) {
      // preservamos role previo si /me no lo trae
      const prev = getUser() || {};
      const merged = { ...prev, ...data, role: prev.role ?? data.role };

      localStorage.setItem('user', JSON.stringify(merged));

      const bid = merged?.active_business_id;
      if (bid !== undefined && bid !== null && bid !== '') {
        localStorage.setItem('activeBusinessId', String(bid));
      }

      return merged;
    }
    return null;
  },

  async requestPasswordReset(email) {
    return await http('/auth/forgot-password', {
      method: 'POST',
      body: { email: String(email).trim() },
      withBusinessId: false,
      noAuthRedirect: true,
    });
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
    try { window.dispatchEvent(new Event('auth:logout')); } catch {}
  },
};

/* ───── Exports nombrados para AuthContext.jsx ───── */

export async function login(email, password) {
  const data = await AuthAPI.login(email, password);
  return data?.user ?? null;
}

export async function me() {
  return AuthAPI.me();
}

export function logout() {
  return AuthAPI.logout();
}

export function getAuthToken() {
  return getToken();
}
