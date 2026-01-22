/**
 * apiAgrupaciones - Servicio (agrupaciones) con filtro opcional por división
 *
 * IMPORTANTE:
 * - httpBiz YA arma la base /api/businesses/:businessId (según tu wrapper)
 * - Este servicio soporta back que devuelve:
 *    a) array directo              -> res.json(rows)
 *    b) objeto { ok, agrupaciones } -> recomendado
 *    c) objeto directo (agrupación) -> res.json(row) en create/update/etc.
 */
import { httpBiz } from './apiBusinesses';

/* ========================= helpers ========================= */

function unwrapList(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp?.ok) return resp.agrupaciones || [];
  // algunos endpoints legacy devuelven { agrupaciones: [...] } sin ok
  if (Array.isArray(resp?.agrupaciones)) return resp.agrupaciones;
  throw new Error(resp?.error || 'Error obteniendo agrupaciones');
}

function unwrapOne(resp, fallbackMsg) {
  // si viene {ok:true, ...}
  if (resp?.ok) return resp;
  // si viene objeto directo (row)
  if (resp && typeof resp === 'object' && !Array.isArray(resp) && !resp.error) return resp;
  throw new Error(resp?.error || fallbackMsg);
}

/* ========================= API ========================= */

// GET /api/businesses/:businessId/agrupaciones
export async function obtenerAgrupaciones(businessId, divisionId = null) {
  const headers = {};
  if (divisionId != null) headers['X-Division-Id'] = String(divisionId);

  const resp = await httpBiz(
    `/agrupaciones`,
    { method: 'GET', headers },
    businessId
  );

  return unwrapList(resp);
}

// POST /api/businesses/:businessId/agrupaciones
export async function crearAgrupacion(businessId, nombre) {
  const resp = await httpBiz(
    `/agrupaciones`,
    { method: 'POST', body: { nombre } },
    businessId
  );

  // tu controller actual devuelve row directo (no {ok:true})
  return unwrapOne(resp, 'Error creando agrupación');
}

// PUT /api/businesses/:businessId/agrupaciones/:id
export async function actualizarAgrupacion(businessId, groupId, updates) {
  const resp = await httpBiz(
    `/agrupaciones/${groupId}`,
    { method: 'PUT', body: updates },
    businessId
  );

  // tu controller devuelve row directo
  return unwrapOne(resp, 'Error actualizando agrupación');
}

// DELETE /api/businesses/:businessId/agrupaciones/:id
export async function eliminarAgrupacion(businessId, groupId) {
  const resp = await httpBiz(
    `/agrupaciones/${groupId}`,
    { method: 'DELETE' },
    businessId
  );

  // tu controller devuelve {ok:true}
  return unwrapOne(resp, 'Error eliminando agrupación');
}

// PUT /api/businesses/:businessId/agrupaciones/:id/articulos
// controller soporta { articulos: [...] } o { ids: [...] }
export async function agregarArticulosAgrupacion(businessId, groupId, ids = []) {
  const cleanIds = Array.isArray(ids)
    ? [...new Set(ids.map(Number))].filter(Number.isFinite)
    : [];

  const resp = await httpBiz(
    `/agrupaciones/${groupId}/articulos`,
    { method: 'PUT', body: { ids: cleanIds } }, // ✅ CLAVE: "ids"
    businessId
  );

  // devuelve row directo
  return unwrapOne(resp, 'Error agregando artículos');
}

// DELETE /api/businesses/:businessId/agrupaciones/:id/articulos/:articuloId
export async function eliminarArticuloDeAgrupacion(businessId, groupId, articuloId) {
  const resp = await httpBiz(
    `/agrupaciones/${groupId}/articulos/${articuloId}`,
    { method: 'DELETE' },
    businessId
  );

  // devuelve row directo
  return unwrapOne(resp, 'Error eliminando artículo');
}

// POST /api/businesses/:businessId/agrupaciones/:fromId/move-items
// payload: { toId: number, ids: number[] }
export async function moveItemsBetweenGroups(businessId, fromId, payload) {
  const resp = await httpBiz(
    `/agrupaciones/${fromId}/move-items`,
    { method: 'POST', body: payload },
    businessId
  );

  return unwrapOne(resp, 'Error moviendo ítems');
}

// POST /api/businesses/:businessId/agrupaciones/create-or-move
// payload: { nombre: string, ids: number[] }
export async function createOrMoveAgrupacion(businessId, payload) {
  const resp = await httpBiz(
    `/agrupaciones/create-or-move`,
    { method: 'POST', body: payload },
    businessId
  );

  return unwrapOne(resp, 'Error create-or-move');
}

// POST /api/businesses/:businessId/agrupaciones/:groupId/assign-division
// body: { divisionId: number | null }
export async function assignAgrupacionToDivision(businessId, groupId, divisionId) {
  const resp = await httpBiz(
    `/agrupaciones/${groupId}/assign-division`,
    { method: 'POST', body: { divisionId } },
    businessId
  );

  if (resp?.ok) return resp;
  throw new Error(resp?.error || 'Error asignando agrupación a división');
}
