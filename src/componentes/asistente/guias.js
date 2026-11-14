// src/componentes/asistente/guias.js
// Guías de cada sección (Diego 14/11/2026): el recorrido de Anthony arranca solo mientras la sección
// no tiene datos propios del negocio, y además se puede ver cuando uno quiera desde un lugar común:
// la pestaña «Guías» del chat de Anthony (soporte). Cada guía es un recorrido de useRecorrido.
export const GUIAS = [
  { id: 'rrhh_cronogramas', titulo: 'Cronogramas', detalle: 'Armar la semana, feriados, puestos y mandarla por WhatsApp', ruta: '/rrhh/cronogramas' },
  { id: 'gestion_panel', titulo: 'Panel de gestión', detalle: 'Ventas, gastos y resultados del mes', ruta: '/gestion' },
  { id: 'tabla_insumos', titulo: 'Insumos', detalle: 'Agrupar, cargar y revisar los insumos', ruta: '/insumos' },
  { id: 'configuracion', titulo: 'Configuración', detalle: 'Datos del negocio, conexiones y ajustes', ruta: '/configuracion' },
];

const CLAVE = 'lazarillo:guia-pendiente';
export const VER_GUIA = 'lazarillo:ver-guia';

/** Pide ver una guía: si ya estás en su pantalla arranca ahí; si no, va a la pantalla y arranca al llegar. */
export function pedirGuia(guia, navigate) {
  try { sessionStorage.setItem(CLAVE, guia.id); } catch { /* sin storage */ }
  if (window.location.pathname === guia.ruta) window.dispatchEvent(new CustomEvent(VER_GUIA, { detail: guia.id }));
  else navigate(guia.ruta);
}

/** La guía pendiente de este id (y la consume). */
export function tomarGuiaPendiente(id) {
  try {
    if (sessionStorage.getItem(CLAVE) !== id) return false;
    sessionStorage.removeItem(CLAVE);
    return true;
  } catch { return false; }
}
