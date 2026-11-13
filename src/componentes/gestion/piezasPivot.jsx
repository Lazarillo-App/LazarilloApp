// src/componentes/gestion/piezasPivot.jsx
// Piezas compartidas de las tablas del Panel (portado de lazarillo_gestion:
// pivot-states.tsx, section-divider.tsx, kpi-block.tsx, sticky-card-cell.tsx y los
// encabezados ordenables de pivot-table-head.tsx / ventas-pivot-table.tsx).

import React from 'react';
import { Box, TableRow, TableCell, CircularProgress, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { MESES, fmtARS } from '@/gestion/formato';
import { RESULT_COLORS, heatmapFill } from '@/gestion/resultadosCalc';
import { MUTED, sxStickyNombre, sxNum } from '@/gestion/estilos';
import { equilibrioMes, equilibrioProyectado, pctVariableReciente } from '@/gestion/equilibrio';
import { useEgresosProyeccion, useEquilibrio, useProyeccionIngresos } from '@/gestion/hooksPanel';
import { usePanelGestion } from '@/gestion/panelContext';
import { EquilibrioTip, ProyeccionEgresos, ProyeccionIngresos, TipProyectado } from './tooltipsProyeccion';
import { EquilibrioConfigModal } from './EquilibrioConfig';

export function PivotLoading() {
  return <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={32} /></Box>;
}
export function PivotError() {
  return <Typography color="error" sx={{ py: 8, textAlign: 'center', fontSize: 14 }}>Error al cargar los datos.</Typography>;
}
export function PivotEmpty() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 8, color: 'text.secondary' }}>
      <SearchOffIcon sx={{ fontSize: 32, opacity: 0.4 }} />
      <Typography fontSize={14}>Sin datos para los filtros seleccionados.</Typography>
    </Box>
  );
}

// Botón expandir/colapsar de la 1ª columna (ExpandableButton de gestion).
export function Expansor({ abierto, onClick, children, indent = 0 }) {
  return (
    <Box onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', pl: indent, minWidth: 0 }}>
      {abierto ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</Box>
    </Box>
  );
}

// Encabezado de mes / Total ordenable (flecha llena = columna activa, tenue = el resto).
export function CabeceraOrden({ col, label, sortCol, sortDir, onSort, total }) {
  const activa = sortCol === col;
  const Flecha = sortDir === 'desc' ? KeyboardArrowDownIcon : KeyboardArrowUpIcon;
  return (
    <TableCell
      sx={{
        ...sxNum, position: 'sticky', top: 0, zIndex: 2, bgcolor: MUTED, py: 1.5, px: total ? 2 : 1.5,
        minWidth: total ? 110 : 90, fontWeight: total ? 600 : 500, fontSize: total ? 15 : 14,
      }}
    >
      <Box
        component="button"
        onClick={() => onSort(col)}
        sx={{
          all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.5,
          color: activa ? 'text.primary' : 'text.secondary', '&:hover': { color: 'text.primary' },
        }}
      >
        {label ?? MESES[col - 1]}
        <Flecha sx={{ fontSize: 14, opacity: activa ? 1 : 0.4 }} />
      </Box>
    </TableCell>
  );
}

// Banda "Gastos por rubro" (SectionDivider de gestion).
export function SectionDivider({ label, icon: Icon, colSpan }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ bgcolor: MUTED, pt: 0.75, pb: 0.75, px: 0, borderBottom: 0 }}>
        <Box sx={{ ...sxStickyNombre(MUTED), display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 2, fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>
          {Icon && <Icon sx={{ fontSize: 14 }} />}
          {label}
        </Box>
      </TableCell>
    </TableRow>
  );
}

/**
 * Bloque "Operación" (kpi-block.tsx de gestion): Ingresos (mapa de calor), Egresos, Resultado OP,
 * Gastos / Ventas y Punto de equilibrio, por mes.
 * Las celdas muestran SIEMPRE lo real; la proyección del mes en curso va en el tooltip, también en
 * Resultado OP y Gastos / Ventas. "Lo que falta cargar" de los meses cerrados llega con Sin carga.
 */
