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

// Lo que el modal de carga (traído tal cual de gestion) espera de fetch: { ok, status, json() }.
// "/api/facturas/…" → la ruta del negocio activo.
export async function gestionFetch(ruta, { method = 'GET', body } = {}) {
  try {
    const cuerpo = body ? JSON.parse(body) : undefined;
    // Esas pantallas nombran el lugar "pdvId" (-negocio = la principal, positivo = una sucursal);
    // las rutas que trabajan sobre un lugar lo reciben como ?sucursal.
    const url = new URL(ruta.replace(/^\/api/, ''), 'http://x');
    const lugar = url.searchParams.get('pdvId') ?? url.searchParams.get('pdvDestinoId') ?? cuerpo?.pdvDestinoId
      ?? (url.pathname.endsWith('/sin-carga/descartes') ? cuerpo?.pdvId : undefined);
    if (lugar != null && lugar !== '' && Number(lugar) !== 0) url.searchParams.set('sucursal', Number(lugar) < 0 ? 'principal' : String(lugar));
    const d = await api(`${base()}${url.pathname}${url.search}`, { method, body: cuerpo });
    return { ok: true, status: 200, json: async () => d };
  } catch (e) {
    if (e?.status == null) throw e; // red o sesión: lo trata quien llama
    return { ok: false, status: e.status, json: async () => e.data };
  }
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
  // Sin rubro · por qué (Diego 06/11/2026): lo que cae en Sin rubro, agrupado por causa.
  sinRubro: ({ anio, sucursal }) => api(`${base()}/sin-rubro${qs({ anio, sucursal })}`),
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

  // ── Detalle y edición (click en una celda) ──
  detalle: ({ meses, ...f }) => api(`${base()}/dashboard/detalle${qs({
    ...f,
    historico: f.historico ? 1 : undefined,
    mes: f.historico ? undefined : f.mes,
    months: !f.historico && !f.mes && meses?.length ? meses.join(',') : undefined,
    sinProveedor: f.sinProveedor ? 1 : undefined,
    sinInsumos: f.sinInsumos ? 1 : undefined,
    modo: f.modo === 'financiera' ? 'financiera' : undefined,
  })}`),
  detalleVentas: (f) => api(`${base()}/dashboard/detalle-ventas${qs(f)}`),
  compraLineas: (compraId) => api(`${base()}/dashboard/compra-lineas/${encodeURIComponent(compraId)}`),
  conceptosEdicion: () => api(`${base()}/config/conceptos`),
  editarCompra: (rowId, body) => api(`${base()}/dashboard/compras/${encodeURIComponent(rowId)}`, { method: 'PATCH', body }),
  // Fecha de un pago del informe 80 corregida a mano ({ fechaPagoManual: 'YYYY-MM-DD' | null, negocio }).
  editarPago: (rowId, body) => api(`${base()}/dashboard/pagos/${encodeURIComponent(rowId)}`, { method: 'PATCH', body }),
  editarVenta: (rowId, body) => api(`${base()}/dashboard/ventas/${encodeURIComponent(rowId)}`, { method: 'PATCH', body }),

  // ── Carga manual: facturas, ventas, conceptos y medios de pago ──
  maestrosFactura: () => api(`${base()}/facturas/maestros`),
  factura: (rowId) => api(`${base()}/facturas/${encodeURIComponent(rowId)}`),
  ventasManuales: (sucursal) => api(`${base()}/ventas-manuales${qs({ sucursal })}`),
  crearVentasManuales: ({ sucursal, items, forzar }) =>
    api(`${base()}/ventas-manuales${qs({ sucursal })}`, { method: 'POST', body: { items, forzar } }),
  borrarVentasManuales: (ids) => api(`${base()}/ventas-manuales${qs({ ids: ids.join(',') })}`, { method: 'DELETE' }),
  conceptos: () => api(`${base()}/conceptos`),
  crearConcepto: (body) => api(`${base()}/conceptos`, { method: 'POST', body }),
  editarConcepto: (codigo, body) => api(`${base()}/conceptos/${codigo}`, { method: 'PATCH', body }),
  borrarConcepto: (codigo) => api(`${base()}/conceptos/${codigo}`, { method: 'DELETE' }),
  mediosPago: () => api(`${base()}/medios-pago`),
  crearMedio: (body) => api(`${base()}/medios-pago`, { method: 'POST', body }),
  editarMedio: (id, body) => api(`${base()}/medios-pago/${id}`, { method: 'PUT', body }),
  borrarMedio: (id) => api(`${base()}/medios-pago/${id}`, { method: 'DELETE' }),

  // ── Buscador (⌘K) y rubros visibles ──
  // Sugerencias: sin q, las de la sucursal que se mira; con q, todo el negocio (cada una dice en
  // qué sucursales tiene compras). Observaciones e importes: todo el negocio, cualquier año.
  sugerencias: ({ q, sucursal }) => api(`${base()}/search/suggestions${qs({ q, sucursal })}`),
  observaciones: (q) => api(`${base()}/search/observaciones${qs({ q })}`),
  importes: (q) => api(`${base()}/search/importe${qs({ q })}`),
  rubrosVisibles: (field) => api(`${base()}/config/rubros-dashboard${qs({ field })}`),
  guardarRubroVisible: ({ codigo, visible, field }) =>
    api(`${base()}/config/rubros-dashboard`, { method: 'PATCH', body: { codigo, visible, field } }),
};
