// src/componentes/gestion/ComprasDetalleModal.jsx
// Detalle de compras (lazarillo_gestion/components/dashboard/compras-detalle-modal.tsx): lo que
// suma la celda clickeada, con edición de fecha, concepto, observación e importe, y edición de
// varias filas tildadas a la vez.
// Todavía no: apertura de gastos y mover a otro negocio (bloque de apertura), cuenta corriente del
// proveedor (bloque 3). Una compra ya repartida solo deja cambiar la observación hasta que esté
// el motor de apertura. El comprobante abre sus líneas; ver/editar la factura llega con la carga.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select, Snackbar, Alert, TableCell, TableRow, TextField, Tooltip,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { fmtARS, fmtDate, normalize } from '@/gestion/formato';
import { periodoInicial, aplicarPeriodo, labelPeriodo } from '@/gestion/detallePeriodo';
import { cambiosLote, describirCambios } from '@/gestion/edicionLote';
import { resolverImporteParaPatch } from '@/gestion/importeParaPatch';
import { ETIQUETA_ESTADO, PUNTO_ESTADO } from '@/gestion/estadoPago';
import DetalleModalShell, { DetallePeriodoControls, EditActionButtons, EditTriggerButton, EditedDot } from './DetalleModalShell';
import { VerFactura } from './CargarFactura';
import { CtaCteModal, origenDeFila } from './pagos/cta-cte-proveedor';
import { ScopeGestion, lugarDeCompra, useFetchQuery } from '@/gestion/compat';
import { BotonAperturaRegistro, ModalAperturaPanel, lugarOrigen, useAperturaPanel } from './apertura/aperturaPanel';
import { MoverPdvButton } from './apertura/mover-pdv-button';
import { cuerpoMover, filasAMover } from '@/gestion/apertura/mover';
import { refrescarCompras } from '@/gestion/hooksPanel';
import { gestionFetch } from '@/servicios/apiGestion';
import { toast } from 'sonner';

const SIN_RUBRO_CODE = '__sin_rubro';
const SIN_RUBRO_NOMBRE = 'Sin Rubro';

// Anchos fijos y angostos para todo menos Observación, que se lleva el resto.
const COLS = [
  { label: 'F. gasto', sortKey: 'fecha', width: 112 },
  { label: 'F. pago', sortKey: 'fechaPago', width: 104 },
  { label: 'Proveedor', sortKey: 'proveedor', width: 144 },
  { label: 'Detalle', sortKey: 'detalle', width: 96 },
  { label: 'Observación', sortKey: 'observacion' },
  { label: 'Rubro', width: 136 },
  { label: 'Concepto', sortKey: 'concepto', width: 144 },
  { label: 'Importe', right: true, sortKey: 'importe', width: 128 },
];
// Lo que depende de los gastos: se recalcula después de guardar.
const DEPENDIENTES = ['gestionPivot', 'gestionAnual', 'gestionEquilibrio', 'gestionEquilibrioVariables', 'gestionDiferenciaCaja', 'gestionCanasta'];

