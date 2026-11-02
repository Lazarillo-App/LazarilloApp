// src/componentes/gestion/PivotCompras.jsx
// Pestaña Compras del Panel de gestion, igual a lazarillo_gestion:
// pivot-table-por-concepto.tsx, pivot-table-por-proveedor.tsx, pivot-table-head.tsx (Operación +
// meses + Total + % ing/egr), kpi-block.tsx, pivot-rubro-row.tsx, pivot-table-foot.tsx,
// composicion-tooltip.tsx y fila-mas-registros.tsx — a MUI.
//
// Vistas: por Concepto (rubro → concepto → registro), por Insumos (mismo árbol, el 2do nivel es
// el insumo o el concepto si el gasto no trae detalle) y por Proveedor
// (rubro → proveedor → concepto → registro).
// Todavía no (paso 4, lo editable): detalle al clickear una celda, apertura de gastos y carga
// desde una celda vacía. Proyección y punto de equilibrio del bloque Operación: paso 3.

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Box, Table, TableHead, TableBody, TableFooter, TableRow, TableCell, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import LayersIcon from '@mui/icons-material/Layers';
import {
  sortPivotRows, flattenRows, sortPivotRowsPorProveedor, flattenRowsPorProveedor, TANDA_PIVOT,
} from '@/gestion/pivotUtils';
import { fmtARS, normalize, fechaCorta } from '@/gestion/formato';
import { computePctCelda, computePctLabel } from '@/gestion/resultadosCalc';
import { MUTED, sxStickyNombre, sxNum } from '@/gestion/estilos';
import {
  PivotLoading, PivotError, PivotEmpty, Expansor, CabeceraOrden, SectionDivider, KpiBlock,
} from './piezasPivot';

// Rubro "Gastos En Personal": los "proveedores" suelen ser personas de planilla con nombres
// ambiguos — ahí se antepone el código del ERP (constants.ts de gestion).
const RUBRO_GASTOS_EN_PERSONAL_CODIGO = '3';

// Tooltip de prorrateo (composicion-tooltip.tsx): 100% del gasto y lo que fue a cada destino.
function ComposicionTooltip({ comp, children }) {
  if (!comp) return children;
  return (
    <Tooltip
      title={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25, fontSize: 12 }}>
          <Box sx={{ fontWeight: 500 }}>100% · {fmtARS(comp.total)}</Box>
          {comp.destinos.map((d, i) => (
            <Box key={i} sx={{ opacity: 0.75 }}>{Math.round(d.pct)}% {d.nombre} {fmtARS(d.importe)}</Box>
          ))}
        </Box>
      }
    >
      {children}
    </Tooltip>
  );
}

// Fila al pie de un concepto abierto con muchos registros (fila-mas-registros.tsx).
function FilaMasRegistros({ fila, onVerMas }) {
  const fmt = (n) => n.toLocaleString('es-AR');
  const quedan = fila.total - fila.mostrados;
  const btn = { all: 'unset', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, '&:hover': { color: 'text.primary' } };
  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
      <span>Se muestran {fmt(fila.mostrados)} de {fmt(fila.total)}</span>
      <span aria-hidden>·</span>
      {quedan > TANDA_PIVOT && (
        <>
          <Box component="button" type="button" sx={btn} onClick={() => onVerMas(fila.conceptoId, false)}>Ver {TANDA_PIVOT} más</Box>
          <span aria-hidden>·</span>
        </>
      )}
      <Box component="button" type="button" sx={btn} onClick={() => onVerMas(fila.conceptoId, true)}>
        {quedan > TANDA_PIVOT ? 'Ver todos' : `Ver ${fmt(quedan)} más`}
      </Box>
    </Box>
  );
}

const Punto = ({ color, title }) => (
  <Tooltip title={title}><Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} /></Tooltip>
);

