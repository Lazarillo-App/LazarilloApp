/* eslint-disable no-empty */
// src/servicios/ensureBusiness.js
import axios from 'axios';
import { BASE } from './apiBase';

function authHeaders() {
    const token = localStorage.getItem('token') || '';
    const bid = localStorage.getItem('activeBusinessId') || '';
    const h = {};
    if (token) h.Authorization = `Bearer ${token}`;
    if (bid) h['x-business-id'] = bid;
    return h;
}

export async function ensureActiveBusiness() {
    let bid = localStorage.getItem('activeBusinessId');
    if (bid) return Number(bid);

    // obtengo la lista de negocios del usuario (ajusta si tu endpoint es otro)
    const { data } = await axios.get(`${BASE}/businesses/mine`, { headers: authHeaders() });
    const first = (data?.items || data || [])[0];
    if (!first?.id) throw new Error('Sin negocios disponibles');

    bid = String(first.id);

    // aviso al backend (opcional pero recomendado si tenés /select)
    try {
        await axios.post(`${BASE}/businesses/${first.id}/select`, {}, { headers: authHeaders() });
    } catch { }

    localStorage.setItem('activeBusinessId', bid);
    window.dispatchEvent(new Event('business:switched'));
    return Number(bid);
}
