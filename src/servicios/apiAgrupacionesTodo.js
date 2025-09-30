// src/servicios/apiAgrupacionesTodo.js
import { httpBiz } from './apiBusinesses';

// Asegura que exista la agrupación "TODO"
export async function ensureTodo(overrideBizId) {
  // 1) PUT idempotente
  try {
    const data = await httpBiz('/agrupaciones/todo', { method: 'PUT' }, overrideBizId);
    if (data?.id) return data;
  } catch (_) {
    // fallback
  }

  // 2) Fallback: listar y buscar por nombre
  const list = await httpBiz('/agrupaciones', {}, overrideBizId);
  const arr = Array.isArray(list) ? list : (list?.data || []);
  const todo = arr.find(g => String(g?.nombre).toUpperCase() === 'TODO');
  if (todo?.id) return todo;

  throw new Error('No se pudo asegurar la agrupación TODO');
}

// Exclusiones
export async function getExclusiones(grupoId, overrideBizId) {
  const data = await httpBiz(`/agrupaciones/${grupoId}/exclusiones`, {}, overrideBizId);
  return Array.isArray(data) ? data : (data?.data || []);
}

export async function addExclusiones(grupoId, items, overrideBizId) {
  if (!Array.isArray(items) || !items.length) return { ok: true, added: 0 };
  return await httpBiz(`/agrupaciones/${grupoId}/exclusiones`, {
    method: 'POST',
    body: { mode: 'add', items },
  }, overrideBizId);
}

export async function removeExclusiones(grupoId, items, overrideBizId) {
  if (!Array.isArray(items) || !items.length) return { ok: true, removed: 0 };
  return await httpBiz(`/agrupaciones/${grupoId}/exclusiones`, {
    method: 'POST',
    body: { mode: 'remove', items },
  }, overrideBizId);
}
