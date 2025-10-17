/* eslint-disable no-empty */
// src/servicios/ensureBusiness.js
import axios from 'axios';
import { BASE } from './apiBase';

function authHeaders({ withBusinessId = true } = {}) {
  const token = localStorage.getItem('token') || '';
  const bid   = localStorage.getItem('activeBusinessId') || '';
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  // para estas rutas no necesitamos X-Business-Id:
  if (withBusinessId && bid) h['X-Business-Id'] = bid; // (mayúsculas por consistencia)
  return h;
}

export async function ensureActiveBusiness() {
  let bid = localStorage.getItem('activeBusinessId');
  if (bid) return Number(bid);

  // ✅ endpoint correcto: GET /api/businesses (sin X-Business-Id)
  const { data } = await axios.get(`${BASE}/businesses`, { headers: authHeaders({ withBusinessId: false }) });
  const first = (data?.items ?? data ?? [])[0];
  if (!first?.id) throw new Error('Sin negocios disponibles');

  bid = String(first.id);

  // seleccionar en backend (sin X-Business-Id)
  try {
    await axios.post(`${BASE}/businesses/${first.id}/select`, {}, { headers: authHeaders({ withBusinessId: false }) });
  } catch {}

  localStorage.setItem('activeBusinessId', bid);
  window.dispatchEvent(new Event('business:switched'));
  return Number(bid);
}