export default function PivotCompras({
  data, isLoading, error, ventas, ventasLoading, months, agrupacion, modoCelda, sort, onSort,
}) {
  const porProveedor = agrupacion === 'proveedor';
  const porInsumo = agrupacion === 'insumo';
  const [expanded, setExpanded] = useState(() => new Set());
  // Registros visibles por concepto (de a TANDA_PIVOT). "Ver todos" = Infinity.
  const [mostrar, setMostrar] = useState(() => new Map());
  // % de cada fila sobre ingresos o sobre egresos (usePctMode de gestion).
  const [pctMode, setPctMode] = useState('ingresos');

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

  // Vista Insumos: arrancan abiertos los rubros que tienen insumos (Mercaderías); el resto cerrado.
  const abiertosInsumo = useRef(false);
  useEffect(() => { setExpanded(new Set()); setMostrar(new Map()); abiertosInsumo.current = false; }, [agrupacion]);
  useEffect(() => {
    if (!porInsumo || abiertosInsumo.current || !data) return;
    abiertosInsumo.current = true;
    setExpanded(new Set(data.rows.filter((r) => r.children.some((c) => c.conceptoCodigo?.startsWith('ins:'))).map((r) => r.id)));
  }, [porInsumo, data]);

  // Click derecho en un rubro: cierra todo; en un concepto / proveedor: cierra los de su nivel.
  const cerrarNivel = useCallback((e, idsNivel) => {
    if (navigator.maxTouchPoints > 0) return;
    e.preventDefault();
    setExpanded((prev) => (idsNivel ? new Set([...prev].filter((id) => idsNivel.has(id))) : new Set()));
  }, []);

  const { filas, rubroIds, proveedorIds } = useMemo(() => {
    if (!data) return { filas: [], rubroIds: new Set(), proveedorIds: new Set() };
    if (porProveedor) {
      const rows = sortPivotRowsPorProveedor(data.rows, sort.col, sort.dir);
      return {
        filas: flattenRowsPorProveedor({ ...data, rows }, expanded),
        rubroIds: new Set(rows.map((r) => r.id)),
        proveedorIds: new Set(rows.flatMap((r) => [r.id, ...r.children.map((p) => p.id)])),
      };
    }
    const rows = sortPivotRows(data.rows, sort.col, sort.dir);
    return {
      filas: flattenRows({ rows, columnTotals: data.columnTotals, grandTotal: data.grandTotal }, expanded, 3, mostrar),
      rubroIds: new Set(rows.map((r) => r.id)),
      proveedorIds: new Set(),
    };
  }, [data, porProveedor, sort, expanded, mostrar]);

  if (isLoading) return <PivotLoading />;
  if (error) return <PivotError />;
  if (!data || data.rows.length === 0) return <PivotEmpty />;

  const ingresosPorMes = ventas?.columnTotals ?? {};
  const ingresosReady = !!ventas;
  // Celda mensual según el toggle $ / % ing (el Total sigue en $).
  const fmtCelda = (valor, mes) => (modoCelda === 'pct'
    ? (!ingresosReady && valor != null ? '…' : computePctCelda(valor, ingresosPorMes[mes]))
    : fmtARS(valor));
  const pctDenominator = pctMode === 'ingresos' ? (ventas?.grandTotal ?? 0) : data.grandTotal;
  const fmtPct = (rowTotal) => computePctLabel(rowTotal, pctDenominator, pctMode === 'ingresos' && ventasLoading);
  const colSpan = months.length + 3;

  const celdaPct = (rowTotal, sx) => (
    <TableCell sx={{ ...sxNum, px: 1.5, fontSize: 12, color: 'text.secondary', opacity: 0.7, ...sx }}>{fmtPct(rowTotal)}</TableCell>
  );

  // Fila de rubro (pivot-rubro-row.tsx): fondo gris, semibold.
  const filaRubro = (rubro) => (
    <TableRow key={rubro.id} onContextMenu={(e) => cerrarNivel(e, null)} sx={{ '& td': { fontWeight: 600 } }}>
      <TableCell sx={{ ...sxStickyNombre(MUTED), px: 2, py: 1.25 }}>
        <Expansor abierto={expanded.has(rubro.id)} onClick={() => toggle(rubro.id)}>{rubro.nombre}</Expansor>
      </TableCell>
      {months.map((mes) => (
        <TableCell key={mes} sx={{ ...sxNum, px: 1.5, py: 1.25, bgcolor: (t) => alpha(t.palette.grey[100], 0.25) }}>
          {fmtCelda(rubro.values[mes], mes)}
        </TableCell>
      ))}
      <TableCell sx={{ ...sxNum, px: 2, py: 1.25, fontSize: 15 }}>{fmtARS(rubro.rowTotal)}</TableCell>
      {celdaPct(rubro.rowTotal, { py: 1.25 })}
    </TableRow>
  );

  // Concepto (2do nivel de Concepto/Insumos, 3er nivel de Proveedor).
  const filaConcepto = (c, indent) => {
    const insumo = porInsumo && c.conceptoCodigo?.startsWith('ins:');
    return (
      <TableRow key={c.id} hover onContextMenu={(e) => cerrarNivel(e, porProveedor ? proveedorIds : rubroIds)}>
        <TableCell sx={{ ...sxStickyNombre(), px: 2, py: 1 }}>
          <Expansor abierto={expanded.has(c.id)} onClick={() => toggle(c.id)} indent={indent}>
            {insumo ? normalize(c.nombre) : c.nombre}
            {porInsumo && !insumo && (
              <Box component="span" sx={{ ml: 0.75, px: 0.75, border: 1, borderColor: 'divider', borderRadius: 4, fontSize: 10, color: 'text.secondary' }}>concepto</Box>
            )}
          </Expansor>
        </TableCell>
        {months.map((mes) => (
          <ComposicionTooltip key={mes} comp={c.composicion?.[mes]}>
            <TableCell sx={{ ...sxNum, px: 1.5, py: 1, color: 'text.secondary' }}>{fmtCelda(c.values[mes], mes)}</TableCell>
          </ComposicionTooltip>
        ))}
        <TableCell sx={{ ...sxNum, px: 2, py: 1, color: 'text.secondary', fontWeight: 600, fontSize: 14 }}>{fmtARS(c.rowTotal)}</TableCell>
        {celdaPct(c.rowTotal, { py: 1, opacity: 0.5 })}
      </TableRow>
    );
  };

  // Registro (último nivel): "dd/mm · Nombre · observación · $".
  const filaRegistro = (r, indent, partes) => (
    <TableRow
      key={r.id}
      hover
      sx={r.hasManualOverride ? { bgcolor: (t) => alpha(t.palette.warning.main, 0.05) } : undefined}
    >
      <TableCell sx={{ ...sxStickyNombre(), px: 2, pl: 2 + indent, py: 0.75, fontSize: 12, color: r.hasManualOverride ? 'warning.dark' : 'text.secondary' }}>
        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {r.hasManualOverride && <Punto color="warning.main" title="Editado en el Panel" />}
          {r.distribucionId != null && <Punto color="info.main" title="Parte de un gasto aperturado" />}
          {partes.filter(Boolean).join(' · ')}
        </Box>
      </TableCell>
      {months.map((mes) => (
        <TableCell key={mes} sx={{ ...sxNum, px: 1.5, py: 0.75, fontSize: 12, color: 'text.secondary' }}>
          {fmtCelda(r.values[mes], mes)}
        </TableCell>
      ))}
      <TableCell sx={{ ...sxNum, px: 2, py: 0.75, fontSize: 12, color: 'text.secondary' }}>{fmtARS(r.rowTotal)}</TableCell>
      {celdaPct(r.rowTotal, { py: 0.75, opacity: 0.4 })}
    </TableRow>
  );

  const renderFila = (item) => {
    const d = item.data;
    switch (item.type) {
      case 'rubro':
      case 'rubroTop':
        return filaRubro(d);
      case 'concepto':
        return filaConcepto(d, 2.5);
      case 'proveedorSub': {
        const nombre = d.rubroCodigo === RUBRO_GASTOS_EN_PERSONAL_CODIGO && d.codigo
          ? `${d.codigo} - ${normalize(d.nombre)}`
          : normalize(d.nombre);
        return (
          <TableRow key={d.id} onContextMenu={(e) => cerrarNivel(e, rubroIds)} sx={{ '& td': { fontWeight: 600 } }}>
            <TableCell sx={{ ...sxStickyNombre(MUTED), px: 2, py: 1.25 }}>
              <Expansor abierto={expanded.has(d.id)} onClick={() => toggle(d.id)} indent={2.5}>{nombre}</Expansor>
            </TableCell>
            {months.map((mes) => (
              <ComposicionTooltip key={mes} comp={d.composicion?.[mes]}>
                <TableCell sx={{ ...sxNum, px: 1.5, py: 1.25 }}>{fmtCelda(d.values[mes], mes)}</TableCell>
              </ComposicionTooltip>
            ))}
            <TableCell sx={{ ...sxNum, px: 2, py: 1.25 }}>{fmtARS(d.rowTotal)}</TableCell>
            {celdaPct(d.rowTotal, { py: 1.25 })}
          </TableRow>
        );
      }
      case 'conceptoSub':
        return filaConcepto(d, 5);
      case 'proveedor':
        return filaRegistro(d, 7, [fechaCorta(d.fecha), normalize(d.nombre), d.observac || null, fmtARS(d.importe)]);
      case 'linea':
        return filaRegistro(d, 9.5, [fechaCorta(d.fecha), d.observac || null, fmtARS(d.importe)]);
      case 'mas':
        return (
          <TableRow key={d.id}>
            <TableCell sx={{ ...sxStickyNombre(), px: 2, pl: 7, py: 0.75, fontSize: 12, color: 'text.secondary' }}>
              <FilaMasRegistros fila={d} onVerMas={verMas} />
            </TableCell>
            <TableCell colSpan={months.length + 2} />
          </TableRow>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0, '& td, & th': { borderBottomColor: 'divider' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...sxStickyNombre(MUTED), top: 0, zIndex: 3, px: 2, py: 1.5, fontWeight: 500, color: 'text.secondary', minWidth: { xs: 150, md: 200 }, whiteSpace: 'nowrap' }}>
              Operación
            </TableCell>
            {months.map((mes) => (
              <CabeceraOrden key={mes} col={mes} sortCol={sort.col} sortDir={sort.dir} onSort={onSort} />
            ))}
            <CabeceraOrden col="total" label="Total" total sortCol={sort.col} sortDir={sort.dir} onSort={onSort} />
            <TableCell
              onClick={() => setPctMode((m) => (m === 'ingresos' ? 'egresos' : 'ingresos'))}
              title={pctMode === 'ingresos' ? '% sobre ingresos — click para cambiar a % sobre egresos' : '% sobre egresos — click para cambiar a % sobre ingresos'}
              sx={{ ...sxNum, position: 'sticky', top: 0, zIndex: 2, bgcolor: MUTED, px: 1.5, py: 1.5, minWidth: 64, fontWeight: 500, color: 'text.secondary', cursor: 'pointer', userSelect: 'none', '&:hover': { color: 'text.primary' } }}
            >
              % {pctMode === 'ingresos' ? 'ing' : 'egr'}
            </TableCell>
          </TableRow>
          <KpiBlock
            months={months}
            ingresosPorMes={ingresosPorMes}
            egresosPorMes={data.columnTotals}
            ingresosTotal={ventas?.grandTotal}
            egresosTotal={data.grandTotal}
            ingresosReady={ingresosReady}
          />
          <SectionDivider label="Gastos por rubro" icon={LayersIcon} colSpan={colSpan} />
        </TableHead>
        <TableBody>{filas.map(renderFila)}</TableBody>
        <TableFooter>
          <TableRow sx={{ '& td': { bgcolor: MUTED, fontWeight: 600, fontSize: 15, color: 'text.primary', borderTop: 2, borderTopColor: 'divider', py: 1.5 } }}>
            <TableCell sx={{ ...sxStickyNombre(MUTED), px: 2 }}>Total gastos</TableCell>
            {months.map((mes) => (
              <TableCell key={mes} sx={{ ...sxNum, px: 1.5 }}>{fmtCelda(data.columnTotals[mes], mes)}</TableCell>
            ))}
            <TableCell sx={{ ...sxNum, px: 2, color: 'primary.main !important' }}>{fmtARS(data.grandTotal)}</TableCell>
            <TableCell sx={{ ...sxNum, px: 1.5, fontSize: '12px !important', color: 'text.secondary !important' }}>
              {pctMode === 'egresos' ? '—' : fmtPct(data.grandTotal)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Box>
  );
}
