// src/componentes/conciliacion/desdeMaxi.js
// Ventas (22) y cobranzas de cuenta corriente (71/72) traídas de Render (usuaria 13/11/2026: "que
// no haya que subir nada manual"). El back las devuelve iguales a las filas del Excel; acá pasan
// por los MISMOS lectores del módulo de Diego y se mezclan con lo que ya había guardado.
import { parseVentas, parsePagos, parseFacturasCC } from './ModuloConciliacion';

/**
 * Los lectores numeran cada fila por su posición en el archivo ("v12"): si se trae otro rango,
 * la misma venta cambiaría de id y el trabajo guardado de ese período (que va por id) no la
 * encontraría. Acá cada fila recibe un id por su contenido (fecha, comprobante, forma, importe),
 * igual sin importar el rango. Los cobros partidos del 22 vienen sin comprobante: heredan el de
 * la fila de arriba, como en el informe.
 */
export function conIdsEstables(parsed, rows, prefijo) {
  const compDe = [];
  let ultimo = '';
  rows.forEach((r, i) => {
    const c = String(r.COMPROBANT || '').trim();
    if (c) ultimo = c;
    compDe[i] = c || ultimo;
  });
  const vistos = new Map();
  return parsed.map((x) => {
    const i = Number(String(x.id).replace(/^\D+/, ''));
    const comp = Number.isInteger(i) && i >= 0 && i < rows.length ? compDe[i] : (x.comp || '');
    const base = `mx${prefijo}:${x.fecha}:${comp}:${x.cobro || x.c || ''}:${x.imp ?? x.total ?? ''}`;
    const n = (vistos.get(base) || 0) + 1;
    vistos.set(base, n);
    return { ...x, id: n > 1 ? `${base}:${n}` : base };
  });
}

/** Lo guardado fuera del rango queda; lo de adentro se reemplaza por lo nuevo. */
export function mezclar(viejas, nuevas, desde, hasta) {
  const fuera = (viejas || []).filter((x) => !(x.fecha >= desde && x.fecha <= hasta));
  return [...fuera, ...nuevas].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/** { ventas, pagos, facturas_cc } listas para guardar, a partir de lo que devuelve el back. */
export function fuentesDesdeMaxi(r, guardadas, desde, hasta) {
  const ventasRows = r?.ventas || [];
  const pagosRows = r?.pagos || [];
  const ventas = conIdsEstables(parseVentas(ventasRows), ventasRows, 'v');
  const facturas = conIdsEstables(parseFacturasCC(ventasRows), ventasRows, 'f');
  const pagos = conIdsEstables(parsePagos(pagosRows), pagosRows, 'p');
  return {
    ventas: mezclar(guardadas?.ventas, ventas, desde, hasta),
    pagos: mezclar(guardadas?.pagos, pagos, desde, hasta),
    facturas_cc: mezclar(guardadas?.facturas_cc, facturas, desde, hasta),
    cuantas: { ventas: ventas.length, pagos: pagos.length },
  };
}
