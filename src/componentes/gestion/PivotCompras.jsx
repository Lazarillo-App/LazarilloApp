// src/componentes/gestion/PivotCompras.jsx
// Pestaña Compras del Panel de gestion: pivot rubro → concepto → registro por mes.
// Portado de lazarillo_gestion (components/dashboard/pivot-table-por-concepto.tsx,
// pivot-table-por-proveedor.tsx, pivot-rubro-row.tsx, pivot-table-head/foot.tsx,
// composicion-tooltip.tsx) a MUI.
//
// Vistas: por Concepto (rubro → concepto → registro), por Insumo (mismo árbol, el 2do nivel
// es el insumo o el concepto si el gasto no trae detalle) y por Proveedor
// (rubro → proveedor → concepto → registro).
// Todavía no: fila de ingresos y % sobre ventas (con la pestaña Ventas), detalle al clickear,
// apertura de gastos y carga desde una celda (con lo editable).

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Table, TableHead, TableBody, TableFooter, TableRow, TableCell, TableSortLabel,
  IconButton, Tooltip, Typography, Button, CircularProgress, Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import {
  hasValue, sortPivotRows, flattenRows, sortPivotRowsPorProveedor, flattenRowsPorProveedor, TANDA_PIVOT,
} from '@/gestion/pivotUtils';
import { MESES, fmtARS, normalize, fechaCorta } from '@/gestion/formato';

const ANCHO_NOMBRE = 320;

// Celda de nombre fija a la izquierda (como el sticky de gestion).
const sxNombre = (nivel, fondo) => ({
  position: 'sticky', left: 0, zIndex: 1, bgcolor: fondo || 'background.paper',
  minWidth: ANCHO_NOMBRE, maxWidth: 480, pl: 1 + nivel * 2.5,
  boxShadow: (t) => `1px 0 0 0 ${t.palette.divider}`,
});
const sxNum = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', px: 1.5 };

// Tooltip del reparto de la apertura (100% del gasto y lo que fue a cada destino).
function ComposicionTooltip({ comp, children }) {
  if (!comp) return children;
  return (
    <Tooltip
      arrow
      title={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, fontSize: 12 }}>
          <b>100% · {fmtARS(comp.total)}</b>
          {comp.destinos.map((d, i) => (
            <span key={i}>{Math.round(d.pct)}% {d.nombre} {fmtARS(d.importe)}</span>
          ))}
        </Box>
      }
    >
      {children}
    </Tooltip>
  );
}

function Expansor({ abierto, onClick, nivel, children, negrita }) {
  return (
    <Box
      onClick={onClick}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', fontWeight: negrita ? 700 : 500, minWidth: 0 }}
    >
      {abierto ? <ExpandMoreIcon sx={{ fontSize: 18 - nivel }} /> : <ChevronRightIcon sx={{ fontSize: 18 - nivel }} />}
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</Box>
    </Box>
  );
}

