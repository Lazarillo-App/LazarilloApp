// src/componentes/RecetaModal/calcCosto.js
// Cálculo de costo de un ítem de receta — ÚNICA fuente de verdad.
//
// Antes esta lógica vivía duplicada casi idéntica en dos lugares (ItemRow, para pintar
// "$/unidad" en la fila, y RecetaModal.calcCostoItem, para el total y lo que se guarda),
// y podían divergir. Casos reales encontrados al unificar:
//  - Ítems-artículo (componentes de promo) con tipoCosto="sugerido": la fila calculaba un
//    precio sugerido propio del componente (costoArt / objetivo), el total usaba el costo
//    normal sin más. Ahora ambos usan la misma rama.
//  - Desperdicio global por defecto mientras la config no cargó: la fila usaba 5%, el total
//    usaba 0%. Ahora ambos reciben el mismo valor resuelto desde el caller.
import { canonicalUnit, getConversionFactor, calcPrecioEnUnidad, calcCostoUnitarioElaborado } from './helpers';

// Comparación tolerante a mayúsculas/espacios: recetas viejas pueden tener la unidad
// guardada con distinto casing que el nombre real de la equivalencia (bug ya corregido
// en el origen — ver resolverUnidadConEquivalencia en helpers.js). Sin esto, el costo
// caía al camino de "unidad desconocida" (factor 1) en vez de aplicar la equivalencia.
const eqNombreMatch = (nombre, unidad) => String(nombre || '').trim().toLowerCase() === String(unidad || '').trim().toLowerCase();

/**
 * Factor de merma total de un ítem = merma global (salvo ítems-artículo, que no llevan
 * merma) × mermas específicas elegidas (se apilan multiplicativamente: pelado × cocción × …).
 */
export function calcFactorMerma(item, appConfigDesperdicio = 0) {
  if (item.esArticulo || item.articleRefId) return 1;
  const pctGlobal = item.desperdicioPct != null ? Number(item.desperdicioPct) : Number(appConfigDesperdicio || 0);
  const fGlobal = 1 + (pctGlobal / 100);
  const ids = Array.isArray(item.mermaIds)
    ? item.mermaIds
    : (item.mermaId != null ? [item.mermaId] : []);
  const fEspecifica = ids.reduce((acc, id) => {
    const m = (item.mermas || []).find(x => Number(x.id) === Number(id));
    if (!m || !(Number(m.peso_final) > 0)) return acc;
    return acc * (Number(m.peso_inicial) / Number(m.peso_final));
  }, 1);
  return fGlobal * fEspecifica;
}

/**
 * Precio por 1 unidad ELEGIDA de un ítem de receta (insumo, elaborado, equivalencia propia
 * o artículo-componente de promo). Casos, en orden de prioridad:
 *  1. Unidad elegida = equivalencia propia del insumo
 *  2. Insumo elaborado (tiene receta propia, y no se forzó costo por compra)
 *  3. Ítem-artículo (componente de promo)
 *  4. Insumo simple (con o sin envase)
 *
 * @param {object} item - ítem de receta (mismo shape que en items[])
 * @param {object} ctx - { insumos, recetasElaborados, allArticulos, objetivoReceta, appConfigDesperdicio }
 */
