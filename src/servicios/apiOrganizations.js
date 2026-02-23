// src/servicios/apiOrganizations.js 
import { http } from './apiBusinesses';

/* ══════════════════════════════════════════════════════════
   Organización del usuario logueado
   GET /api/me/organization
══════════════════════════════════════════════════════════ */
export async function getMyOrganization() {
  const res = await http('/me/organization', { withBusinessId: false });
  return res?.organization ?? null;
}

/* ══════════════════════════════════════════════════════════
   Crear organización (onboarding)
   POST /api/organizations
   body: { name, businessId, maxiCodCli? }
══════════════════════════════════════════════════════════ */
export async function createOrganization({ name, businessId, maxiCodCli }) {
  const res = await http('/organizations', {
    method: 'POST',
    body: { name, businessId, maxiCodCli },
    withBusinessId: false,
  });
  return res?.organization ?? null;
}

/* ══════════════════════════════════════════════════════════
   Editar organización
   PATCH /api/organizations/:orgId
   body: { name, display_name?, maxi_codcli? }
══════════════════════════════════════════════════════════ */
export async function updateOrganization(orgId, { name, displayName, maxiCodCli }) {
  const res = await http(`/organizations/${orgId}`, {
    method: 'PATCH',
    body: { name, display_name: displayName, maxi_codcli: maxiCodCli },
    withBusinessId: false,
  });
  return res?.organization ?? null;
}

/* ══════════════════════════════════════════════════════════
   Crear sub-negocio desde una agrupación
   POST /api/organizations/:orgId/businesses/from-group
   body: { sourceGroupId, name, colorHex?, maxiCodCliOverride? }
══════════════════════════════════════════════════════════ */
export async function createBusinessFromGroup(orgId, {
  sourceGroupId, name, colorHex, maxiCodCliOverride,
  branding, contact, description, address, social,
}) {
  const res = await http(`/organizations/${orgId}/businesses/from-group`, {
    method: 'POST',
    body: {
      sourceGroupId, name, colorHex, maxiCodCliOverride,
      branding, contact, description, address, social,
    },
    withBusinessId: false,
  });
  return res?.business ?? null;
}

/* ══════════════════════════════════════════════════════════
   Obtener receta de un artículo en un negocio
   GET /api/businesses/:bizId/articles/:artId/receta
══════════════════════════════════════════════════════════ */
export async function getReceta(bizId, articleId) {
  const res = await http(`/businesses/${bizId}/articles/${articleId}/receta`, {
    withBusinessId: false,
  });
  return res?.receta ?? null;
}

/* ══════════════════════════════════════════════════════════
   Guardar (crear o actualizar) receta
   POST /api/businesses/:bizId/articles/:artId/receta
   body: { nombre?, descripcion?, porciones, porcentajeVenta, items[] }
══════════════════════════════════════════════════════════ */
export async function saveReceta(bizId, articleId, recetaData) {
  const res = await http(`/businesses/${bizId}/articles/${articleId}/receta`, {
    method: 'POST',
    body: recetaData,
    withBusinessId: false,
  });
  return res?.receta ?? null;
}

/* ══════════════════════════════════════════════════════════
   Eliminar receta (soft delete)
   DELETE /api/businesses/:bizId/articles/:artId/receta
══════════════════════════════════════════════════════════ */
export async function deleteReceta(bizId, articleId) {
  const res = await http(`/businesses/${bizId}/articles/${articleId}/receta`, {
    method: 'DELETE',
    withBusinessId: false,
  });
  return res?.ok ?? false;
}