// src/servicios/apiSoporte.js
// Pedidos de los clientes (chat de Anthony) y panel de super usuarios (13/11/2026).
import { http } from '@/servicios/apiBusinesses';

const negocioActivo = () => {
  try { return Number(localStorage.getItem('activeBusinessId')) || null; } catch { return null; }
};

// ── Cliente ──
export const SoporteAPI = {
  chat: () => http('/soporte/chat', { withBusinessId: false, cache: false }),
  enviar: (body) => http('/soporte/mensaje', { method: 'POST', withBusinessId: false, timeoutMs: 60000, body: { businessId: negocioActivo(), ...body } }),
  misPedidos: () => http('/soporte/mis-pedidos', { withBusinessId: false, cache: false }),
  sinLeer: () => http('/soporte/sin-leer', { withBusinessId: false, cache: false }),
  marcarVistos: () => http('/soporte/mis-pedidos/vistos', { method: 'POST', withBusinessId: false }),
  responder: (id, texto) => http(`/soporte/mis-pedidos/${id}/responder`, { method: 'POST', withBusinessId: false, body: { texto } }),
  ajustes: () => {
    const b = negocioActivo();
    return http(`/soporte/ajustes${b ? `?businessId=${b}` : ''}`, { withBusinessId: false, cache: false });
  },
};

// ── Super usuarios ──
const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};
export const SuperAPI = {
  pedidos: (filtros) => http(`/superusuarios/pedidos${qs(filtros)}`, { withBusinessId: false, cache: false }),
  pedido: (id) => http(`/superusuarios/pedidos/${id}`, { withBusinessId: false, cache: false }),
  actualizarPedido: (id, cambios) => http(`/superusuarios/pedidos/${id}`, { method: 'PATCH', withBusinessId: false, body: cambios }),
  responder: (id, texto, interna = false) => http(`/superusuarios/pedidos/${id}/respuestas`, { method: 'POST', withBusinessId: false, body: { texto, interna } }),
  config: () => http('/superusuarios/soporte/config', { withBusinessId: false, cache: false }),
  guardarConfig: (config) => http('/superusuarios/soporte/config', { method: 'PUT', withBusinessId: false, body: { config } }),
  telegramChats: () => http('/superusuarios/telegram/chats', { withBusinessId: false, cache: false }),
  telegramProbar: () => http('/superusuarios/telegram/probar', { method: 'POST', withBusinessId: false }),
  ajustes: () => http('/superusuarios/ajustes', { withBusinessId: false, cache: false }),
  guardarAjuste: (a) => http('/superusuarios/ajustes', { method: 'POST', withBusinessId: false, body: a }),
  borrarAjuste: (id) => http(`/superusuarios/ajustes/${id}`, { method: 'DELETE', withBusinessId: false }),
  buscarAlcance: (tipo, q) => http(`/superusuarios/buscar-alcance${qs({ tipo, q })}`, { withBusinessId: false, cache: false }),
  superusuarios: () => http('/superusuarios', { withBusinessId: false, cache: false }),
  // Tablero de tareas del equipo (13/11/2026).
  tareas: () => http('/superusuarios/tareas', { withBusinessId: false, cache: false }),
  tarea: (id) => http(`/superusuarios/tareas/${id}`, { withBusinessId: false, cache: false }),
  crearTarea: (t) => http('/superusuarios/tareas', { method: 'POST', withBusinessId: false, body: t }),
  actualizarTarea: (id, cambios) => http(`/superusuarios/tareas/${id}`, { method: 'PATCH', withBusinessId: false, body: cambios }),
  borrarTarea: (id) => http(`/superusuarios/tareas/${id}`, { method: 'DELETE', withBusinessId: false }),
  notaTarea: (id, texto) => http(`/superusuarios/tareas/${id}/notas`, { method: 'POST', withBusinessId: false, body: { texto } }),
  borrarNotaTarea: (id, notaId) => http(`/superusuarios/tareas/${id}/notas/${notaId}`, { method: 'DELETE', withBusinessId: false }),
};
