// src/servicios/apiArca.js
// ARCA automático (18/11/2026): cada cuánto la PC del cliente trae «Mis Comprobantes › Recibidos» y
// «Traer ahora» con rango. La clave fiscal nunca pasa por acá (queda en la PC). Ver Backend/routes/arcaRoutes.js.
import { http } from '@/servicios/apiBusinesses';

const base = (bid) => `/businesses/${bid}/arca`;

export const ArcaAPI = {
  estado: (bid) => http(base(bid), { cache: false }),
  frecuencia: (bid, frecuencia) => http(base(bid), { method: 'PATCH', body: { frecuencia } }),
  traer: (bid, desde, hasta) => http(`${base(bid)}/traer`, { method: 'POST', body: { desde, hasta } }),
  cancelar: (bid) => http(`${base(bid)}/traer`, { method: 'DELETE' }),
};
