// src/servicios/appAlert.js
// Reemplaza todos los window.alert() del proyecto.
// Uso: import { showAlert } from '../servicios/appAlert';
//      showAlert('Mensaje aquí');
//      showAlert('Error grave', 'error');
//      showAlert('Token: abc123', 'info', { copyText: 'abc123' });

export function showAlert(message, type = 'info', options = {}) {
  window.dispatchEvent(
    new CustomEvent('app:alert', {
      detail: { message: String(message ?? ''), type, ...options },
    })
  );
}