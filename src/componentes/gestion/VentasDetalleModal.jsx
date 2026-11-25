// src/componentes/gestion/VentasDetalleModal.jsx
// Detalle de ventas (lazarillo_gestion/components/dashboard/ventas-detalle-modal.tsx): las ventas
// de la celda clickeada, con su importe editable.

import CampoImporte from '../CampoImporte';
import React, { useCallback, useMemo, useState } from 'react';
import { Box, TableRow, TableCell, Dialog, DialogTitle, DialogContent, IconButton, Table, TableHead, TableBody } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { fmtARS, fmtDate, normalize } from '@/gestion/formato';
import { parseImporteManual } from '@/gestion/parseImporteManual';
import DetalleModalShell, { EditActionButtons, EditTriggerButton, EditedDot } from './DetalleModalShell';

const COLS = [
  { label: 'Fecha', sortKey: 'fecha' },
  { label: 'Local' },
  { label: 'Tipo', sortKey: 'tipo' },
  { label: 'Cobro', sortKey: 'cobro' },
  { label: 'Turno', sortKey: 'turno' },
  { label: 'Comprobante' },
  { label: 'Mesa', sortKey: 'mesa' },
  { label: 'Cub.', right: true, sortKey: 'cubiertos', width: 64 },
  { label: 'Mozo' },
  { label: 'Importe', right: true, sortKey: 'importe' },
];
const DEPENDIENTES = ['gestionPivotVentas', 'gestionProyeccion', 'gestionAnual', 'gestionDiferenciaCaja'];

function sortVentas(a, b, sort) {
  if (sort.key === 'importe') {
    const va = Number(a.importeManual ?? a.importe ?? 0);
    const vb = Number(b.importeManual ?? b.importe ?? 0);
    return sort.dir === 'asc' ? va - vb : vb - va;
  }
  const cmp = String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), 'es', { numeric: true });
  return sort.dir === 'asc' ? cmp : -cmp;
}

// Cubiertos (usuaria 25/11/2026): total de lo que se ve y desglose por día y por turno. Con varios pagos,
// el POS pone los cubiertos en una sola fila (verificado en Comercio), así que se suman las filas.
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
// Igual que la versión celular: «MAÑ» → «Mañana».
const TURNOS = { 'MAÑ': 'Mañana', MAN: 'Mañana', TAR: 'Tarde', NOC: 'Noche' };
const nombreTurno = (t) => TURNOS[String(t || '').trim().toUpperCase()] || normalize(t) || 'Sin turno';
const importeDe = (v) => Number(v.importeManual ?? v.importe ?? 0) || 0;
const diaDe = (f) => String(f || '').slice(0, 10);
function totales(items) {
  const mesas = new Set();
  let cubiertos = 0;
  let importe = 0;
  for (const v of items) {
    mesas.add(`${diaDe(v.fecha)}|${v.local?.nombre || ''}|${v.comprobant || v.rowId}`);
    cubiertos += Number(v.cubiertos) || 0;
    importe += importeDe(v);
  }
  return { mesas: mesas.size, cubiertos, importe };
}
function agrupar(items, clave) {
  const m = new Map();
  for (const v of items) {
    const k = clave(v);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(v);
  }
  return [...m].map(([k, xs]) => ({ k, ...totales(xs) }));
}
const porCubierto = (t) => (t.cubiertos > 0 ? fmtARS(t.importe / t.cubiertos) : '—');

function DesgloseCubiertos({ items, onClose }) {
  const [vista, setVista] = useState('dia');
  if (!items) return null;
  const t = totales(items);
  const filas = vista === 'dia'
    ? agrupar(items, (v) => diaDe(v.fecha)).sort((a, b) => a.k.localeCompare(b.k))
    : agrupar(items, (v) => nombreTurno(v.turno)).sort((a, b) => b.cubiertos - a.cubiertos);
  const etiqueta = (k) => {
    if (vista !== 'dia') return k;
    const d = new Date(`${k}T12:00:00`);
    return Number.isNaN(d.getTime()) ? k : `${DIAS_CORTOS[d.getDay()]} ${fmtDate(k)}`;
  };
  const max = Math.max(1, ...filas.map((f) => f.cubiertos));
  const celdaN = { px: 1.25, py: 0.6, fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6, pb: 1 }}>
        Cubiertos
        <Box sx={{ fontSize: 13, fontWeight: 400, color: 'text.secondary' }}>
          {t.cubiertos.toLocaleString('es-AR')} cubiertos · {t.mesas.toLocaleString('es-AR')} mesas/comprobantes · {porCubierto(t)} por cubierto
        </Box>
        <IconButton aria-label="Cerrar" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.25 }}>
          {[['dia', 'Por día'], ['turno', 'Por turno']].map(([k, l]) => (
            <Box key={k} component="button" type="button" onClick={() => setVista(k)}
              sx={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, px: 1.5, py: 0.6, borderRadius: 999, border: 1,
                borderColor: vista === k ? '#15213E' : 'divider', bgcolor: vista === k ? '#15213E' : 'transparent', color: vista === k ? '#fff' : 'text.secondary' }}>
              {l}
            </Box>
          ))}
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ px: 1.25, fontSize: 12 }}>{vista === 'dia' ? 'Día' : 'Turno'}</TableCell>
              <TableCell sx={{ ...celdaN, fontSize: 12 }}>Cubiertos</TableCell>
              <TableCell sx={{ ...celdaN, fontSize: 12 }}>Mesas</TableCell>
              <TableCell sx={{ ...celdaN, fontSize: 12 }}>Ventas</TableCell>
              <TableCell sx={{ ...celdaN, fontSize: 12 }}>$ por cubierto</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.k}>
                <TableCell sx={{ px: 1.25, py: 0.6, fontSize: 12.5 }}>
                  {etiqueta(f.k)}
                  <Box sx={{ height: 3, borderRadius: 2, bgcolor: '#5BC2EA', width: `${(f.cubiertos / max) * 100}%`, mt: 0.4 }} />
                </TableCell>
                <TableCell sx={{ ...celdaN, fontWeight: 600 }}>{f.cubiertos.toLocaleString('es-AR')}</TableCell>
                <TableCell sx={celdaN}>{f.mesas.toLocaleString('es-AR')}</TableCell>
                <TableCell sx={celdaN}>{fmtARS(f.importe)}</TableCell>
                <TableCell sx={celdaN}>{porCubierto(f)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {t.cubiertos === 0 && <Box sx={{ mt: 1.5, fontSize: 12.5, color: 'text.secondary' }}>El POS no cargó cubiertos para estas ventas.</Box>}
      </DialogContent>
    </Dialog>
  );
}

