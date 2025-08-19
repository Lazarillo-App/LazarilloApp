// src/servicios/apiAgrupacionesInsumos.js
const RAW = import.meta?.env?.VITE_BACKEND_URL;
const API = (RAW && RAW !== 'undefined' ? RAW : '/api').replace(/\/$/, '');

export async function obtenerAgrupacionesInsumos() {
  const r = await fetch(`${API}/agrupaciones-insumos`);
  if (!r.ok) throw new Error('Error al obtener agrupaciones de insumos');
  return r.json();
}

export async function crearAgrupacionInsumos({ nombre, insumos }) {
  const r = await fetch(`${API}/agrupaciones-insumos`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ nombre, insumos })
  });
  if (!r.ok) throw new Error('Error al crear agrupación de insumos');
  return r.json();
}

export async function eliminarAgrupacionInsumos(id) {
  const r = await fetch(`${API}/agrupaciones-insumos/${id}`, { method:'DELETE' });
  if (!r.ok) throw new Error('Error al eliminar agrupación de insumos');
  return r.json();
}
