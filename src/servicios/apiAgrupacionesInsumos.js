// src/servicios/apiAgrupacionesInsumos.js
import { BASE } from './apiBase';

function authHeaders() {
  const token = localStorage.getItem('token') || '';
  const bid = localStorage.getItem('activeBusinessId') || '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid) h['X-Business-Id'] = bid;
  return h;
}

export async function obtenerAgrupacionesInsumos() {
  const r = await fetch(`${BASE}/agrupaciones-insumos`, { headers: authHeaders() });
  if (!r.ok) throw new Error('Error al obtener agrupaciones de insumos');
  return r.json();
}

export async function crearAgrupacionInsumos({ nombre, insumos }) {
  const r = await fetch(`${BASE}/agrupaciones-insumos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ nombre, insumos }),
  });
  if (!r.ok) throw new Error('Error al crear agrupación de insumos');
  return r.json();
}

export async function eliminarAgrupacionInsumos(id) {
  const r = await fetch(`${BASE}/agrupaciones-insumos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error('Error al eliminar agrupación de insumos');
  return r.json();
}
