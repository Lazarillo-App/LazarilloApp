// src/hooks/useAjustes.js
// Ajustes a medida (13/11/2026): lo que los super usuarios prenden para un cliente, un negocio,
// una organización o para todos, desde su panel. Uso: const valor = useAjuste('clave', porDefecto).
// Se cargan una vez y se recargan al cambiar de negocio o con window 'ajustes:refrescar'.
import { useSyncExternalStore } from 'react';
import { SoporteAPI } from '@/servicios/apiSoporte';

let ajustes = {};
let cargando = null;
let cargadoPara = undefined; // negocio con el que se cargaron
const oyentes = new Set();
const avisar = () => oyentes.forEach((fn) => fn());

const negocioActivo = () => {
  try { return localStorage.getItem('activeBusinessId') || ''; } catch { return ''; }
};
const logueado = () => {
  try { return !!localStorage.getItem('token'); } catch { return false; }
};

export function recargarAjustes() {
  if (!logueado()) { ajustes = {}; cargadoPara = undefined; avisar(); return Promise.resolve(); }
  const neg = negocioActivo();
  cargando = SoporteAPI.ajustes()
    .then((r) => { ajustes = r?.ajustes || {}; cargadoPara = neg; })
    .catch(() => { /* sin ajustes: todo con su valor por defecto */ })
    .finally(() => { cargando = null; avisar(); });
  return cargando;
}

if (typeof window !== 'undefined') {
  ['business:switched', 'business:created', 'ajustes:refrescar', 'auth:login'].forEach((ev) =>
    window.addEventListener(ev, () => { recargarAjustes(); }));
  window.addEventListener('auth:logout', () => { ajustes = {}; cargadoPara = undefined; avisar(); });
}

function suscribir(fn) {
  oyentes.add(fn);
  if (!cargando && cargadoPara !== negocioActivo() && logueado()) recargarAjustes();
  return () => oyentes.delete(fn);
}

/** Todos los ajustes que le tocan al usuario en el negocio activo: { clave: valor }. */
export function useAjustes() {
  return useSyncExternalStore(suscribir, () => ajustes, () => ajustes);
}

/** El valor de una clave, o el valor por defecto si nadie la prendió para este cliente. */
export function useAjuste(clave, porDefecto) {
  const a = useAjustes();
  return Object.prototype.hasOwnProperty.call(a, clave) ? a[clave] : porDefecto;
}
