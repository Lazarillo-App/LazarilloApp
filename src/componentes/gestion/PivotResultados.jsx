// src/componentes/gestion/PivotResultados.jsx
// Pestaña Resultados del Panel, igual a lazarillo_gestion/components/dashboard/
// resultados-pivot-table.tsx, caja-rows.tsx y societario-rows.tsx — a MUI:
//   Operación (bloque KPI con los totales de Compras) → Caja (Disponible en caja editable +
//   Diferencia de caja) → Societario (Ganancia + % Rentabilidad) → Detalle (rubro → concepto →
//   registro de los conceptos visibles en Resultados).
// Todavía no (paso 4, lo editable): detalle al clickear una celda y apertura de gastos.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, CircularProgress, IconButton, Popover,
  Typography, Snackbar, Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupsIcon from '@mui/icons-material/Groups';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useQueryClient } from '@tanstack/react-query';
import { sortPivotRows, flattenRows, TANDA_PIVOT } from '@/gestion/pivotUtils';
import { MESES, fmtARS, fmtARSDecimal, normalize, fechaCorta } from '@/gestion/formato';
import {
  RESULT_COLORS, pctSobreIngresos, parseMontoARS, montoNoGuardable, sumarDiferenciaCajaVisible,
  heatmapFillZeroAnchored, heatmapTextZeroAnchored,
} from '@/gestion/resultadosCalc';
import { MUTED, sxStickyNombre, sxNum, sxTablaPanel } from '@/gestion/estilos';
import { GestionAPI } from '@/servicios/apiGestion';
import { useDiferenciaCaja, useFlujoCaja } from '@/gestion/hooksPanel';
import { usePanelGestion } from '@/gestion/panelContext';
import { PivotLoading, PivotError, Expansor, CabeceraOrden, SectionDivider, KpiBlock } from './piezasPivot';

const Espacio = ({ colSpan }) => <TableRow aria-hidden><TableCell colSpan={colSpan} sx={{ p: 0, height: 12, border: 0 }} /></TableRow>;

