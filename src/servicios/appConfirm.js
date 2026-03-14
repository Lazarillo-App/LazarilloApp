// src/servicios/appConfirm.js
// Reemplaza todos los window.confirm() del proyecto.
// Uso: import { showConfirm } from '../servicios/appConfirm';
//      const ok = await showConfirm('¿Eliminar esto?');
//      if (!ok) return;

let _resolve = null;

export function showConfirm(message, { danger = false } = {}) {
  return new Promise((resolve) => {
    _resolve = resolve;
    window.dispatchEvent(
      new CustomEvent('app:confirm', {
        detail: { message: String(message ?? ''), danger },
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