/* eslint-disable no-console */
// ============================================================================
// src/servicios/autoGroupingInsumos.js
// Auto-agrupación de INSUMOS basada en rubro (simple)
// Flujo recomendado: sync -> backend autoAssignNewInsumos -> refresh groups
// ============================================================================

import { httpBiz } from './apiBusinesses';

/**
 * Normaliza texto para comparaciones (sin acentos, lowercase, trim)
 */
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function esSystemGroupInsumos(grupo) {
  const n = norm(grupo?.nombre || '');
  return (
    n === 'todo' ||
    n === 'sin agrupacion' ||
    n === 'sin agrupación' ||
    n === 'sin agrupar' ||
    n === 'sin grupo' ||
    n === 'discontinuados' ||
    n === 'descontinuados'
  );
}

/**
 * 1) Dispara el sync de insumos en backend (Maxi -> DB)
 * 2) Backend corre autoAssignNewInsumos y devuelve auto_assigned
 *
 * Ajustá el endpoint si tu ruta real es distinta.
 */
export async function syncInsumosFromMaxi(businessId) {
  if (!businessId) throw new Error('businessId requerido');

  // Ejemplo: si tu ruta es /businesses/:id/insumos/sync
  const res = await httpBiz(`/businesses/${businessId}/insumos/sync`, {
    method: 'POST',
    body: JSON.stringify({}), // si no requiere body
  });

  // Esperado: { ok: true, inserted, updated, ... auto_assigned, auto_details }
  return res;
}

/**
 * Lista grupos de insumos (sidebar)
 * Endpoint según tu controller: groups_list
 *
 * Ajustá a tu ruta real.
 */
export async function fetchInsumoGroups(businessId) {
  if (!businessId) throw new Error('businessId requerido');

  // Ejemplo: /businesses/:id/insumos/groups
  const res = await httpBiz(`/businesses/${businessId}/insumos/groups`);
  return res?.data || res?.groups || [];
}

/**
 * Lista insumos (tabla). Útil para refetch post-sync.
 * Ajustá a tu ruta real (tu controller: exports.listar)
 */
export async function fetchInsumosList(businessId, params = {}) {
  if (!businessId) throw new Error('businessId requerido');

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === '') return;
    qs.set(k, String(v));
  });

  const url = `/businesses/${businessId}/insumos?${qs.toString()}`;
  const res = await httpBiz(url);
  return res; // { ok, data, pagination }
}

/**
 * Orquestador estilo “un click”:
 * - sincroniza
 * - refetch groups
 * - (opcional) refetch insumos list
 */
export async function syncAndRefreshInsumos({
  businessId,
  refetchGroups,
  refetchList,
}) {
  console.log('[autoGroupingInsumos] 🔄 sync+refresh start', { businessId });

  const syncRes = await syncInsumosFromMaxi(businessId);

  const autoAssigned = Number(syncRes?.auto_assigned || 0);
  console.log('[autoGroupingInsumos] ✅ sync ok', {
    inserted: syncRes?.inserted,
    updated: syncRes?.updated,
    autoAssigned,
  });

  let groups = null;
  if (typeof refetchGroups === 'function') {
    groups = await refetchGroups();
  }

  let list = null;
  if (typeof refetchList === 'function') {
    list = await refetchList();
  }

  return {
    sync: syncRes,
    auto_assigned: autoAssigned,
    groups,
    list,
  };
}
