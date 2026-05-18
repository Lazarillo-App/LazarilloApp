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