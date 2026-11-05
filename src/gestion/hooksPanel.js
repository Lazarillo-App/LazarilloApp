// src/gestion/hooksPanel.js
// Hooks del bloque Operación, Resultados y tarjetas KPI (port de lazarillo_gestion/hooks:
// use-proyeccion-ingresos, use-egresos-proyeccion, use-equilibrio, use-equilibrio-variables,
// use-diferencia-caja, use-canasta y las consultas de /m/anual, flujo-caja y actualizado).
// Mismas claves de caché entre hooks que piden lo mismo, como en gestion.
//
// Diferencia con gestion: "lo que falta cargar" (Sin carga) todavía no está portado, así que la
// proyección de egresos se calcula sin esa parte y los meses cerrados no muestran faltantes.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { egresosProyectados } from '@/gestion/egresosProy';
import { MESES_IDX } from '@/gestion/formato';
import { usePanelGestion } from '@/gestion/panelContext';
import { gestionFetch } from '@/servicios/apiGestion';
import { getSession } from '@/servicios/apiBase';

// Proyección de cierre del mes con ventas incompletas (mismos filtros que la fila Ingresos).
// null cuando no hay mes para proyectar.
export function useProyeccionIngresos() {
  const { businessId, year, sucursal } = usePanelGestion();
  const { data } = useQuery({
    queryKey: ['gestionProyeccion', businessId, year, sucursal],
    queryFn: () => GestionAPI.proyeccion({ year, sucursal }),
    enabled: !!businessId,
    staleTime: 5 * 60_000,
  });
  return data?.proyeccion ?? null;
}

// El año mes a mes (ventas y gastos por rubro). Lo comparten las tarjetas y la proyección de egresos.
export function useAnual(anio, enabled = true) {
  const { businessId, sucursal } = usePanelGestion();
  return useQuery({
    queryKey: ['gestionAnual', businessId, sucursal, anio],
    queryFn: () => GestionAPI.anual({ anio, sucursal }),
    enabled: !!businessId && enabled,
    staleTime: 10 * 60_000,
  });
}

// Fila Egresos: proyección del mes en curso (Económica, sin búsqueda: con un filtro de
// proveedor/concepto la proyección por rubro no tiene sentido).
export function useEgresosProyeccion(egresosPorMes) {
  const { businessId, year, modo, busquedaActiva, sucursalCaja } = usePanelGestion();
  const proy = useProyeccionIngresos();
  const activo = modo === 'economica' && !busquedaActiva;
  const mesProy = activo && proy && proy.anio === year ? proy.mes : null;
  const { data: anual } = useAnual(year, !!mesProy);
  // Lo que falta cargar sale de Sin carga, del lugar elegido (con "todas" no hay un lugar concreto).
  const pdvId = sucursalCaja === undefined || !businessId ? null : sucursalCaja === 'principal' ? -Number(businessId) : Number(sucursalCaja);
  const { data: sc } = useQuery({
    queryKey: ['sin-carga', pdvId, businessId],
    queryFn: async () => (await gestionFetch(`/api/sin-carga?pdvId=${pdvId}`)).json(),
    enabled: activo && pdvId != null,
    staleTime: 60_000,
  });
  const delMes = (mes) => sc?.meses?.find((m) => m.mes === `${year}-${String(mes).padStart(2, '0')}`)?.items ?? [];
  const proyectado = mesProy && anual && egresosPorMes[mesProy] != null
    ? egresosProyectados({ anual: anual.meses, mesProy, ventasProy: proy.proyeccion, cargadoPivot: egresosPorMes[mesProy], sinCargar: delMes(mesProy) })
    : null;
  // Meses cerrados con algo sin cargar (el de la proyección ya lo incluye).
  const faltan = {};
  if (activo && sc?.meses) {
    for (const m of sc.meses) {
      const [a, mm] = m.mes.split('-').map(Number);
      if (a !== year || mm === mesProy || !m.items.length) continue;
      const items = [...m.items].sort((x, y) => y.ultimo - x.ultimo);
      faltan[mm] = { n: items.length, total: items.reduce((s, x) => s + x.ultimo, 0), items };
    }
  }
  return { proyectado, ventasProy: proyectado ? proy.proyeccion : null, faltan };
}

// Gastos variables por mes para la fila "Punto de equilibrio" (solo en la Económica y sin
// búsqueda: con un filtro los egresos de la fila ya no son todos los gastos).
export function useEquilibrio() {
  const { businessId, year, sucursal, modo, busquedaActiva } = usePanelGestion();
  const activo = modo === 'economica' && !busquedaActiva;
  const { data } = useQuery({
    queryKey: ['gestionEquilibrio', businessId, year, sucursal],
    queryFn: () => GestionAPI.equilibrio({ year, sucursal }),
    enabled: !!businessId && activo,
    staleTime: 10 * 60_000,
  });
  return { data: activo ? data ?? null : null, activo };
}

