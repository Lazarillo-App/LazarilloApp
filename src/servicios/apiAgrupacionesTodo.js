// src/servicios/apiAgrupacionesTodo.js
import { BASE } from './apiBase';

async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await parseJsonSafe(res);
  return { ok: res.ok, status: res.status, data };
}

// ---------- EXPORTS ÚNICOS: en la declaración ----------
export async function ensureTodo() {
  // 1) PUT idempotente
  try {
    const { ok, data } = await httpJson(`${BASE}/agrupaciones/todo`, { method: 'PUT' });
    if (ok && data?.id) return data;
  } catch (e) { /* noop: seguimos al fallback */ }

  // 2) Fallback: listar y buscar por nombre
  const { ok, status, data } = await httpJson(`${BASE}/agrupaciones`);
  if (!ok) throw new Error(`No se pudieron listar agrupaciones (status ${status})`);

  const list = Array.isArray(data) ? data : (data?.data || []);
  const todo = list.find(g => g?.nombre === 'TODO');
  if (todo?.id) return todo;

  throw new Error('No se pudo asegurar la agrupación TODO');
}

export async function getExclusiones(grupoId) {
  const { ok, status, data } = await httpJson(`${BASE}/agrupaciones/${grupoId}/exclusiones`);
  if (status === 404) return [];
  if (!ok) throw new Error(data?.error || `No se pudieron obtener exclusiones (status ${status})`);
  return Array.isArray(data) ? data : (data?.data || []);
}

export async function addExclusiones(grupoId, items) {
  if (!Array.isArray(items) || !items.length) return { ok: true, added: 0 };
  const { ok, status, data } = await httpJson(`${BASE}/agrupaciones/${grupoId}/exclusiones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'add', items }),
  });
  if (!ok) throw new Error(data?.error || `No se pudieron agregar exclusiones (status ${status})`);
  return data;
}

export async function removeExclusiones(grupoId, items) {
  if (!Array.isArray(items) || !items.length) return { ok: true, removed: 0 };
  const { ok, status, data } = await httpJson(`${BASE}/agrupaciones/${grupoId}/exclusiones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'remove', items }),
  });
  if (!ok) throw new Error(data?.error || `No se pudieron quitar exclusiones (status ${status})`);
  return data;
}