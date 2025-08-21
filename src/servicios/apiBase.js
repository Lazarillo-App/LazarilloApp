// src/servicios/apiBase.js
export function resolveBase() {
  const RAW = import.meta?.env?.VITE_BACKEND_URL;

  // 1) Si está en .env (dev o prod), usamos eso SIEMPRE
  if (typeof RAW === 'string' && RAW.trim() && RAW.trim() !== 'undefined') {
    return RAW.trim().replace(/\/$/, ''); // sin barra final
  }

  // 2) En dev, si no tenés env, usamos /api (requiere proxy en Vite)
  if (import.meta?.env?.DEV) return '/api';

  // 3) Heurística de dominio (backup para Render)
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return 'https://backend-tablas-maxi.onrender.com/api';
  }

  // 4) Último recurso
  return '/api';
}

export const BASE = resolveBase();

