// src/componentes/gestion/PivotVentas.jsx
// Pestaña Ventas del Panel de gestion, igual a lazarillo_gestion/components/dashboard/
// ventas-pivot-table.tsx: tipo → forma de cobro, por mes, con "Total <año>" al pie.
// Todavía no (paso 4, lo editable): detalle al clickear y la barra de ingresos manuales.

import React, { useMemo, useState, useCallback } from 'react';
import { Box, Table, TableHead, TableBody, TableFooter, TableRow, TableCell } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { flattenRows, sortPivotRows } from '@/gestion/pivotUtils';
import { fmtARS, normalize } from '@/gestion/formato';
import { MUTED, sxStickyNombre, sxNum, sxTablaPanel } from '@/gestion/estilos';
import { PivotLoading, PivotError, PivotEmpty, Expansor, CabeceraOrden } from './piezasPivot';

export default function PivotVentas({ data, isLoading, error, year, months, sort, onSort }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = useCallback((id) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const sortedRows = useMemo(() => (data ? sortPivotRows(data.rows, sort.col, sort.dir) : []), [data, sort]);
  const flatRows = useMemo(
    () => (data ? flattenRows({ rows: sortedRows, columnTotals: data.columnTotals, grandTotal: data.grandTotal }, expanded, 2) : []),
    [data, sortedRows, expanded]
  );
  const rubroIds = useMemo(() => new Set(sortedRows.map((r) => r.id)), [sortedRows]);
  // Click derecho: en un tipo cierra todo; en una forma de cobro cierra las formas de cobro.
  const cerrar = (e, soloTipos) => {
    if (navigator.maxTouchPoints > 0) return;
    e.preventDefault();
    setExpanded((prev) => (soloTipos ? new Set([...prev].filter((id) => rubroIds.has(id))) : new Set()));
  };

  if (isLoading) return <PivotLoading />;
  if (error) return <PivotError />;
  if (!data || data.rows.length === 0) return <PivotEmpty />;

  return (
    <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <Table size="small" sx={sxTablaPanel}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...sxStickyNombre(MUTED), top: 0, zIndex: 3, px: 2, py: 1.5, fontWeight: 500, color: 'text.secondary', minWidth: { xs: 150, md: 240 }, whiteSpace: 'nowrap' }}>
              Tipo / Forma de cobro
            </TableCell>
            {months.map((mes) => (
              <CabeceraOrden key={mes} col={mes} sortCol={sort.col} sortDir={sort.dir} onSort={onSort} />
            ))}
            <CabeceraOrden col="total" label="Total" total sortCol={sort.col} sortDir={sort.dir} onSort={onSort} />
          </TableRow>
        </TableHead>
        <TableBody>
          {flatRows.map((item) => {
            const d = item.data;
            if (item.type === 'rubro') {
              return (
                <TableRow
                  key={d.id}
                  onContextMenu={(e) => cerrar(e, false)}
                  sx={{ bgcolor: (t) => alpha(t.palette.grey[100], 0.25), '& td': { fontWeight: 600 }, '&:hover': { bgcolor: (t) => alpha(t.palette.grey[100], 0.5) } }}
                >
                  <TableCell sx={{ ...sxStickyNombre(MUTED), px: 2, py: 1.25 }}>
                    <Expansor abierto={expanded.has(d.id)} onClick={() => toggle(d.id)}>{normalize(d.nombre)}</Expansor>
                  </TableCell>
                  {months.map((mes) => <TableCell key={mes} sx={{ ...sxNum, px: 1.5, py: 1.25 }}>{fmtARS(d.values[mes])}</TableCell>)}
                  <TableCell sx={{ ...sxNum, px: 2, py: 1.25, fontSize: 15 }}>{fmtARS(d.rowTotal)}</TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow key={d.id} hover onContextMenu={(e) => cerrar(e, true)}>
                <TableCell sx={{ ...sxStickyNombre(), px: 2, pl: 7, py: 1, color: 'text.secondary' }}>{normalize(d.nombre)}</TableCell>
                {months.map((mes) => <TableCell key={mes} sx={{ ...sxNum, px: 1.5, py: 1, color: 'text.secondary' }}>{fmtARS(d.values[mes])}</TableCell>)}
                <TableCell sx={{ ...sxNum, px: 2, py: 1, color: 'text.secondary', fontWeight: 600, fontSize: 14 }}>{fmtARS(d.rowTotal)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow sx={{ '& td': { bgcolor: MUTED, fontWeight: 600, fontSize: 15, color: 'text.primary', borderTop: 2, borderTopColor: 'divider', py: 1.5 } }}>
            <TableCell sx={{ ...sxStickyNombre(MUTED), px: 2 }}>Total {year}</TableCell>
            {months.map((mes) => <TableCell key={mes} sx={{ ...sxNum, px: 1.5 }}>{fmtARS(data.columnTotals[mes])}</TableCell>)}
            <TableCell sx={{ ...sxNum, px: 2, color: 'primary.main !important' }}>{fmtARS(data.grandTotal)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Box>
  );
}
