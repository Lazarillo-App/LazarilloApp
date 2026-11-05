// src/gestion/avisoPrecio.js
// Aviso de "un 0 de más" al cargar una factura (pedido de Diego, 05/11/2026): el unitario de la
// línea se compara con el último precio del insumo (el del maestro de la carga, por unidad base).
//   rojo   ×5 o más / ÷5 o menos  → casi seguro un 0 de más o de menos: se ofrece corregir
//   ámbar  ×2,5 a ×5 / ÷2,5 a ÷5  → "¿es correcto?"
//   nada   hasta ×2,5 / ÷2,5
// La sugerencia es el mismo número corrido 1 a 3 lugares (÷10, ×10, …) que más se acerque al último.

const ROJO = 5;
const AMBAR = 2.5;

/**
 * @param {number} unit   unitario cargado en la línea (por la medida de la línea)
 * @param {number} ref    último precio del insumo, por unidad base
 * @param {number|null} factor  unidades base por envase (X8 → 8); null/1 = misma medida
 * @returns {null | { nivel: 'rojo'|'ambar', ratio: number, sugerido: number|null }}
 */
export function avisoPrecio(unit, ref, factor = null) {
  const u = Number(unit);
  const r0 = Number(ref);
  if (!(u > 0) || !(r0 > 0)) return null;
  const f = factor && factor > 1 ? factor : 1;
  const ratio = (u / f) / r0;
  const lejos = Math.max(ratio, 1 / ratio);
  if (lejos < AMBAR) return null;
  if (lejos < ROJO) return { nivel: 'ambar', ratio, sugerido: null };
  let sugerido = null;
  let mejor = Infinity;
  for (const k of [-3, -2, -1, 1, 2, 3]) {
    const cand = u * 10 ** k;
    const d = Math.abs(Math.log((cand / f) / r0));
    if (d < mejor) { mejor = d; sugerido = cand; }
  }
  // Solo si corrido queda razonable (dentro del rango sin aviso).
  if (!(Math.exp(mejor) < AMBAR)) sugerido = null;
  else sugerido = Math.round(sugerido * 100) / 100;
  return { nivel: 'rojo', ratio, sugerido };
}

/** "×10" / "÷10" / "×3,2" para mostrar. */
export function textoVeces(ratio) {
  const v = ratio >= 1 ? ratio : 1 / ratio;
  const n = v >= 9.5 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${ratio >= 1 ? '×' : '÷'}${String(n).replace('.', ',')}`;
}
