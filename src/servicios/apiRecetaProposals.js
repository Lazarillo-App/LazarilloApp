// src/servicios/apiRecetaProposals.js
// Vista Operación — Fase 3: bandeja de aprobación de recetas propuestas por Staff.
import { httpBiz } from './apiBusinesses';

// GET /api/businesses/:businessId/receta-proposals?status=pending,in_revision
export async function listarPropuestas(businessId, status = 'pending,in_revision') {
  const resp = await httpBiz(`/receta-proposals?status=${encodeURIComponent(status)}`, { method: 'GET' }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error obteniendo propuestas');
  return resp.proposals || [];
}

// GET /api/businesses/:businessId/receta-proposals/:id
export async function obtenerPropuesta(businessId, id) {
  const resp = await httpBiz(`/receta-proposals/${id}`, { method: 'GET' }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error obteniendo la propuesta');
  return resp.proposal;
}

// POST /api/businesses/:businessId/receta-proposals/:id/approve
export async function aprobarPropuesta(businessId, id, comment = '') {
  const resp = await httpBiz(`/receta-proposals/${id}/approve`, { method: 'POST', body: { comment } }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error aprobando la propuesta');
  return resp;
}

// POST /api/businesses/:businessId/receta-proposals/:id/reject
export async function rechazarPropuesta(businessId, id, comment = '') {
  const resp = await httpBiz(`/receta-proposals/${id}/reject`, { method: 'POST', body: { comment } }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error rechazando la propuesta');
  return resp;
}

// POST /api/businesses/:businessId/receta-proposals/:id/revision   comment obligatorio
export async function pedirRevisionPropuesta(businessId, id, comment) {
  const resp = await httpBiz(`/receta-proposals/${id}/revision`, { method: 'POST', body: { comment } }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error pidiendo revisión');
  return resp;
}

// GET /api/businesses/:businessId/receta-proposals/mine — cambios propios (staff)
export async function listarMisPropuestas(businessId) {
  const resp = await httpBiz(`/receta-proposals/mine`, { method: 'GET' }, businessId);
  if (!resp?.ok) throw new Error(resp?.error || 'Error obteniendo tus cambios');
  return resp.proposals || [];
}