export default function PivotResultados({ operacion, resultados, ventas, months, sort, onSort }) {
  const [expanded, setExpanded] = useState(() => new Set());
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

  const data = resultados.data;
  const { filas, rubroIds } = useMemo(() => {
    if (!data) return { filas: [], rubroIds: new Set() };
    const rows = sortPivotRows(data.rows, sort.col, sort.dir);
    return {
      filas: flattenRows({ rows, columnTotals: data.columnTotals, grandTotal: data.grandTotal }, expanded, 3, mostrar),
      rubroIds: new Set(rows.map((r) => r.id)),
    };
  }, [data, sort, expanded, mostrar]);
  const cerrarNivel = (e, idsNivel) => {
    if (navigator.maxTouchPoints > 0) return;
    e.preventDefault();
    setExpanded((prev) => (idsNivel ? new Set([...prev].filter((id) => idsNivel.has(id))) : new Set()));
  };

  if (operacion.isLoading || resultados.isLoading) return <PivotLoading />;
  if (operacion.error || resultados.error) return <PivotError />;
  if (!operacion.data || !data) return <PivotLoading />;

  const ingresosPorMes = ventas.data?.columnTotals ?? {};
  const ingresosTotal = ventas.data?.grandTotal;
  const resultadosEmpty = data.rows.length === 0;
  const colSpan = months.length + 3; // nombre + meses + total + % ing
  const pctIng = (v) => pctSobreIngresos(v, ingresosTotal ?? 0);

  const renderFila = (item) => {
    const d = item.data;
    if (item.type === 'rubro') {
      return (
        <TableRow key={d.id} onContextMenu={(e) => cerrarNivel(e, null)} sx={{ '& td': { fontWeight: 600 } }}>
          <TableCell sx={{ ...sxStickyNombre(MUTED), px: 2, py: 1.25 }}>
            <Expansor abierto={expanded.has(d.id)} onClick={() => toggle(d.id)}>{d.nombre}</Expansor>
          </TableCell>
          {months.map((mes) => (
            <TableCell key={mes} sx={{ ...sxNum, px: 1.5, py: 1.25, bgcolor: (t) => alpha(t.palette.grey[100], 0.25) }}>{fmtARS(d.values[mes])}</TableCell>
          ))}
          <TableCell sx={{ ...sxNum, px: 2, py: 1.25, fontWeight: '700 !important', bgcolor: (t) => alpha(t.palette.grey[100], 0.25) }}>{fmtARS(d.rowTotal)}</TableCell>
          <TableCell sx={{ ...sxNum, px: 1.5, py: 1.25, fontSize: 12, fontWeight: '400 !important', color: 'text.secondary', opacity: 0.7 }}>{pctIng(d.rowTotal)}</TableCell>
        </TableRow>
      );
    }
    if (item.type === 'concepto') {
      return (
        <TableRow key={d.id} hover onContextMenu={(e) => cerrarNivel(e, rubroIds)}>
          <TableCell sx={{ ...sxStickyNombre(), px: 2, py: 1 }}>
            <Expansor abierto={expanded.has(d.id)} onClick={() => toggle(d.id)} indent={2.5}>{d.nombre}</Expansor>
          </TableCell>
          {months.map((mes) => <TableCell key={mes} sx={{ ...sxNum, px: 1.5, py: 1, color: 'text.secondary' }}>{fmtARS(d.values[mes])}</TableCell>)}
          <TableCell sx={{ ...sxNum, px: 2, py: 1, color: 'text.secondary', fontWeight: 600 }}>{fmtARS(d.rowTotal)}</TableCell>
          <TableCell sx={{ ...sxNum, px: 1.5, py: 1, fontSize: 12, color: 'text.secondary', opacity: 0.5 }}>{pctIng(d.rowTotal)}</TableCell>
        </TableRow>
      );
    }
    if (item.type === 'mas') {
      return (
        <TableRow key={d.id}>
          <TableCell sx={{ ...sxStickyNombre(), px: 2, pl: 7, py: 0.75, fontSize: 12, color: 'text.secondary' }}>
            <FilaMasRegistros fila={d} onVerMas={verMas} />
          </TableCell>
          <TableCell colSpan={months.length + 2} />
        </TableRow>
      );
    }
    const label = [fechaCorta(d.fecha), normalize(d.nombre), d.observac || null, fmtARS(d.importe)].filter(Boolean).join(' · ');
    return (
      <TableRow key={d.id} hover sx={d.hasManualOverride ? { bgcolor: (t) => alpha(t.palette.warning.main, 0.05) } : undefined}>
        <TableCell sx={{ ...sxStickyNombre(), px: 2, pl: 7, py: 0.75, fontSize: 12, color: d.hasManualOverride ? 'warning.dark' : 'text.secondary' }}>{label}</TableCell>
        {months.map((mes) => <TableCell key={mes} sx={{ ...sxNum, px: 1.5, py: 0.75, fontSize: 12, color: 'text.secondary' }}>{fmtARS(d.values[mes])}</TableCell>)}
        <TableCell sx={{ ...sxNum, px: 2, py: 0.75, fontSize: 12, color: 'text.secondary' }}>{fmtARS(d.rowTotal)}</TableCell>
        <TableCell sx={{ ...sxNum, px: 1.5, py: 0.75, fontSize: 12, color: 'text.secondary', opacity: 0.4 }}>{pctIng(d.rowTotal)}</TableCell>
      </TableRow>
    );
  };

  return (
    <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
      <Table size="small" sx={sxTablaPanel}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...sxStickyNombre(MUTED), top: 0, zIndex: 3, px: 2, py: 1.5, fontWeight: 500, color: 'text.secondary', minWidth: { xs: 150, md: 240 }, whiteSpace: 'nowrap' }}>
              Operación
            </TableCell>
            {months.map((mes) => <CabeceraOrden key={mes} col={mes} sortCol={sort.col} sortDir={sort.dir} onSort={onSort} />)}
            <CabeceraOrden col="total" label="Total" total sortCol={sort.col} sortDir={sort.dir} onSort={onSort} />
            <TableCell sx={{ ...sxNum, position: 'sticky', top: 0, zIndex: 2, bgcolor: MUTED, px: 1.5, py: 1.5, minWidth: 64, fontWeight: 500, color: 'text.secondary' }}>% ing</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <KpiBlock
            months={months}
            ingresosPorMes={ingresosPorMes}
            egresosPorMes={operacion.data.columnTotals}
            ingresosTotal={ingresosTotal}
            egresosTotal={operacion.data.grandTotal}
            ingresosReady={!!ventas.data}
          />
          <Espacio colSpan={colSpan} />
          <CajaRows months={months} isEmpty={resultadosEmpty} colSpan={colSpan} />
          <Espacio colSpan={colSpan} />
          <SocietarioRows
            months={months}
            ingresosPorMes={ingresosPorMes}
            ingresosTotal={ingresosTotal}
            gananciaPorMes={data.columnTotals}
            gananciaTotal={data.grandTotal}
            isEmpty={resultadosEmpty}
            colSpan={colSpan}
          />
          <Espacio colSpan={colSpan} />
          <SectionDivider label="Detalle" icon={AccountTreeIcon} colSpan={colSpan} />
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} sx={{ py: 6 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                  <InboxIcon sx={{ fontSize: 32, opacity: 0.4 }} />
                  <Typography fontSize={14} textAlign="center">
                    No hay conceptos marcados como visibles en Resultados.<br />
                    Usá el ícono de configuración para elegir cuáles mostrar.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : filas.map(renderFila)}
        </TableBody>
      </Table>
    </Box>
  );
}

