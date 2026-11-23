import { http } from './apiBusinesses';

const BASE_ORG = (orgId) => `/organizations/${orgId}/price-lists`;
const BASE_BIZ = (bizId) => `/businesses/${bizId}/price-list`;

// ── Config de org ────────────────────────────────────────────────────────
export async function getOrgPriceListConfig(orgId) {
  const res = await http(`${BASE_ORG(orgId)}/config`, { withBusinessId: false });
  return res?.config ?? [];
}

export async function saveOrgPriceListConfig(orgId, lists) {
  const res = await http(`${BASE_ORG(orgId)}/config`, {
    method: 'PUT',
    body: { lists },
    withBusinessId: false,
  });
  return res?.ok ?? false;
}

// ── Lista activa por negocio ──────────────────────────────────────────────
export async function getBusinessPriceList(bizId) {
  const res = await http(`${BASE_BIZ(bizId)}`, { withBusinessId: false });
  return res?.listNumber ?? 1;
}

export async function setBusinessPriceList(bizId, listNumber) {
  const res = await http(`${BASE_BIZ(bizId)}`, {
    method: 'PUT',
    body: { listNumber },
    withBusinessId: false,
  });
  return res?.ok ?? false;
}

// ── Precios desde Maxi para el negocio activo ────────────────────────────
export async function getBusinessPrices(bizId) {
  const res = await http(`${BASE_BIZ(bizId)}/prices`, { withBusinessId: false });
  return res ?? { prices: {}, listNumber: 1, discountPct: null };
}

// ── Excepciones de descuento ──────────────────────────────────────────────
export async function getDiscountExceptions(orgId, listNumber = null) {
  const qs = listNumber ? `?list_number=${listNumber}` : '';
  const res = await http(`${BASE_ORG(orgId)}/discount-exceptions${qs}`, { withBusinessId: false });
  return res?.exceptions ?? [];
}

export async function addDiscountException(orgId, scope, scopeId, listNumber = null) {
  return http(`${BASE_ORG(orgId)}/discount-exceptions`, {
    method: 'POST',
    body: { scope, scopeId: String(scopeId), listNumber },
    withBusinessId: false,
  });
}

export async function removeDiscountException(orgId, scope, scopeId, listNumber = null) {
  return http(`${BASE_ORG(orgId)}/discount-exceptions`, {
    method: 'DELETE',
    body: { scope, scopeId: String(scopeId), listNumber },
    withBusinessId: false,
  });
}
// ── Lista del POS por sucursal (Diego 23/11/2026) ─────────────────────────
// { disponible, listas: [{listNumber, alias}], sucursales: [{branchId, nombre, principal, listNumber}] }
export async function getListasSucursales(bizId) {
  const res = await http(`${BASE_BIZ(bizId)}/sucursales`, { withBusinessId: false });
  return res?.ok ? res : { disponible: false, listas: [], sucursales: [] };
}

export async function setListaSucursal(bizId, branchId, listNumber) {
  const res = await http(`${BASE_BIZ(bizId)}/sucursales`, {
    method: 'PUT',
    body: { branchId, listNumber },
    withBusinessId: false,
  });
  return res;
}

// Precio por artículo según la sucursal que se mira: sucursal = 'all' | 'main' | branchId.
// null = el negocio no tiene listas por sucursal (queda el precio de siempre).
export async function getPreciosPorSucursal(bizId, { sucursal = 'all', from, to } = {}) {
  const q = new URLSearchParams({ sucursal: String(sucursal) });
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const res = await http(`${BASE_BIZ(bizId)}/por-sucursal?${q}`, { withBusinessId: false });
  return res?.resultado ?? null;
}
