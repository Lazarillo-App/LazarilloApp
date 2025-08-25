// src/utils/fechas.js
export function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Últimos N días (incluye hoy), anclado a medianoche local */
export function lastNDaysLocal(n) {
  const end = new Date(); // ahora
  // anclo a 00:00 local de hoy
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const startMid = new Date(endMid);
  // incluye hoy => restar (n-1)
  startMid.setDate(startMid.getDate() - (n - 1));
  return { from: ymdLocal(startMid), to: ymdLocal(endMid) };
}

export function daysByMode(mode) {
  if (mode === '7') return 7;
  if (mode === '90') return 90;
  return 30; // default
}
