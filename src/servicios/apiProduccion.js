// src/servicios/apiProduccion.js
// Tareas operativas · producción de elaborados (usuaria 21/11/2026). Ver Backend/services/produccion.js.
import { http } from '@/servicios/apiBusinesses';

const base = (bid) => `/businesses/${bid}/produccion`;
const sin = { cache: false };

export const ProduccionAPI = {
  contexto: (bid) => http(`${base(bid)}/contexto`, sin),
  guardarTurno: (bid, t) => (t.id
    ? http(`${base(bid)}/turnos/${t.id}`, { method: 'PUT', body: t })
    : http(`${base(bid)}/turnos`, { method: 'POST', body: t })),
  borrarTurno: (bid, id) => http(`${base(bid)}/turnos/${id}`, { method: 'DELETE' }),
  elaborados: (bid) => http(`${base(bid)}/elaborados`, sin),
  guardarElaborado: (bid, insumoId, body) => http(`${base(bid)}/elaborados/${insumoId}`, { method: 'PUT', body }),
  tareas: (bid, desde, hasta) => http(`${base(bid)}/tareas?desde=${desde}&hasta=${hasta}`, sin),
  crear: (bid, tareas) => http(`${base(bid)}/tareas`, { method: 'POST', body: { tareas } }),
  editar: (bid, id, body) => http(`${base(bid)}/tareas/${id}`, { method: 'PATCH', body }),
  borrar: (bid, id) => http(`${base(bid)}/tareas/${id}`, { method: 'DELETE' }),
  copiarSemana: (bid, desde, hacia, sumar = false) => http(`${base(bid)}/semana/copiar`, { method: 'POST', body: { desde, hacia, sumar } }),
  detalle: (bid, id) => http(`${base(bid)}/tareas/${id}`, sin),
  accion: (bid, id, accion, body = {}) => http(`${base(bid)}/tareas/${id}/${accion}`, { method: 'POST', body }),
  insumo: (bid, id, itemId, body) => http(`${base(bid)}/tareas/${id}/insumos/${itemId}`, { method: 'PATCH', body }),
  agregarInsumo: (bid, id, body) => http(`${base(bid)}/tareas/${id}/insumos`, { method: 'POST', body }),
  decidir: (bid, id, itemId, decision, nota) => http(`${base(bid)}/tareas/${id}/insumos/${itemId}/decision`, { method: 'POST', body: { decision, nota } }),
  nota: (bid, id, texto) => http(`${base(bid)}/tareas/${id}/notas`, { method: 'POST', body: { texto } }),
  cambios: (bid) => http(`${base(bid)}/cambios`, sin),
  panel: (bid, desde, hasta) => http(`${base(bid)}/panel?desde=${desde}&hasta=${hasta}`, sin),
};
