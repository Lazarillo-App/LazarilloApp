/* eslint-disable no-empty */
// src/componentes/RecetaModal/helpers.js
// Constantes y helpers puros compartidos por los subcomponentes de RecetaModal.

/* ── constantes ── */
export const UNIDADES = ['u', 'kg', 'gr', 'lt', 'ml', 'oz'];
export const TIPO_COSTO_OPTS = [
  { value: 'total', label: 'Total' },
  { value: 'nulo', label: 'Nulo' },
  { value: 'sugerido', label: 'Precio sugerido' },
];

export const PRIMARY = 'var(--color-primary, #3b82f6)';
export const ON_PRIMARY = 'var(--on-primary, #fff)';
export const DEFAULT_LIST_COLORS = ['#2492C8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
export const colorForList = (list, idx) => list?.color || DEFAULT_LIST_COLORS[idx % DEFAULT_LIST_COLORS.length];

export const fmt = (v, d = 2) => Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtDate = (s) => {
  if (!s) return null;
  try {
    const d = new Date(s);
    if (isNaN(d)) return null;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return null; }
};

/* ── Step progresivo de cantidad para las flechitas ──
   Bandas por magnitud: <10 → 0.5 | <100 → 5 | ≥100 → 50
   Redondea al escalón de la banda (10▼=9.5, 100▼=95). Cruza el 0 espejado. */
export function stepCantidad(valor, dir) {
  const v = Number(valor) || 0;
  const stepFor = (a) => (a < 10 ? 0.5 : a < 100 ? 5 : 50);
  if (v >= 0) {
    if (dir > 0) {
      const s = stepFor(v + 1e-9);
      return Number((Math.floor(v / s + 1e-9) * s + s).toFixed(4));
    }
    const s = stepFor(v - 1e-9);
    return Number((Math.ceil(v / s - 1e-9) * s - s).toFixed(4));
  }
  // v < 0: operar sobre la magnitud con dirección invertida (▲ acerca a 0)
  const mag = -v;
  if (dir > 0) {
    const s = stepFor(mag - 1e-9);
    return Number((-(Math.ceil(mag / s - 1e-9) * s - s)).toFixed(4));
  }
  const s = stepFor(mag + 1e-9);
  return Number((-(Math.floor(mag / s + 1e-9) * s + s)).toFixed(4));
}

/* ── helpers de conversión de unidades ── */
export function normUnit(u) {
  return String(u || 'u').toLowerCase().trim();
}

// Mapa de variantes → unidad canónica. Cubre lo que viene de MaxiRest y cargas manuales
// (mayúsculas, plurales, abreviaturas). Cualquier variante no listada se trata como
// unidad discreta (se devuelve tal cual, sin romper la familia).
export const UNIT_ALIASES = {
  // peso → gr
  g: 'gr', gr: 'gr', grs: 'gr', gramo: 'gr', gramos: 'gr',
  // peso → kg
  k: 'kg', kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  // volumen → ml
  ml: 'ml', mls: 'ml', cc: 'ml', mililitro: 'ml', mililitros: 'ml',
  // volumen → lt
  l: 'lt', lt: 'lt', lts: 'lt', litro: 'lt', litros: 'lt',
  // unidad → u
  u: 'u', un: 'u', uni: 'u', unid: 'u', unidad: 'u', unidades: 'u', und: 'u',
  doc: 'u', docena: 'u',
  // otras de peso
  oz: 'oz', onza: 'oz', onzas: 'oz', lb: 'lb', libra: 'lb', libras: 'lb',
};
export function canonicalUnit(u) {
  const n = normUnit(u);
  return UNIT_ALIASES[n] || n;
}

const UNIDADES_FISICAS = ['u', 'kg', 'gr', 'lt', 'ml', 'oz'];

/**
 * Normaliza la unidad GUARDADA de un ítem de receta al recargarla desde el backend.
 * - Si es una unidad física reconocida (o una variante suya: "K", "GRS", "Lts"…),
 *   se devuelve canonicalizada (para que matchee con las opciones del Select).
 * - Si NO lo es, es el nombre de una equivalencia propia del insumo (ej. "3 Unidades",
 *   "Sobre", "Media oz") y debe preservarse tal cual — canonicalUnit la pasaría a
 *   minúsculas y rompería el match exacto contra `equivalencia.nombre`, dejando el
 *   Select vacío y el costo calculado con la unidad base en vez de la equivalencia.
 */
export function normalizarUnidadGuardada(raw) {
  const canon = canonicalUnit(raw);
  return UNIDADES_FISICAS.includes(canon) ? canon : (raw || 'u');
}

const normEqName = (s) => String(s || '').trim().toLowerCase();

/**
 * Resuelve la unidad de un ítem contra la lista de equivalencias del insumo, tolerando
 * diferencias de mayúsculas/espacios entre lo guardado y `equivalencia.nombre`.
 *
 * Existió un bug (ya corregido en el origen) donde la unidad de un ítem con equivalencia
 * propia se pasaba a minúsculas al recargar la receta; como el autoguardado la persistía
 * de nuevo, algunas recetas quedaron con la unidad guardada en minúsculas mientras la
 * equivalencia real conserva su casing original — el Select no encontraba match exacto,
 * quedaba vacío, y el costo se calculaba como si la unidad fuera desconocida (factor 1),
 * disparando el total. Esta función sana ese dato en memoria (match case-insensitive →
 * reemplaza por el nombre exacto de la equivalencia), y al guardar de nuevo la receta
 * queda persistida ya corregida.
 */
export function resolverUnidadConEquivalencia(unidadActual, equivalencias, supplyMedidaFallback) {
  const eqs = Array.isArray(equivalencias) ? equivalencias : [];
  // Match exacto: nada que sanar
  if (eqs.some(e => e.nombre === unidadActual)) return unidadActual;
  // Match tolerante a mayúsculas/espacios: sanar al nombre exacto de la equivalencia
  const actual = normEqName(unidadActual);
  const heal = eqs.find(e => normEqName(e.nombre) === actual);
  if (heal) return heal.nombre;
  // Unidad física estándar (o su equivalente canónico): sigue siendo válida tal cual
  if (UNIDADES_FISICAS.includes(canonicalUnit(unidadActual))) return unidadActual;
  // Ninguna de las anteriores: la unidad guardada no matchea ni una equivalencia actual
  // ni una unidad física. Diagnóstico temporal — ayuda a ver, en la consola del navegador,
  // qué quedó guardado vs. qué equivalencias trajo el fetch para ESTE insumo puntual.
  try {
    console.warn('[RecetaModal] Unidad de ítem sin match — cae a la unidad base del insumo', {
      unidadGuardada: unidadActual,
      equivalenciasDisponibles: eqs.map(e => e.nombre),
      cantidadEquivalencias: eqs.length,
      fallbackA: canonicalUnit(supplyMedidaFallback || 'u'),
    });
  } catch { }
  return canonicalUnit(supplyMedidaFallback || 'u');
}

// Devuelve las unidades válidas para elegir en la receta según la unidad base del insumo.
// - peso (kg/gr) → [gr, kg]
// - volumen (lt/ml/oz) → [ml, lt, oz]
// - unidad/porción CON envase → [u] + las del tipo del envase; SIN envase → [u]
export function unidadesParaInsumo(insumoData) {
  const base = canonicalUnit(insumoData?.unidad_med || insumoData?.medida || 'u');
  const PESO = ['gr', 'kg'];
  const VOLUM = ['ml', 'lt', 'oz'];
  if (PESO.includes(base)) return PESO;
  if (VOLUM.includes(base)) return VOLUM;
  // base 'u' o 'porcion': ver si tiene envase cargado
  const contEnvase = Number(insumoData?.contenido_envase) || 0;
  const uniEnvase = canonicalUnit(insumoData?.unidad_envase || '');
  if (contEnvase > 0 && uniEnvase) {
    if (PESO.includes(uniEnvase)) return ['u', ...PESO];
    if (VOLUM.includes(uniEnvase)) return ['u', ...VOLUM];
  }
  return ['u'];
}

export function getConversionFactor(from, to) {
  const PESO = { gr: 1, gramo: 1, gramos: 1, g: 1, k: 1000, kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, oz: 28.35, onza: 28.35, lb: 453.59 };
  const VOLUM = { ml: 1, cc: 1, lt: 1000, l: 1000, litro: 1000, litros: 1000, oz: 30, 'oz fl': 29.57 };
  const f = normUnit(from);
  const t = normUnit(to);
  if (f === t) return 1;
  if (PESO[f] !== undefined && PESO[t] !== undefined) return PESO[f] / PESO[t];
  if (VOLUM[f] !== undefined && VOLUM[t] !== undefined) return VOLUM[f] / VOLUM[t];
  // Cruce peso↔volumen: asumir densidad 1 (1gr = 1ml) — llevar ambos a su base (gr/ml) y convertir
  const pesoF = PESO[f], volF = VOLUM[f];
  const pesoT = PESO[t], volT = VOLUM[t];
  const baseF = pesoF !== undefined ? pesoF : volF; // valor en gr o ml
  const baseT = pesoT !== undefined ? pesoT : volT;
  if (baseF !== undefined && baseT !== undefined) return baseF / baseT;
  return 1;
}

export function isCompatibleUnits(a, b) {
  const PESO = new Set(['gr', 'gramo', 'gramos', 'g', 'k', 'kg', 'kilo', 'kilos', 'kilogramo', 'oz', 'onza', 'lb']);
  const VOLUM = new Set(['ml', 'cc', 'lt', 'l', 'litro', 'litros', 'oz']);
  const UNID = new Set(['u', 'un', 'unidad', 'unidades', 'und', 'doc', 'docena']);
  const na = normUnit(a), nb = normUnit(b);
  if (na === nb) return true;
  if (PESO.has(na) && PESO.has(nb)) return true;
  if (VOLUM.has(na) && VOLUM.has(nb)) return true;
  if (UNID.has(na) && UNID.has(nb)) return true;
  return false;
}

/**
 * Dado el precio_ref de la DB (expresado en unidadDB),
 * devuelve el precio por cada 1 unidad de unidadElegida.
 * Ej: precioRefDB=$1000/kg, unidadElegida=gr → $1/gr
 */
export function calcPrecioEnUnidad(precioRefDB, unidadDB, unidadElegida) {
  const pRef = Number(precioRefDB) || 0;
  if (!pRef) return 0;
  const factor = getConversionFactor(normUnit(unidadDB), normUnit(unidadElegida));
  return factor > 0 ? pRef / factor : pRef;
}

export function calcCostoUnitarioElaborado(elaborado, unidadItem, unidadElegida, tipoCosto) {
  if (!elaborado || tipoCosto === 'nulo') return 0;
  const medibles = ['kg', 'gr', 'lt', 'ml', 'l'];
  const cantidad = Number(elaborado?.porciones) || 1;          // divisor SIEMPRE = cantidad
  const pesoEq = Number(elaborado?.rendimientoPeso) || 0;
  const rendUnidad = canonicalUnit(elaborado?.rendimientoUnidad || 'porcion');
  const costoBase = (tipoCosto === 'sugerido' && (elaborado?.precioSugerido ?? 0) > 0)
    ? elaborado.precioSugerido * cantidad
    : (elaborado?.costoTotal ?? 0);
  // 1) Costo por UNIDAD de rendimiento (dividir por cantidad, NO por peso)
  const costoPorUnidad = costoBase / (cantidad > 0 ? cantidad : 1);
  const uElegida = canonicalUnit(unidadElegida || rendUnidad);
  // 2) Rendimiento medible (kg/gr/lt/ml): la unidad de rendimiento ya es física
  if (medibles.includes(rendUnidad)) {
    const factor = getConversionFactor(rendUnidad, uElegida);
    return factor > 0 ? costoPorUnidad / factor : costoPorUnidad;
  }
  // 3) Rendimiento en porción/unidad:
  //    - misma unidad (u/porción) → costo por unidad completo
  //    - peso/volumen con pesoEq definido → convertir vía peso equivalente
  if (uElegida === rendUnidad || uElegida === 'u' || uElegida === 'porcion') {
    return costoPorUnidad;
  }
  const isPeso = (u) => ['gr', 'kg', 'oz', 'lb'].includes(canonicalUnit(u));
  const isVolum = (u) => ['ml', 'lt'].includes(canonicalUnit(u));
  if (pesoEq > 0 && (isPeso(uElegida) || isVolum(uElegida))) {
    const unidadFisica = canonicalUnit(elaborado?.unidadPeso || 'gr');
    const costoPorUnidadFisica = costoPorUnidad / pesoEq;      // costo por 1 unidadFísica
    const factor = getConversionFactor(unidadFisica, uElegida);
    return factor > 0 ? costoPorUnidadFisica / factor : costoPorUnidadFisica;
  }
  return costoPorUnidad;
}

/* ── colores de alerta de última compra ── */
export function getAlertaColor(ultimaCompra, alertaSemanas, esElaborado = false) {
  // Los insumos elaborados no se compran, tienen receta. No aplica alerta.
  if (esElaborado) return null;
  // Insumo que nunca tuvo compras: no es una alerta útil ("hace mucho que no comprás"
  // no aplica si nunca se compró). La referencia de precio se maneja aparte.
  if (!ultimaCompra) return null;
  const d = new Date(ultimaCompra);
  if (isNaN(d)) return alertaSemanas ? '#fef2f2' : null;
  const semanas = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 7);
  return semanas > Number(alertaSemanas) ? '#fef2f2' : null;
}

/**
 * Ordena insumos con las mismas reglas del buscador de ingredientes:
 * 1) con compras primero  2) más compras primero  3) precio asc  4) alfabético.
 * (Sin la parte de búsqueda numérica de código, que aplica solo al filtrar.)
 */
export function ordenarInsumosBusqueda(list) {
  return [...list].sort((a, b) => {
    const aCompra = !!a.fecha_ultima_compra;
    const bCompra = !!b.fecha_ultima_compra;
    if (aCompra !== bCompra) return aCompra ? -1 : 1;
    if (aCompra && bCompra) {
      const aCnt = Number(a.cantidad_compras || 0);
      const bCnt = Number(b.cantidad_compras || 0);
      if (aCnt !== bCnt) return bCnt - aCnt;
    }
    const aP = Number(a.precio_ref ?? a.precio_promedio ?? a.precio ?? 0);
    const bP = Number(b.precio_ref ?? b.precio_promedio ?? b.precio ?? 0);
    if (aP > 0 && bP > 0) return aP - bP;
    if (aP > 0) return -1;
    if (bP > 0) return 1;
    return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
  });
}
