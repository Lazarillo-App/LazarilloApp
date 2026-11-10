// src/paginas/GestionPanel.jsx
// Panel de Gestión, igual a lazarillo_gestion (components/dashboard/dashboard-content.tsx,
// dashboard-filters.tsx, dashboard-tab-content.tsx, switch-eco-fin.tsx, vista-tabla-toggles.tsx).
// Solo owner/admin (la ruta va con RequireAdminOrOwner; el back también lo exige).
//
// Pasos del port: 1 Compras, 2 Ventas, 3 Resultados + tarjetas KPI (hechos), 4 lo editable.
// La sucursal sale del selector global de sucursales (BranchContext), como en el resto de la app.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Typography, ToggleButton, ToggleButtonGroup, Stack, Tooltip, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ViewQuiltOutlinedIcon from '@mui/icons-material/ViewQuiltOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { MAIN_BRANCH_ID } from '@/context/BranchContext';
import { GestionAPI, sucursalParam } from '@/servicios/apiGestion';
import PivotCompras from '@/componentes/gestion/PivotCompras';
import { SinRubroPanel } from '@/componentes/gestion/SinRubro';
import PivotVentas from '@/componentes/gestion/PivotVentas';
import PivotResultados from '@/componentes/gestion/PivotResultados';
import KpiTarjetas from '@/componentes/gestion/KpiTarjetas';
import ActualizadoAl from '@/componentes/gestion/ActualizadoAl';
import FiltroPeriodo from '@/componentes/gestion/FiltroPeriodo';
import BuscadorPanel from '@/componentes/gestion/BuscadorPanel';
import RubrosConfig from '@/componentes/gestion/RubrosConfig';
import ComprasDetalleModal from '@/componentes/gestion/ComprasDetalleModal';
import VentasDetalleModal from '@/componentes/gestion/VentasDetalleModal';
import CargarFactura from '@/componentes/gestion/CargarFactura';
import BloqueSeguro from '@/componentes/gestion/BloqueSeguro';
import BarraIngresosManuales from '@/componentes/gestion/IngresosManuales';
import { ImpagasBoton } from '@/componentes/gestion/pagos/impagas-boton';
import { SinCargaBoton } from '@/componentes/gestion/pagos/sin-carga-boton';
import { ScopeGestion, lugarDe, useFetchQuery } from '@/gestion/compat';
import { Toaster } from 'sonner';
import { ActividadCampana } from '@/componentes/gestion/pagos/actividad-campana';
import { NotasSidebar } from '@/componentes/gestion/pagos/notas-sidebar';
import { Popover as MuiPopover } from '@mui/material';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import { buildDetalleFilter } from '@/gestion/detalleFilter';
import { TIPOS, TIPO_DE_PARAM } from '@/gestion/buscadorTipos';
import { sxBotonBarra } from '@/gestion/estilos';
import { PanelGestionContext } from '@/gestion/panelContext';
import { MESES_IDX } from '@/gestion/formato';
import { useAccess } from '@/context/AccessContext';
import SpotlightTour from '@/componentes/SpotlightTour';
import { useRecorrido } from '@/hooks/useRecorrido';

const ANIO_ACTUAL = new Date().getFullYear();

const TABS = [
  { v: 'compras', label: 'Compras' },
  { v: 'ventas', label: 'Ventas' },
  { v: 'resultados', label: 'Resultados' },
];

// Preferencias de vista por negocio (en gestion: zustand persistido). Solo comodidad del
// usuario: si localStorage no está disponible, se usan los valores por defecto.
const claveEstado = (bizId) => `gestion:panel:${bizId || 'default'}`;
const ESTADO_INICIAL = {
  year: ANIO_ACTUAL, meses: [], tab: 'compras', agrupacion: 'concepto', modoCelda: 'importe',
  modo: 'economica', sort: { col: 1, dir: 'desc' }, mostrarTarjetas: true,
};

