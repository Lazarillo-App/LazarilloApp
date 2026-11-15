// src/componentes/asistente/guias.js
// Guías de cada sección (Diego 14/11/2026): el recorrido de Anthony arranca solo mientras la sección
// no tiene datos propios del negocio, y además se puede ver cuando uno quiera desde un lugar común:
// la pestaña «Guías» del chat de Anthony (soporte). Cada guía es un recorrido de useRecorrido.
// 14/11/2026 (Diego): están las 10, agrupadas por módulo. Las que viven en un modal o menú se abren
// solas al tocar «Ver» (useAbrirGuia en la pantalla que abre ese modal).
import { useEffect, useRef, useState } from 'react';

export const GUIAS = [
  { id: 'tabla_articulos', grupo: 'Recetas', titulo: 'Artículos', detalle: 'Ventas, costo, precio, objetivo y nuevo precio', ruta: '/menu', sectores: ['lateral', 'tabla', 'barra', 'header'] },
  { id: 'tabla_insumos', grupo: 'Recetas', titulo: 'Insumos', detalle: 'Agrupar, cargar y revisar los insumos', ruta: '/insumos', sectores: ['lateral', 'tabla', 'barra', 'header'] },
  { id: 'crear_insumo', grupo: 'Recetas', titulo: 'Crear un insumo', detalle: 'Nombre, rubro, unidad y precio', ruta: '/insumos' },
  { id: 'menu_accion', grupo: 'Recetas', titulo: 'Acciones de un artículo', detalle: 'Editar, mover, armar una promo o discontinuar', ruta: '/menu' },
  { id: 'crear_articulo', grupo: 'Recetas', titulo: 'Crear un artículo', detalle: 'Dar de alta un artículo a mano', ruta: '/menu' },
  { id: 'receta', grupo: 'Recetas', titulo: 'Receta de un artículo', detalle: 'Ingredientes, rendimiento, promo, vincular, foto y paso a paso', ruta: '/menu', sectores: ['datos', 'ingredientes', 'encabezado', 'pie'] },
  { id: 'gestion_panel', grupo: 'Resultados', titulo: 'Panel de gestión', detalle: 'Ventas, gastos y resultados del mes', ruta: '/gestion', sectores: ['filtros', 'tabla', 'header'] },
  { id: 'carga_gastos', grupo: 'Resultados', titulo: 'Cargar una factura o gasto', detalle: 'Factura, gasto vario o pago a empleados', ruta: '/gestion' },
  { id: 'rrhh_cronogramas', grupo: 'RRHH', titulo: 'Cronogramas', detalle: 'Armar la semana, feriados, puestos y mandarla por WhatsApp', ruta: '/rrhh/cronogramas', sectores: ['cronograma', 'header'] },
  { id: 'perfil_equipo', grupo: 'Equipo y ajustes', titulo: 'Tu equipo', detalle: 'Invitar gente y el QR para el staff', ruta: '/equipo' },
  { id: 'configuracion', grupo: 'Equipo y ajustes', titulo: 'Configuración', detalle: 'Datos del negocio, conexiones y ajustes', ruta: '/configuracion', sectores: ['pestanas', 'header'] },
];
export const GRUPOS_GUIAS = ['Recetas', 'Resultados', 'RRHH', 'Equipo y ajustes'];

// Sectores de cada pantalla (Diego 15/11/2026: «apertura por sectores dentro de cada módulo; el header
// es uno de ellos, pero con todos»). «Ver» muestra la guía entera; cada sector, solo sus pasos.
export const NOMBRE_SECTOR = {
  lateral: 'Lateral', tabla: 'Tabla', barra: 'Barra', header: 'Header', filtros: 'Filtros',
  cronograma: 'Cronograma', pestanas: 'Pestañas', datos: 'Datos', ingredientes: 'Ingredientes', encabezado: 'Encabezado', pie: 'Pie',
};