export default function PivotCompras({ data, isLoading, error, months, agrupacion, sort, onSort }) {
  const porProveedor = agrupacion === 'proveedor';
  const porInsumo = agrupacion === 'insumo';
  const [expanded, setExpanded] = useState(() => new Set());
  // Registros visibles por concepto (de a TANDA_PIVOT, como en gestion). "Ver todos" = Infinity.
  const [mostrar, setMostrar] = useState(() => new Map());

  const toggle = useCallback((id) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);
  const verMas = useCallback((conceptoId, todos) => {
    setMostrar((prev) => {
      const n = new Map(prev);
      n.set(conceptoId, todos ? Infinity : (prev.get(conceptoId) ?? TANDA_PIVOT) + TANDA_PIVOT);
      return n;
    });
  }, []);

  // Al cambiar de vista se arranca cerrado. Vista Insumos: abiertos los rubros que tienen
  // insumos (Mercaderías), como en gestion.
  const abiertosInsumo = useRef(false);
  useEffect(() => { setExpanded(new Set()); setMostrar(new Map()); abiertosInsumo.current = false; }, [agrupacion]);
  useEffect(() => {
    if (!porInsumo || abiertosInsumo.current || !data) return;
    abiertosInsumo.current = true;
    setExpanded(new Set(data.rows.filter((r) => r.children.some((c) => c.conceptoCodigo?.startsWith('ins:'))).map((r) => r.id)));
  }, [porInsumo, data]);

  const filas = useMemo(() => {
    if (!data) return [];
    if (porProveedor) {
      const rows = sortPivotRowsPorProveedor(data.rows, sort.col, sort.dir);
      return flattenRowsPorProveedor({ ...data, rows }, expanded);
    }
    const rows = sortPivotRows(data.rows, sort.col, sort.dir);
    return flattenRows({ rows, columnTotals: data.columnTotals, grandTotal: data.grandTotal }, expanded, 3, mostrar);
  }, [data, porProveedor, sort, expanded, mostrar]);

  if (isLoading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={28} /></Box>;
  }
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>No se pudo cargar el panel: {String(error.message || error)}</Alert>;
  }
  if (!data || data.rows.length === 0) {
    return <Typography sx={{ p: 4, textAlign: 'center' }} color="text.secondary">No hay compras para los filtros elegidos.</Typography>;
  }

  const celdas = (values, { onComp, peso } = {}) => months.map((mes) => {
    const v = values[mes];
    const celda = (
      <TableCell key={mes} sx={{ ...sxNum, fontWeight: peso, color: hasValue(v) ? 'text.primary' : 'text.disabled' }}>
        {hasValue(v) || (v ?? 0) < 0 ? fmtARS(v) : '—'}
      </TableCell>
    );
    return onComp ? <ComposicionTooltip key={mes} comp={onComp[mes]}>{celda}</ComposicionTooltip> : celda;
  });

  const etiquetaRegistro = (r, nombre) =>
    [fechaCorta(r.fecha), nombre != null ? normalize(nombre) : null, r.observac || null, fmtARS(r.importe)].filter(Boolean).join(' · ');

  const filaRegistro = (r, nivel, nombre) => (
    <TableRow key={r.id} hover sx={r.hasManualOverride ? { bgcolor: (t) => alpha(t.palette.warning.main, 0.08) } : undefined}>
      <TableCell sx={{ ...sxNombre(nivel), fontSize: 12, color: 'text.secondary', py: 0.5 }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          {r.hasManualOverride && <Tooltip title="Editado a mano"><Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} /></Tooltip>}
          {r.distribucionId != null && <Tooltip title="Parte de un gasto repartido (apertura)"><Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'info.main' }} /></Tooltip>}
          {etiquetaRegistro(r, nombre)}
        </Box>
      </TableCell>
      {months.map((mes) => (
        <TableCell key={mes} sx={{ ...sxNum, fontSize: 12, color: 'text.secondary', py: 0.5 }}>
          {r.values[mes] != null ? fmtARS(r.values[mes]) : ''}
        </TableCell>
      ))}
      <TableCell sx={{ ...sxNum, fontSize: 12, color: 'text.secondary', py: 0.5 }}>{fmtARS(r.rowTotal)}</TableCell>
    </TableRow>
  );

  const renderFila = (item) => {
    const d = item.data;
    switch (item.type) {
      case 'rubro':
      case 'rubroTop':
        return (
          <TableRow key={d.id} sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ ...sxNombre(0, 'grey.100'), fontWeight: 700 }}>
              <Expansor abierto={expanded.has(d.id)} onClick={() => toggle(d.id)} nivel={0} negrita>{d.nombre}</Expansor>
            </TableCell>
            {celdas(d.values, { peso: 700 })}
            <TableCell sx={{ ...sxNum, fontWeight: 700 }}>{fmtARS(d.rowTotal)}</TableCell>
          </TableRow>
        );
      case 'concepto': {
        const insumo = porInsumo && d.conceptoCodigo?.startsWith('ins:');
        return (
          <TableRow key={d.id} hover>
            <TableCell sx={sxNombre(1)}>
              <Expansor abierto={expanded.has(d.id)} onClick={() => toggle(d.id)} nivel={1}>
                {insumo ? normalize(d.nombre) : d.nombre}
                {porInsumo && !insumo && (
                  <Box component="span" sx={{ ml: 1, px: 0.75, border: 1, borderColor: 'divider', borderRadius: 4, fontSize: 10, color: 'text.secondary' }}>concepto</Box>
                )}
              </Expansor>
            </TableCell>
            {celdas(d.values, { onComp: d.composicion })}
            <TableCell sx={{ ...sxNum, fontWeight: 600 }}>{fmtARS(d.rowTotal)}</TableCell>
          </TableRow>
        );
      }
      case 'proveedorSub':
        return (
          <TableRow key={d.id} hover>
            <TableCell sx={sxNombre(1)}>
              <Expansor abierto={expanded.has(d.id)} onClick={() => toggle(d.id)} nivel={1}>{normalize(d.nombre)}</Expansor>
            </TableCell>
            {celdas(d.values, { onComp: d.composicion })}
            <TableCell sx={{ ...sxNum, fontWeight: 600 }}>{fmtARS(d.rowTotal)}</TableCell>
          </TableRow>
        );
      case 'conceptoSub':
        return (
          <TableRow key={d.id} hover>
            <TableCell sx={sxNombre(2)}>
              <Expansor abierto={expanded.has(d.id)} onClick={() => toggle(d.id)} nivel={2}>{d.nombre}</Expansor>
            </TableCell>
            {celdas(d.values, { onComp: d.composicion })}
            <TableCell sx={sxNum}>{fmtARS(d.rowTotal)}</TableCell>
          </TableRow>
        );
      case 'proveedor':
        return filaRegistro(d, 3, d.nombre);
      case 'linea':
        return filaRegistro(d, 4, null);
      case 'mas':
        return (
          <TableRow key={d.id}>
            <TableCell sx={{ ...sxNombre(3), fontSize: 12, py: 0.5 }} colSpan={1}>
              Mostrando {d.mostrados} de {d.total} registros ·{' '}
              <Button size="small" onClick={() => verMas(d.conceptoId, false)}>Ver {Math.min(TANDA_PIVOT, d.total - d.mostrados)} más</Button>
              <Button size="small" onClick={() => verMas(d.conceptoId, true)}>Ver todos</Button>
            </TableCell>
            <TableCell colSpan={months.length + 1} />
          </TableRow>
        );
      default:
        return null;
    }
  };

  const cabeceraOrden = (col, label) => (
    <TableSortLabel
      active={sort.col === col}
      direction={sort.col === col ? sort.dir : 'desc'}
      onClick={() => onSort(col)}
    >
      {label}
    </TableSortLabel>
  );

  return (
    <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <Table size="small" stickyHeader sx={{ '& td, & th': { borderBottomColor: 'divider' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...sxNombre(0, 'background.paper'), zIndex: 3, fontWeight: 700 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {porProveedor ? 'Rubro / Proveedor / Concepto' : porInsumo ? 'Rubro / Insumo' : 'Rubro / Concepto'}
                <Tooltip title="Cerrar todo">
                  <IconButton size="small" onClick={() => setExpanded(new Set())}><UnfoldLessIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
            </TableCell>
            {months.map((mes) => (
              <TableCell key={mes} sx={{ ...sxNum, fontWeight: 700 }}>{cabeceraOrden(mes, MESES[mes - 1])}</TableCell>
            ))}
            <TableCell sx={{ ...sxNum, fontWeight: 700 }}>{cabeceraOrden('total', 'Total')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{filas.map(renderFila)}</TableBody>
        <TableFooter>
          <TableRow sx={{ '& td': { position: 'sticky', bottom: 0, bgcolor: 'background.paper', fontWeight: 700, color: 'text.primary', fontSize: 14 } }}>
            <TableCell sx={{ ...sxNombre(0, 'background.paper'), zIndex: 3 }}>Total egresos</TableCell>
            {months.map((mes) => <TableCell key={mes} sx={sxNum}>{fmtARS(data.columnTotals[mes] ?? 0)}</TableCell>)}
            <TableCell sx={sxNum}>{fmtARS(data.grandTotal)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Box>
  );
}
