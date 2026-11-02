// src/servicios/apiGestion.js
// API del Panel de gestion (port de lazarillo_gestion) — back: /api/businesses/:id/gestion/*
// Usa el cliente liviano de apiBase (Bearer + X-Business-Id automáticos).

import { api, getSession, qs } from './apiBase';

const base = () => {
  const { activeBusinessId } = getSession();
  return `/businesses/${activeBusinessId}/gestion`;
};

// Filtro de sucursal del BranchContext → parámetro `sucursal` del back:
// todas → sin parámetro, principal → "principal", una sucursal → su id.
export function sucursalParam(activeBranchFilter) {
  if (!activeBranchFilter || activeBranchFilter.mode === 'all') return undefined;
  if (activeBranchFilter.mode === 'main') return 'principal';
  return activeBranchFilter.branchId ?? undefined;
}

export const GestionAPI = {
  // Pivot de Compras. params: { year, sucursal, months:[..], agrupacion:'concepto'|'proveedor'|'insumo',
  // modo:'financiera'|undefined, rubroCodigo, conceptoCodigo, proveedorId, observacionQuery, importeQuery }
  pivot: ({ months, agrupacion, ...resto }) =>
    api(`${base()}/dashboard/pivot${qs({
      ...resto,
      months: months?.length ? months.join(',') : undefined,
      agrupacion: agrupacion && agrupacion !== 'concepto' ? agrupacion : undefined,
    })}`),

  // Pivot de Ventas (tipo → forma de cobro). params: { year, sucursal, months:[..] }
  pivotVentas: ({ months, ...resto }) =>
    api(`${base()}/dashboard/pivot-ventas${qs({
      ...resto,
      months: months?.length ? months.join(',') : undefined,
    })}`),
};
