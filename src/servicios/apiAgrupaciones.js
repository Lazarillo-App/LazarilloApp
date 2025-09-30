// src/servicios/apiAgrupaciones.js
import { httpBiz } from './apiBusinesses';

// Lista todas las agrupaciones
export async function obtenerAgrupaciones(overrideBizId) {
  const data = await httpBiz('/agrupaciones', {}, overrideBizId);
  return Array.isArray(data) ? data : (data?.data || []);
}

// Obtiene una agrupación por id (vía lista)
export async function obtenerAgrupacion(id, overrideBizId) {
  const list = await obtenerAgrupaciones(overrideBizId);
  const g = list.find(x => Number(x?.id) === Number(id));
  if (!g) throw new Error(`Agrupación #${id} no encontrada`);
  return g;
}

// Crea una agrupación
export async function crearAgrupacion(payload, overrideBizId) {
  return await httpBiz('/agrupaciones', { method: 'POST', body: payload }, overrideBizId);
}

// Actualiza nombre o REEMPLAZA artículos (si enviás { articulos })
export async function actualizarAgrupacion(id, payload, overrideBizId) {
  return await httpBiz(`/agrupaciones/${id}`, { method: 'PUT', body: payload }, overrideBizId);
}

// Elimina una agrupación
export async function eliminarAgrupacion(id, overrideBizId) {
  return await httpBiz(`/agrupaciones/${id}`, { method: 'DELETE' }, overrideBizId);
}

// Reemplaza COMPLETAMENTE los artículos
export async function setArticulosEnAgrupacion(id, items, overrideBizId) {
  return actualizarAgrupacion(id, { articulos: items }, overrideBizId);
}

// Agrega artículos (append SIN duplicar)
export async function agregarArticulos(id, items, overrideBizId) {
  return await httpBiz(`/agrupaciones/${id}/articulos`, {
    method: 'PUT',
    body: { articulos: items },
  }, overrideBizId);
}

// Quita UN artículo
export async function quitarArticulo(id, articuloId, overrideBizId) {
  return await httpBiz(`/agrupaciones/${id}/articulos/${articuloId}`, {
    method: 'DELETE',
  }, overrideBizId);
}

// Búsqueda simple (si backend soporta ?q=)
export async function buscarAgrupaciones(q, overrideBizId) {
  const qs = new URLSearchParams({ q }).toString();
  const data = await httpBiz(`/agrupaciones?${qs}`, {}, overrideBizId);
  return Array.isArray(data) ? data : (data?.data || []);
}
