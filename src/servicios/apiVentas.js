// src/servicios/apiVentas.js
import axios from 'axios';
import { BASE } from './apiBase'; 
// BASE -> 'http://localhost:4000/api' en dev (por tu .env)
//        -> 'https://tu-backend/api' en prod

/**
 * Obtiene ventas SOLO del artículo indicado, agrupadas por day|week|month.
 * @param {{articuloId:number|string, from:string, to:string, groupBy?:'day'|'week'|'month'}} params
 * @returns {{ total:number, items: {label:string, qty:number}[] }}
 */
export async function obtenerVentas({ articuloId, from, to, groupBy = 'day' }) {
  if (!articuloId || !from || !to) return { total: 0, items: [] };

  const params = new URLSearchParams({
    articuloId: String(articuloId),
    from,
    to,
    groupBy
  });

  try {
    const { data } = await axios.get(`${BASE}/ventas?${params.toString()}`, { timeout: 15000 });

    // Normalizo por las dudas
    const total = Number(data?.total ?? 0);
    const items = Array.isArray(data?.items)
      ? data.items.map(it => ({ label: String(it.label), qty: Number(it.qty || 0) }))
      : [];

    return { total, items };
  } catch (err) {
    console.warn('[apiVentas.obtenerVentas] error:', err?.message || err);
    return { total: 0, items: [] };
  }
}