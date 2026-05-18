// src/servicios/apiBranches.js
import { BASE } from './apiBase';

function getAuthHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const bid   = bizId || localStorage.getItem('activeBusinessId') || '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid)   h['X-Business-Id'] = String(bid);
  return h;
}

async function http(bizId, path, { method = 'GET', body } = {}) {
  const url = `${BASE}/businesses/${bizId}/branches${path}`;
  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(bizId),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const BranchesAPI = {
  /** Lista todas las sucursales de un negocio */
  list: (bizId) =>
    http(bizId, ''),

  /** ¿El negocio tiene sucursales? */
  hasBranches: (bizId) =>
    http(bizId, '/has-branches'),

  /** Obtener una sucursal por id */
  get: (bizId, branchId) =>
    http(bizId, `/${branchId}`),

  /** Crear sucursal */
  create: (bizId, payload) =>
    http(bizId, '', { method: 'POST', body: payload }),

  /** Editar sucursal (patch parcial) */
  update: (bizId, branchId, payload) =>
    http(bizId, `/${branchId}`, { method: 'PATCH', body: payload }),

  /**
   * Editar la sucursal PRINCIPAL (el negocio mismo).
   * Hace PATCH a /businesses/:bizId/branches/main
   * Crea o actualiza la sucursal principal como branch independiente.
   * NO toca el negocio padre.
   */
  updateMain: (bizId, payload) => {
    const token = localStorage.getItem('token') || '';
    const url   = `${BASE}/businesses/${bizId}/branches/main`;
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Business-Id': String(bizId),
      },
      body: JSON.stringify({
        name:     payload.name,
        logo_url: payload.logo_url,
        address:  payload.address,
        contacts: payload.contacts,
        props:    payload.props,
      }),
    }).then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return data;
    });
  },

  /** Eliminar sucursal */
  delete: (bizId, branchId) =>
    http(bizId, `/${branchId}`, { method: 'DELETE' }),
};