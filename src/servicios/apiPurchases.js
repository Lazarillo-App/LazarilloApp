// src/servicios/apiPurchases.js
import { BASE } from './apiBase';
import { getActiveBusinessId } from './apiBusinesses';

function authHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const bidRaw = bizId ?? getActiveBusinessId() ?? localStorage.getItem('activeBusinessId') ?? '';
  const bidNum = Number(bidRaw);
  const bid = Number.isFinite(bidNum) && bidNum > 0 ? bidNum : '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid) h['X-Business-Id'] = String(bid);
  return h;
}

function qs(params = {}) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    u.append(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

// POST /api/purchases/sync  { from, to }
export async function purchasesSync(bizId, {
  from, to, provdr, num,
  branch_id,   // id de sucursal o null
} = {}) {
  return {BASE}(`/purchases/sync`, {
    method: 'POST',
    body: JSON.stringify({ from, to, provdr, num, branch_id: branch_id ?? null }),
    bizId,
  });
}

// GET /api/purchases?from=&to=&limit=
export async function purchasesList(bizId, {
  from, to, proveedor_id, insumo_id, page, limit,
  branch_id,   // null | 'all' | 'none' | number
} = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (proveedor_id) params.set('proveedor_id', proveedor_id);
  if (insumo_id) params.set('insumo_id', insumo_id);
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  // branch_id: solo enviar si viene explícito (null = todas = omitir)
  if (branch_id !== null && branch_id !== undefined) {
    params.set('branch_id', String(branch_id));
  }
  const res = await fetch(`${BASE}/purchases${qs(Object.fromEntries(params))}`, {
    headers: authHeaders(bizId),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

// Descarga CSV y lo dispara como archivo
export async function purchasesDownloadCsv(bizId, params = {}) {
  const res = await fetch(`${BASE}/purchases/export/csv${qs(params)}`, {
    headers: authHeaders(bizId),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al descargar CSV`);
  const blob = await res.blob();
  const from = params.from ?? 'all';
  const to = params.to ?? 'all';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compras_${from}_${to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Construye Map<insumoId:number, { cantidad, neto, iva, total, facturas }>
// para pasarle a InsumosTable como comprasMap
export function buildComprasMap(rows) {
  const map = new Map();
  for (const r of rows) {
    const id = Number(r.insumo_id ?? r.insumoId);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!map.has(id)) {
      map.set(id, { cantidad: 0, neto: 0, iva: 0, total: 0, facturas: new Set() });
    }
    const acc = map.get(id);
    acc.cantidad += Number(r.cantidad ?? 0);
    acc.neto += Number(r.precio_total ?? 0);
    acc.iva += Number(r.iva_total ?? 0);
    acc.total += Number(r.precio_total ?? 0) + Number(r.iva_total ?? 0);
    if (r.factura) acc.facturas.add(r.factura);
  }
  for (const [, v] of map) {
    v.facturas = v.facturas.size;
  }
  return map;
}

// GET /api/purchases/first-date
// Devuelve la fecha más antigua con compras sincronizadas en la DB para este negocio
export async function purchasesFirstDate(bizId) {
  const res = await fetch(`${BASE}/purchases/first-date`, {
    headers: authHeaders(bizId),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data; // { ok: true, firstDate: "2024-08-15" } o { ok: true, firstDate: null }
}