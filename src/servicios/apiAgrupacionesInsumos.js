// src/servicios/apiAgrupacionesInsumos.js
import { BASE } from './apiBase';

export async function obtenerAgrupacionesInsumos() {
  const r = await fetch(`${BASE}/agrupaciones-insumos`);
  if (!r.ok) throw new Error('Error al obtener agrupaciones de insumos');
  return r.json();
}

export async function crearAgrupacionInsumos({ nombre, insumos }) {
  const r = await fetch(`${BASE}/agrupaciones-insumos`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ nombre, insumos })
  });
  if (!r.ok) throw new Error('Error al crear agrupación de insumos');
  return r.json();
}

export async function eliminarAgrupacionInsumos(id) {
  const r = await fetch(`${BASE}/agrupaciones-insumos/${id}`, { method:'DELETE' });
  if (!r.ok) throw new Error('Error al eliminar agrupación de insumos');
  return r.json();
}