const esEditada = (c) => c.importeManual != null || c.fechaManual != null || c.conceptoCodigoManual != null || c.observacManual != null;
const fechaInput = (iso) => iso?.slice(0, 10) ?? '';
const texto = (v) => (v != null ? String(v) : '');
const nombreProveedor = (i) => normalize(i.proveedor ?? i.proveedorRef?.nombre ?? i.proveedorRef?.razon);
const celda = { px: 1.5, py: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const celdaEdicion = { px: 0.75, py: 0.75 };
const sxInput = { width: '100%', boxSizing: 'border-box', height: 28, border: 1, borderColor: 'divider', borderRadius: 1, px: 0.75, fontSize: 12, bgcolor: 'background.paper', '&:disabled': { bgcolor: 'grey.100', color: 'text.disabled' } };

function sortCompras(a, b, sort) {
  if (sort.key === 'importe') {
    const va = Number(a.importeVista ?? a.importeManual ?? a.importe ?? 0);
    const vb = Number(b.importeVista ?? b.importeManual ?? b.importe ?? 0);
    return sort.dir === 'asc' ? va - vb : vb - va;
  }
  const valor = {
    fecha: (x) => String(x.fechaGasto ?? x.fechaManual ?? x.fecha ?? '').slice(0, 10),
    fechaPago: (x) => String(x.fechaPago ?? '').slice(0, 10),
    proveedor: (x) => String(x.proveedor || x.proveedorRef?.nombre || x.proveedorRef?.razon || ''),
    concepto: (x) => String((x.conceptoCajaManual ?? x.conceptoCaja)?.nombre ?? ''),
    detalle: (x) => String(x.detalle ?? ''),
    observacion: (x) => String(x.observacManual ?? x.observac ?? ''),
  }[sort.key];
  if (!valor) return 0;
  const cmp = valor(a).localeCompare(valor(b), 'es', { numeric: true });
  return sort.dir === 'asc' ? cmp : -cmp;
}

const searchFields = (i) => [
  i.proveedor, i.proveedorRef?.nombre, i.proveedorRef?.razon, i.observacManual, i.observac, i.obsInsumos, i.detalle, i.concepto,
  (i.conceptoCajaManual ?? i.conceptoCaja)?.nombre, (i.conceptoCajaManual ?? i.conceptoCaja)?.rubro?.nombre, i.local?.nombre,
];

// Fecha de pago: la del informe 80 (si hubo varios, el último) o la de la caja del gasto vario / sueldo.
function FechaPago({ item }) {
  if (!item.fechaPago) return <Box component="span" sx={{ opacity: 0.5 }}>—</Box>;
  const n = item.pagoRef ? 1 : item.estadoPago?.pagos ?? 0;
  const parcial = item.estadoPago?.estado === 'parcial' && !item.pagoRef;
  const detalle = [n > 1 ? `último de ${n} pagos` : null, parcial ? 'pago parcial' : null, item.cajaPago ? `caja: ${item.cajaPago}` : null].filter(Boolean).join(' · ');
  return <Box component="span" title={detalle || undefined} sx={detalle ? { textDecoration: 'underline dotted', textUnderlineOffset: 2 } : undefined}>{fmtDate(item.fechaPago)}{n > 1 || parcial ? '*' : ''}</Box>;
}

function Semaforo({ estado }) {
  if (!estado) return <Box component="span" sx={{ display: 'inline-block', width: 12, ml: 0.75 }} />;
  const p = PUNTO_ESTADO[estado.estado];
  const titulo = `${ETIQUETA_ESTADO[estado.estado]}${estado.pagado ? ` · pagado ${fmtARS(estado.pagado)} de ${fmtARS(estado.total)}` : ''}`;
  return (
    <Tooltip title={titulo}>
      <Box component="span" aria-label={`Estado: ${ETIQUETA_ESTADO[estado.estado]}`} sx={{ display: 'inline-flex', width: 12, ml: 0.75, justifyContent: 'center', verticalAlign: 'middle' }}>
        <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color, border: p.borde ? `1px solid ${p.borde}` : 'none', boxSizing: 'border-box' }} />
      </Box>
    </Tooltip>
  );
}

function CheckFila({ seleccion }) {
  if (!seleccion) return null;
  return (
    <TableCell sx={{ pl: 1.5, pr: 0, py: 0.75 }}>
      <Box component="input" type="checkbox" aria-label="Tildar registro" checked={seleccion.tildado} onChange={seleccion.onToggle} sx={{ cursor: 'pointer', verticalAlign: 'middle' }} />
    </TableCell>
  );
}

