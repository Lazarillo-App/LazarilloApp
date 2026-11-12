// src/servicios/apiPlazas.js — plazas de despacho (back: controllers/plazasController.js)
import { httpBiz } from './apiBusinesses';

const ok = (r, msg) => { if (!r?.ok) throw new Error(r?.error || msg); return r; };

export const PlazasAPI = {
  // Plazas + si la persona puede crear (dueño/admin, o jefe en sus sectores) y en qué sectores.
  async tablero() { const r = ok(await httpBiz('/plazas', { method: 'GET', cache: false }), 'No se pudieron cargar las plazas'); return { plazas: r.plazas || [], puedeCrear: !!r.puedeCrear, sectores: r.sectores || [] }; },
  async listar() { return ok(await httpBiz('/plazas', { method: 'GET', cache: false }), 'No se pudieron cargar las plazas').plazas || []; },
  // Artículos con receta, por ventas (90 días) de mayor a menor, con rubro/subrubro y agrupaciones; y las
  // agrupaciones para filtrar.
  async articulos(q = '') {
    const r = ok(await httpBiz(`/plazas/articulos?q=${encodeURIComponent(q)}`, { method: 'GET', cache: false }), 'No se pudieron cargar los artículos');
    return { articulos: r.articulos || [], agrupaciones: r.agrupaciones || [] };
  },
  async crear(sectorId, nombre, articleIds) { return ok(await httpBiz('/plazas', { method: 'POST', body: { sectorId, nombre, articleIds } }), 'No se pudo crear la plaza'); },
  async editar(id, nombre, articleIds) { return ok(await httpBiz(`/plazas/${id}`, { method: 'PUT', body: { nombre, articleIds } }), 'No se pudo guardar la plaza'); },
  async borrar(id) { return ok(await httpBiz(`/plazas/${id}`, { method: 'DELETE' }), 'No se pudo borrar la plaza'); },
  async vista(id, articleId) { return ok(await httpBiz(`/plazas/${id}/vista${articleId ? `?articleId=${articleId}` : ''}`, { method: 'GET', cache: false }), 'No se pudo cargar la plaza'); },
  async guardarFicha(id, articleId, ficha) { return ok(await httpBiz(`/plazas/${id}/fichas/${articleId}`, { method: 'PUT', body: ficha }), 'No se pudo guardar'); },
  // Edita UN ingrediente de la receta desde la plaza ({ key, cantidad, unidad, observaciones }).
  // Dueño/admin: directo. Staff: queda como propuesta (devuelve pending: true).
  async editarItem(id, articleId, datos) {
    const r = await httpBiz(`/plazas/${id}/fichas/${articleId}/item`, { method: 'PUT', body: datos });
    if (!r?.ok) throw new Error(r?.message || r?.error || 'No se pudo guardar en la receta');
    return r;
  },
  // color, mostrar ('peso' | 'obs') y/o alias ('' lo borra): lo que no se manda queda como estaba.
  async guardarColor(ref, color, mostrar, alias) { return ok(await httpBiz('/plazas/colores', { method: 'PUT', body: { ref, color, mostrar, alias } }), 'No se pudo guardar el ingrediente'); },
};
