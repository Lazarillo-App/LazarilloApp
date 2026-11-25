// src/servicios/apiWona.js
// Wona Sports (25/11/2026): conexión del negocio con una sede de Wona (canchas y buffet), solo lectura.
// Ver Backend/routes/wonaRoutes.js.
import { http } from '@/servicios/apiBusinesses';

const base = (bid) => `/businesses/${bid}/wona`;

export const WonaAPI = {
  estado: (bid) => http(`${base(bid)}/estado`, { cache: false }),
  // Sedes de la cuenta (para elegir cuál va a este negocio). No guarda nada.
  sedes: (bid, usuario, clave) => http(`${base(bid)}/sedes`, { method: 'POST', timeoutMs: 60000, body: { usuario, clave } }),
  conectar: (bid, usuario, clave, tenantUuid, branchId = null) =>
    http(`${base(bid)}/conectar`, { method: 'POST', timeoutMs: 60000, body: { usuario, clave, tenantUuid, branchId } }),
  desconectar: (bid) => http(base(bid), { method: 'DELETE' }),
  sincronizar: (bid) => http(`${base(bid)}/sincronizar`, { method: 'POST' }),
};