export default function ComprasDetalleModal({ filter, onClose }) {
  const { businessId, modo, nombreLugar } = usePanelGestion();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [lineas, setLineas] = useState(null);
  // Apertura y "mover a otro lugar" de una fila o de las tildadas.
  const aperturaPanel = useAperturaPanel();
  const { data: localesApertura } = useFetchQuery(['locales-apertura'], '/api/apertura/locales', { staleTime: 5 * 60_000 });
  const filaMovible = (f) => ({
    ...f,
    localIdOrigen: f.localIdOrigen != null ? Number(f.localIdOrigen) : null,
    puntoDeVentaIdOrigen: lugarOrigen(f.localIdOrigen, f.puntoDeVentaIdOrigen),
  });
  const importeDe = (f) => Number(f.importeBase ?? f.importeManual ?? f.importe ?? 0);
  const abrirAperturaFila = (row) => {
    // Con la fila tildada (y 2+ tildadas) la regla nueva va para todas.
    const filas = tildadas.has(row.rowId) && tildadas.size > 1 ? [...tildadas.values()].map(filaMovible) : null;
    const m = filaMovible(row);
    aperturaPanel.abrir('registro', row.rowId, nombreProveedor(row) || row.detalle || row.rowId, {
      localId: m.localIdOrigen,
      pdvId: m.puntoDeVentaIdOrigen,
      lote: filas?.map((f) => ({ entidadId: f.rowId, origenLocalId: f.localIdOrigen, origenPdvId: f.puntoDeVentaIdOrigen, importe: importeDe(f) })) ?? null,
    });
  };
  const moverFilas = async (filas, destino) => {
    const aMover = filasAMover(filas, destino);
    let movidas = 0;
    let conRegla = 0;
    let fallidas = 0;
    for (const f of aMover) {
      try {
        const res = await gestionFetch('/api/apertura/reglas', { method: 'POST', body: JSON.stringify(cuerpoMover(f, destino)) });
        if (res.ok) movidas += 1;
        else if (res.status === 409) conRegla += 1;
        else fallidas += 1;
      } catch {
        fallidas += 1;
      }
    }
    queryClient.invalidateQueries({ queryKey: ['apertura-reglas'] });
    refrescarCompras(queryClient);
    setTildadas(new Map());
    const yaEstaban = filas.length - aMover.length;
    const detalle = [
      conRegla ? `${conRegla} ya tenía${conRegla !== 1 ? 'n' : ''} una apertura propia` : null,
      yaEstaban ? `${yaEstaban} ya estaba${yaEstaban !== 1 ? 'n' : ''} en ${destino.etiqueta}` : null,
      fallidas ? `${fallidas} no se pudo mover` : null,
    ].filter(Boolean).join(' · ');
    if (movidas > 0 && !conRegla && !fallidas) toast.success(`${movidas} registro${movidas !== 1 ? 's' : ''} movido${movidas !== 1 ? 's' : ''} a ${destino.etiqueta}`);
    else if (movidas > 0) toast.warning(`${movidas} movido${movidas !== 1 ? 's' : ''} a ${destino.etiqueta}`, { description: detalle });
    else toast.error('No se movió ningún registro', { description: detalle || undefined });
  };
  // Cuenta corriente del proveedor de la fila (empleados y gastos varios: por lugar + código + nombre).
  const [ctaCte, setCtaCte] = useState(null);
  const origenDe = (item) => origenDeFila({
    codigo: item.codigoProveedor, pdvId: lugarDeCompra(item.pdvCompraId), nombre: item.proveedor, tieneMaestro: !!item.proveedorRef,
  });
  const abrirCtaCte = (item) => {
    const origen = origenDe(item);
    const pdvId = lugarDeCompra(item.pdvCompraId);
    if (origen) setCtaCte({ origen, resaltado: item.comprobante && pdvId != null ? { pdvId, comprobante: item.comprobante } : null });
  };
  const [pendiente, setPendiente] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [tildadas, setTildadas] = useState(() => new Map());

  // Se retiene el último filtro; el período elegido adentro manda sobre el del click y se
  // reinicia con cada apertura nueva.
  const [stable, setStable] = useState(filter);
  const [periodo, setPeriodo] = useState(filter ? periodoInicial(filter) : null);
  if (filter !== null && filter !== stable) {
    setStable(filter);
    setPeriodo(periodoInicial(filter));
  }
  const conPeriodo = stable != null && !stable.rowId && periodo != null;
  const efectivo = useMemo(() => (stable && conPeriodo ? aplicarPeriodo(stable, periodo) : stable), [stable, conPeriodo, periodo]);

  // En Año / Histórico hay tope de registros: el buscador también filtra en el servidor.
  const buscaEnServidor = conPeriodo && periodo.modo !== 'mes';
  const [qServidor, setQServidor] = useState('');
  const q = buscaEnServidor ? qServidor : '';
  // Las tildadas se limpian al cambiar de período: no actuar sobre filas que no se ven.
  const claveTildadas = JSON.stringify(efectivo);
  const [clavePrevia, setClavePrevia] = useState(claveTildadas);
  if (clavePrevia !== claveTildadas) {
    setClavePrevia(claveTildadas);
    setTildadas(new Map());
  }
  const queryKey = useMemo(() => ['gestionDetalle', businessId, efectivo, q, modo], [businessId, efectivo, q, modo]);
  const resetKey = useMemo(() => ['gestionDetalle', stable], [stable]);
  const queryFn = useCallback(() => GestionAPI.detalle({ ...efectivo, modo, q }), [efectivo, modo, q]);

  const { data: maestros } = useQuery({
    queryKey: ['gestionConceptosEdicion', businessId],
    queryFn: () => GestionAPI.conceptosEdicion(),
    staleTime: 5 * 60_000,
    enabled: filter !== null,
  });
  const conceptos = useMemo(() => maestros?.conceptos ?? [], [maestros]);
  const rubros = useMemo(() => maestros?.rubros ?? [], [maestros]);

  const conSeleccion = !stable?.rowId;
  const cambiarTildadas = useCallback((items, tildar) => {
    setTildadas((prev) => {
      const n = new Map(prev);
      for (const it of items) { if (tildar) n.set(it.rowId, it); else n.delete(it.rowId); }
      return n;
    });
  }, []);

  // Las otras tildadas y lo que se les aplica: solo lo que cambió. El importe no se replica, salvo $0.
  const loteDe = (state) => {
    if (!tildadas.has(state.rowId) || tildadas.size < 2) return null;
    const imp = resolverImporteParaPatch({ esDistribuida: state.esDistribuida, importeInput: state.importeManual, importeInicial: state.importeInicial });
    const enCero = imp.ok && imp.incluir && imp.value === 0;
    const cuerpo = cambiosLote(state.inicial, { fecha: state.fechaManual, concepto: state.conceptoCodigoManual, observac: state.observacManual }, enCero);
    if (Object.keys(cuerpo).length === 0) return null;
    return { otras: [...tildadas.values()].filter((f) => f.rowId !== state.rowId), cuerpo };
  };

  async function guardarConfirmado(state) {
    const imp = resolverImporteParaPatch({ esDistribuida: state.esDistribuida, importeInput: state.importeManual, importeInicial: state.importeInicial });
    if (!imp.ok) { setSaveError('El importe ingresado no es un número válido.'); return; }
    setSaving(true);
    setSaveError(null);
    // Una compra repartida solo cambia su observación hasta que esté el motor de apertura.
    const cuerpo = state.esDistribuida
      ? { observacManual: state.observacManual !== '' ? state.observacManual : null }
      : {
        ...(imp.incluir ? { importeManual: imp.value } : {}),
        fechaManual: state.fechaManual !== '' ? new Date(`${state.fechaManual}T12:00:00Z`).toISOString() : null,
        conceptoCodigoManual: state.conceptoCodigoManual !== '' ? state.conceptoCodigoManual : null,
        observacManual: state.observacManual !== '' ? state.observacManual : null,
      };
    try {
      await GestionAPI.editarCompra(state.rowId, cuerpo);
    } catch (err) {
      // Un 4xx trae un mensaje accionable; un fallo de red, el genérico.
      setSaveError(err?.status ? err.message : 'No se pudo guardar. Intentá de nuevo.');
      setSaving(false);
      return;
    }
    const lote = loteDe(state);
    let fallidas = 0;
    if (lote) {
      for (const f of lote.otras) {
        try { await GestionAPI.editarCompra(f.rowId, lote.cuerpo); } catch { fallidas += 1; }
      }
    }
    // Ya guardó: un fallo del refresco no es "no se guardó". El resto se refresca de fondo.
    DEPENDIENTES.forEach((k) => { queryClient.invalidateQueries({ queryKey: [k] }); });
    try { await queryClient.refetchQueries({ queryKey }); } catch (err) { console.error('[detalle compras] guardó pero falló el refresco', err); }
    setEditing(null);
    if (lote) {
      const total = lote.otras.length + 1;
      setTildadas(new Map());
      setAviso(fallidas
        ? { sev: 'warning', txt: `${total - fallidas} de ${total} registros actualizados · ${fallidas} no se pudo guardar` }
        : { sev: 'success', txt: `${total} registros actualizados` });
    } else {
      setAviso({ sev: 'success', txt: 'Registro actualizado' });
    }
    setSaving(false);
  }

  const guardar = (state) => { if (loteDe(state)) setPendiente(state); else guardarConfirmado(state); };
  const cerrar = () => { setEditing(null); setLineas(null); setTildadas(new Map()); setSaveError(null); onClose(); };

  const abrirEdicion = (item) => {
    const esDistribuida = item.esDistribuido || item.distribucionId != null;
    const importeInicial = texto(esDistribuida ? item.importeBase : item.importeManual ?? item.importe);
    const concepto = item.conceptoCodigoManual ?? item.conceptoCaja?.codigo ?? '';
    setEditing({
      rowId: String(item.rowId),
      distribucionId: item.distribucionId,
      esDistribuida,
      importeManual: importeInicial,
      importeInicial,
      fechaManual: fechaInput(item.fechaManual ?? item.fecha),
      conceptoCodigoManual: concepto,
      observacManual: item.observacManual ?? '',
      rubroFiltro: conceptos.find((o) => o.codigo === concepto)?.rubroCodigo ?? SIN_RUBRO_CODE,
      inicial: { fecha: fechaInput(item.fechaManual ?? item.fecha), concepto, observac: item.observacManual ?? '' },
    });
  };

  const renderFila = (item) => {
    const key = `${item.distribucionId != null ? `d-${item.distribucionId}` : item.rowId}${item.pagoRef ? `|${item.pagoRef}` : ''}`;
    const seleccion = conSeleccion ? { tildado: tildadas.has(item.rowId), onToggle: () => cambiarTildadas([item], !tildadas.has(item.rowId)) } : null;
    const enEdicion = editing?.rowId === item.rowId && editing.distribucionId === item.distribucionId;
    if (enEdicion) {
      const bloqueada = editing.esDistribuida;
      const opciones = editing.rubroFiltro === SIN_RUBRO_CODE ? conceptos.filter((o) => !o.rubroCodigo) : conceptos.filter((o) => o.rubroCodigo === editing.rubroFiltro);
      return (
        <TableRow key={key} sx={{ bgcolor: 'grey.50' }}>
          <CheckFila seleccion={seleccion} />
          <TableCell sx={celdaEdicion}>
            <Box component="input" type="date" disabled={bloqueada} value={editing.fechaManual} onChange={(e) => setEditing({ ...editing, fechaManual: e.target.value })} sx={sxInput} />
          </TableCell>
          <TableCell sx={{ ...celda, color: 'text.secondary' }}><FechaPago item={item} /></TableCell>
          <TableCell sx={{ ...celda, color: 'text.secondary' }}>{nombreProveedor(item)}</TableCell>
          <TableCell sx={{ ...celda, color: 'text.secondary' }}>{normalize(item.detalle)}</TableCell>
          <TableCell sx={celdaEdicion}>
            <Box component="input" type="text" placeholder={item.observac ? normalize(item.observac) : ''} value={editing.observacManual} onChange={(e) => setEditing({ ...editing, observacManual: e.target.value })} sx={sxInput} />
          </TableCell>
          <TableCell sx={celdaEdicion}>
            <Select
              size="small" fullWidth disabled={bloqueada} value={editing.rubroFiltro}
              onChange={(e) => {
                const rubro = e.target.value;
                const sigue = conceptos.some((o) => o.codigo === editing.conceptoCodigoManual && (rubro === SIN_RUBRO_CODE ? !o.rubroCodigo : o.rubroCodigo === rubro));
                setEditing({ ...editing, rubroFiltro: rubro, conceptoCodigoManual: sigue ? editing.conceptoCodigoManual : '' });
              }}
              sx={{ height: 28, fontSize: 12 }}
            >
              {rubros.map((o) => <MenuItem key={o.codigo} value={o.codigo} sx={{ fontSize: 12 }}>{o.nombre}</MenuItem>)}
              <MenuItem value={SIN_RUBRO_CODE} sx={{ fontSize: 12, color: 'text.secondary' }}>{SIN_RUBRO_NOMBRE}</MenuItem>
            </Select>
          </TableCell>
          <TableCell sx={celdaEdicion}>
            <Autocomplete
              size="small" disabled={bloqueada} disableClearable={false} options={opciones}
              value={conceptos.find((o) => o.codigo === editing.conceptoCodigoManual) ?? null}
              onChange={(_, v) => setEditing({ ...editing, conceptoCodigoManual: v?.codigo ?? '' })}
              getOptionLabel={(o) => o.nombre}
              isOptionEqualToValue={(a, b) => a.codigo === b.codigo}
              filterOptions={(ops, st) => {
                const t = st.inputValue.toLowerCase();
                return t ? ops.filter((o) => `${o.codigo} ${o.nombre}`.toLowerCase().includes(t)) : ops;
              }}
              noOptionsText="Sin resultados."
              slotProps={{ popper: { sx: { minWidth: 256 } }, listbox: { sx: { fontSize: 12 } } }}
              renderInput={(p) => <TextField {...p} placeholder="Sin cambio" sx={{ '& .MuiInputBase-root': { height: 28, py: '0 !important', fontSize: 12 } }} />}
            />
          </TableCell>
          <TableCell sx={celdaEdicion}>
            <Box component="input" type="text" inputMode="decimal" disabled={bloqueada} value={editing.importeManual} onChange={(e) => setEditing({ ...editing, importeManual: e.target.value })} sx={{ ...sxInput, textAlign: 'right' }} />
          </TableCell>
          <TableCell sx={{ px: 1, py: 0.5 }}><EditActionButtons onSave={() => guardar(editing)} onCancel={() => setEditing(null)} saving={saving} /></TableCell>
        </TableRow>
      );
    }
    const fecha = item.fechaGasto ?? item.fechaManual ?? item.fecha;
    const importe = item.importeVista ?? item.importeManual ?? item.importe;
    const concepto = item.conceptoCajaManual ?? item.conceptoCaja;
    const observacion = item.observacManual ?? item.observac ?? '';
    const prov = nombreProveedor(item);
    return (
      <TableRow key={key} hover className="group" selected={!!seleccion?.tildado} sx={{ '&:hover .lapiz': { opacity: 1 } }}>
        <CheckFila seleccion={seleccion} />
        <TableCell sx={celda}>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>{esEditada(item) && <EditedDot />}{fmtDate(fecha)}</Box>
        </TableCell>
        <TableCell sx={{ ...celda, color: 'text.secondary' }}><FechaPago item={item} /></TableCell>
        <TableCell sx={celda} title={prov}>
          {origenDe(item) ? (
            <Box component="button" type="button" title="Ver cuenta corriente" onClick={() => abrirCtaCte(item)} sx={{ all: 'unset', cursor: 'pointer', color: '#0369a1', textDecoration: 'underline dotted', textUnderlineOffset: 2, '&:hover': { textDecorationStyle: 'solid' } }}>{prov}</Box>
          ) : prov}
        </TableCell>
        <TableCell sx={celda} title={item.detalle ?? undefined}>
          {item.detalle ? (
            <Box component="button" type="button" onClick={() => setLineas({ rowId: item.rowId, detalle: item.detalle })} sx={{ all: 'unset', cursor: 'pointer', color: 'text.secondary', fontFamily: 'monospace', fontSize: 12, '&:hover': { color: 'text.primary', textDecoration: 'underline' } }}>
              {item.detalle}
            </Box>
          ) : <Box component="span" sx={{ color: 'text.secondary' }}>—</Box>}
        </TableCell>
        {observacion.trim() || !item.obsInsumos
          ? <TableCell sx={{ ...celda, color: 'text.secondary' }} title={normalize(observacion || null)}>{normalize(observacion || null)}</TableCell>
          : <TableCell sx={{ ...celda, color: 'text.disabled', fontStyle: 'italic' }} title={`Insumos de la factura (sin observación): ${item.obsInsumos}`}>{item.obsInsumos}</TableCell>}
        <TableCell sx={celda} title={normalize(concepto?.rubro?.nombre)}>{normalize(concepto?.rubro?.nombre)}</TableCell>
        <TableCell sx={celda} title={normalize(concepto?.nombre)}>{normalize(concepto?.nombre)}</TableCell>
        <TableCell sx={{ ...celda, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {fmtARS(importe != null ? Number(importe) : null)}<Semaforo estado={item.estadoPago} />
        </TableCell>
        <TableCell sx={{ px: 1, py: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EditTriggerButton onClick={() => abrirEdicion(item)} />
            <BotonAperturaRegistro panel={aperturaPanel} rowId={item.rowId} onClick={() => abrirAperturaFila(item)} />
            {localesApertura && (() => {
              // Con la fila tildada actúa sobre todas las tildadas; si no, solo sobre ella.
              const filas = (tildadas.has(item.rowId) ? [...tildadas.values()] : [item]).map(filaMovible);
              return <ScopeGestion><MoverPdvButton filas={filas} importeTotal={filas.reduce((a, f) => a + importeDe(f), 0)} locales={localesApertura} onMover={moverFilas} /></ScopeGestion>;
            })()}
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  const lotePendiente = pendiente ? loteDe(pendiente) : null;
  const nota = editing && tildadas.has(editing.rowId) && tildadas.size > 1
    ? `Fecha, concepto y observación se aplican a los ${tildadas.size} tildados; el importe, solo a este (salvo $0: va a todos)`
    : editing?.esDistribuida ? 'Esta compra está repartida entre negocios: por ahora solo se puede cambiar su observación' : null;

  return (
    <>
      <DetalleModalShell
        open={filter !== null}
        onClose={cerrar}
        title="Detalle de compras"
        subtitle={nombreLugar}
        cols={COLS}
        queryKey={queryKey}
        queryFn={queryFn}
        resetKey={resetKey}
        onServerQuery={buscaEnServidor ? setQServidor : undefined}
        searchFields={searchFields}
        sortFn={sortCompras}
        seleccion={conSeleccion ? { ids: new Set(tildadas.keys()), idDe: (r) => r.rowId, onCambiar: cambiarTildadas, onLimpiar: () => setTildadas(new Map()) } : undefined}
        saveError={saveError}
        footerNote={nota}
        headerControls={conPeriodo ? <DetallePeriodoControls periodo={periodo} onChange={setPeriodo} /> : null}
        periodoLabel={conPeriodo ? labelPeriodo(periodo) : null}
        renderRow={renderFila}
      />
      <ModalAperturaPanel panel={aperturaPanel} />
      {ctaCte && <ScopeGestion><CtaCteModal origen={ctaCte.origen} resaltado={ctaCte.resaltado} onCerrar={() => setCtaCte(null)} /></ScopeGestion>}
      <VerFactura rowId={lineas?.rowId ?? null} detalle={lineas?.detalle ?? null} onClose={() => setLineas(null)} />
      <Dialog open={pendiente !== null} onClose={() => setPendiente(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16 }}>Aplicar a los registros tildados</DialogTitle>
        <DialogContent sx={{ fontSize: 14 }}>
          {lotePendiente && `Se cambia ${describirCambios(lotePendiente.cuerpo)} en los ${lotePendiente.otras.length + 1} registros tildados${'importeManual' in lotePendiente.cuerpo ? '' : ' (el importe solo en este)'}. ¿Confirmás?`}
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setPendiente(null)}>Cancelar</Button>
          <Button size="small" variant="contained" disabled={saving} onClick={() => { const s = pendiente; setPendiente(null); if (s) guardarConfirmado(s); }}>Confirmar y guardar</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aviso ? <Alert severity={aviso.sev} variant="filled" onClose={() => setAviso(null)}>{aviso.txt}</Alert> : undefined}
      </Snackbar>
    </>
  );
}
