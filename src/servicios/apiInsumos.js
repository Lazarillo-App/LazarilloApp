// src/servicios/apiInsumos.js
import { BASE } from './apiBase';

function authHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const bid = bizId || localStorage.getItem('activeBusinessId') || '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid) h['X-Business-Id'] = bid;
  return h;
}

/* ================== INSUMOS (CRUD + LISTADO) ================== */

export const insumosList = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}/insumos${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: authHeaders(),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    console.error('[apiInsumos] insumosList error:', res.status, data);
    throw new Error((data && data.error) || 'Error al listar insumos');
  }

  return data; // { ok, data, pagination }
};

export const insumoCreate = async (payload) => {
  const url = `${BASE}/insumos`;
  console.log('[apiInsumos] POST', url, payload);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[apiInsumos] insumoCreate error:', res.status, data);
    throw new Error((data && data.error) || 'Error al crear insumo');
  }
  return data;
};

export const insumoUpdate = async (id, payload) => {
  const url = `${BASE}/insumos/${id}`;
  console.log('[apiInsumos] PUT', url, payload);

  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[apiInsumos] insumoUpdate error:', res.status, data);
    throw new Error((data && data.error) || 'Error al actualizar insumo');
  }
  return data;
};

export const insumoDelete = async (id) => {
  const url = `${BASE}/insumos/${id}`;
  console.log('[apiInsumos] DELETE', url);

  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[apiInsumos] insumoDelete error:', res.status, data);
    throw new Error((data && data.error) || 'Error al eliminar insumo');
  }
  return data;
};

/* ================== BULK JSON / CSV ================== */

export const insumosBulkJSON = async (items) => {
  const url = `${BASE}/insumos/bulk`;
  console.log('[apiInsumos] POST bulk JSON', url, items);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(items),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[apiInsumos] insumosBulkJSON error:', res.status, data);
    throw new Error((data && data.error) || 'Error en bulk JSON');
  }
  return data;
};

export const insumosBulkCSV = async (file) => {
  const url = `${BASE}/insumos/bulk-csv`;
  const fd = new FormData();
  fd.append('file', file);
  const headers = authHeaders();
  delete headers['Content-Type']; // ✅ importante: FormData pone el boundary solo

  console.log('[apiInsumos] POST bulk CSV', url, file?.name);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: fd,
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error('[apiInsumos] insumosBulkCSV error:', res.status, data);
    throw new Error((data && data.error) || 'Error en bulk CSV');
  }
  return data;
};

export const insumosCleanup = async () => {
  const url = `${BASE}/insumos/admin/cleanup-null`;
  console.log('[apiInsumos] POST', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[apiInsumos] insumosCleanup error:', res.status, data);
    throw new Error((data && data.error) || 'Error en cleanup');
  }
  return data;
};

/* ================== SYNC INSUMOS DESDE MAXI ================== */

export const insumosSyncMaxi = async (bizId) => {
  const url = `${BASE}/insumos/maxi-sync`;
  console.log('[apiInsumos] POST syncMaxi', url, 'bizId=', bizId);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(bizId),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumosSyncMaxi error:', res.status, data);
    throw new Error((data && data.error) || 'Error al sincronizar insumos');
  }
  return data;
};

/* ================== RUBROS DE INSUMOS (MAXI) ================== */

