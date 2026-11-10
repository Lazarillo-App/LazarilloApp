// src/componentes/asistente/chatEvento.js
// Abrir el chat de Anthony desde cualquier pantalla: abrirChatAnthony({ opcion, respuesta, mensaje, contexto }).
// opcion = id del menú (armar, pos, tecnico, duda, otra); respuesta = la de su pregunta corta.
export const ABRIR_CHAT = 'anthony:chat';

export function abrirChatAnthony(detalle = {}) {
  window.dispatchEvent(new CustomEvent(ABRIR_CHAT, { detail: detalle }));
}
