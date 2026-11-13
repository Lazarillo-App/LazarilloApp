// src/servicios/apiConciliacion.js
// Módulo de conciliación bancaria (14/11/2026): guardado por negocio. Ver
// Backend/routes/conciliacionRoutes.js.
import { http } from '@/servicios/apiBusinesses';

const base = (bid) => `/businesses/${bid}/conciliacion`;

export const ConciliacionAPI = {
  cargar: (bid) => http(base(bid), { cache: false, timeoutMs: 60000 }),
  guardarFuente: (bid, tipo, filas, archivo) =>
    http(`${base(bid)}/fuentes/${tipo}`, { method: 'PUT', timeoutMs: 120000, body: { filas, archivo } }),
  borrarFuente: (bid, tipo) => http(`${base(bid)}/fuentes/${tipo}`, { method: 'DELETE' }),
  leerEstado: (bid, periodo) => http(`${base(bid)}/estado?periodo=${encodeURIComponent(periodo)}`, { cache: false }),
  guardarEstado: (bid, periodo, estado) =>
    http(`${base(bid)}/estado`, { method: 'PUT', timeoutMs: 60000, body: { periodo, estado } }),
  guardarPagadores: (bid, mapa) => http(`${base(bid)}/pagadores`, { method: 'PUT', body: { mapa } }),
};
