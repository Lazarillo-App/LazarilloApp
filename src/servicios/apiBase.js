// src/servicios/apiBase.js

// === BASE del backend por entorno (Vite) ===
// DEV:  VITE_BACKEND_URL=http://localhost:4000/api
// PROD: VITE_BACKEND_URL=https://lazarilloapp-backend.onrender.com/api
const RAW = import.meta.env.VITE_BACKEND_URL || '';
export const BASE = RAW.replace(/\/+$/, ''); // sin barra final

// === Basename del frontend (para ruteo/redirects correctos: gh-pages vs raíz) ===
// DEV/PROD raíz:    VITE_BASE=/
// GH Pages:         VITE_BASE=/LazarilloApp/
export const APP_BASENAME = (import.meta.env.VITE_BASE || '/').replace(/\/+$/, '') || '/';

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
  localStorage.removeItem('user');
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

// === Cliente HTTP central (simple) ===
// Nota: si ya usás el wrapper `http` de apiBusinesses.js, este `api()` queda para usos puntuales.
export async function api(path, { method = 'GET', body, headers } = {}) {
  // Permitir path absoluto o relativo a BASE
  const url = path.startsWith('http') ? path : `${BASE}${path}`;

  const { token, activeBusinessId } = getSession();
  const h = { 'Content-Type': 'application/json', ...(headers || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  if (activeBusinessId) h['X-Business-Id'] = activeBusinessId; // 👈 header normalizado

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.detail)) || res.statusText || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
