import { BASE } from './apiBase';

// ---- Helpers genéricos ----
async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

async function httpJson(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await parseJsonSafe(res);
  return { ok: res.ok, status: res.status, data };
}

// ===================================================================
//                          AGRUPACIONES
// ===================================================================

// Lista todas las agrupaciones
export async function obtenerAgrupaciones() {
  const { ok, status, data } = await httpJson(`/agrupaciones`);
  if (!ok) {
    throw new Error((data && data.error) || `No se pudieron obtener agrupaciones (status ${status})`);
  }
  // backend devuelve array plano
  return Array.isArray(data) ? data : (data?.data || []);
}

// Obtiene una agrupación por id (vía lista, porque el backend no expone GET /agrupaciones/:id)
export async function obtenerAgrupacion(id) {
  const list = await obtenerAgrupaciones();
  const g = list.find(x => Number(x?.id) === Number(id));
  if (!g) throw new Error(`Agrupación #${id} no encontrada`);
  return g;
}

// Crea una agrupación
// payload: { nombre: string, articulos?: [{ id|codigo|articuloId, ... }] }
export async function crearAgrupacion(payload) {
  const { ok, status, data } = await httpJson(`/agrupaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!ok) throw new Error(data?.error || `No se pudo crear la agrupación (status ${status})`);
  return data;
}

// Actualiza nombre / o REEMPLAZA todos los artículos (si mandás { articulos })
export async function actualizarAgrupacion(id, payload) {
  const { ok, status, data } = await httpJson(`/agrupaciones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!ok) throw new Error(data?.error || `No se pudo actualizar la agrupación #${id} (status ${status})`);
  return data;
}

// Elimina una agrupación
export async function eliminarAgrupacion(id) {
  const { ok, status, data } = await httpJson(`/agrupaciones/${id}`, { method: 'DELETE' });
  if (!ok) throw new Error(data?.error || `No se pudo eliminar la agrupación #${id} (status ${status})`);
  return data;
}

// ===================================================================
//                          ARTÍCULOS EN GRUPO
// ===================================================================

// Reemplaza COMPLETAMENTE los artículos de una agrupación
// items: [{ id|codigo|articuloId, ... }]
export async function setArticulosEnAgrupacion(id, items) {
  // Tu backend reemplaza enviando { articulos } por PUT /agrupaciones/:id
  return actualizarAgrupacion(id, { articulos: items });
}

// Agrega artículos (append SIN duplicar) → backend lo hace con PUT /agrupaciones/:id/articulos
// items: [{ id|codigo|articuloId, ... }]
export async function agregarArticulos(id, items) {
  const { ok, status, data } = await httpJson(`/agrupaciones/${id}/articulos`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articulos: items }),
  });
  if (!ok) throw new Error(data?.error || `No se pudieron agregar artículos a #${id} (status ${status})`);
  return data;
}

// Quita UN artículo de la agrupación
export async function quitarArticulo(id, articuloId) {
  const { ok, status, data } = await httpJson(`/agrupaciones/${id}/articulos/${articuloId}`, {
    method: 'DELETE',
  });
  if (!ok) throw new Error(data?.error || `No se pudo quitar el artículo #${articuloId} de #${id} (status ${status})`);
  return data;
}

// Reordenamiento: tu backend aún no lo expone.
// export async function reordenarArticulos(id, orden) { ... }

// ===================================================================
//                           UTILIDADES
// ===================================================================

// Búsqueda simple de agrupaciones por nombre (si tu backend soporta ?q=)
export async function buscarAgrupaciones(q) {
  const qs = new URLSearchParams({ q }).toString();
  const { ok, status, data } = await httpJson(`/agrupaciones?${qs}`);
  if (!ok) throw new Error(`No se pudo buscar agrupaciones (status ${status})`);
  return Array.isArray(data) ? data : (data?.data || []);
}