function leerEstado(bizId) {
  try {
    const raw = localStorage.getItem(claveEstado(bizId));
    return raw ? { ...ESTADO_INICIAL, ...JSON.parse(raw) } : ESTADO_INICIAL;
  } catch {
    return ESTADO_INICIAL;
  }
}
function guardarEstado(bizId, estado) {
  try { localStorage.setItem(claveEstado(bizId), JSON.stringify(estado)); } catch { /* sin storage: no se recuerda */ }
}

// Botonera chica de la barra de la tarjeta (vista-tabla-toggles.tsx).
const sxGrupo = {
  bgcolor: 'background.paper',
  '& .MuiToggleButton-root': { height: 28, px: 1.25, py: 0, fontSize: 12, fontWeight: 500, textTransform: 'none', gap: 0.5, border: 0, borderRadius: '6px !important' },
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': { bgcolor: 'grey.900', color: '#fff' },
  border: 1, borderColor: 'divider', borderRadius: 2, p: 0.25,
};

// Todo el Panel protegido además de cada bloque: si algo falla arriba, se ve el aviso, no la pantalla en blanco.
export default function GestionPanel() {
  return <BloqueSeguro nombre="el Panel de Gestión"><GestionPanelContenido /></BloqueSeguro>;
}

function GestionPanelContenido() {
  const { activeBusinessId, active } = useBusiness() || {};
  const { activeBranchFilter, activeBranch, branches, setActiveBranch } = useBranch() || {};
  const [estado, setEstado] = useState(() => {
    const e = leerEstado(activeBusinessId);
    // El botón de carga no está en Ventas: si se entra a cargar, se abre en Compras.
    return new URLSearchParams(window.location.search).get('cargar') === '1' && e.tab === 'ventas' ? { ...e, tab: 'compras' } : e;
  });
  // Filtro del buscador ({ param, value, label }): no se recuerda entre visitas, como en gestion.
  const [busqueda, setBusqueda] = useState(null);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  // Modales de detalle: el filtro de la celda clickeada (null = cerrado).
  const [detalleFilter, setDetalleFilter] = useState(null);
  const [ventasFilter, setVentasFilter] = useState(null);
  // Celda vacía tocada en la tabla: la atiende CargarFactura.
  const [pedidoCarga, setPedidoCarga] = useState(null);
  const [anclaNotas, setAnclaNotas] = useState(null);
  const limpiarPedido = useCallback(() => setPedidoCarga(null), []);
  // Desde la home ("Carga de gastos"): /gestion?cargar=1 abre el modal de carga y se limpia la URL.
  const [params, setParams] = useSearchParams();
  const [cargarAlEntrar] = useState(() => params.get('cargar') === '1');
  const limpiarCargar = useCallback(() => {
    setParams((p) => { const n = new URLSearchParams(p); n.delete('cargar'); return n; }, { replace: true });
  }, [setParams]);

  // Al cambiar de negocio, sus propias preferencias.
  useEffect(() => { setEstado(leerEstado(activeBusinessId)); setBusqueda(null); }, [activeBusinessId]);
  useEffect(() => { guardarEstado(activeBusinessId, estado); }, [activeBusinessId, estado]);

  const cambiar = (parcial) => setEstado((e) => ({ ...e, ...parcial }));

  // Roles a medida (sin rol a medida, se ve todo como siempre).
  const { puedeVer = () => true, oculto = () => false } = useAccess() || {};
  const verPanel = puedeVer('resultados');
  const verCarga = puedeVer('carga', 'editar');
  const tabsVisibles = TABS.filter((t) => !oculto(`tab.${t.v}`));
  const sinEcoFin = oculto('btn.eco_fin');
  const sinPct = oculto('tabla.pct');
  // Si lo guardado apunta a algo que el rol no ve, se vuelve a lo básico.
  useEffect(() => {
    const arreglo = {};
    if (!tabsVisibles.some((t) => t.v === estado.tab)) arreglo.tab = 'compras';
    if (sinEcoFin && estado.modo !== 'economica') arreglo.modo = 'economica';
    if (sinPct && estado.modoCelda !== 'importe') arreglo.modoCelda = 'importe';
    if (Object.keys(arreglo).length) setEstado((e) => ({ ...e, ...arreglo }));
  }, [estado.tab, estado.modo, estado.modoCelda, sinEcoFin, sinPct, tabsVisibles.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleMes = (m) => setEstado((e) => {
    const set = new Set(e.meses);
    if (set.has(m)) set.delete(m); else set.add(m);
    // Los 12 marcados es lo mismo que ninguno (todo el año), como en gestion.
    return { ...e, meses: set.size === 12 ? [] : [...set].sort((a, b) => a - b) };
  });
  const ordenar = (col) => setEstado((e) => ({
    ...e,
    sort: e.sort.col === col ? { col, dir: e.sort.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' },
  }));

  const sucursal = sucursalParam(activeBranchFilter);
  // Caja concreta para lo que se carga por sucursal (arqueos, aumentos de la carta): la elegida o,
  // con "todas", la principal si el negocio no tiene otras sucursales.
  const sucursalCaja = sucursal !== undefined ? sucursal : (branches?.length ?? 1) <= 1 ? 'principal' : undefined;
  // La búsqueda filtra Compras y Resultados (Ventas no tiene buscador).
  const busquedaActiva = estado.tab !== 'ventas' && busqueda ? busqueda : null;
  // El modal muestra exactamente lo que suma la celda: los filtros del Panel también van al detalle.
  const abrirDetalle = useCallback((extra) => {
    const param = busquedaActiva?.param;
    const valor = busquedaActiva?.value;
    setDetalleFilter(buildDetalleFilter(
      { year: estado.year, sucursal },
      {
        rubroCodigo: param === 'rubroCodigo' ? valor : undefined,
        conceptoCodigo: param === 'conceptoCodigo' ? valor : undefined,
        proveedorId: param === 'proveedorId' ? Number(valor) : undefined,
        observacionQuery: param === 'observacionQuery' ? valor : undefined,
        importeQuery: param === 'importeQuery' ? valor : undefined,
        activeMonths: estado.meses.length ? estado.meses : undefined,
      },
      extra,
    ));
  }, [estado.year, estado.meses, sucursal, busquedaActiva]);
  const abrirVentas = useCallback((extra) => {
    setVentasFilter({ year: estado.year, sucursal, ...extra });
  }, [estado.year, sucursal]);
  const nombreLugar = activeBranchFilter?.mode === 'all' || !activeBranchFilter
    ? (active?.name || 'Negocio')
    : `${active?.name || 'Negocio'} · ${activeBranch?.name || 'Principal'}`;
  const panel = useMemo(() => ({
    businessId: activeBusinessId, year: estado.year, sucursal, sucursalCaja, modo: estado.modo, busquedaActiva: !!busquedaActiva,
    abrirDetalle, abrirVentas, nombreLugar, pedirCarga: setPedidoCarga,
  }), [activeBusinessId, estado.year, sucursal, sucursalCaja, estado.modo, busquedaActiva, abrirDetalle, abrirVentas, nombreLugar]);

  // ⌘K / Ctrl+K abre el buscador (no en Ventas).
  useEffect(() => {
    if (estado.tab === 'ventas') return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBuscadorAbierto(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [estado.tab]);

  // Elegir un resultado: filtra y, si vive en otra sucursal u otro año, va hasta ahí.
  const elegirBusqueda = ({ param, value, label, anio, sucursal: destino }) => {
    setBusqueda({ param, value, label });
    if (anio != null) cambiar({ year: anio });
    if (destino !== undefined && setActiveBranch) setActiveBranch(destino === null ? MAIN_BRANCH_ID : destino);
  };

  // Años navegables: desde el primer dato importado hasta el actual (rango-anios de gestion).
  const rango = useQuery({
    enabled: !!activeBusinessId && verPanel,
    queryKey: ['gestionRangoAnios', activeBusinessId, sucursal],
    queryFn: () => GestionAPI.rangoAnios({ sucursal }),
    staleTime: 10 * 60 * 1000,
  });
  const columnas = estado.meses.length ? estado.meses : MESES_IDX;
  // Impagas y Sin carga: en la Económica sin búsqueda están en la tarjeta "Para mirar"; si no, en la barra.
  const pdvId = lugarDe(activeBusinessId, sucursalCaja);
  const enParaMirar = estado.modo === 'economica' && !busquedaActiva && pdvId != null && estado.mostrarTarjetas;
  const { data: locales } = useFetchQuery(['locales'], '/api/locales', { staleTime: 5 * 60_000 });

  const paramsCompras = useMemo(() => ({
    year: estado.year,
    sucursal,
    months: estado.meses,
    agrupacion: estado.agrupacion,
    modo: estado.modo === 'financiera' ? 'financiera' : undefined,
    ...(busquedaActiva ? { [busquedaActiva.param]: busquedaActiva.value } : {}),
  }), [estado.year, sucursal, estado.meses, estado.agrupacion, estado.modo, busquedaActiva]);
  const paramsVentas = useMemo(() => ({ year: estado.year, sucursal, months: estado.meses }), [estado.year, sucursal, estado.meses]);

  // Compras y, en Resultados, la fila Egresos del bloque Operación (vista por concepto).
  const paramsOperacion = useMemo(() => ({ ...paramsCompras, agrupacion: 'concepto' }), [paramsCompras]);
  const compras = useQuery({
    enabled: !!activeBusinessId && verPanel && estado.tab === 'compras',
    queryKey: ['gestionPivot', activeBusinessId, paramsCompras],
    queryFn: () => GestionAPI.pivot(paramsCompras),
    staleTime: 60 * 1000,
  });
  const operacion = useQuery({
    enabled: !!activeBusinessId && verPanel && estado.tab === 'resultados',
    queryKey: ['gestionPivot', activeBusinessId, paramsOperacion],
    queryFn: () => GestionAPI.pivot(paramsOperacion),
    staleTime: 60 * 1000,
  });
  // Resultados: pivot filtrado por los rubros visibles en Resultados (Ganancia y el detalle).
  const paramsResultados = useMemo(() => ({ ...paramsOperacion, vista: 'resultados' }), [paramsOperacion]);
  const resultados = useQuery({
    enabled: !!activeBusinessId && verPanel && estado.tab === 'resultados',
    queryKey: ['gestionPivot', activeBusinessId, paramsResultados],
    queryFn: () => GestionAPI.pivot(paramsResultados),
    staleTime: 60 * 1000,
  });
  // Ventas: su pestaña y la fila de Ingresos y el % de las otras dos (useOperacionKpis de gestion).
  const ventas = useQuery({
    enabled: !!activeBusinessId && verPanel,
    queryKey: ['gestionPivotVentas', activeBusinessId, paramsVentas],
    queryFn: () => GestionAPI.pivotVentas(paramsVentas),
    staleTime: 60 * 1000,
  });

  const nombreSucursal = activeBranchFilter?.mode === 'all' || !activeBranchFilter
    ? 'Todas las sucursales'
    : activeBranch?.name || 'Principal';

  const nombreActualizado = activeBranchFilter?.mode === 'all' || !activeBranchFilter
    ? (active?.name || 'Negocio')
    : `${active?.name || 'Negocio'} · ${nombreSucursal}`;

  /* ── Recorrido de Anthony la primera vez en el Panel (10/11): solo los pasos que se ven. ── */
  const refsTour = { periodo: useRef(null), ecofin: useRef(null), tabs: useRef(null), tarjetas: useRef(null), cargar: useRef(null) };
  // Las tarjetas no se dibujan sin datos, en Financiera ni con búsqueda: el paso va solo si se ven (10/11).
  const [hayTarjetas, setHayTarjetas] = useState(false);
  useEffect(() => {
    const el = refsTour.tarjetas.current;
    if (!el) { setHayTarjetas(false); return undefined; }
    const medir = () => setHayTarjetas(el.getBoundingClientRect().height > 40);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [estado.mostrarTarjetas, verPanel]); // eslint-disable-line react-hooks/exhaustive-deps
  const pasosTour = [
    { k: 'periodo', t: <>Elegí el <b>año</b> y los <b>meses</b> que querés ver. Todo el panel se calcula con ese período.</> },
    ...(!sinEcoFin ? [{ k: 'ecofin', t: <><b>Económica</b> pone cada gasto en el mes de la factura; <b>Financiera</b>, en el mes en que lo pagaste. Sirve para ver la rentabilidad o la caja.</> }] : []),
    { k: 'tabs', t: <><b>Compras</b> son tus gastos (los podés ver por concepto, proveedor o insumo), <b>Ventas</b> tus ingresos y <b>Resultados</b> lo que te queda: la ganancia.</> },
    ...(estado.mostrarTarjetas && hayTarjetas ? [{ k: 'tarjetas', t: <>Estas tarjetas son el resumen del <b>último mes cerrado</b> y cómo viene el mes en curso.</> }] : []),
    ...(verCarga && estado.tab !== 'ventas' ? [{ k: 'cargar', t: <>Desde acá <b>cargás una factura o un gasto</b> (alquiler, sueldos, servicios). También podés tocar una celda vacía de la tabla.</> }] : []),
  ];
  const recPanel = useRecorrido('gestion_panel', pasosTour.length,
    verPanel && !cargarAlEntrar && !buscadorAbierto && !detalleFilter && !ventasFilter && !pedidoCarga && !anclaNotas);
  const pasoTour = pasosTour[recPanel.paso - 1];

  return (
    <PanelGestionContext.Provider value={panel}>
    <Toaster position="bottom-right" />
    <SinRubroPanel />
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', height: { md: 'calc(100vh - 64px)' } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={600} noWrap>Panel de Gestión</Typography>
            {/* Compu: el punto de frescura vive al lado del logo (PulsoDatos, Diego 06/11/2026);
                acá ya no se repite. Celu: el chip de abajo, porque en el celu el header no lo muestra. */}
          </Stack>
          <Stack direction="row" flexWrap="wrap" alignItems="center" columnGap={1} rowGap={0.5}>
            <Typography variant="body2" color="text.secondary" noWrap>
              Resumen general de operaciones · {active?.name || 'Negocio'} · {nombreSucursal}
            </Typography>
            <Box sx={{ display: { xs: 'inline-flex', md: 'none' }, maxWidth: '100%' }}><ActualizadoAl nombre={nombreActualizado} /></Box>
          </Stack>
        </Box>
        <Stack direction="row" alignItems="center" gap={1}>
          <BloqueSeguro nombre="Actividad" compacto><ScopeGestion><ActividadCampana /></ScopeGestion></BloqueSeguro>
          <Tooltip title="Notas">
            <IconButton size="small" onClick={(e) => setAnclaNotas(e.currentTarget)} sx={{ width: 32, height: 32, borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <StickyNote2OutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <MuiPopover open={!!anclaNotas} anchorEl={anclaNotas} onClose={() => setAnclaNotas(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <ScopeGestion><Box sx={{ width: 320, pt: 1 }}><NotasSidebar /></Box></ScopeGestion>
          </MuiPopover>
          {/* Ocultar / mostrar las tarjetas: quedan título, filtros, buscador y la tabla. */}
          <Tooltip title={estado.mostrarTarjetas ? 'Ocultar tarjetas' : 'Mostrar tarjetas'}>
            <IconButton
              size="small" onClick={() => cambiar({ mostrarTarjetas: !estado.mostrarTarjetas })}
              aria-pressed={!estado.mostrarTarjetas}
              sx={{ width: 32, height: 32, borderRadius: 2, border: 1, borderColor: 'divider', ...(estado.mostrarTarjetas ? {} : { bgcolor: 'grey.100', color: 'text.primary' }) }}
            >
              <ViewQuiltOutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          {/* Switch Económica / Financiera, arriba, a la altura del título. */}
          {verPanel && !sinEcoFin && (
          <Tooltip title="Económica: cada gasto en el mes de la factura (o del período, en sueldos). Financiera: en el mes en que se pagó.">
            <ToggleButtonGroup ref={refsTour.ecofin} size="small" exclusive value={estado.modo} onChange={(_, v) => v && cambiar({ modo: v })} sx={sxGrupo}>
              <ToggleButton value="economica">Económica</ToggleButton>
              <ToggleButton value="financiera">Financiera</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
          )}
        </Stack>
      </Stack>

      {/* Barra de filtros (dashboard-filters.tsx): período a la izquierda; ⚙ rubros y Buscar a la
          derecha. La sucursal se elige en el selector global de la app, no acá. */}
      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ pt: 3, pb: 2 }}>
        <Box ref={refsTour.periodo} sx={{ display: 'inline-flex' }}>
        <FiltroPeriodo
          year={estado.year}
          meses={estado.meses}
          minYear={rango.data?.minYear ?? undefined}
          maxYear={rango.data?.maxYear ?? ANIO_ACTUAL}
          onYear={(year) => cambiar({ year })}
          onToggleMes={toggleMes}
          onTodoElAnio={() => cambiar({ meses: [] })}
        />
        </Box>
        {estado.tab !== 'ventas' && (
          <Stack direction="row" alignItems="center" gap={1} sx={{ ml: 'auto' }}>
            {verCarga && <Box ref={refsTour.cargar} sx={{ display: 'inline-flex' }}><BloqueSeguro nombre="Cargar Gastos" compacto><CargarFactura pedido={pedidoCarga} onPedidoAtendido={limpiarPedido} abrirAlMontar={cargarAlEntrar} onAbiertoAlMontar={limpiarCargar} /></BloqueSeguro></Box>}
            {verPanel && !enParaMirar && pdvId != null && (
              <ScopeGestion>
                {!oculto('btn.impagas') && <BloqueSeguro nombre="Impagas" compacto><ImpagasBoton locales={locales ?? []} pdvId={pdvId} /></BloqueSeguro>}
                {!oculto('btn.sin_carga') && <BloqueSeguro nombre="Sin carga" compacto><SinCargaBoton /></BloqueSeguro>}
              </ScopeGestion>
            )}
            {!verPanel || !puedeVer('resultados', 'editar') ? null : estado.tab === 'resultados'
              ? <RubrosConfig key="res" field="visibleEnResultados" title="Rubros visibles en Resultados" />
              : <RubrosConfig key="dash" />}
            {verPanel && <Box component="button" type="button" onClick={() => setBuscadorAbierto(true)} sx={{ ...sxBotonBarra, color: 'text.secondary', '&:hover': { color: 'text.primary', borderColor: 'grey.400' } }}>
              <SearchIcon sx={{ fontSize: 15 }} />
              <span>Buscar</span>
            </Box>}
          </Stack>
        )}
      </Stack>
      {busquedaActiva && <ChipBusqueda busqueda={busquedaActiva} onQuitar={() => setBusqueda(null)} />}
      <BuscadorPanel open={buscadorAbierto} onClose={() => setBuscadorAbierto(false)} onElegir={elegirBusqueda} />

      {/* Tarjetas del último mes cerrado + proyección del que corre. */}
      {verPanel && estado.mostrarTarjetas && <Box ref={refsTour.tarjetas}><BloqueSeguro nombre="las tarjetas del mes"><KpiTarjetas /></BloqueSeguro></Box>}

      {verPanel && <Paper variant="outlined" sx={{ flex: 1, minHeight: 360, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <ToggleButtonGroup
            ref={refsTour.tabs}
            exclusive
            value={estado.tab}
            onChange={(_, v) => v && cambiar({ tab: v })}
            sx={{ ...sxGrupo, bgcolor: 'grey.50', '& .MuiToggleButton-root': { ...sxGrupo['& .MuiToggleButton-root'], height: 30, px: 2, fontSize: 14 }, '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': { bgcolor: 'background.paper', color: 'text.primary', boxShadow: 1 } }}
          >
            {tabsVisibles.map((t) => (
              <ToggleButton key={t.v} value={t.v} disabled={t.proximamente} title={t.proximamente ? 'Próximamente' : undefined}>{t.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          {estado.tab === 'compras' && (
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>ver por</Typography>
              <ToggleButtonGroup exclusive value={estado.agrupacion} onChange={(_, v) => v && cambiar({ agrupacion: v })} sx={sxGrupo}>
                <ToggleButton value="concepto">Concepto</ToggleButton>
                <ToggleButton value="proveedor"><GroupsIcon sx={{ fontSize: 13 }} />Proveedor</ToggleButton>
                <ToggleButton value="insumo" title="Cada gasto por sus insumos (informe 25); sin detalle, por su concepto"><Inventory2Icon sx={{ fontSize: 13 }} />Insumos</ToggleButton>
              </ToggleButtonGroup>
              {/* $ / % ing: cada celda mensual como peso sobre los ingresos de ese mes. */}
              {!sinPct && (
              <ToggleButtonGroup exclusive value={estado.modoCelda} onChange={(_, v) => v && cambiar({ modoCelda: v })} sx={sxGrupo}>
                <ToggleButton value="importe" title="Celdas en pesos">$</ToggleButton>
                <ToggleButton value="pct" title="Celdas como % de los ingresos de cada mes">% ing</ToggleButton>
              </ToggleButtonGroup>
              )}
            </Stack>
          )}
        </Stack>
        {estado.tab === 'compras' && (
          <BloqueSeguro nombre="la tabla de gastos">
          <PivotCompras
            data={compras.data}
            isLoading={compras.isLoading}
            error={compras.error}
            ventas={ventas.data}
            ventasLoading={ventas.isLoading}
            months={columnas}
            agrupacion={estado.agrupacion}
            modoCelda={estado.modoCelda}
            sort={estado.sort}
            onSort={ordenar}
          />
          </BloqueSeguro>
        )}
        {estado.tab === 'ventas' && <BloqueSeguro nombre="los ingresos manuales"><BarraIngresosManuales /></BloqueSeguro>}
        {estado.tab === 'ventas' && (
          <BloqueSeguro nombre="la tabla de ventas">
          <PivotVentas
            data={ventas.data}
            isLoading={ventas.isLoading}
            error={ventas.error}
            year={estado.year}
            months={columnas}
            sort={estado.sort}
            onSort={ordenar}
          />
          </BloqueSeguro>
        )}
        {estado.tab === 'resultados' && (
          <BloqueSeguro nombre="la tabla de resultados">
          <PivotResultados
            operacion={operacion}
            resultados={resultados}
            ventas={ventas}
            months={columnas}
            sort={estado.sort}
            onSort={ordenar}
          />
          </BloqueSeguro>
        )}
      </Paper>}
      <BloqueSeguro nombre="el detalle de compras"><ComprasDetalleModal filter={detalleFilter} onClose={() => setDetalleFilter(null)} /></BloqueSeguro>
      <BloqueSeguro nombre="el detalle de ventas"><VentasDetalleModal filter={ventasFilter} onClose={() => setVentasFilter(null)} /></BloqueSeguro>
      {recPanel.visible && pasoTour && (
        <SpotlightTour key={pasoTour.k} targetRef={refsTour[pasoTour.k]} pose={recPanel.paso === 1 ? 'presenta' : 'senala'} placement="bottom"
          text={pasoTour.t} {...recPanel.props(recPanel.paso)} />
      )}
    </Box>
    </PanelGestionContext.Provider>
  );
}

// Chip del filtro activo del buscador ("Proveedor: X  ×").
function ChipBusqueda({ busqueda, onQuitar }) {
  const t = TIPOS[TIPO_DE_PARAM[busqueda.param]];
  return (
    <Box sx={{ display: 'flex', mt: -1, mb: 2 }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, pl: 1, pr: 0.5, py: 0.25, borderRadius: 999, fontSize: 12, border: 1, borderColor: t.bg, bgcolor: t.bg }}>
        <Box component="span" sx={{ fontWeight: 500, color: t.color }}>{t.label}:</Box>
        <Box component="span" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{busqueda.label}</Box>
        <IconButton size="small" aria-label={'Quitar filtro ' + t.label} onClick={onQuitar} sx={{ p: 0.25, color: t.color }}>
          <CloseIcon sx={{ fontSize: 11 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
