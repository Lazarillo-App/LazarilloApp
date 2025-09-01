// src/utils/fechas.js

export function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Últimos N días, terminando en AYER (anclado a medianoche local) */
export function lastNDaysUntilYesterday(n) {
  const now = new Date();
  // hoy 00:00
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // AYER 00:00
  const endMid = new Date(todayMid);
  endMid.setDate(endMid.getDate() - 1);
  // desde = (n-1) días antes de AYER
  const startMid = new Date(endMid);
  startMid.setDate(startMid.getDate() - (n - 1));
  return { from: ymdLocal(startMid), to: ymdLocal(endMid) };
}

/**
 * Compatibilidad: antes devolvía hasta HOY; ahora delega a “hasta AYER”
 * para evitar parciales y resultados que varíen durante el día.
 */
export function lastNDaysLocal(n) {
  return lastNDaysUntilYesterday(n);
}

export function daysByMode(mode) {
  if (mode === '7') return 7;
  if (mode === '90') return 90;
  return 30; // default
}

/** Conveniencia: rango directo por modo (7|30|90) terminando en AYER */
export function rangeByModeUntilYesterday(mode) {
  return lastNDaysUntilYesterday(daysByMode(mode));
}