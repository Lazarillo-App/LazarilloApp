// src/servicios/apiFudo.js
// Fudo (17/11/2026): conexión por la API oficial de Fudo (solo lectura), vínculo de sus productos con
// los artículos y sincronización de ventas. Ver Backend/routes/fudoRoutes.js.
import { http } from '@/servicios/apiBusinesses';

const base = (bid) => `/businesses/${bid}/fudo`;

export const FudoAPI = {
  estado: (bid) => http(`${base(bid)}/estado`, { cache: false }),
  conectar: (bid, apiKey, apiSecret, traer = null, branchId = null) =>
    http(`${base(bid)}/conectar`, { method: 'POST', timeoutMs: 60000, body: { apiKey, apiSecret, traer, branchId } }),
  // Qué trae además de las ventas (que siempre vienen): { articulos, insumos, compras }.
  traer: (bid, traer) => http(`${base(bid)}/traer`, { method: 'PATCH', body: { traer } }),
  desconectar: (bid) => http(base(bid), { method: 'DELETE' }),
  sincronizar: (bid) => http(`${base(bid)}/sincronizar`, { method: 'POST' }),
  productos: (bid) => http(`${base(bid)}/productos`, { cache: false, timeoutMs: 60000 }),
  vincular: (bid, cambios) => http(`${base(bid)}/productos`, { method: 'PATCH', timeoutMs: 120000, body: { cambios } }),
};
