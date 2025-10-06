// src/servicios/apiAuth.js
import { http } from './apiBusinesses';

function saveSession(data) {
  if (data?.token) localStorage.setItem('token', data.token);
  if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
  const bid = data?.user?.active_business_id;
  if (bid != null) localStorage.setItem('activeBusinessId', bid);
}
export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('activeBusinessId');
  localStorage.removeItem('user');
}

export const AuthAPI = {
  login: async (email, password) => {
    const data = await http('/auth/login', {
      method: 'POST',
      body: { email: String(email).trim(), password },
      withBusinessId: false,      // 👈 importante
      noAuthRedirect: true,       // 👈 evita redirect en 401
    });
    saveSession(data);
    return data;
  },

  register: async ({ name, email, password }) => {
    const data = await http('/auth/register', {
      method: 'POST',
      body: { name: String(name).trim(), email: String(email).trim(), password },
      withBusinessId: false,
      noAuthRedirect: true,
    });
    saveSession(data);
    return data;
  },

  me: async () => {
    const data = await http('/auth/me', {
      withBusinessId: false,
      noAuthRedirect: true,
    });
    if (data) {
      localStorage.setItem('user', JSON.stringify(data));
      if (data?.active_business_id != null) {
        localStorage.setItem('activeBusinessId', data.active_business_id);
      }
    }
    return data;
  },

  async requestPasswordReset(email) {
    const base = import.meta.env.VITE_BACKEND_URL || '';
    const r = await fetch(`${base}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) throw new Error('Error solicitando enlace');
    return r.json(); // <-- importante: devolver el JSON (ok, previewUrl)
  },

  resetPassword: async ({ token, password }) => {
    return await http('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
      withBusinessId: false,
      noAuthRedirect: true,
    });
  },

  logout: () => clearSession(),
};
