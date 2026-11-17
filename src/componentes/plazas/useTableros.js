// src/componentes/plazas/useTableros.js — datos de Tableros compartidos por el header (pestañas de sectores
// y chips de plazas) y la pantalla «Todos» (Diego 17/11/2026: sectores como pestañas, plazas como chips de
// sucursal). Un solo pedido para todos los que lo usan; se vuelve a pedir con el evento 'plazas:changed'
// sin vaciar lo que ya se ve.
import { useEffect, useState } from 'react';
import { PlazasAPI } from '@/servicios/apiPlazas';
import { useBusiness } from '@/context/BusinessContext';

const VACIO = { plazas: [], puedeCrear: false, puedeCrearSector: false, sectores: [] };
let cache = { biz: null, t: null };
let pedido = null;
let pedidoBiz = null;
const oyentes = new Set();

function cargar(biz) {
  pedidoBiz = biz;
  pedido = PlazasAPI.tablero()
    .then((t) => { if (pedidoBiz !== biz) return t; cache = { biz, t }; oyentes.forEach((f) => f(t)); return t; })
    .catch(() => cache.t || VACIO)
    .finally(() => { pedido = null; });
  return pedido;
}

// Sectores para mostrar: los que la persona puede gestionar (aunque estén vacíos) + los de sus plazas.
export function sectoresDe(t) {
  const m = new Map();
  (t?.sectores || []).forEach((s) => m.set(Number(s.id), { id: Number(s.id), nombre: s.nombre }));
  (t?.plazas || []).forEach((p) => { if (p.sectorId != null && !m.has(Number(p.sectorId))) m.set(Number(p.sectorId), { id: Number(p.sectorId), nombre: p.sectorNombre || 'Sector' }); });
  // Primero los que tienen plazas (los que se usan), después los vacíos; dentro de cada grupo, por nombre.
  const n = (id) => (t?.plazas || []).filter((p) => Number(p.sectorId) === id).length;
  return [...m.values()].sort((a, b) => (n(b.id) > 0) - (n(a.id) > 0) || a.nombre.localeCompare(b.nombre, 'es'));
}

export function useTableros() {
  const { activeId } = useBusiness() || {};
  const [t, setT] = useState(() => (cache.biz === activeId ? cache.t : null));
  useEffect(() => {
    oyentes.add(setT);
    if (cache.biz === activeId && cache.t) setT(cache.t);
    else if (!pedido || pedidoBiz !== activeId) cargar(activeId);
    const recargar = () => cargar(activeId);
    window.addEventListener('plazas:changed', recargar);
    return () => { oyentes.delete(setT); window.removeEventListener('plazas:changed', recargar); };
  }, [activeId]);
  return t;
}

// Pide abrir el editor de plaza (vive en TablerosBotonera) con un sector ya elegido.
export const pedirNuevaPlaza = (sectorId) => {
  try { window.dispatchEvent(new CustomEvent('plazas:crear', { detail: { sectorId } })); } catch { /* sin evento */ }
};

// Color del punto de cada plaza en los chips (como el de las sucursales).
export const COLORES_PLAZA = ['#5FA862', '#E9A23B', '#C0392B', '#5BC2EA', '#8E6CC9', '#C49A6C', '#2F9C95'];
