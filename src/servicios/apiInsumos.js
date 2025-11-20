// src/servicios/apiInsumos.js
import { BASE } from './apiBase';

function authHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const bid = bizId || localStorage.getItem('activeBusinessId') || '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid) h['X-Business-Id'] = bid;
  return h;
}

export const insumosList = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/insumos${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Error al listar insumos');
  return await res.json();
};

export const insumoCreate = async (payload) => {
  const res = await fetch(`${BASE}/insumos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Error al crear insumo');
  return await res.json();
};

export const insumoUpdate = async (id, payload) => {
  const res = await fetch(`${BASE}/insumos/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Error al actualizar insumo');
  return await res.json();
};

export const insumoDelete = async (id) => {
  const res = await fetch(`${BASE}/insumos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Error al eliminar insumo');
  return await res.json();
};

export const insumosBulkJSON = async (items) => {
  const res = await fetch(`${BASE}/insumos/bulk`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('Error en bulk JSON');
  return await res.json();
};

export const insumosBulkCSV = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  const headers = authHeaders();
  delete headers['Content-Type']; // importante: FormData pone el boundary solo
  const res = await fetch(`${BASE}/insumos/bulk-csv`, {
    method: 'POST',
    headers,
    body: fd,
  });
  if (!res.ok) throw new Error('Error en bulk CSV');
  return await res.json();
};

export const insumosCleanup = async () => {
  const res = await fetch(`${BASE}/insumos/admin/cleanup-null`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Error en cleanup');
  return await res.json();
};

// src/servicios/apiInsumos.js
export const insumosSyncMaxi = async () => {
  const res = await fetch(`${BASE}/insumos/maxi-sync`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al sincronizar insumos');
  return data;
};

