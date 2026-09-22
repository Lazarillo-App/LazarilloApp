// src/servicios/apiSectores.js
// Vista Operación — sectores (recorte de adentro de un negocio: Barra, Cocina,
// Salón). Define qué recetas ve una persona con rol Staff.
import { httpBiz, http } from './apiBusinesses';

// GET /api/businesses/:businessId/sectores
export async function listarSectores(businessId) {
  const resp = await httpBiz('/sectores', { method: 'GET' }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error obteniendo sectores');
  return resp.sectores || [];
}

// POST /api/businesses/:businessId/sectores
// Body: { nombre, color, scope: [{tipo, agrupacionId, rubro?, subrubro?}] }
export async function crearSector(businessId, payload) {
  const resp = await httpBiz('/sectores', { method: 'POST', body: payload }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error creando el sector');
  return resp.sector;
}

// PATCH /api/sectores/:sectorId
export async function actualizarSector(sectorId, payload) {
  const resp = await http(`/sectores/${sectorId}`, { method: 'PATCH', body: payload, withBusinessId: false });
  if (!resp?.ok) throw new Error(resp?.error || 'Error actualizando el sector');
  return resp;
}

// DELETE /api/sectores/:sectorId
export async function eliminarSector(sectorId) {
  const resp = await http(`/sectores/${sectorId}`, { method: 'DELETE', withBusinessId: false });
  if (!resp?.ok) throw new Error(resp?.error || 'Error eliminando el sector');
  return resp;
}
