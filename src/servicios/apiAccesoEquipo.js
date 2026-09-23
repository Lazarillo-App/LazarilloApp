// src/servicios/apiAccesoEquipo.js
// Vista Operación — QR de acceso por sucursal, pendientes de aprobación.
import { httpBiz, http } from './apiBusinesses';

// GET /api/businesses/:businessId/branches/:branchId/access
export async function obtenerCodigoAcceso(businessId, branchId) {
  const resp = await httpBiz(`/branches/${branchId}/access`, { method: 'GET' }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error obteniendo el código de acceso');
  return resp.accessCode;
}

// PATCH /api/businesses/:businessId/branches/:branchId/access  { active }
export async function pausarReanudarAcceso(businessId, branchId, active) {
  const resp = await httpBiz(`/branches/${branchId}/access`, { method: 'PATCH', body: { active } }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error actualizando el acceso');
  return resp.accessCode;
}

// GET /api/businesses/:businessId/access-requests
export async function listarPendientes(businessId) {
  const resp = await httpBiz('/access-requests', { method: 'GET' }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error obteniendo pendientes');
  return resp.pendientes || [];
}

// POST /api/access-requests/:requestId/approve  { role, sectorIds }
export async function aprobarPendiente(requestId, payload) {
  const resp = await http(`/access-requests/${requestId}/approve`, { method: 'POST', body: payload, withBusinessId: false });
  if (!resp?.ok) throw new Error(resp?.error || 'Error aprobando');
  return resp;
}

// POST /api/access-requests/:requestId/reject
export async function rechazarPendiente(requestId) {
  const resp = await http(`/access-requests/${requestId}/reject`, { method: 'POST', withBusinessId: false });
  if (!resp?.ok) throw new Error(resp?.error || 'Error rechazando');
  return resp;
}

/* ── Público — sin auth (usado por la pantalla de alta por QR) ── */

// GET /api/public/access/:code
export async function resolverCodigoPublico(code) {
  const resp = await http(`/public/access/${code}`, { method: 'GET', withBusinessId: false });
  return resp;
}

// POST /api/public/access/:code/request  { nombre, canal, valor }
export async function pedirAccesoPublico(code, payload) {
  const resp = await http(`/public/access/${code}/request`, { method: 'POST', body: payload, withBusinessId: false });
  return resp;
}

// POST /api/public/access/:code/confirm  { requestId, otp, password }
export async function confirmarAccesoPublico(code, payload) {
  const resp = await http(`/public/access/${code}/confirm`, { method: 'POST', body: payload, withBusinessId: false });
  return resp;
}
