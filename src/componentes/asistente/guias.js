// src/componentes/asistente/guias.js
// Guías de cada sección (Diego 14/11/2026): el recorrido de Anthony arranca solo mientras la sección
// no tiene datos propios del negocio, y además se puede ver cuando uno quiera desde un lugar común:
// la pestaña «Guías» del chat de Anthony (soporte). Cada guía es un recorrido de useRecorrido.
// soloGestion: la pantalla es solo de dueño y admin; el staff no la ve en Guías.
// 14/11/2026 (Diego): están las 10, agrupadas por módulo. Las que viven en un modal o menú se abren
// solas al tocar «Ver» (useAbrirGuia en la pantalla que abre ese modal).
import { useEffect, useRef, useState } from 'react';

export const GUIAS = [
  { id: 'tabla_articulos', grupo: 'Recetas', titulo: 'Artículos', detalle: 'Ventas, costo, precio, objetivo y nuevo precio', ruta: '/menu', sectores: ['lateral', 'tabla', 'barra', 'header'], claves: 'carta precios precio nuevo objetivo costo rentabilidad ventas agrupación rubro listas pendientes marcar columnas' },
  { id: 'tabla_insumos', grupo: 'Recetas', titulo: 'Insumos', detalle: 'Agrupar, cargar y revisar los insumos', ruta: '/insumos', sectores: ['lateral', 'tabla', 'barra', 'header'], claves: 'compras mercadería elaborado marcar listas pendientes rubro unidad agrupar' },
  { id: 'food_cost', grupo: 'Recetas', titulo: 'Food cost', detalle: 'Qué es, cómo se calcula y cómo armarlo por área', ruta: '/menu', claves: 'costo de mercadería porcentaje área bebidas comidas configurar compras ventas' },
  { id: 'crear_insumo', grupo: 'Recetas', titulo: 'Crear un insumo', detalle: 'Nombre, rubro, unidad y precio', ruta: '/insumos', claves: 'alta insumo nuevo cargar producto precio unidad' },
  { id: 'menu_accion', grupo: 'Recetas', titulo: 'Acciones de un artículo', detalle: 'Editar, mover, armar una promo o discontinuar', ruta: '/menu', claves: 'editar mover promo promoción combo discontinuar menú tres puntos' },
  { id: 'crear_articulo', grupo: 'Recetas', titulo: 'Crear un artículo', detalle: 'Dar de alta un artículo a mano', ruta: '/menu', claves: 'alta artículo nuevo producto a mano' },
  { id: 'receta', grupo: 'Recetas', titulo: 'Receta de un artículo', detalle: 'Ingredientes, rendimiento, promo, vincular, foto y paso a paso', ruta: '/menu', sectores: ['datos', 'ingredientes', 'encabezado', 'pie'], claves: 'ingredientes rendimiento merma promo vincular foto paso a paso cocina costo receta elaborado' },
  { id: 'tableros', grupo: 'Operación', titulo: 'Tableros de la cocina', detalle: 'Plazas, la lámina de cada producto y la TV', ruta: '/tableros', sectores: ['tablero', 'header'], claves: 'plaza despacho cocina barra lámina tv pantalla armado' },
  { id: 'gestion_panel', grupo: 'Resultados', titulo: 'Panel de gestión', detalle: 'Ventas, gastos y resultados del mes', ruta: '/gestion', sectores: ['filtros', 'tabla', 'header'], claves: 'resultados ganancia gastos ventas rubros económica financiera mes período balance' },
  { id: 'carga_gastos', grupo: 'Resultados', titulo: 'Cargar una factura o gasto', detalle: 'Factura, gasto vario o pago a empleados', ruta: '/gestion', claves: 'factura gasto vario pago proveedor sueldos adelantos impaga ticket comprobante' },
  { id: 'editar_registro', grupo: 'Resultados', titulo: 'Corregir un registro', detalle: 'Fecha, mes, concepto, importe, pagos, repartir o borrar', ruta: '/gestion', sectores: ['detalle', 'fila'], claves: 'editar modificar cambiar fecha mes período pago impaga concepto importe observación borrar eliminar mover pdv apertura repartir cuenta corriente tildar varios' },
  { id: 'conciliacion', grupo: 'Administración', titulo: 'Conciliación bancaria', detalle: 'Cruzar tus ventas con lo que entró al banco', ruta: '/conciliacion', sectores: ['fuentes', 'conciliar', 'header'], soloGestion: true, claves: 'banco mercado pago cobros extracto conciliar cupón tarjeta cuenta corriente' },
  { id: 'rrhh_nomina', grupo: 'RRHH', titulo: 'Nómina', detalle: 'Tu equipo: altas, bajas y quién va en cronogramas', ruta: '/rrhh/nomina', sectores: ['barra', 'tabla', 'header'], soloGestion: true, claves: 'empleados equipo alta baja personal dni no aplica' },
  { id: 'rrhh_cronogramas', grupo: 'RRHH', titulo: 'Cronogramas', detalle: 'Armar la semana, feriados, puestos y mandarla por WhatsApp', ruta: '/rrhh/cronogramas', sectores: ['cronograma', 'header'], claves: 'turnos horarios semana francos feriados puestos whatsapp' },
  { id: 'perfil_equipo', grupo: 'Equipo y ajustes', titulo: 'Tu equipo', detalle: 'Invitar gente y el QR para el staff', ruta: '/equipo', claves: 'invitar usuarios qr staff permisos roles' },
  { id: 'configuracion', grupo: 'Equipo y ajustes', titulo: 'Configuración', detalle: 'Datos del negocio, conexiones y ajustes', ruta: '/configuracion', sectores: ['pestanas', 'header'], claves: 'ajustes conexiones punto de venta pos importar negocio sucursal datos' },
];
export const GRUPOS_GUIAS = ['Recetas', 'Operación', 'Resultados', 'Administración', 'RRHH', 'Equipo y ajustes'];

