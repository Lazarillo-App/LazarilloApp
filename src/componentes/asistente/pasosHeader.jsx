// src/componentes/asistente/pasosHeader.jsx
// Pasos de las guías para los botones del header y de la barra (Diego 14/11/2026: «la guía debe
// considerar los botones del header; el Panel de gestión no lo hace»). Cada guía de pantalla los
// suma a los suyos. Solo entran los que se ven en esa pantalla, para ese usuario (permisos, staff,
// sucursales), así nunca se señala algo que no está.
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Ref que busca el elemento en el DOM cada vez (el header vive fuera de la página). */
export const refTour = (clave) => ({ get current() { return document.querySelector(`[data-tour="${clave}"]`); } });

/** ¿El elemento se ve de verdad? Dentro de la ventana y sin que lo corte un contenedor con
 *  overflow (la tabla de artículos a 1100 px corta la última columna). Compara rectángulos del
 *  mismo sistema (getBoundingClientRect), así no depende del zoom de la app. */
export function seVe(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return false;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const pr = p.getBoundingClientRect();
    if (cx < pr.left || cx > pr.right || cy < pr.top || cy > pr.bottom) return false;
  }
  return true;
}

const visible = (clave) => {
  const el = document.querySelector(`[data-tour="${clave}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  // Que esté dentro de la ventana: si el header no entra (RRHH a 1100 px) no se señala lo que no se ve.
  return r.width > 0 && r.height > 0 && r.right <= window.innerWidth + 2 && r.left >= -2;
};

function textoBotonera(path) {
  if (path.startsWith('/gestion')) return <><b>Conceptos de caja</b> ordena en qué se agrupan tus gastos, <b>Insumos</b> te lleva a tus insumos y <b>Proveedores</b> abre la cuenta corriente de cada proveedor.</>;
  if (path.startsWith('/rrhh')) return <><b>Cronogramas</b> arma la semana de cada sucursal y <b>Nómina</b> es tu equipo. Liquidación y Fichaje llegan pronto.</>;
  if (path.startsWith('/menu') || path.startsWith('/insumos')) return <>Arriba cambiás de pantalla: <b>Artículos</b> (tu carta con costos y precios), <b>Insumos</b> (lo que comprás) y <b>Menú</b> (la carta lista para imprimir).</>;
  return null;
}

// La barra de Recetas (Artículos / Insumos): período, buscador y food cost.
const BARRA = [
  { k: 'barra-periodo', t: () => <>El <b>período</b>: las ventas, las compras y el food cost de esta pantalla se calculan con estas fechas.</> },
  { k: 'barra-buscador', t: () => <>Buscás cualquier <b>artículo o insumo</b> por nombre o código y te lleva directo.</> },
  { k: 'barra-foodcost', t: () => <>Tu <b>food cost</b> del período: cuánto de lo que vendés se va en mercadería. Tocalo para verlo mes a mes y elegir qué ventas y compras entran en la cuenta.</> },
];

// El header de toda la app, de izquierda a derecha.
const HEADER = [
  { k: 'hdr-modulos', t: () => <>Con esta pestañita de la izquierda abrís <b>todos los módulos</b> de Lazarillo.</> },
  { k: 'hdr-pulso', t: () => <>El punto al lado del logo te dice si los datos de tu punto de venta están <b>al día</b>: verde hasta ayer, ámbar 2 o 3 días, rojo más viejo. Tocalo para actualizar.</> },
  { k: 'hdr-botonera', t: (path) => textoBotonera(path) },
  { k: 'hdr-sucursales', t: (path) => (path.startsWith('/rrhh')
    ? <>Cada sucursal tiene su propio cronograma: elegí cuál ves. Con <b>+</b> sumás una sucursal.</>
    : <>Elegís de qué <b>sucursal</b> ves los datos; <b>Todas</b> las suma. Con <b>+</b> sumás una sucursal y el <b>?</b> te explica cómo funcionan.</>) },
  { k: 'hdr-negocio', t: () => <>Si manejás más de un <b>negocio</b>, acá pasás de uno a otro.</> },
  { k: 'hdr-perfil', t: () => <>Tu <b>perfil</b>: tus datos, tu equipo y tus pendientes (el número rojo).</> },
  { k: 'hdr-campana', t: () => <>Los <b>avisos</b>: cada alta, baja o cambio que hace tu equipo queda acá.</> },
  { k: 'hdr-config', t: () => <><b>Configuración</b>: datos del negocio, conexión con tu punto de venta, importar y ajustes.</> },
];

/** Pasos del header (y de la barra de Recetas si conBarra) que se ven ahora en pantalla.
 *  Devuelve [{ k, ref, t }]: k = clave, ref = targetRef para SpotlightTour, t = texto. */
export function usePasosHeader({ conBarra = false } = {}) {
  const { pathname } = useLocation();
  const [claves, setClaves] = useState([]);
  useEffect(() => {
    const medir = () => {
      const lista = [...(conBarra ? BARRA : []), ...HEADER].filter((p) => visible(p.k) && p.t(pathname)).map((p) => p.k);
      setClaves((prev) => (prev.join() === lista.join() ? prev : lista));
    };
    medir();
    // El header y la barra terminan de dibujarse después (sucursales, permisos): se vuelve a mirar.
    const t1 = setTimeout(medir, 600);
    const t2 = setTimeout(medir, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pathname, conBarra]);
  return claves.map((k) => {
    const p = [...BARRA, ...HEADER].find((x) => x.k === k);
    return { k, ref: refTour(k), t: p.t(pathname) };
  });
}
