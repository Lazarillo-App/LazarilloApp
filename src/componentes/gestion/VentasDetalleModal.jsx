// src/componentes/gestion/VentasDetalleModal.jsx
// Detalle de ventas (lazarillo_gestion/components/dashboard/ventas-detalle-modal.tsx): las ventas
// de la celda clickeada, con su importe editable.

import React, { useCallback, useMemo, useState } from 'react';
import { Box, TableRow, TableCell } from '@mui/material';
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
  { label: 'Mesa' },
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

const searchFields = (i) => [i.tipo, i.cobro, i.turno, i.comprobant, i.mesa, i.mozo, i.local?.nombre];
const celda = { px: 1.5, py: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

export default function VentasDetalleModal({ filter, onClose }) {
  const { businessId } = usePanelGestion();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
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
  const cerrar = () => { setEditing(null); setSaveError(null); onClose(); };

  return (
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
            <TableCell sx={celda}>{normalize(item.mozo)}</TableCell>
            <TableCell sx={{ ...celda, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {enEdicion ? (
                <Box
                  component="input" type="text" inputMode="decimal" autoFocus value={editing.importeManual}
                  onChange={(e) => setEditing({ ...editing, importeManual: e.target.value })}
                  sx={{ width: '100%', height: 28, border: 1, borderColor: 'divider', borderRadius: 1, px: 0.5, textAlign: 'right', fontSize: 12 }}
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
  );
}