// Configuración de gastos variables del equilibrio. Con ref = mes de referencia trae además los
// gastos por concepto de la sucursal elegida (para el antes → después del ⚙).
export function useEquilibrioVariables(ref) {
  const { businessId, sucursal } = usePanelGestion();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['gestionEquilibrioVariables', businessId, ref?.anio ?? null, ref?.mes ?? null, ref ? sucursal : null],
    queryFn: () => GestionAPI.equilibrioVariables({ anio: ref?.anio, mes: ref?.mes, sucursal: ref ? sucursal : undefined }),
    enabled: !!businessId,
    staleTime: 60_000,
  });
  // Devuelve null si salió bien, o el mensaje de error.
  async function guardar(cambios) {
    if (!cambios.length) return null;
    try {
      await GestionAPI.guardarEquilibrioVariables(cambios);
    } catch (e) {
      return e?.message || 'No se pudo guardar';
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['gestionEquilibrioVariables'] }),
      queryClient.invalidateQueries({ queryKey: ['gestionEquilibrio'] }),
    ]);
    return null;
  }
  return { variables: data?.variables ?? null, gastos: data?.gastos ?? null, isLoading, guardar };
}

const MES_VACIO = { valor: null, acumulado: null };

// Diferencia de caja por mes + acumulado (todo se calcula en el back, un request).
export function useDiferenciaCaja() {
  const { businessId, year, sucursal } = usePanelGestion();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['gestionDiferenciaCaja', businessId, year, sucursal],
    queryFn: () => GestionAPI.diferenciaCaja({ year, sucursal }),
    enabled: !!businessId,
    staleTime: 30_000,
  });
  const diferenciaPorMes = {};
  for (const mes of MESES_IDX) diferenciaPorMes[mes] = data?.diferenciaPorMes?.[mes] ?? MES_VACIO;
  return { diferenciaPorMes, isLoading, isError };
}

// Disponible en caja (arqueos) del año.
export function useFlujoCaja() {
  const { businessId, year, sucursal } = usePanelGestion();
  return useQuery({
    queryKey: ['gestionFlujoCaja', businessId, year, sucursal],
    queryFn: () => GestionAPI.flujoCaja({ anio: year, sucursal }),
    enabled: !!businessId,
  });
}

// Canasta hasta el mes de referencia (el último cerrado). Se recalcula poco: 1 h.
// Los aumentos de la carta se anotan por sucursal: con "todas" solo si el negocio no tiene
// otras sucursales (lo resuelve el back).
export function useCanasta(ref) {
  const { businessId, sucursal } = usePanelGestion();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['gestionCanasta', businessId, ref?.anio ?? null, ref?.mes ?? null, sucursal],
    queryFn: () => GestionAPI.canasta({ anio: ref.anio, mes: ref.mes, sucursal }),
    enabled: !!businessId && !!ref,
    staleTime: 60 * 60_000,
  });
  // Devuelve null si salió bien, o el mensaje de error.
  async function aumento(metodo, fecha) {
    try {
      await GestionAPI.aumento(metodo, { fecha, sucursal });
    } catch {
      return 'No se pudo guardar el aumento';
    }
    await queryClient.invalidateQueries({ queryKey: ['gestionCanasta'] });
    return null;
  }
  return {
    data: data ?? null,
    isLoading,
    agregarAumento: (f) => aumento('POST', f),
    quitarAumento: (f) => aumento('DELETE', f),
  };
}

// useFetchQuery de gestion. El negocio va al final de la clave para que los invalidate/setQueriesData
// por prefijo de esas pantallas sigan valiendo.
export function useFetchQuery(queryKey, url, opts) {
  const { activeBusinessId } = getSession();
  return useQuery({
    queryKey: [...queryKey, activeBusinessId],
    queryFn: async () => {
      const res = await gestionFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: opts?.enabled !== false && url !== null,
    staleTime: opts?.staleTime ?? 30_000,
    retry: 1,
  });
}

// Medios de pago del negocio (los pagos y el gestor).
export function useMediosPago() {
  const { businessId } = usePanelGestion();
  return useQuery({
    queryKey: ['gestionMediosPago', businessId],
    queryFn: () => GestionAPI.mediosPago(),
    enabled: !!businessId,
    staleTime: 60_000,
  });
}

// Proveedores, conceptos, insumos y lugares para el modal de carga.
export function useMaestrosFactura(enabled = true) {
  const { businessId } = usePanelGestion();
  return useQuery({
    queryKey: ['gestionMaestrosFactura', businessId],
    queryFn: () => GestionAPI.maestrosFactura(),
    enabled: !!businessId && enabled,
    staleTime: 5 * 60_000,
  });
}

// Tras cargar, editar o borrar un gasto: todo lo que se calcula con las compras.
export function refrescarCompras(queryClient) {
  for (const k of ['gestionPivot', 'gestionDetalle', 'gestionFactura', 'gestionCompraLineas', 'gestionProyeccion', 'gestionEquilibrio', 'gestionAnual', 'gestionActualizado', 'gestionRangoAnios', 'gestionMaestrosFactura', 'impagas', 'sin-carga', 'cta-cte']) {
    queryClient.invalidateQueries({ queryKey: [k] });
  }
}

// "Actualizado al …": último día con ventas y con compras, y la última lectura del kit.
export function useActualizado() {
  const { businessId, sucursal } = usePanelGestion();
  return useQuery({
    queryKey: ['gestionActualizado', businessId, sucursal],
    queryFn: () => GestionAPI.actualizado({ sucursal }),
    enabled: !!businessId,
    staleTime: 5 * 60_000,
  });
}