// Sectores de cada pantalla (Diego 15/11/2026: «apertura por sectores dentro de cada módulo; el header
// es uno de ellos, pero con todos»). «Ver» muestra la guía entera; cada sector, solo sus pasos.
export const NOMBRE_SECTOR = {
  lateral: 'Lateral', tabla: 'Tabla', barra: 'Barra', header: 'Header', filtros: 'Filtros',
  cronograma: 'Cronograma', pestanas: 'Pestañas', tablero: 'Tablero', detalle: 'Detalle', fila: 'Fila', fuentes: 'Fuentes', conciliar: 'Conciliar', datos: 'Datos', ingredientes: 'Ingredientes', encabezado: 'Encabezado', pie: 'Pie',
};

/** Link para compartir una guía (Diego 16/11/2026: «que cada guía tenga un link único»).
 *  Abre la pantalla y arranca la guía sola; si no hay sesión, pasa por el login y vuelve. */
export function linkGuia(g, sector = null) {
  return `${window.location.origin}/guia/${g.id}${sector ? `/${sector}` : ''}`;
}

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
/** Busca guías por título, detalle, módulo, sectores y palabras clave. Todas las palabras
 *  tienen que aparecer (en cualquier orden). */
export function buscarGuias(q, lista = GUIAS) {
  const palabras = norm(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return lista;
  return lista.filter((g) => {
    const texto = norm([g.titulo, g.detalle, g.grupo, g.claves, ...(g.sectores || []).map((x) => NOMBRE_SECTOR[x] || x)].join(' '));
    return palabras.every((w) => texto.includes(w));
  });
}

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
  // Tableros vive en /tableros/:id: si ya estás en una plaza, arranca ahí.
  const aca = window.location.pathname === guia.ruta || (guia.ruta === '/tableros' && window.location.pathname.startsWith('/tableros/'));
  if (aca) window.dispatchEvent(new CustomEvent(VER_GUIA, { detail: guia.id }));
  else {
    navigate(guia.ruta);
    // Lo que no se vuelve a montar al navegar (la barra de Recetas es la misma en Artículos e
    // Insumos, y ahí vive el food cost) se entera por el aviso.
    setTimeout(() => window.dispatchEvent(new CustomEvent(VER_GUIA, { detail: guia.id })), 400);
  }
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
