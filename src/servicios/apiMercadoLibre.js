// src/servicios/apiMercadoLibre.js
// Mercado Libre (14/11/2026): conexión del negocio y sus compras, para cargarlas como factura en el
// Panel de Gestión. Ver Backend/routes/mercadolibreRoutes.js.
import { http } from '@/servicios/apiBusinesses';

const base = (bid) => `/businesses/${bid}/mercadolibre`;

export const MercadoLibreAPI = {
  estado: (bid) => http(`${base(bid)}/estado`, { cache: false }),
  autorizar: (bid) => http(`${base(bid)}/autorizar`, { cache: false }),
  conectar: (bid, code, state) => http(`${base(bid)}/conectar`, { method: 'POST', timeoutMs: 60000, body: { code, state } }),
  desconectar: (bid) => http(base(bid), { method: 'DELETE' }),
  sincronizar: (bid, desde, hasta) => http(`${base(bid)}/sincronizar`, { method: 'POST', timeoutMs: 180000, body: { desde, hasta } }),
  compras: (bid) => http(`${base(bid)}/compras`, { cache: false }),
  marcar: (bid, orderId, estado_carga) => http(`${base(bid)}/compras/${orderId}`, { method: 'PATCH', body: { estado_carga } }),
};