const searchFields = (i) => [i.tipo, i.cobro, i.turno, i.comprobant, i.mesa, i.mozo, i.local?.nombre];
const celda = { px: 1.5, py: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

export default function VentasDetalleModal({ filter, onClose }) {
  const { businessId } = usePanelGestion();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [desglose, setDesglose] = useState(null); // filas para el desglose de cubiertos
  // Se retiene el último filtro para que no se vacíe durante la animación de cierre.
  const [stable, setStable] = useState(filter);
  if (filter !== null && filter !== stable) setStable(filter);

  const queryKey = useMemo(() => ['gestionDetalleVentas', businessId, stable], [businessId, stable]);
  const queryFn = useCallback(() => GestionAPI.detalleVentas(stable), [stable]);

  async function guardar(state) {
    const r = parseImporteManual(state.importeManual);
    if (!r.ok) { setSaveError('El importe ingresado no es un número válido.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await GestionAPI.editarVenta(state.rowId, { importeManual: r.value });
      await queryClient.refetchQueries({ queryKey });
      DEPENDIENTES.forEach((k) => { queryClient.invalidateQueries({ queryKey: [k] }); });
      setEditing(null);
    } catch {
      setSaveError('No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }
  const cerrar = () => { setEditing(null); setSaveError(null); setDesglose(null); onClose(); };

  return (
    <>
    <DesgloseCubiertos items={desglose} onClose={() => setDesglose(null)} />
    <DetalleModalShell
      open={filter !== null}
      onClose={cerrar}
      title="Detalle de ventas"
      cols={COLS}
      queryKey={queryKey}
      queryFn={queryFn}
      searchFields={searchFields}
      sortFn={sortVentas}
      saveError={saveError}
      resumen={(vistas) => {
        const t = totales(vistas);
        if (!t.cubiertos) return null;
        return (
          <Box component="button" type="button" onClick={() => setDesglose(vistas)} title="Ver por día y por turno"
            sx={{ all: 'unset', cursor: 'pointer', color: 'text.primary', fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
            {t.cubiertos.toLocaleString('es-AR')} cubiertos · {porCubierto(t)} por cubierto
          </Box>
        );
      }}
      renderRow={(item) => {
        const enEdicion = editing?.rowId === item.rowId;
        const importe = item.importeManual ?? item.importe;
        return (
          <TableRow key={item.rowId} hover sx={{ '&:hover .lapiz': { opacity: 1 } }}>
            <TableCell sx={celda}>{fmtDate(item.fecha)}</TableCell>
            <TableCell sx={celda}>{normalize(item.local?.nombre)}</TableCell>
            <TableCell sx={celda}>{normalize(item.tipo)}</TableCell>
            <TableCell sx={celda}>{normalize(item.cobro)}</TableCell>
            <TableCell sx={celda}>{normalize(item.turno)}</TableCell>
            <TableCell sx={celda}>{normalize(item.comprobant)}</TableCell>
            <TableCell sx={celda}>{normalize(item.mesa)}</TableCell>
            <TableCell sx={{ ...celda, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(item.cubiertos) > 0 ? item.cubiertos : ''}</TableCell>
            <TableCell sx={celda}>{normalize(item.mozo)}</TableCell>
            <TableCell sx={{ ...celda, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {enEdicion ? (
                // Miles mientras se escribe (Guía «Importes»); el estado sigue siendo texto "1234.5" para parseImporteManual.
                <CampoImporte
                  size="small" fullWidth autoFocus
                  value={editing.importeManual === '' || editing.importeManual == null ? '' : Number(editing.importeManual)}
                  onChange={(v) => setEditing({ ...editing, importeManual: v === '' ? '' : String(v) })}
                  sx={{ '& .MuiInputBase-root': { height: 28, fontSize: 12 }, '& .MuiInputAdornment-root p': { fontSize: 12 } }}
                />
              ) : (
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                  {item.importeManual != null && <EditedDot />}{fmtARS(importe != null ? Number(importe) : null)}
                </Box>
              )}
            </TableCell>
            <TableCell sx={{ px: 1, py: 0.5 }}>
              {enEdicion
                ? <EditActionButtons onSave={() => guardar(editing)} onCancel={() => setEditing(null)} saving={saving} />
                : <EditTriggerButton onClick={() => setEditing({ rowId: String(item.rowId), importeManual: item.importeManual ?? item.importe ?? '' })} />}
            </TableCell>
          </TableRow>
        );
      }}
    />
    </>
  );
}
