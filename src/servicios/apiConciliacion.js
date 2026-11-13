// src/servicios/apiConciliacion.js
// Módulo de conciliación bancaria y conexión con Mercado Pago (14/11/2026). Todo va por
// SUCURSAL: `suc` = 0 para la principal, o el id de la sucursal. Ver
// Backend/routes/conciliacionRoutes.js y mercadopagoRoutes.js.
import { http } from '@/servicios/apiBusinesses';

const base = (bid) => `/businesses/${bid}/conciliacion`;
const q = (suc, extra = '') => `?sucursal=${Number(suc) || 0}${extra}`;

/** id de sucursal del BranchContext ('main' / null / número) → número para el backend */
export const sucursalNum = (branchId) => (branchId === 'main' || branchId == null ? 0 : Number(branchId) || 0);

export const ConciliacionAPI = {
  cargar: (bid, suc) => http(`${base(bid)}${q(suc)}`, { cache: false, timeoutMs: 60000 }),
  guardarFuente: (bid, suc, tipo, filas, archivo) =>
    http(`${base(bid)}/fuentes/${tipo}${q(suc)}`, { method: 'PUT', timeoutMs: 120000, body: { filas, archivo } }),
  borrarFuente: (bid, suc, tipo) => http(`${base(bid)}/fuentes/${tipo}${q(suc)}`, { method: 'DELETE' }),
  leerEstado: (bid, suc, periodo) => http(`${base(bid)}/estado${q(suc, `&periodo=${encodeURIComponent(periodo)}`)}`, { cache: false }),
  guardarEstado: (bid, suc, periodo, estado) =>
    http(`${base(bid)}/estado${q(suc)}`, { method: 'PUT', timeoutMs: 60000, body: { periodo, estado } }),
  guardarPagadores: (bid, suc, mapa) => http(`${base(bid)}/pagadores${q(suc)}`, { method: 'PUT', body: { mapa } }),
  // Ventas y cobranzas de cuenta corriente desde MaxiRest (lo que sube el kit a Render).
  maxiEstado: (bid, suc) => http(`${base(bid)}/maxi${q(suc)}`, { cache: false }),
  maxiTraer: (bid, suc, desde, hasta) =>
    http(`${base(bid)}/maxi${q(suc, `&desde=${desde}&hasta=${hasta}`)}`, { cache: false, timeoutMs: 120000 }),
};

// Conexión con Mercado Pago, una por sucursal. En `conectar` la sucursal viaja en el state.
const mpBase = (bid) => `/businesses/${bid}/mercadopago`;
export const MercadoPagoAPI = {
  estado: (bid, suc) => http(`${mpBase(bid)}/estado${q(suc)}`, { cache: false }),
  autorizar: (bid, suc) => http(`${mpBase(bid)}/autorizar${q(suc)}`, { cache: false }),
  conectar: (bid, code, state) => http(`${mpBase(bid)}/conectar`, { method: 'POST', timeoutMs: 60000, body: { code, state } }),
  desconectar: (bid, suc) => http(`${mpBase(bid)}${q(suc)}`, { method: 'DELETE' }),
  sincronizar: (bid, suc, desde, hasta) =>
    http(`${mpBase(bid)}/sincronizar${q(suc)}`, { method: 'POST', timeoutMs: 300000, body: { desde, hasta } }),
};
