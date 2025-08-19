// src/servicios/apiAgrupacionesTodo.js

// Resolvedor robusto de base URL
function resolveBase() {
  const RAW = import.meta?.env?.VITE_BACKEND_URL?.trim();

  // Si viene de .env y no es "undefined", usamos eso
  if (RAW && RAW !== 'undefined') {
    return RAW.replace(/\/$/, '');
  }

  // En dev, si no hay env, asumimos backend local estándar
  if (import.meta?.env?.DEV) {
    // Si estás corriendo Vite (5173) y backend en 4000 con prefijo /api
    return 'http://localhost:4000/api';
  }

  // Último recurso: confiar en un proxy / reverse proxy a /api
  return '/api';
}

//const BASE = resolveBase();
// const BASE = resolveBase();
const BASE = 'http://localhost:4000/api';
console.info('[apiAgrupacionesTodo] BASE =', BASE);

// Ayuda de depuración
if (import.meta?.env?.DEV) {
  // eslint-disable-next-line no-console
  console.info('[apiAgrupacionesTodo] BASE =', BASE);
}

async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

// ========= API =========

// Asegura la agrupación "TODO" (idempotente).
export async function ensureTodo() {
  // 1) Intento principal: PUT idempotente
  try {
    const res = await fetch(`${BASE}/agrupaciones/todo`, {
      method: 'PUT',
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await parseJsonSafe(res);
      if (data?.id) return data;
    }
  } catch (_) { /* seguimos al fallback */ }

  // 2) Fallback: listar y buscar por nombre
  try {
    const listRes = await fetch(`${BASE}/agrupaciones`, {
      headers: { 'Accept': 'application/json' }
    });
    if (listRes.ok) {
      const all = await parseJsonSafe(listRes);
      const todo = Array.isArray(all) ? all.find(g => g?.nombre === 'TODO') : null;
      if (todo?.id) return todo;
    }
  } catch (e) {
    throw new Error(`Fallback de ensureTodo falló: ${e?.message || e}`);
  }

  throw new Error('No se pudo asegurar la agrupación TODO');
}

// Obtiene exclusiones actuales del grupo (si 404 => [])
export async function getExclusiones(grupoId) {
  const r = await fetch(`${BASE}/agrupaciones/${grupoId}/exclusiones`, {
    headers: { 'Accept': 'application/json' }
  });
  if (r.status === 404) return [];
  if (!r.ok) {
    const body = await parseJsonSafe(r);
    throw new Error(body?.error || 'No se pudieron obtener exclusiones');
  }
  const data = await parseJsonSafe(r);
  return Array.isArray(data) ? data : (data?.data || []);
}

// Agrega exclusiones
export async function addExclusiones(grupoId, items) {
  if (!Array.isArray(items) || !items.length) return { ok: true, added: 0 };
  const r = await fetch(`${BASE}/agrupaciones/${grupoId}/exclusiones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept':'application/json' },
    body: JSON.stringify({ mode: 'add', items })
  });
  if (!r.ok) {
    const body = await parseJsonSafe(r);
    throw new Error(body?.error || 'No se pudieron agregar exclusiones');
  }
  return await parseJsonSafe(r);
}

// Quita exclusiones
export async function removeExclusiones(grupoId, items) {
  if (!Array.isArray(items) || !items.length) return { ok: true, removed: 0 };
  const r = await fetch(`${BASE}/agrupaciones/${grupoId}/exclusiones`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
    body: JSON.stringify({ mode: 'remove', items })
  });
  if (!r.ok) {
    const body = await parseJsonSafe(r);
    throw new Error(body?.error || 'No se pudieron quitar exclusiones');
  }
  return await parseJsonSafe(r);
}