export const insumosRubrosList = async (businessId) => {
  const params = new URLSearchParams();
  if (businessId) params.set('businessId', businessId);
  const qs = params.toString();

  const url = `${BASE}/insumos/maxi/rubros${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(businessId),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumosRubrosList error:', res.status, data);
    throw new Error((data && data.error) || 'Error al listar rubros de insumos');
  }
  return data;
};

export const insumosRubrosSync = async (bizId) => {
  const url = `${BASE}/insumos/maxi/rubros/sync`;
  console.log('[apiInsumos] POST rubros sync', url, 'bizId=', bizId);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(bizId),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumosRubrosSync error:', res.status, data);
    throw new Error((data && data.error) || 'Error al sincronizar rubros de insumos');
  }
  return data;
};

/* ================== AGRUPACIONES DE INSUMOS ================== */

export const insumoGroupsList = async () => {
  const url = `${BASE}/insumos/groups`;

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupsList error:', res.status, data);
    throw new Error((data && data.error) || 'Error al listar agrupaciones de insumos');
  }

  return data;
};

export const insumoGroupGetOne = async (id) => {
  const url = `${BASE}/insumos/groups/${id}`;

  console.log('[apiInsumos] GET group one', url);

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });

  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupGetOne raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupGetOne error:', res.status, data);
    throw new Error((data && data.error) || 'Error al obtener la agrupación de insumos');
  }

  return data;
};

export const insumoGroupCreate = async (payload) => {
  const url = `${BASE}/insumos/groups`;
  console.log('[apiInsumos] POST group', url, payload);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupCreate raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupCreate error:', res.status, data);
    throw new Error((data && data.error) || 'Error al crear agrupación de insumos');
  }
  return data;
};

export const insumoGroupUpdate = async (id, payload) => {
  const url = `${BASE}/insumos/groups/${id}`;
  console.log('[apiInsumos] PUT group', url, payload);

  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupUpdate raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupUpdate error:', res.status, data);
    throw new Error((data && data.error) || 'Error al actualizar agrupación de insumos');
  }
  return data;
};

export const insumoGroupDelete = async (id) => {
  const url = `${BASE}/insumos/groups/${id}`;
  console.log('[apiInsumos] DELETE group', url);

  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupDelete raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupDelete error:', res.status, data);
    throw new Error((data && data.error) || 'Error al eliminar agrupación de insumos');
  }
  return data;
};

export const insumoGroupAddMultipleItems = async (groupId, insumoIds) => {
  const url = `${BASE}/insumos/groups/${groupId}/items/bulk`; // 👈 Verificar esta URL
  console.log('[apiInsumos] POST group items bulk', url, { insumoIds });

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ insumoIds }), // 👈 Backend espera "insumoIds"
  });
  
  const data = await res.json().catch(() => null);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupAddMultipleItems error:', res.status, data);
    throw new Error((data && data.error) || `Error ${res.status}: not_found`);
  }
  
  return data;
};

/* Items dentro de agrupaciones */

export const insumoGroupAddItem = async (groupId, insumoId) => {
  const url = `${BASE}/insumos/groups/${groupId}/items`;
  console.log('[apiInsumos] POST group item', url, { insumoId });

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ insumoId }),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupAddItem raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupAddItem error:', res.status, data);
    throw new Error((data && data.error) || 'Error al agregar insumo a agrupación');
  }
  return data;
};

export const insumoGroupRemoveItem = async (groupId, insumoId) => {
  const url = `${BASE}/insumos/groups/${groupId}/items/${insumoId}`;
  console.log('[apiInsumos] DELETE group item', url);

  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupRemoveItem raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupRemoveItem error:', res.status, data);
    throw new Error((data && data.error) || 'Error al quitar insumo de agrupación');
  }
  return data;
};

/* ================== REEMPLAZAR ITEMS (bulk) ================== */

export const insumoGroupReplaceItems = async (groupId, insumoIds) => {
  const url = `${BASE}/insumos/groups/${groupId}/items`;
  console.log('[apiInsumos] PUT group items', url, { insumoIds });

  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ insumoIds }),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupReplaceItems raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupReplaceItems error:', res.status, data);
    throw new Error((data && data.error) || 'Error al reemplazar items de agrupación');
  }
  return data;
};

/* ================== EXCLUSIONES (para TODO) ================== */

export const insumoGroupGetExclusions = async (groupId) => {
  const url = `${BASE}/insumos/groups/${groupId}/exclusions`;
  console.log('[apiInsumos] GET exclusions', url);

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupGetExclusions raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupGetExclusions error:', res.status, data);
    throw new Error((data && data.error) || 'Error al obtener exclusiones');
  }
  return data;
};

export const insumoGroupAddExclusions = async (groupId, exclusions) => {
  const url = `${BASE}/insumos/groups/${groupId}/exclusions`;
  console.log('[apiInsumos] POST exclusions', url, { exclusions });

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ exclusions }),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupAddExclusions raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupAddExclusions error:', res.status, data);
    throw new Error((data && data.error) || 'Error al agregar exclusiones');
  }
  return data;
};

export const insumoGroupRemoveExclusions = async (groupId, ids, scope = 'insumo') => {
  const url = `${BASE}/insumos/groups/${groupId}/exclusions`;
  console.log('[apiInsumos] DELETE exclusions', url, { ids, scope });

  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ ids, scope }),
  });
  const data = await res.json().catch(() => null);

  console.log('[apiInsumos] insumoGroupRemoveExclusions raw:', res.status, data);

  if (!res.ok || (data && data.ok === false)) {
    console.error('[apiInsumos] insumoGroupRemoveExclusions error:', res.status, data);
    throw new Error((data && data.error) || 'Error al quitar exclusiones');
  }
  return data;
};