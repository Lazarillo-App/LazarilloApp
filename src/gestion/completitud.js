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

/** Lo habitual del rubro: { importe, meses: [números de mes usados] } o null si no hay historia. */
export function habitualRubro(values, months, anio, hoy = new Date()) {
  const corte = indice(hoy.getFullYear(), hoy.getMonth() + 1) - MESES_ATRAS;
  // Desde el primer mes con carga del rubro (un negocio que arrancó a mitad de año no es «esporádico»).
  const primero = months.find((m) => tieneValor(values?.[m]));
  const cerrados = months.filter((m) => primero != null && m >= primero && indice(anio, m) <= corte);
  const refs = cerrados.filter((m) => tieneValor(values?.[m]));
  if (refs.length < MIN_REFERENCIAS || refs.length < cerrados.length * MIN_REGULARIDAD) return null;
  return { importe: mediana(refs.map((m) => values[m])), meses: refs };
}

/**
 * Estado de un mes del rubro:
 *  { tipo: 'futuro' }                      mes que todavía no llegó (no se muestra nada)
 *  { tipo: 'vacio' }                       nada cargado y el rubro suele tener gastos
 *  { tipo: 'sin_dato' }                    nada cargado y sin historia para comparar
 *  { tipo: 'valor', pct: number|null }     con carga; pct = cargado / habitual (null sin historia)
 */
export function estadoMes(values, mes, anio, habitual, hoy = new Date(), pendiente = null) {
  if (indice(anio, mes) > indice(hoy.getFullYear(), hoy.getMonth() + 1)) return { tipo: 'futuro' };
  const v = values?.[mes];
  if (!tieneValor(v)) return { tipo: habitual || pendiente?.n ? 'vacio' : 'sin_dato', pendiente };
  const pct = habitual && habitual.importe > 0 ? v / habitual.importe : null;
  // Con gastos de «Sin carga» pendientes en ese rubro y mes (Diego 12/11: «octubre debería estar
  // más en amarillo, tiene gastos pendientes de carga»): manda cuánto falta, y nunca se ve completo.
  const completo = pendiente?.importe > 0 ? v / (v + pendiente.importe) : null;
  return { tipo: 'valor', pct, completo, pendiente };
}

/** Suma Sin carga por mes ('YYYY-MM') y rubro → { 'YYYY-MM': { rubro: { n, importe } } }. */
export function pendientesPorMes(sinCarga) {
  const out = {};
  for (const m of sinCarga?.meses ?? []) {
    const r = (out[m.mes] = {});
    for (const it of m.items ?? []) {
      const k = String(it.rubro || '').trim().toLowerCase();
      if (!k) continue;
      (r[k] ??= { n: 0, importe: 0 });
      r[k].n += 1; r[k].importe += Number(it.ultimo) || 0;
    }
  }
  return out;
}

/** 42104000 → «42,1» (millones, un decimal). Menos de 50 mil → «<0,1». */
export function millones(v) {
  if (!tieneValor(v)) return '';
  const m = v / 1e6;
  if (Math.abs(m) < 0.05) return m < 0 ? '>-0,1' : '<0,1';
  return m.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Escala de la barra contra lo habitual (Diego 12/11/2026: «todo se ve azul y hay diferencias»).
 * Cinco tramos: los de abajo avisan que falta cargar, el del medio es lo normal y el de arriba
 * marca un mes por encima de lo habitual (aguinaldo, compra grande) para que también se note.
 */
export const TRAMOS = [
  { hasta: 0.5, color: '#ef4444', nombre: 'muy por debajo' },
  { hasta: 0.8, color: '#f59e0b', nombre: 'por debajo' },
  { hasta: 0.95, color: '#a9dcf2', nombre: 'un poco por debajo' },
  { hasta: 1.15, color: '#5BC2EA', nombre: 'lo habitual' },
  { hasta: Infinity, color: '#1d6fa5', nombre: 'por encima' },
];
const tramo = (pct) => TRAMOS.find((t) => pct < t.hasta);
// Con pendientes manda lo que falta (cargado / cargado + pendiente) y el tope es «casi completo».
// Amarillo = «casi completo, pero hay gastos de Sin carga pendientes»: solo con pendientes.
const CASI = { hasta: 0.95, color: '#eab308', nombre: 'faltan cargar gastos' };
const tramoDe = (e) => {
  if (e?.completo != null) { const t = tramo(Math.min(e.completo, 0.94)); return t.hasta === 0.95 ? CASI : t; }
  return e?.pct != null ? tramo(e.pct) : null;
};
export function colorCompletitud(e) { return tramoDe(e)?.color ?? null; }
export const nombreTramo = (e) => tramoDe(e)?.nombre ?? '';
/** El número se pinta cuando falta algo (rojo / naranja / amarillo); lo normal y lo de más, en negro. */
export const colorNumero = (e) => { const t = tramoDe(e); return t && (t.hasta <= 0.8 || t === CASI) ? t.color : null; };
/** Largo de la barra: la barra llena es 150% de lo habitual; la marca de lo habitual queda a 2/3. */
export const TOPE_BARRA = 1.5;
export const anchoBarra = (pct) => Math.min(Math.max(pct, 0), TOPE_BARRA) / TOPE_BARRA;

/** «ene–ago» / «ene, mar y abr» para explicar de dónde sale lo habitual. */
export function rangoMeses(meses) {
  if (!meses?.length) return '';
  const contiguos = meses.every((m, i) => i === 0 || m === meses[i - 1] + 1);
  if (contiguos) return meses.length === 1 ? MESES[meses[0] - 1] : `${MESES[meses[0] - 1]}–${MESES[meses[meses.length - 1] - 1]}`;
  const n = meses.map((m) => MESES[m - 1]);
  return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}