export function KpiBlock({ months, ingresosPorMes, egresosPorMes, ingresosTotal, egresosTotal, ingresosReady, sinTotal = false }) {
  const { year, abrirVentas } = usePanelGestion();
  // Mes con ventas incompletas → tooltip con la proyección de cierre. Para el color del mapa de
  // calor ese mes cuenta con lo proyectado, no con lo facturado a medias.
  const proy = useProyeccionIngresos();
  const mesProy = proy && proy.anio === year ? proy.mes : null;
  const valorHeatmap = (m) => (m === mesProy && ingresosPorMes[m] > 0 ? proy.proyeccion : ingresosPorMes[m]);
  const ingresosVisibles = months.map(valorHeatmap).filter((v) => v != null && v > 0);
  const minIngresos = ingresosVisibles.length ? Math.min(...ingresosVisibles) : 0;
  const maxIngresos = ingresosVisibles.length ? Math.max(...ingresosVisibles) : 1;
  const { proyectado: egrProy, ventasProy, faltan } = useEgresosProyeccion(egresosPorMes);
  const esProy = (m) => !!egrProy && egrProy.mes === m && ventasProy != null;
  // Ingresos y egresos "completos" del mes para los tooltips (proyectados en el mes en curso).
  const completo = (m) => {
    if (esProy(m)) return { ing: ventasProy, egr: egrProy.total, tipo: 'proy' };
    if (faltan[m] && egresosPorMes[m] != null) return { ing: ingresosPorMes[m] ?? 0, egr: egresosPorMes[m] + faltan[m].total, tipo: 'falta' };
    return null;
  };

  // Punto de equilibrio: fila debajo de Gastos / Ventas, solo en la Económica.
  const { data: eqData } = useEquilibrio();
  const conEquilibrio = !!eqData;
  const varDe = (m) => eqData?.porMes[m]?.total ?? 0;
  const eqCerrado = (m) => (ingresosPorMes[m] > 0 && egresosPorMes[m] != null ? equilibrioMes(ingresosPorMes[m], egresosPorMes[m], varDe(m)) : null);
  const eqProyectado = (() => {
    if (!eqData || !proy || !egrProy || ventasProy == null || !esProy(egrProy.mes)) return null;
    const previos = months.filter((m) => m < egrProy.mes && ingresosPorMes[m] > 0).slice(-3);
    const pct = pctVariableReciente(previos.map((m) => ({ ventas: ingresosPorMes[m], variable: varDe(m) })));
    return pct == null ? null : equilibrioProyectado({ ventasProy, egresosProy: egrProy.total, pctVariable: pct, facturado: proy.facturado, diasRestantes: proy.diasRestantes });
  })();
  // Mes de referencia del ⚙: el último cerrado con ventas y gastos (el que se proyecta no).
  const mesRef = [...months].reverse().find((m) => m !== mesProy && ingresosPorMes[m] > 0 && egresosPorMes[m] != null) ?? null;
  const nombresVariables = (eqData?.variables ?? []).map((v) => `${v.nombre.trim().toLowerCase().replace(/^\S/, (c) => c.toUpperCase())}${v.pct < 100 ? ` (${v.pct}%)` : ''}`);

  const colorRatio = (ratio) => (ratio > 90 ? RESULT_COLORS.negative : ratio > 60 ? RESULT_COLORS.neutral : RESULT_COLORS.positive);
  const celdaNombre = (texto, sx) => (
    <TableCell sx={{ ...sxStickyNombre(), px: 2, py: 0.75, whiteSpace: 'nowrap', ...sx }}>{texto}</TableCell>
  );
  // Columna Total oculta para el rol (sinTotal): la celda 't' no se dibuja.
  const celda = (key, contenido, sx, onClick) => (sinTotal && key === 't' ? null : <TableCell key={key} onClick={onClick} sx={{ ...sxNum, px: 1.5, py: 0.75, ...sx, ...(onClick ? { cursor: 'pointer', '&:hover': { opacity: 0.75 } } : {}) }}>{contenido}</TableCell>);

  const resTotal = (ingresosTotal ?? 0) - egresosTotal;
  const ratioTotal = (ingresosTotal ?? 0) > 0 ? (egresosTotal / ingresosTotal) * 100 : null;

  return (
    <>
      <TableRow>
        {celdaNombre('Ingresos', { fontSize: 15, fontWeight: 600, color: 'text.secondary' })}
        {months.map((mes) => {
          const val = ingresosPorMes[mes];
          const hasVal = val != null && val > 0;
          const fill = ingresosReady && hasVal ? heatmapFill(valorHeatmap(mes), minIngresos, maxIngresos) : null;
          return celda(mes, mesProy === mes && hasVal ? <ProyeccionIngresos p={proy}>{fmtARS(val)}</ProyeccionIngresos> : fmtARS(val), {
            fontSize: 15, fontWeight: 600,
            ...(fill ? { bgcolor: fill.background, color: fill.foreground } : val != null ? { color: RESULT_COLORS.positive } : { color: 'text.disabled' }),
          }, hasVal ? () => abrirVentas({ mes }) : undefined);
        })}
        {celda('t', fmtARS(ingresosTotal), { fontSize: 15, fontWeight: 600, px: 2, color: RESULT_COLORS.positive }, ingresosTotal ? () => abrirVentas({}) : undefined)}
        <TableCell />
      </TableRow>
      <TableRow>
        {celdaNombre('Egresos', { fontWeight: 500, color: 'text.secondary' })}
        {months.map((mes) => celda(mes, esProy(mes)
          ? <ProyeccionEgresos e={egrProy} anio={year} corte={null} ventasProy={ventasProy}>{fmtARS(egresosPorMes[mes])}</ProyeccionEgresos>
          : fmtARS(egresosPorMes[mes]), { color: 'text.secondary' }))}
        {celda('t', fmtARS(egresosTotal), { fontWeight: 500, px: 2, color: 'text.secondary' })}
        <TableCell />
      </TableRow>
      <TableRow>
        {celdaNombre('Resultado OP', { fontWeight: 700 })}
        {months.map((mes) => {
          const ing = ingresosPorMes[mes];
          const egr = egresosPorMes[mes];
          const comp = completo(mes);
          const noData = ing == null && egr == null;
          const res = (ing ?? 0) - (egr ?? 0);
          return celda(mes, noData ? '—' : comp ? (
            <TipProyectado
              titulo={comp.tipo === 'proy' ? 'Resultado OP · proyección de cierre' : 'Resultado OP · con lo que falta cargar'}
              grande={fmtARS(comp.ing - comp.egr)} negativo={comp.ing - comp.egr < 0}
              filas={[[comp.tipo === 'proy' ? 'Ventas proyectadas' : 'Ventas', fmtARS(comp.ing)], [comp.tipo === 'proy' ? 'Egresos proyectados' : 'Egresos + lo que falta cargar', `− ${fmtARS(comp.egr)}`], ['Hoy (real)', fmtARS(res)]]}
            >
              {fmtARS(res)}
            </TipProyectado>
          ) : fmtARS(res), {
            fontWeight: 600, color: noData ? 'text.disabled' : res < 0 ? RESULT_COLORS.negative : RESULT_COLORS.positive,
          });
        })}
        {celda('t', fmtARS(resTotal), { fontWeight: 700, px: 2, color: resTotal < 0 ? RESULT_COLORS.negative : RESULT_COLORS.positive })}
        <TableCell />
      </TableRow>
      <TableRow>
        {celdaNombre('Gastos / Ventas', { fontWeight: 500, color: 'text.secondary' })}
        {months.map((mes) => {
          const ing = ingresosPorMes[mes] ?? 0;
          const egr = egresosPorMes[mes] ?? 0;
          const comp = completo(mes);
          const ratio = ing > 0 ? (egr / ing) * 100 : null;
          return celda(mes, ratio === null ? '—' : comp && comp.ing > 0 ? (
            <TipProyectado
              titulo={comp.tipo === 'proy' ? 'Gastos / Ventas · proyección de cierre' : 'Gastos / Ventas · con lo que falta cargar'}
              grande={`${((comp.egr / comp.ing) * 100).toFixed(1)}%`} filas={[['Hoy (real)', `${ratio.toFixed(1)}%`]]}
            >
              {ratio.toFixed(1)}%
            </TipProyectado>
          ) : `${ratio.toFixed(1)}%`, {
            fontWeight: 500, color: ratio === null ? 'text.disabled' : colorRatio(ratio),
          });
        })}
        {celda('t', ratioTotal !== null ? `${ratioTotal.toFixed(1)}%` : '—', {
          fontWeight: 600, px: 2, color: ratioTotal === null ? 'text.disabled' : colorRatio(ratioTotal),
        })}
        <TableCell />
      </TableRow>
      {conEquilibrio && (
        <TableRow>
          {celdaNombre(
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
              Punto de equilibrio
              {mesRef != null && <EquilibrioConfigModal anio={year} mes={mesRef} ventasMes={ingresosPorMes[mesRef]} egresosMes={egresosPorMes[mesRef]} />}
            </Box>,
            { fontWeight: 500, color: 'text.secondary' },
          )}
          {months.map((mes) => {
            const p = eqProyectado && egrProy?.mes === mes ? eqProyectado : null;
            // El mes en curso solo con la proyección (con gastos a medio cargar el equilibrio no dice nada).
            const e = p ?? (mes === mesProy ? null : eqCerrado(mes));
            return celda(mes, e?.equilibrio != null
              ? <EquilibrioTip e={e} p={p} anio={year} mes={mes} detalle={eqData.porMes[mes]?.detalle ?? []} variables={nombresVariables}>{fmtARS(e.equilibrio)}</EquilibrioTip>
              : '—', {
              fontWeight: 500,
              color: e?.equilibrio == null ? 'text.disabled' : e.diferencia < 0 ? RESULT_COLORS.negative : 'text.secondary',
            });
          })}
          {celda('t', '—', { px: 2, color: 'text.disabled' })}
          <TableCell />
        </TableRow>
      )}
    </>
  );
}
