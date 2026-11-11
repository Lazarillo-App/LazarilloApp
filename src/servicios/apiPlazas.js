// src/servicios/apiPlazas.js — plazas de despacho (back: controllers/plazasController.js)
import { httpBiz } from './apiBusinesses';

const ok = (r, msg) => { if (!r?.ok) throw new Error(r?.error || msg); return r; };

export const PlazasAPI = {
  async listar() { return ok(await httpBiz('/plazas', { method: 'GET', cache: false }), 'No se pudieron cargar las plazas').plazas || []; },
  async articulos(q = '') { return ok(await httpBiz(`/plazas/articulos?q=${encodeURIComponent(q)}`, { method: 'GET', cache: false }), 'No se pudieron cargar los artículos').articulos || []; },
  async crear(sectorId, nombre, articleIds) { return ok(await httpBiz('/plazas', { method: 'POST', body: { sectorId, nombre, articleIds } }), 'No se pudo crear la plaza'); },
  async editar(id, nombre, articleIds) { return ok(await httpBiz(`/plazas/${id}`, { method: 'PUT', body: { nombre, articleIds } }), 'No se pudo guardar la plaza'); },
  async borrar(id) { return ok(await httpBiz(`/plazas/${id}`, { method: 'DELETE' }), 'No se pudo borrar la plaza'); },
  async vista(id) { return ok(await httpBiz(`/plazas/${id}/vista`, { method: 'GET', cache: false }), 'No se pudo cargar la plaza'); },
  async guardarFicha(id, articleId, ficha) { return ok(await httpBiz(`/plazas/${id}/fichas/${articleId}`, { method: 'PUT', body: ficha }), 'No se pudo guardar'); },
  async guardarColor(ref, color) { return ok(await httpBiz('/plazas/colores', { method: 'PUT', body: { ref, color } }), 'No se pudo guardar el color'); },
};
