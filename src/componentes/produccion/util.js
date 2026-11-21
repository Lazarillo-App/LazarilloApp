// src/componentes/produccion/util.js — formatos y fechas del módulo de producción.

export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function isoHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function sumarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Lunes de la semana (la semana de producción va de lunes a domingo). */
export function lunesDe(iso) {
  const dow = new Date(`${iso}T12:00:00`).getDay();
  return sumarDias(iso, dow === 0 ? -6 : 1 - dow);
}
export const diasDeSemana = (lunes) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
export function fechaCorta(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
export function diaLargo(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return `${DIAS_CORTOS[dow]} ${d.getDate()}/${d.getMonth() + 1}`;
}
export const rangoSemana = (lunes) => `${fechaCorta(lunes)} – ${fechaCorta(sumarDias(lunes, 6))}`;

/** Tandas como en la planilla: 1 · ½ · 1½ · ¼ · ¾. */
export function fmtTandas(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  const ent = Math.floor(v + 1e-9);
  const resto = Math.round((v - ent) * 100) / 100;
  const frac = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[resto];
  if (resto === 0) return String(ent);
  if (frac) return ent ? `${ent}${frac}` : frac;
  return String(v).replace('.', ',');
}
export const textoTandas = (n) => `${fmtTandas(n)} ${Number(n) === 1 ? 'tanda' : 'tandas'}`;

const UNIDAD = { porcion: 'porc.', porciones: 'porc.', u: 'u', unidad: 'u', unidades: 'u', kg: 'kg', k: 'kg', gr: 'g', g: 'g', lt: 'L', l: 'L', ml: 'ml', cc: 'ml' };
export const unidadCorta = (u) => UNIDAD[String(u || '').trim().toLowerCase()] ?? (u || '');

/** Cantidad legible: 0,35 kg → 350 g; 0,2 L → 200 ml (como hacía la planilla con K→Gr y L→Cc). */
export function fmtCant(cant, unidad) {
  const n = Number(cant);
  if (cant == null || !Number.isFinite(n)) return '—';
  let u = unidadCorta(unidad), v = n;
  if (u === 'kg' && v < 1) { v *= 1000; u = 'g'; } else if (u === 'L' && v < 1) { v *= 1000; u = 'ml'; }
  else if (u === 'g' && v >= 1000) { v /= 1000; u = 'kg'; } else if (u === 'ml' && v >= 1000) { v /= 1000; u = 'L'; }
  const txt = v.toLocaleString('es-AR', { maximumFractionDigits: v >= 100 ? 0 : 2 });
  return `${txt}${u ? ` ${u}` : ''}`;
}

export function fmtMin(min) {
  const m = Math.round(Number(min) || 0);
  if (!m) return '0 min';
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
}
/** Cronómetro: 1:05:09 / 12:04. */
export function fmtReloj(seg) {
  const s = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const dd = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${dd(m)}:${dd(r)}` : `${m}:${dd(r)}`;
}

export const ESTADOS = {
  pendiente: { label: 'Pendiente', color: '#8696B2', fondo: '#EEF2F8' },
  en_curso: { label: 'En curso', color: '#1E87B5', fondo: '#E3F4FB' },
  pausada: { label: 'Pausada', color: '#C8912B', fondo: '#FBF3E2' },
  hecha: { label: 'Hecha', color: '#1FA866', fondo: '#E4F6EC' },
  cancelada: { label: 'Cancelada', color: '#D64545', fondo: '#FBE9E9' },
};

export const iniciales = (nombre) => String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';

/** Mensajes de error del servidor en castellano. */
export function textoError(e) {
  const code = e?.data?.error || e?.error || e?.message;
  const msg = e?.data?.message;
  const T = {
    forbidden: 'No tenés permiso para esto.', tarea_no_encontrada: 'La tarea ya no existe.',
    semana_con_tareas: msg, semana_vacia: 'La semana anterior no tiene tareas para repetir.',
    ya_iniciada: msg || 'La tarea ya empezó.', rinde_requerido: 'Cargá cuánto rindió.', motivo_requerido: 'Contá por qué cambió.',
    elaborado_sin_receta: 'Ese elaborado no tiene receta.', tandas_invalidas: 'Las tandas tienen que ser más de 0.',
    no_en_curso: 'Empezá la tarea para marcar los ingredientes.', estado_invalido: 'La tarea cambió de estado: recargá.',
  };
  return T[code] || msg || 'No se pudo guardar. Probá de nuevo.';
}
