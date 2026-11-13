// src/componentes/asistente/chatEvento.js
// Abrir el chat de Anthony desde cualquier pantalla: abrirChatAnthony({ opcion, respuesta, mensaje, contexto }).
// opcion = id del menú (armar, pos, tecnico, cambio, duda, otra); respuesta = la de su pregunta corta.
// abrirChatAnthony({ vista: 'pedidos' }) abre directo en "Mis pedidos".
export const ABRIR_CHAT = 'anthony:chat';
// Cuántas respuestas del equipo hay sin leer: { detail: { n } } (lo escucha el botón de Anthony).
export const SIN_LEER = 'anthony:sin-leer';

export function abrirChatAnthony(detalle = {}) {
  window.dispatchEvent(new CustomEvent(ABRIR_CHAT, { detail: detalle }));
}
