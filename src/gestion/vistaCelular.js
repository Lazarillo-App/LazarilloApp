// Versión celular del Panel (/m), igual que en lazarillo_gestion (Diego 28/10/2026: "¿no debería darse
// cuenta solo?"). En un teléfono, /gestion abre /m salvo que se haya pedido el Panel completo desde /m
// («Abrir el Panel completo» → se recuerda en este celular). Entrar a /m desde el menú borra esa elección.
const CLAVE = 'gestion:vista';

// Teléfonos (no tablets: un iPad o un Android sin "Mobile" se quedan con el Panel).
export function esCelular(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return !!ua && /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile Safari/i.test(ua) && !/iPad|Tablet/i.test(ua);
}
const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const escribir = (v) => { try { if (v) localStorage.setItem(CLAVE, v); else localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } };

export const elegirPanelCompleto = () => escribir('completa');
export const elegirVersionCelular = () => escribir(null);
// ¿Hay que mandar /gestion a /m?
export const irACelular = () => esCelular() && leer() !== 'completa';
