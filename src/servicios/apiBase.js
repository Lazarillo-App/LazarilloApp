/* eslint-disable no-empty */
// src/servicios/apiBase.js

// === Base URL del backend ===
const RAW =
  import.meta.env.VITE_BACKEND_URL || // Render / prod (ej: https://tu-back.onrender.com/api)
  import.meta.env.VITE_LOCAL        || // Dev local (ej: http://localhost:4000/api)
  '/api';                             // fallback si hay reverse proxy

export const BASE = String(RAW).replace(/\/+$/, ''); // sin barra al final

// === Basename del frontend (routing) ===
// DEV/PROD raíz:    VITE_BASE=/
// GH Pages:         VITE_BASE=/LazarilloApp/
export const APP_BASENAME =
  (import.meta.env.VITE_BASE || '/').replace(/\/+$/, '') || '/';

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

/**
 * Cliente HTTP liviano:
 *  - soporta cancelación con `signal`
 *  - NO setea Content-Type si el body es FormData
 *  - encadena timeout propio con el `signal` entrante
 */
export async function api(
  path,
  {
    method = 'GET',
    body,
    headers,
    timeout = 45000,         // ⏱️ evita cuelgues si Render está lento
    redirectOn401 = true,    // 🔐 igual que http() del wrapper
    signal,                  // 👈 NUEVO: cancelación externa
  } = {}
) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const { token, activeBusinessId } = getSession();

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  // Solo seteamos Content-Type cuando NO es FormData (boundary lo pone el browser)
  const h = { ...(headers || {}) };
  if (!isFormData) h['Content-Type'] = 'application/json';
  if (token && !h.Authorization) h.Authorization = `Bearer ${token}`;
  if (activeBusinessId && !h['X-Business-Id']) h['X-Business-Id'] = activeBusinessId;

  // AbortController con encadenado de signal externo + timeout
  const ctrl = new AbortController();
  if (signal && typeof signal.addEventListener === 'function') {
    signal.addEventListener('abort', () => {
      try { ctrl.abort(signal.reason || 'aborted_by_caller'); } catch {}
    });
  }
  const t = setTimeout(() => ctrl.abort('timeout'), timeout);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: h,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  // Manejo de 401 (opcional con redirect)
  if (res.status === 401 && redirectOn401) {
    try { await res.clone().json(); } catch {}
    clearSession();
    window.location.href = `${APP_BASENAME || ''}/login`;
    throw new Error('invalid_token');
  }

  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

  // Modo mantenimiento global: mismo criterio que apiBusinesses.js::http().
  if (res.status === 503 && data?.error === 'maintenance') {
    try { sessionStorage.setItem('mantenimiento_info', JSON.stringify({ message: data.message || null })); } catch {}
    if (!window.location.pathname.startsWith('/en-mantenimiento')) {
      window.location.href = '/en-mantenimiento';
    }
    throw new Error('maintenance');
  }

  // Negocio pausado desde el admin: mismo criterio que apiBusinesses.js::http().
  if (res.status === 403 && data?.error === 'business_paused') {
    try {
      sessionStorage.setItem('negocio_pausado_info', JSON.stringify({
        paused_at: data.paused_at || null,
        paused_reason: data.paused_reason || null,
      }));
    } catch {}
    if (!window.location.pathname.startsWith('/negocio-pausado')) {
      window.location.href = '/negocio-pausado';
    }
    throw new Error('business_paused');
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.detail)) ||
                res.statusText || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
