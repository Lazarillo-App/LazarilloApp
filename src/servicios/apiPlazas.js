// src/servicios/apiPlazas.js — plazas de despacho (back: controllers/plazasController.js)
import { httpBiz } from './apiBusinesses';

const ok = (r, msg) => { if (!r?.ok) throw new Error(r?.error || msg); return r; };

export const PlazasAPI = {
  // Plazas + si la persona puede crear (dueño/admin, o jefe en sus sectores) y en qué sectores.
  async tablero() { const r = ok(await httpBiz('/plazas', { method: 'GET', cache: false }), 'No se pudieron cargar las plazas'); return { plazas: r.plazas || [], puedeCrear: !!r.puedeCrear, puedeCrearSector: !!r.puedeCrearSector, sectores: r.sectores || [] }; },
  async listar() { return ok(await httpBiz('/plazas', { method: 'GET', cache: false }), 'No se pudieron cargar las plazas').plazas || []; },
  // Artículos con receta, por ventas (90 días) de mayor a menor, con rubro/subrubro y agrupaciones; y las
  // agrupaciones para filtrar.
  async articulos(q = '') {
    const r = ok(await httpBiz(`/plazas/articulos?q=${encodeURIComponent(q)}`, { method: 'GET', cache: false }), 'No se pudieron cargar los artículos');
    return { articulos: r.articulos || [], agrupaciones: r.agrupaciones || [] };
  },
  // grupos: [{ tipo: 'rubro'|'subrubro', nombre }] que la plaza sigue (sus productos nuevos se suman solos).
  async crear(sectorId, nombre, articleIds, grupos) { return ok(await httpBiz('/plazas', { method: 'POST', body: { sectorId, nombre, articleIds, grupos } }), 'No se pudo crear la plaza'); },
  async editar(id, nombre, articleIds, grupos) { return ok(await httpBiz(`/plazas/${id}`, { method: 'PUT', body: { nombre, articleIds, grupos } }), 'No se pudo guardar la plaza'); },
  // ★ NUEVO a mano (Diego 20/11/2026): marca (una semana desde hoy) o desmarca un producto de la plaza.
  async marcarNuevo(id, articleId, nuevo) { return ok(await httpBiz(`/plazas/${id}/fichas/${articleId}/nuevo`, { method: 'PUT', body: { nuevo } }), 'No se pudo guardar'); },
  // Lugares de los productos (Diego 19/11/2026): [articleId | null], null = lugar libre.
  async casillas(id, casillas) { return ok(await httpBiz(`/plazas/${id}`, { method: 'PUT', body: { casillas } }), 'No se pudo guardar el orden'); },
  // Qué muestra la plaza por defecto ('peso' | 'obs' | 'ambos'); cada ingrediente puede tener el suyo.
  async mostrar(id, mostrar) { return ok(await httpBiz(`/plazas/${id}`, { method: 'PUT', body: { mostrar } }), 'No se pudo guardar'); },
  // TVs de la plaza (Vincular TV): el código lo muestra la TV en /pantalla.
  async pantallas(id) { return ok(await httpBiz(`/plazas/${id}/pantallas`, { method: 'GET', cache: false }), 'No se pudieron cargar las pantallas').pantallas || []; },
  async vincularPantalla(id, codigo, nombre) {
    const r = await httpBiz(`/plazas/${id}/pantallas`, { method: 'POST', body: { codigo, nombre } });
    if (!r?.ok) throw new Error(r?.message || (r?.error === 'codigo_invalido' ? 'Ese código no existe o ya venció. Fijate el que muestra la TV.' : 'No se pudo vincular'));
    return r.pantalla;
  },
  async desvincularPantalla(id, pid) { return ok(await httpBiz(`/plazas/${id}/pantallas/${pid}`, { method: 'DELETE' }), 'No se pudo desvincular'); },
  // Sector nuevo desde el editor de la plaza (dueño/admin). Si ya existe con ese nombre, devuelve ese.
  async crearSector(nombre) { return ok(await httpBiz('/plazas/sectores', { method: 'POST', body: { nombre } }), 'No se pudo crear el sector').sector; },
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
  // Ojito: oculta / muestra el ingrediente en TODAS las recetas (queda como «Oculto» en cada receta).
  async ocultar(id, ref, oculto) { return ok(await httpBiz(`/plazas/${id}/ocultar`, { method: 'PUT', body: { ref, oculto } }), 'No se pudo ocultar'); },
  // color, mostrar ('peso' | 'obs' | 'ambos'; 'plaza' = sin excepción, sigue a cada plaza) y/o alias ('' lo borra):
  // lo que no se manda queda como estaba.
  async guardarColor(ref, color, mostrar, alias) { return ok(await httpBiz('/plazas/colores', { method: 'PUT', body: { ref, color, mostrar, alias } }), 'No se pudo guardar el ingrediente'); },
};
