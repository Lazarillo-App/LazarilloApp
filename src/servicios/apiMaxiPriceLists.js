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