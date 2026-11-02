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
 * Bloque "Operación" (KpiBlock de gestion): Ingresos (mapa de calor), Egresos, Resultado OP y
 * Gastos / Ventas, por mes.
 * Pendiente (paso 3, con sus APIs): proyección del mes en curso, "lo que falta cargar" en los
 * meses cerrados y la fila de Punto de equilibrio.
 */
export function KpiBlock({ months, ingresosPorMes, egresosPorMes, ingresosTotal, egresosTotal, ingresosReady }) {
  const ingresosVisibles = months.map((m) => ingresosPorMes[m]).filter((v) => v != null && v > 0);
  const minIngresos = ingresosVisibles.length ? Math.min(...ingresosVisibles) : 0;
  const maxIngresos = ingresosVisibles.length ? Math.max(...ingresosVisibles) : 1;
  const colorRatio = (ratio) => (ratio > 90 ? RESULT_COLORS.negative : ratio > 60 ? RESULT_COLORS.neutral : RESULT_COLORS.positive);
  const celdaNombre = (texto, sx) => (
    <TableCell sx={{ ...sxStickyNombre(), px: 2, py: 0.75, whiteSpace: 'nowrap', ...sx }}>{texto}</TableCell>
  );
  const celda = (key, contenido, sx) => <TableCell key={key} sx={{ ...sxNum, px: 1.5, py: 0.75, ...sx }}>{contenido}</TableCell>;

  const resTotal = (ingresosTotal ?? 0) - egresosTotal;
  const ratioTotal = (ingresosTotal ?? 0) > 0 ? (egresosTotal / ingresosTotal) * 100 : null;

  return (
    <>
      <TableRow>
        {celdaNombre('Ingresos', { fontSize: 15, fontWeight: 600, color: 'text.secondary' })}
        {months.map((mes) => {
          const val = ingresosPorMes[mes];
          const hasVal = val != null && val > 0;
          const fill = ingresosReady && hasVal ? heatmapFill(val, minIngresos, maxIngresos) : null;
          return celda(mes, fmtARS(val), {
            fontSize: 15, fontWeight: 600,
            ...(fill ? { bgcolor: fill.background, color: fill.foreground } : val != null ? { color: RESULT_COLORS.positive } : { color: 'text.disabled' }),
          });
        })}
        {celda('t', fmtARS(ingresosTotal), { fontSize: 15, fontWeight: 600, px: 2, color: RESULT_COLORS.positive })}
        <TableCell />
      </TableRow>
      <TableRow>
        {celdaNombre('Egresos', { fontWeight: 500, color: 'text.secondary' })}
        {months.map((mes) => celda(mes, fmtARS(egresosPorMes[mes]), { color: 'text.secondary' }))}
        {celda('t', fmtARS(egresosTotal), { fontWeight: 500, px: 2, color: 'text.secondary' })}
        <TableCell />
      </TableRow>
      <TableRow>
        {celdaNombre('Resultado OP', { fontWeight: 700 })}
        {months.map((mes) => {
          const ing = ingresosPorMes[mes];
          const egr = egresosPorMes[mes];
          const noData = ing == null && egr == null;
          const res = (ing ?? 0) - (egr ?? 0);
          return celda(mes, noData ? '—' : fmtARS(res), {
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
          const ratio = ing > 0 ? (egr / ing) * 100 : null;
          return celda(mes, ratio === null ? '—' : `${ratio.toFixed(1)}%`, {
            fontWeight: 500, color: ratio === null ? 'text.disabled' : colorRatio(ratio),
          });
        })}
        {celda('t', ratioTotal !== null ? `${ratioTotal.toFixed(1)}%` : '—', {
          fontWeight: 600, px: 2, color: ratioTotal === null ? 'text.disabled' : colorRatio(ratioTotal),
        })}
        <TableCell />
      </TableRow>
    </>
  );
}