// Fila al pie de un concepto abierto con muchos registros (igual que en Compras).
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

const sxValor = { ...sxNum, px: 1.5, py: 0.75 };
const sxTotal = { ...sxNum, px: 2, py: 0.75, fontWeight: 600 };
const colorDe = (gray, negative) => (gray ? RESULT_COLORS.noData : negative ? RESULT_COLORS.negative : RESULT_COLORS.positive);
const CERO_NO_GUARDABLE = '$0 no es un arqueo — dejá la celda vacía.';

// ── Caja: Disponible en caja (arqueos, editable) y Diferencia de caja ─────────
function CajaRows({ months, isEmpty, colSpan }) {
  const { year, sucursalCaja } = usePanelGestion();
  const queryClient = useQueryClient();
  const { data: flujo, isLoading: flujoLoading } = useFlujoCaja();
  const { diferenciaPorMes, isLoading: difLoading, isError: difError } = useDiferenciaCaja();
  const [editando, setEditando] = useState(null);
  const [draft, setDraft] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [infoEl, setInfoEl] = useState(null);

  const flujoPorMes = flujo?.meses ?? {};
  const flujoTotal = months.reduce((acc, mes) => acc + (flujoPorMes[mes] ?? 0), 0);
  // Un total real de $0 no es "nada cargado": se mira si algún mes tiene una entrada.
  const flujoTieneDatos = months.some((mes) => flujoPorMes[mes] != null);
  // Con "todas las sucursales" (y más de una) es una vista agregada de solo lectura: el arqueo es
  // de una caja concreta.
  const puedeEditar = sucursalCaja !== undefined;
  const ceroExplicito = montoNoGuardable(draft);

  async function guardar(mes) {
    if (ceroExplicito) { setAviso({ sev: 'warning', txt: CERO_NO_GUARDABLE }); return; }
    // Vacío = sin arqueo: parseMontoARS('') da 0 y el back borra la fila.
    const monto = parseMontoARS(draft);
    if (monto === null) return;
    setGuardando(true);
    try {
      await GestionAPI.guardarFlujoCaja({ sucursal: sucursalCaja, anio: year, mes, monto });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gestionFlujoCaja'] }),
        // Cargar el primer arqueo de la historia cambia la diferencia de todos los meses.
        queryClient.invalidateQueries({ queryKey: ['gestionDiferenciaCaja'] }),
      ]);
      setAviso({ sev: 'success', txt: 'Registro actualizado' });
      setEditando(null);
    } catch {
      setAviso({ sev: 'error', txt: 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  }

  const totalDif = sumarDiferenciaCajaVisible(months.map((mes) => diferenciaPorMes[mes].valor));
  const spinner = <CircularProgress size={12} />;

  return (
    <>
      <SectionDivider label="Caja" icon={AccountBalanceWalletIcon} colSpan={colSpan} />
      <TableRow sx={{ '&:hover .editar': { opacity: 1 } }}>
        <TableCell
          sx={{ ...sxStickyNombre(), px: 2, py: 0.75, whiteSpace: 'nowrap' }}
          title={puedeEditar ? undefined : 'Elegí una sucursal para cargar Disponible en caja — acá se muestra la suma de todas'}
        >
          Disponible en caja
        </TableCell>
        {months.map((mes) => {
          const value = flujoPorMes[mes];
          if (editando === mes && puedeEditar) {
            return (
              <TableCell key={mes} sx={sxValor}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25 }}>
                  <Box
                    component="input" type="text" inputMode="decimal" autoFocus aria-label={`Disponible en caja ${MESES[mes - 1]}`}
                    value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={ceroExplicito}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardar(mes); if (e.key === 'Escape') setEditando(null); }}
                    sx={{ height: 24, width: 84, borderRadius: 1, border: 1, borderColor: ceroExplicito ? 'error.main' : 'divider', px: 0.5, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  />
                  <IconButton size="small" disabled={guardando || ceroExplicito} title={ceroExplicito ? CERO_NO_GUARDABLE : 'Guardar'} onClick={() => guardar(mes)} sx={{ p: 0.25 }}>
                    {guardando ? spinner : <CheckIcon sx={{ fontSize: 15 }} />}
                  </IconButton>
                  <IconButton size="small" onClick={() => setEditando(null)} title="Cancelar" sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
                </Box>
                {ceroExplicito && <Box sx={{ fontSize: 10, color: 'error.main', maxWidth: 160, ml: 'auto', whiteSpace: 'normal' }}>{CERO_NO_GUARDABLE}</Box>}
              </TableCell>
            );
          }
          return (
            <TableCell key={mes} sx={sxValor}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                <Box component="span" sx={{ color: value == null ? 'text.disabled' : undefined }}>
                  {flujoLoading ? spinner : value != null ? fmtARSDecimal(value) : '—'}
                </Box>
                {puedeEditar && (
                  <IconButton
                    className="editar" size="small" title="Editar"
                    onClick={() => { setEditando(mes); setDraft(value != null ? String(value) : ''); }}
                    sx={{ p: 0.25, opacity: 0, transition: 'opacity .15s' }}
                  >
                    <EditIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                )}
              </Box>
            </TableCell>
          );
        })}
        <TableCell sx={sxTotal}>{flujoLoading ? spinner : flujoTieneDatos ? fmtARSDecimal(flujoTotal) : '—'}</TableCell>
        <TableCell />
      </TableRow>

      <TableRow sx={isEmpty ? { opacity: 0.6 } : undefined} title={isEmpty ? 'Incluye $0 de Ganancia: no hay conceptos configurados en Resultados' : undefined}>
        <TableCell sx={{ ...sxStickyNombre(MUTED), px: 2, py: 0.75, whiteSpace: 'nowrap', fontWeight: 700 }} title="(Arqueo del mes − Arqueo del mes anterior) − (Resultado OP − Ganancia), por mes">
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            Diferencia de caja
            <IconButton size="small" aria-label="Ver fórmula de Diferencia de caja" onClick={(e) => setInfoEl(e.currentTarget)} sx={{ p: 0.25, color: 'text.disabled' }}>
              <InfoOutlinedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </TableCell>
        {months.map((mes) => {
          const { valor, acumulado } = diferenciaPorMes[mes];
          const noData = !difLoading && valor == null;
          const title = difError ? 'Error al cargar Diferencia de caja' : valor != null ? `Acumulado desde el primer arqueo: ${fmtARS(acumulado)}` : undefined;
          return (
            <TableCell key={mes} title={title} sx={{ ...sxValor, bgcolor: MUTED, color: colorDe(noData, valor != null && valor < 0) }}>
              {difLoading ? spinner : valor == null ? '—' : fmtARS(valor)}
            </TableCell>
          );
        })}
        <TableCell title="Suma de los meses con arqueo cargado" sx={{ ...sxTotal, fontWeight: 700, bgcolor: MUTED, color: colorDe(!difLoading && totalDif == null, totalDif != null && totalDif < 0) }}>
          {difLoading ? spinner : totalDif == null ? '—' : fmtARS(totalDif)}
        </TableCell>
        <TableCell sx={{ bgcolor: MUTED }} />
      </TableRow>

      <Popover open={!!infoEl} anchorEl={infoEl} onClose={() => setInfoEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ width: 320, p: 2, fontSize: 12, lineHeight: 1.6, color: 'text.secondary' }}>
          <Box sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', lineHeight: 1.35 }}>
            Diferencia de caja (mes) = (Arqueo del mes − Arqueo del mes anterior) − (Resultado OP − Ganancia)
          </Box>
          <Box sx={{ mt: 0.75 }}>
            Cada mes es independiente. “Mes anterior” es el último con Disponible en caja cargado (compara
            contra diciembre del año anterior si hace falta). Solo los meses con Disponible en caja cargado
            muestran un valor; el resto queda en “—”. Pasá el mouse sobre un mes para ver el acumulado desde
            el primer arqueo.
          </Box>
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider', display: 'grid', gridTemplateColumns: '14px 1fr', columnGap: 1, rowGap: 1.25 }}>
            <Box sx={{ height: 20, display: 'grid', placeItems: 'center' }}><Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: RESULT_COLORS.negative }} /></Box>
            <span><b>Negativo (falta):</b> gastos que salieron de la caja sin cargar.</span>
            <Box sx={{ height: 20, display: 'grid', placeItems: 'center' }}><Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: RESULT_COLORS.positive }} /></Box>
            <span><b>Positivo (sobra):</b> gastos cargados que no salieron de la caja (deuda).</span>
            <Box sx={{ height: 20, display: 'grid', placeItems: 'center', fontWeight: 600, color: RESULT_COLORS.noData }}>—</Box>
            <span><b>Sin dato:</b> mes anterior o igual al primer arqueo, o cualquier mes sin un arqueo cargado (un arqueo en $0 cuenta como sin dato).</span>
          </Box>
        </Box>
      </Popover>
      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aviso ? <Alert severity={aviso.sev} variant="filled" onClose={() => setAviso(null)}>{aviso.txt}</Alert> : undefined}
      </Snackbar>
    </>
  );
}

