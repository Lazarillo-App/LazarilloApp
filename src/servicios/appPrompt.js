// src/servicios/appPrompt.js
// Reemplaza todos los window.prompt() del proyecto.
// Uso: import { showPrompt } from '../servicios/appPrompt';
//      const nombre = await showPrompt('Nuevo nombre:', 'valor actual');
//      if (nombre == null) return; // usuario canceló

let _resolve = null;

// El modal escucha 'app:prompt' y dispara 'app:prompt:response'
export function showPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    _resolve = resolve;
    window.dispatchEvent(
      new CustomEvent('app:prompt', {
        detail: { message: String(message ?? ''), defaultValue: String(defaultValue ?? '') },
      })
    );
  });
}

// Llamado internamente por AppPromptModal
export function _resolvePrompt(value) {
  if (_resolve) {
    _resolve(value); // null = canceló, string = confirmó
    _resolve = null;
  }
}