// src/componentes/asistente/guias.js
// Guías de cada sección (Diego 14/11/2026): el recorrido de Anthony arranca solo mientras la sección
// no tiene datos propios del negocio, y además se puede ver cuando uno quiera desde un lugar común:
// la pestaña «Guías» del chat de Anthony (soporte). Cada guía es un recorrido de useRecorrido.
// 14/11/2026 (Diego): están las 10, agrupadas por módulo. Las que viven en un modal o menú se abren
// solas al tocar «Ver» (useAbrirGuia en la pantalla que abre ese modal).
import { useEffect, useRef } from 'react';

export const GUIAS = [
  { id: 'tabla_insumos', grupo: 'Recetas', titulo: 'Insumos', detalle: 'Agrupar, cargar y revisar los insumos', ruta: '/insumos' },
  { id: 'crear_insumo', grupo: 'Recetas', titulo: 'Crear un insumo', detalle: 'Nombre, rubro, unidad y precio', ruta: '/insumos' },
  { id: 'menu_accion', grupo: 'Recetas', titulo: 'Acciones de un artículo', detalle: 'Editar, mover, armar una promo o discontinuar', ruta: '/menu' },
  { id: 'crear_articulo', grupo: 'Recetas', titulo: 'Crear un artículo', detalle: 'Dar de alta un artículo a mano', ruta: '/menu' },
  { id: 'receta', grupo: 'Recetas', titulo: 'Receta de un artículo', detalle: 'Armar la receta y ver el costo del plato', ruta: '/menu' },
  { id: 'gestion_panel', grupo: 'Resultados', titulo: 'Panel de gestión', detalle: 'Ventas, gastos y resultados del mes', ruta: '/gestion' },
  { id: 'carga_gastos', grupo: 'Resultados', titulo: 'Cargar una factura o gasto', detalle: 'Factura, gasto vario o pago a empleados', ruta: '/gestion' },
  { id: 'rrhh_cronogramas', grupo: 'RRHH', titulo: 'Cronogramas', detalle: 'Armar la semana, feriados, puestos y mandarla por WhatsApp', ruta: '/rrhh/cronogramas' },
  { id: 'perfil_equipo', grupo: 'Equipo y ajustes', titulo: 'Tu equipo', detalle: 'Invitar gente y el QR para el staff', ruta: '/perfil' },
  { id: 'configuracion', grupo: 'Equipo y ajustes', titulo: 'Configuración', detalle: 'Datos del negocio, conexiones y ajustes', ruta: '/configuracion' },
];
export const GRUPOS_GUIAS = ['Recetas', 'Resultados', 'RRHH', 'Equipo y ajustes'];

const CLAVE = 'lazarillo:guia-pendiente';
export const VER_GUIA = 'lazarillo:ver-guia';
// Si la pantalla no la pudo abrir (sin permiso, vista sin artículos…), el pedido vence y no
// aparece de sorpresa más tarde.
const VENCE_MS = 2 * 60 * 1000;

function leer() {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
    if (!v?.id || Date.now() - Number(v.t || 0) > VENCE_MS) return null;
    return v;
  } catch { return null; }
}

/** Pide ver una guía: si ya estás en su pantalla arranca ahí; si no, va a la pantalla y arranca al llegar. */
export function pedirGuia(guia, navigate) {
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ id: guia.id, t: Date.now() })); } catch { /* sin storage */ }
  if (window.location.pathname === guia.ruta) window.dispatchEvent(new CustomEvent(VER_GUIA, { detail: guia.id }));
  else navigate(guia.ruta);
}

/** La guía pendiente de este id (y la consume). La llama el recorrido cuando ya se puede mostrar. */
export function tomarGuiaPendiente(id) {
  const v = leer();
  if (v?.id !== id) return false;
  try { sessionStorage.removeItem(CLAVE); } catch { /* sin storage */ }
  return true;
}

// Una sola copia abre el modal por pedido (el menú ⋮ está en cada fila de la tabla).
let reclamado = null;
function reclamarGuia(id) {
  const v = leer();
  if (v?.id !== id || reclamado === v.t) return false;
  reclamado = v.t;
  return true;
}

/** En la pantalla que abre el modal o menú de una guía: si la piden, lo abre (una vez).
 *  listo = la pantalla ya puede abrirlo (ej. la tabla ya tiene artículos). */
export function useAbrirGuia(id, abrir, listo = true) {
  const ref = useRef(abrir);
  ref.current = abrir;
  useEffect(() => {
    if (!listo) return undefined;
    if (reclamarGuia(id)) ref.current?.();
    const f = (e) => { if (e?.detail === id && reclamarGuia(id)) ref.current?.(); };
    window.addEventListener(VER_GUIA, f);
    return () => window.removeEventListener(VER_GUIA, f);
  }, [id, listo]);
}