// ── Societario: Ganancia (visibles en Resultados) y % Rentabilidad ──────────────
function SocietarioRows({ months, ingresosPorMes, ingresosTotal, gananciaPorMes, gananciaTotal, isEmpty, colSpan }) {
  // Misma escala anclada en 0 para la Ganancia (fondo) y el % (texto): coinciden en qué meses pintan rojo.
  const pctPorMes = months.map((mes) => {
    const raw = gananciaPorMes[mes];
    if (isEmpty || raw == null) return null;
    const ing = ingresosPorMes[mes] ?? 0;
    return ing > 0 ? (raw / ing) * 100 : null;
  });
  const pctValidos = pctPorMes.filter((v) => v != null);
  const minPct = pctValidos.length ? Math.min(...pctValidos) : 0;
  const maxPct = pctValidos.length ? Math.max(...pctValidos) : 0;
  const gananciaVisible = months.map((m) => gananciaPorMes[m]).filter((v) => v != null);
  const minGanancia = gananciaVisible.length ? Math.min(...gananciaVisible) : 0;
  const maxGanancia = gananciaVisible.length ? Math.max(...gananciaVisible) : 0;
  const labelTotal = isEmpty ? '—' : pctSobreIngresos(gananciaTotal, ingresosTotal ?? 0);

  return (
    <>
      <SectionDivider label="Societario" icon={GroupsIcon} colSpan={colSpan} />
      <TableRow>
        <TableCell sx={{ ...sxStickyNombre(), px: 2, py: 0.75, whiteSpace: 'nowrap', fontSize: 15, fontWeight: 600 }}>Ganancia</TableCell>
        {months.map((mes) => {
          const raw = gananciaPorMes[mes];
          const gray = isEmpty || raw == null;
          const fill = !gray ? heatmapFillZeroAnchored(raw, minGanancia, maxGanancia) : null;
          return (
            <TableCell key={mes} sx={{ ...sxValor, fontSize: 15, fontWeight: 600, ...(fill ? { bgcolor: fill.background, color: fill.foreground } : { color: 'text.disabled' }) }}>
              {gray ? '—' : fmtARS(raw)}
            </TableCell>
          );
        })}
        <TableCell sx={{ ...sxTotal, fontSize: 15, color: isEmpty ? 'text.disabled' : gananciaTotal < 0 ? 'error.main' : undefined }}>
          {isEmpty ? '—' : fmtARS(gananciaTotal)}
        </TableCell>
        <TableCell />
      </TableRow>
      <TableRow>
        <TableCell sx={{ ...sxStickyNombre(), px: 2, py: 0.75, whiteSpace: 'nowrap' }}>% Rentabilidad</TableCell>
        {months.map((mes, i) => {
          const raw = gananciaPorMes[mes];
          const pct = pctPorMes[i];
          const label = isEmpty || raw == null ? '—' : pctSobreIngresos(raw, ingresosPorMes[mes] ?? 0);
          const color = pct != null ? heatmapTextZeroAnchored(pct, minPct, maxPct) : undefined;
          return <TableCell key={mes} sx={{ ...sxValor, color: color ?? 'text.disabled' }}>{label}</TableCell>;
        })}
        <TableCell sx={{ ...sxTotal, color: labelTotal === '—' ? 'text.disabled' : gananciaTotal < 0 ? RESULT_COLORS.negative : RESULT_COLORS.positive }}>{labelTotal}</TableCell>
        <TableCell />
      </TableRow>
    </>
  );
}
