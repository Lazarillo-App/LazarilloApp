// src/servicios/apiProduccion.js
// Tareas operativas · producción de elaborados (usuaria 21/11/2026). Ver Backend/services/produccion.js.
import { http as httpBase } from '@/servicios/apiBusinesses';

// Sucursal (como RRHH): cada sucursal tiene sus turnos, su producción, mermas, desperdicios y
// equipos. La página la fija con setSucursalOperacion; 'main' / null = la principal (sin parámetro).
let sucursal = null;
export const setSucursalOperacion = (s) => { sucursal = s == null || s === 'main' ? null : s; };
export const conSucursal = (path) => (sucursal != null ? `${path}${path.includes('?') ? '&' : '?'}branchId=${encodeURIComponent(sucursal)}` : path);
const http = (path, opts) => httpBase(conSucursal(path), opts);

const base = (bid) => `/businesses/${bid}/produccion`;
const sin = { cache: false };

export const ProduccionAPI = {
  contexto: (bid) => http(`${base(bid)}/contexto`, sin),
  guardarTurno: (bid, t) => (t.id
    ? http(`${base(bid)}/turnos/${t.id}`, { method: 'PUT', body: t })
    : http(`${base(bid)}/turnos`, { method: 'POST', body: t })),
  borrarTurno: (bid, id) => http(`${base(bid)}/turnos/${id}`, { method: 'DELETE' }),
  buscarInsumos: (bid, q) => http(`${base(bid)}/insumos?q=${encodeURIComponent(q)}`, sin),
  asignarAreas: (bid, userId, sectorIds) => http(`${base(bid)}/equipo/${userId}/areas`, { method: 'PUT', body: { sector_ids: sectorIds } }),
  elaborados: (bid) => http(`${base(bid)}/elaborados`, sin),
  guardarElaborado: (bid, insumoId, body) => http(`${base(bid)}/elaborados/${insumoId}`, { method: 'PUT', body }),
  tareas: (bid, desde, hasta) => http(`${base(bid)}/tareas?desde=${desde}&hasta=${hasta}`, sin),
  crear: (bid, tareas) => http(`${base(bid)}/tareas`, { method: 'POST', body: { tareas } }),
  editar: (bid, id, body) => http(`${base(bid)}/tareas/${id}`, { method: 'PATCH', body }),
  borrar: (bid, id, motivo) => http(`${base(bid)}/tareas/${id}`, { method: 'DELETE', body: { motivo } }),
  copiarSemana: (bid, desde, hacia, sumar = false) => http(`${base(bid)}/semana/copiar`, { method: 'POST', body: { desde, hacia, sumar } }),
  detalle: (bid, id) => http(`${base(bid)}/tareas/${id}`, sin),
  accion: (bid, id, accion, body = {}) => http(`${base(bid)}/tareas/${id}/${accion}`, { method: 'POST', body }),
  insumo: (bid, id, itemId, body) => http(`${base(bid)}/tareas/${id}/insumos/${itemId}`, { method: 'PATCH', body }),
  agregarInsumo: (bid, id, body) => http(`${base(bid)}/tareas/${id}/insumos`, { method: 'POST', body }),
  decidir: (bid, id, itemId, decision, nota) => http(`${base(bid)}/tareas/${id}/insumos/${itemId}/decision`, { method: 'POST', body: { decision, nota } }),
  escalar: (bid, id, body) => http(`${base(bid)}/tareas/${id}/escalar`, { method: 'POST', body }),
  mermaInsumo: (bid, insumoId) => http(`${base(bid)}/mermas/insumo/${insumoId}`, sin),
  nota: (bid, id, texto) => http(`${base(bid)}/tareas/${id}/notas`, { method: 'POST', body: { texto } }),
  cambios: (bid) => http(`${base(bid)}/cambios`, sin),
  mise: (bid) => http(`${base(bid)}/mise`, sin),
  guardarMise: (bid, plazaId, items) => http(`${base(bid)}/mise/${plazaId}`, { method: 'PUT', body: { items } }),
  mermas: (bid, desde, hasta) => http(`${base(bid)}/mermas?desde=${desde}&hasta=${hasta}`, sin),
  crearMerma: (bid, body, desde, hasta) => http(`${base(bid)}/mermas?desde=${desde}&hasta=${hasta}`, { method: 'POST', body }),
  desperdicios: (bid, desde, hasta) => http(`${base(bid)}/desperdicios?desde=${desde}&hasta=${hasta}`, sin),
  crearDesperdicio: (bid, body, desde, hasta) => http(`${base(bid)}/desperdicios?desde=${desde}&hasta=${hasta}`, { method: 'POST', body }),
  borrarRegistro: (bid, tipo, id) => http(`${base(bid)}/registros/${tipo}/${id}`, { method: 'DELETE' }),
  consumos: (bid, desde, hasta) => http(`${base(bid)}/consumos?desde=${desde}&hasta=${hasta}`, sin),
  sugerencias: (bid, semana) => http(`${base(bid)}/sugerencias?semana=${semana}`, sin),
  panel: (bid, desde, hasta) => http(`${base(bid)}/panel?desde=${desde}&hasta=${hasta}`, sin),
  novedades: (bid) => http(`${base(bid)}/novedades`, sin),
  crearNovedad: (bid, body) => http(`${base(bid)}/novedades`, { method: 'POST', body }),
  subirFotoNovedad: (bid, file) => {
    const fd = new FormData();
    fd.append('file', file, file?.name || 'novedad.jpg');
    return http(`${base(bid)}/novedades/foto`, { method: 'POST', body: fd });
  },
  marcarNovedadVista: (bid, id) => http(`${base(bid)}/novedades/${id}/vista`, { method: 'POST' }),
  borrarNovedad: (bid, id) => http(`${base(bid)}/novedades/${id}`, { method: 'DELETE' }),
};