/** Al terminar una guía, Anthony ofrece hacerlo ahora con su ayuda (Diego 14/11/2026): abre la guía
 *  del modal que sigue sobre el formulario real, así el usuario carga el primero acompañado. */
export function seguirConGuia(id) {
  const g = GUIAS.find((x) => x.id === id);
  if (!g) return;
  pedirGuia(g, (ruta) => window.location.assign(ruta));
}

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
export function pedirGuia(guia, navigate, sector = null) {
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ id: guia.id, t: Date.now(), sector })); } catch { /* sin storage */ }
  if (window.location.pathname === guia.ruta) window.dispatchEvent(new CustomEvent(VER_GUIA, { detail: guia.id }));
  else navigate(guia.ruta);
}

/** Qué guía está pedida ahora (sin consumirla), o null. */
export function guiaPedida() {
  return leer()?.id ?? null;
}

/** La guía pendiente de este id (y la consume). La llama el recorrido cuando ya se puede mostrar. */
export const SECTOR_GUIA = 'lazarillo:guia-sector';
export function tomarGuiaPendiente(id) {
  const v = leer();
  if (v?.id !== id) return false;
  try { sessionStorage.removeItem(CLAVE); } catch { /* sin storage */ }
  // Avisa qué sector se pidió (null = la guía entera) para que la pantalla filtre sus pasos.
  window.dispatchEvent(new CustomEvent(SECTOR_GUIA, { detail: { id, sector: v.sector || null } }));
  return true;
}

/** Sector pedido para esta guía (null = entera). Se actualiza cada vez que arranca desde Guías. */
export function useSectorGuia(id) {
  const [sector, setSector] = useState(() => { const v = leer(); return v?.id === id ? (v.sector || null) : null; });
  useEffect(() => {
    const f = (e) => { if (e?.detail?.id === id) setSector(e.detail.sector); };
    window.addEventListener(SECTOR_GUIA, f);
    return () => window.removeEventListener(SECTOR_GUIA, f);
  }, [id]);
  return sector;
}

/** Filtra los pasos de una guía por sector (cada paso trae s: 'lateral' | 'tabla' | …). */
export function pasosDelSector(pasos, sector) {
  if (!sector) return pasos;
  const del = pasos.filter((p) => p.s === sector);
  // Si ese sector todavía no se ve (un panel sin datos no tiene tabla), se muestra la guía entera.
  return del.length ? del : pasos;
}

// Una sola copia abre el modal por pedido (el menú ⋮ está en cada fila de la tabla).
let reclamado = null;
/** Abre una sola vez por pedido. abrir() puede devolver false si esta copia no pudo (fila oculta):
 *  entonces queda libre para otra. */
function abrirUnaVez(id, abrir) {
  const v = leer();
  if (v?.id !== id || reclamado === v.t) return;
  if (abrir?.() !== false) reclamado = v.t;
}

/** En la pantalla que abre el modal o menú de una guía: si la piden, lo abre (una vez).
 *  listo = la pantalla ya puede abrirlo (ej. la tabla ya tiene artículos).
 *  espera = ms que la pantalla tiene que quedar quieta antes de abrir: la tabla de artículos
 *  pinta primero lo que tenía en caché y después restaura la agrupación guardada; si abría
 *  en ese instante, la fila desaparecía y la guía se perdía (Diego 14/11/2026). */
export function useAbrirGuia(id, abrir, listo = true, espera = 0) {
  const ref = useRef(abrir);
  ref.current = abrir;
  useEffect(() => {
    if (!listo) return undefined;
    let t = null;
    const intentar = () => {
      clearTimeout(t);
      t = setTimeout(() => abrirUnaVez(id, ref.current), espera);
    };
    if (guiaPedida() === id) intentar();
    const f = (e) => { if (e?.detail === id) intentar(); };
    window.addEventListener(VER_GUIA, f);
    return () => { clearTimeout(t); window.removeEventListener(VER_GUIA, f); };
  }, [id, listo, espera]);
}
