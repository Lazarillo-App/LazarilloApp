// src/gestion/formato.js
// Formatos del Panel de gestion (mismos que lazarillo_gestion/lib/utils.ts y lib/dashboard/constants.ts).

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_IDX = Array.from({ length: 12 }, (_, i) => i + 1);

const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function fmtARS(value) {
  return value != null ? ARS.format(value) : '—';
}

// MaxiRest guarda muchos nombres en MAYÚSCULAS: se muestran como título; el resto, tal cual.
export function normalize(s) {
  if (!s) return '—';
  return s === s.toUpperCase()
    ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : s;
}

// "2026-01-02" → "02/01"
export function fechaCorta(iso) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : null;
}
