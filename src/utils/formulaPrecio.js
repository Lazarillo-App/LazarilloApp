// src/utils/formulaPrecio.js
// Permite tipear una cuenta en las cajas de precio de la tabla de artículos
// (ej. "9600*5" para un 6x5 → 48.000). Solo números y + − * / x ( ).
// Convención de la tabla: el punto es separador de miles ("9.600") y la coma, decimal.
// No usa eval: es un parser chico (recursive descent) que solo entiende aritmética.

const OPERADORES = /[+\-*/x×()]/i;

/** ¿El texto tiene alguna operación (y no es solo un número)? */
export const esFormula = (txt) => {
  const s = String(txt ?? '').trim();
  // Un "-" solo al principio no es una cuenta, es un número negativo
  return OPERADORES.test(s.replace(/^-/, ''));
};

/** Deja solo los caracteres que acepta una fórmula. */
export const limpiarFormula = (txt) => String(txt ?? '').replace(/[^0-9.,+\-*/x×()\s]/gi, '');

/**
 * Calcula la fórmula. Devuelve un número, o null si está mal escrita
 * (paréntesis sin cerrar, dividir por cero, dos operadores seguidos, etc.).
 */
export function evaluarFormula(txt) {
  const s = String(txt ?? '')
    .replace(/\s+/g, '')
    .replace(/[x×]/gi, '*')
    .replace(/\./g, '')        // miles
    .replace(/,/g, '.');       // decimal
  if (!s || /[^0-9.+\-*/()]/.test(s)) return null;
  let i = 0;
  const ver = () => s[i];
  const numero = () => {
    const ini = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    const t = s.slice(ini, i);
    if (!t || (t.match(/\./g) || []).length > 1) throw new Error('número');
    return Number(t);
  };
  const factor = () => {
    if (ver() === '-') { i++; return -factor(); }
    if (ver() === '+') { i++; return factor(); }
    if (ver() === '(') {
      i++;
      const v = suma();
      if (ver() !== ')') throw new Error('paréntesis');
      i++;
      return v;
    }
    return numero();
  };
  const producto = () => {
    let v = factor();
    while (ver() === '*' || ver() === '/') {
      const op = s[i++];
      const d = factor();
      if (op === '/') { if (d === 0) throw new Error('cero'); v /= d; } else v *= d;
    }
    return v;
  };
  const suma = () => {
    let v = producto();
    while (ver() === '+' || ver() === '-') {
      const op = s[i++];
      const d = producto();
      v = op === '+' ? v + d : v - d;
    }
    return v;
  };
  try {
    const v = suma();
    if (i !== s.length || !Number.isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}
