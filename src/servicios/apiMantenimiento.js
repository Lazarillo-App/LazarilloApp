// src/servicios/apiMantenimiento.js — Operación › Mantenimiento (21/11/2026). Ver Backend/services/mantenimiento.js.
import { http } from '@/servicios/apiBusinesses';

const base = (bid) => `/businesses/${bid}/mantenimiento`;
const sin = { cache: false };

export const MantenimientoAPI = {
  contexto: (bid) => http(`${base(bid)}/contexto`, sin),
  equipos: (bid) => http(`${base(bid)}/equipos`, sin),
  equipo: (bid, id) => http(`${base(bid)}/equipos/${id}`, sin),
  guardarEquipo: (bid, e) => (e.id
    ? http(`${base(bid)}/equipos/${e.id}`, { method: 'PUT', body: e })
    : http(`${base(bid)}/equipos`, { method: 'POST', body: e })),
  borrarEquipo: (bid, id) => http(`${base(bid)}/equipos/${id}`, { method: 'DELETE' }),
  guardarPlan: (bid, equipoId, p) => (p.id
    ? http(`${base(bid)}/equipos/${equipoId}/planes/${p.id}`, { method: 'PUT', body: p })
    : http(`${base(bid)}/equipos/${equipoId}/planes`, { method: 'POST', body: p })),
  borrarPlan: (bid, equipoId, planId) => http(`${base(bid)}/equipos/${equipoId}/planes/${planId}`, { method: 'DELETE' }),
  ordenes: (bid) => http(`${base(bid)}/ordenes`, sin),
  crearOrden: (bid, body) => http(`${base(bid)}/ordenes`, { method: 'POST', body }),
  reportarFalla: (bid, body) => http(`${base(bid)}/fallas`, { method: 'POST', body }),
  accion: (bid, id, accion, body = {}) => http(`${base(bid)}/ordenes/${id}/${accion}`, { method: 'POST', body }),
  registros: (bid) => http(`${base(bid)}/registros`, sin),
  crearRegistro: (bid, body) => http(`${base(bid)}/registros`, { method: 'POST', body }),
  borrarRegistro: (bid, id) => http(`${base(bid)}/registros/${id}`, { method: 'DELETE' }),
};
