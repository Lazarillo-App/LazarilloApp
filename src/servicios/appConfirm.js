// src/servicios/appConfirm.js
// Reemplaza todos los window.confirm() del proyecto.
// Uso: import { showConfirm } from '../servicios/appConfirm';
//      const ok = await showConfirm('¿Eliminar esto?');
//      if (!ok) return;

let _resolve = null;

// confirmText: texto del botón que acepta. Por defecto "Eliminar" si es
// danger y "Aceptar" si no — pasalo cuando la acción no es borrar (ej.
// "Descartar"), si no el botón dice "Eliminar" y no se entiende qué hace.
export function showConfirm(message, { danger = false, confirmText = null } = {}) {
  return new Promise((resolve) => {
    _resolve = resolve;
    window.dispatchEvent(
      new CustomEvent('app:confirm', {
        detail: { message: String(message ?? ''), danger, confirmText },
      })
    );
  });
}

// Llamado internamente por AppConfirmModal
export function _resolveConfirm(value) {
  if (_resolve) {
    _resolve(value); // true = aceptó, false = canceló
    _resolve = null;
  }
}