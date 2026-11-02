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

  // ── Resultados, tarjetas KPI y bloque Operación (paso 3) ──
  // Todos llevan `sucursal` (undefined = todas, 'principal', o el id de la sucursal).
  proyeccion: ({ year, sucursal }) => api(`${base()}/dashboard/proyeccion${qs({ year, sucursal })}`),
  equilibrio: ({ year, sucursal }) => api(`${base()}/dashboard/equilibrio${qs({ year, sucursal })}`),
  equilibrioVariables: ({ anio, mes, sucursal }) => api(`${base()}/dashboard/equilibrio/variables${qs({ anio, mes, sucursal })}`),
  guardarEquilibrioVariables: (cambios) => api(`${base()}/dashboard/equilibrio/variables`, { method: 'PUT', body: { cambios } }),
  flujoCaja: ({ anio, sucursal }) => api(`${base()}/dashboard/flujo-caja${qs({ anio, sucursal })}`),
  guardarFlujoCaja: ({ sucursal, anio, mes, monto }) =>
    api(`${base()}/dashboard/flujo-caja${qs({ sucursal })}`, { method: 'PUT', body: { anio, mes, monto } }),
  diferenciaCaja: ({ year, sucursal }) => api(`${base()}/dashboard/diferencia-caja${qs({ year, sucursal })}`),
  canasta: ({ anio, mes, sucursal }) => api(`${base()}/dashboard/canasta${qs({ anio, mes, sucursal })}`),
  aumento: (metodo, { fecha, sucursal }) =>
    api(`${base()}/dashboard/canasta/aumentos${qs({ sucursal })}`, { method: metodo, body: { fecha } }),
  anual: ({ anio, sucursal }) => api(`${base()}/m/anual${qs({ anio, sucursal })}`),
  actualizado: ({ sucursal }) => api(`${base()}/dashboard/actualizado${qs({ sucursal })}`),
  rangoAnios: ({ sucursal }) => api(`${base()}/dashboard/rango-anios${qs({ sucursal })}`),
};
