// src/servicios/apiBase.js

// 🔒 Base fija a Render
export const BASE = 'https://lazarilloapp-backend.onrender.com/api';

// === Sesión/Contexto ===
export const getSession = () => ({
  token: localStorage.getItem('token') || '',
  activeBusinessId: localStorage.getItem('activeBusinessId') || '',
});
export const setSession = ({ token, activeBusinessId }) => {
  if (token != null) localStorage.setItem('token', token);
  if (activeBusinessId != null) localStorage.setItem('activeBusinessId', activeBusinessId);
};
export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('activeBusinessId');
};

// === Utilidad para query strings ===
export function qs(params = {}) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    u.append(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

// === Cliente HTTP central ===
export async function api(path, { method = 'GET', body, headers } = {}) {
  // Permitir path absoluto o relativo a BASE
  const url = path.startsWith('http') ? path : `${BASE}${path}`;

  const { token, activeBusinessId } = getSession();
  const h = { 'Content-Type': 'application/json', ...(headers || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  if (activeBusinessId) h['x-business-id'] = activeBusinessId;

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
