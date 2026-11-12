// src/gestion/completitud.js
//
// Rol a medida sin totales por rubro (Panel › Compras): en vez de dejar la fila del rubro vacía,
// cada mes muestra el total resumido en millones («42,1») y una barra con cuánto se cargó contra
// lo habitual de ese rubro (Diego 12/11/2026). Sirve para que quien carga vea dónde le falta.
//
// Lo «habitual» = mediana de los meses con carga que tienen al menos 3 meses de antigüedad: los
// meses recientes todavía se están cargando y los más viejos son los completos. Con menos de 2
// meses de referencia no se compara (sin historia no se deduce nada), y tampoco en rubros
// esporádicos (Mantenimiento, Impuestos…): si en los meses de referencia faltan gastos más de
// 1 de cada 5, un mes vacío o bajo es normal y marcarlo sería ruido.

export const MESES_ATRAS = 3;
export const MIN_REFERENCIAS = 2;
export const MIN_REGULARIDAD = 0.8;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const tieneValor = (v) => v != null && Math.abs(v) > 0.5;
const indice = (anio, mes) => anio * 12 + (mes - 1);

function mediana(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Lo habitual del rubro: { importe, meses: [{ anio, mes }] } o null si no hay historia.
 * `valoresPrev` = los meses del año anterior del mismo rubro: el año no es barrera (Diego
 * 12/11/2026) — en enero se compara con octubre, septiembre… del año pasado. Se toman los
 * últimos VENTANA meses cerrados (con 3+ meses de antigüedad): con la inflación, los meses muy
 * viejos dan importes más chicos y harían parecer completo lo que no lo está.
 */
export const VENTANA = 6;
export function habitualRubro(values, months, anio, hoy = new Date(), valoresPrev = null) {
  const corte = indice(hoy.getFullYear(), hoy.getMonth() + 1) - MESES_ATRAS;
  const serie = [
    ...(valoresPrev ? Array.from({ length: 12 }, (_, i) => ({ anio: anio - 1, mes: i + 1, v: valoresPrev[i + 1] })) : []),
    ...months.map((m) => ({ anio, mes: m, v: values?.[m] })),
  ];
  // Desde el primer mes con carga del rubro (un negocio que arrancó hace poco no es «esporádico»).
  const iPrimero = serie.findIndex((x) => tieneValor(x.v));
  if (iPrimero < 0) return null;
  const cerrados = serie.slice(iPrimero).filter((x) => indice(x.anio, x.mes) <= corte).slice(-VENTANA);
  const refs = cerrados.filter((x) => tieneValor(x.v));
  if (refs.length < MIN_REFERENCIAS || refs.length < cerrados.length * MIN_REGULARIDAD) return null;
  return { importe: mediana(refs.map((x) => x.v)), meses: refs.map(({ anio: a, mes }) => ({ anio: a, mes })) };
}

/**
 * Estado de un mes del rubro:
 *  { tipo: 'futuro' }                      mes que todavía no llegó (no se muestra nada)
 *  { tipo: 'vacio' }                       nada cargado y el rubro suele tener gastos
 *  { tipo: 'sin_dato' }                    nada cargado y sin historia para comparar
 *  { tipo: 'valor', pct: number|null }     con carga; pct = cargado / habitual (null sin historia)
 */
export function estadoMes(values, mes, anio, habitual, hoy = new Date()) {
  if (indice(anio, mes) > indice(hoy.getFullYear(), hoy.getMonth() + 1)) return { tipo: 'futuro' };
  const v = values?.[mes];
  if (!tieneValor(v)) return { tipo: habitual ? 'vacio' : 'sin_dato' };
  return { tipo: 'valor', pct: habitual && habitual.importe > 0 ? v / habitual.importe : null };
}

/** 42104000 → «42,1» (millones, un decimal). Menos de 50 mil → «<0,1». */
export function millones(v) {
  if (!tieneValor(v)) return '';
  const m = v / 1e6;
  if (Math.abs(m) < 0.05) return m < 0 ? '>-0,1' : '<0,1';
  return m.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Color de la barra: completo (≥80%), a medias (40–80%), muy por debajo (<40%). */
export function colorCompletitud(pct) {
  if (pct == null) return null;
  if (pct >= 0.8) return '#5BC2EA';
  if (pct >= 0.4) return '#f59e0b';
  return '#ef4444';
}

/** [{anio, mes}] → «may–oct» (mismo año) o «sep 25–feb 26» (cruza el año); con huecos, la lista. */
export function rangoMeses(meses) {
  if (!meses?.length) return '';
  const norm = meses.map((x) => (typeof x === 'number' ? { anio: null, mes: x } : x));
  const variosAnios = new Set(norm.map((x) => x.anio)).size > 1;
  const et = (x) => `${MESES[x.mes - 1]}${variosAnios && x.anio != null ? ` ${String(x.anio).slice(-2)}` : ''}`;
  const idx = (x) => (x.anio ?? 0) * 12 + x.mes;
  const contiguos = norm.every((x, i) => i === 0 || idx(x) === idx(norm[i - 1]) + 1);
  if (contiguos) return norm.length === 1 ? et(norm[0]) : `${et(norm[0])}–${et(norm[norm.length - 1])}`;
  const n = norm.map(et);
  return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}