export function calcCostoUnitarioItem(item, ctx = {}) {
  const { insumos = [], recetasElaborados = {}, allArticulos = [], objetivoReceta = 30, appConfigDesperdicio = 0 } = ctx;
  const tipoCosto = item.tipoCosto || 'total';
  if (tipoCosto === 'nulo') return 0;

  const insumoData = item.supplyId ? insumos.find(i => String(i.id) === String(item.supplyId)) : null;
  const elaboradoData = item.supplyId ? recetasElaborados[String(item.supplyId)] : null;
  const forzarCompra = insumoData?.costo_efectivo_origen === 'compra';
  const elaborado = forzarCompra ? null : elaboradoData;
  const factorMerma = calcFactorMerma(item, appConfigDesperdicio);

  // ── Si la unidad elegida es una equivalencia propia del insumo (prioridad) ──
  const eqSel = (item.equivalencias || []).find(e => eqNombreMatch(e.nombre, item.unidad));
  if (eqSel) {
    const contenido = Number(eqSel.contenido) || 0;
    if (elaborado) {
      // Elaborado como insumo: aplicar su merma propia (opción A, coherente con la fila y el total).
      const costoPorUnidadEq = calcCostoUnitarioElaborado(elaborado, item.supplyMedida, eqSel.unidad, tipoCosto);
      return contenido * costoPorUnidadEq * factorMerma;
    }
    const precioParaCosto = forzarCompra
      ? (Number(insumoData?.precio_ultima_compra) || Number(item.precioRefDB) || 0)
      : (Number(item.precioRefDB) || 0);
    const precioBase = precioParaCosto * factorMerma;
    // Insumo unidad CON envase: la equivalencia (ml/gr) se cuesta vía envase, no vía precio_ref directo
    const contEnvase = Number(insumoData?.contenido_envase) || 0;
    const uniEnvase = canonicalUnit(insumoData?.unidad_envase || '');
    const baseInsumo = canonicalUnit(item.supplyMedida || 'u');
    if (baseInsumo === 'u' && contEnvase > 0 && uniEnvase) {
      const costoPorUnidadEnvase = precioBase / contEnvase;                       // ej. $8214,90/750ml = $10,95/ml
      const factor = getConversionFactor(canonicalUnit(eqSel.unidad), uniEnvase); // unidad de la equiv → unidad del envase
      return contenido * factor * costoPorUnidadEnvase;                          // ej. 85 × 1 × 10,95 = $931
    }
    // Insumo medible normal: contenido convertido a la unidad base × precio_ref
    const factor = getConversionFactor(canonicalUnit(eqSel.unidad), canonicalUnit(item.supplyMedida || eqSel.unidad));
    return (contenido * factor) * precioBase;
  }

  if (elaborado) {
    // DB-puro: precio_ref del elaborado YA es el costo por unidad de RENDIMIENTO
    // (materializado en backend). La unidad base es rendimiento_unidad, NO supplyMedida
    // (que puede venir sucia de MaxiRest: 'K'/'L'/'U'). Convertimos desde ahí.
    const costoBase = (tipoCosto === 'sugerido' && Number(elaborado?.precioSugerido) > 0)
      ? Number(elaborado.precioSugerido)
      : (Number(item.precioRefDB) || 0);
    const unidadBase = canonicalUnit(elaborado?.rendimientoUnidad || item.supplyMedida || 'u');
    const unidadElegida = canonicalUnit(item.unidad || unidadBase);
    return calcPrecioEnUnidad(costoBase, unidadBase, unidadElegida) * factorMerma;
  }

  // ── Item-artículo (promo): costo del ARTÍCULO, jerarquía costoTotal receta > costo > precio ──
  if (item.esArticulo || item.articleRefId) {
    const refId = Number(item.articleRefId);
    const art = allArticulos.find(a => Number(a.id ?? a.articulo_id) === refId);
    if (tipoCosto === 'sugerido') {
      const costoArt = Number(art?.costoTotal) || 0;
      const objArt = Number(objetivoReceta) || 30;
      const precioSug = (costoArt > 0 && objArt > 0) ? costoArt / (objArt / 100) : 0;
      const unidadDBart = canonicalUnit(item.supplyMedida || 'u');
      return calcPrecioEnUnidad(precioSug, unidadDBart, canonicalUnit(item.unidad || unidadDBart));
    }
    // Costo del componente = precio de venta del artículo
    const costoComp = Number(art?.costoTotal) || Number(art?.precio) || Number(item.precioRefDB) || 0;
    const unidadDBart = canonicalUnit(item.supplyMedida || 'u');
    return calcPrecioEnUnidad(costoComp, unidadDBart, canonicalUnit(item.unidad || unidadDBart));
  }

  // ── Insumo simple ──
  const precioRef = forzarCompra
    ? (Number(insumoData?.precio_ultima_compra) || Number(item.precioRefDB) || 0)
    : (Number(item.precioRefDB) || 0);
  const unidadDB = canonicalUnit(item.supplyMedida || 'u');
  const unidadElegida = canonicalUnit(item.unidad || unidadDB);
  // ── Insumo unidad "u" CON envase, unidad elegida medible (ml/gr/etc, no equivalencia nombrada) ──
  //    El envase ES la unidad de compra al 100%: costo/unidadMedible = precioRef / contenido_envase.
  //    Sin esto caía en calcPrecioEnUnidad con unidadDB='u' → conversión u→ml disparatada.
  const contEnvase = Number(insumoData?.contenido_envase) || 0;
  const uniEnvase = canonicalUnit(insumoData?.unidad_envase || '');
  if (unidadDB === 'u' && contEnvase > 0 && uniEnvase && unidadElegida !== 'u') {
    const costoPorUnidadEnvase = (precioRef * factorMerma) / contEnvase;   // ej. $5.269,98 / 750ml = $7,0266/ml
    const factor = getConversionFactor(unidadElegida, uniEnvase);          // unidad elegida → unidad del envase
    return factor * costoPorUnidadEnvase;                                  // costo por 1 unidad elegida
  }
  return calcPrecioEnUnidad(precioRef * factorMerma, unidadDB, unidadElegida);
}

/** Costo total de línea (cantidad × costo unitario). Envoltorio fino sobre calcCostoUnitarioItem. */
export function calcCostoLineaItem(item, ctx) {
  const cant = Number(item.cantidad) || 0;
  return cant * calcCostoUnitarioItem(item, ctx);
}
