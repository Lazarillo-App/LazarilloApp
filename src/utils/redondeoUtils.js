/* eslint-disable no-empty */
// src/utils/redondeoUtils.js
// Utilidades de configuración de redondeo de precios
// Exportado separado para no romper Fast Refresh de Vite

export function getRedondeoConfig(bizId) {
  try {
    const raw = localStorage.getItem(`redondeo_${bizId}`);
    if (raw) return JSON.parse(raw);
  } catch { }
  return { valor: null, mostrarModal: true };
}

export function saveRedondeoConfig(bizId, valor, mostrarModal = true) {
  try {
    const data = { valor: valor ?? null, mostrarModal: !!mostrarModal };
    localStorage.setItem(`redondeo_${bizId}`, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('redondeo:changed', { detail: { ...data, bizId: String(bizId) } }));
    return data;
  } catch { return null; }
}

/**
 * Redondea un precio al múltiplo elegido por el usuario en Configuración (ej. al múltiplo
 * de $50 más cercano). Mismo criterio que ya se usa en TablaArticulos para precios manuales
 * y aumentos masivos — centralizado acá para no repetirlo en cada lugar que muestra un precio.
 * `redondeo` nulo/0/negativo → sin redondeo (solo entero).
 */
export function aplicarRedondeo(precio, redondeo) {
  const p = Number(precio) || 0;
  const r = Number(redondeo) || 0;
  return r > 0 ? Math.round(p / r) * r : Math.round(p);
}