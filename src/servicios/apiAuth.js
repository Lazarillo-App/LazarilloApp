// src/servicios/apiAuth.js
import { BASE } from './apiBase';

// --- Helpers de sesión ---
function saveSession(data) {
  if (data?.token) localStorage.setItem('token', data.token);
  if (data?.user)  localStorage.setItem('user', JSON.stringify(data.user));

  const bid = data?.user?.active_business_id;
  if (bid != null) localStorage.setItem('activeBusinessId', bid);
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('activeBusinessId');
  localStorage.removeItem('user');
}

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// --- HTTP base con manejo de 401 global ---
async function http(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const txt = await res.text();
  let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }

  if (!res.ok) {
    // Si expira o no hay token -> limpiar y redirigir a /login
    if (res.status === 401) {
      clearSession();
      if (location.pathname !== '/login') location.href = '/login';
      throw new Error(data?.error || 'unauthorized');
    }
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const AuthAPI = {
  // Espera { token, user:{ id, email, name?, active_business_id? } }
  login: async (email, password) => {
    const data = await http('/auth/login', {
      method: 'POST',
      body: { email: String(email).trim(), password }
    });
    saveSession(data);
    return data;
  },

  // Puede devolver { ok:true } o { token, user }
  register: async ({ name, email, password }) => {
    const data = await http('/auth/register', {
      method: 'POST',
      body: { name: String(name).trim(), email: String(email).trim(), password }
    });
    // si el back ya te loguea al registrarte, guardamos token/user
    saveSession(data);
    return data;
  },

  // Devuelve el user actual desde el backend y refresca el cache local
  me: async () => {
    const data = await http('/auth/me');
    if (data) {
      localStorage.setItem('user', JSON.stringify(data));
      if (data?.active_business_id != null) {
        localStorage.setItem('activeBusinessId', data.active_business_id);
      }
    }
    return data;
  },

  logout: () => {
    clearSession();
    // navegá si querés directamente:
    // location.href = '/login';
  }
};