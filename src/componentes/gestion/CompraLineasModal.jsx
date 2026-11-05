// src/componentes/gestion/CompraLineasModal.jsx
// Líneas de una factura (lazarillo_gestion/components/dashboard/compra-lineas-modal.tsx): la
// factura completa, aunque en compras venga dividida en varias filas por concepto.

import React, { useMemo, useState } from 'react';
import { Box, Dialog, CircularProgress, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { fmtARS, normalize } from '@/gestion/formato';
import { sortCompraLineas, totalComprobante, totalLinea } from '@/gestion/compraLineas';
import { sxTablaPanel } from '@/gestion/estilos';

const COLS = [
  { key: 'codigo', label: 'Código' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'cantidad', label: 'Cant.', right: true },
  { key: 'medida', label: 'Medida' },
  { key: 'neto', label: 'Neto', right: true },
  { key: 'ivaTot', label: 'IVA', right: true },
  { key: 'impNtTot', label: 'Imp. int.', right: true },
  { key: 'total', label: 'Total', right: true },
  { key: 'observac', label: 'Observación' },
];
const num = (v) => (v != null ? Number(v) : null);

export default function CompraLineasModal({ compraId, comprobante, onClose }) {
  const { businessId } = usePanelGestion();
  const [sort, setSort] = useState(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['gestionCompraLineas', businessId, compraId],
    queryFn: () => GestionAPI.compraLineas(compraId),
    enabled: compraId !== null,
    staleTime: 60_000,
  });
  const lineas = useMemo(() => {
    const raw = data?.data ?? [];
    return sort ? [...raw].sort((a, b) => sortCompraLineas(a, b, sort)) : raw;
  }, [data, sort]);
  const total = useMemo(() => totalComprobante(lineas), [lineas]);
  const ordenar = (key) => setSort((prev) => {
    if (!prev || prev.key !== key) return { key, dir: 'asc' };
    return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
  });
  const titulo = normalize(comprobante);

  return (
    <Dialog open={compraId !== null} onClose={onClose} maxWidth={false} slotProps={{ paper: { sx: { minWidth: { sm: 520 }, maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 } } }}>
      <Box sx={{ px: 3, pt: 2, pb: 1.5, flexShrink: 0, fontSize: 16, fontWeight: 600 }}>{titulo === '—' ? 'Comprobante' : titulo}</Box>
      {isLoading && <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={32} /></Box>}
      {error && <Box sx={{ py: 6, textAlign: 'center', fontSize: 14, color: 'error.main' }}>Error al cargar los datos.</Box>}
      {!isLoading && !error && lineas.length === 0 && (
        <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: 14 }}>
          <InsertDriveFileOutlinedIcon sx={{ fontSize: 32, opacity: 0.4 }} />Sin detalle para este comprobante.
        </Box>
      )}
      {!isLoading && !error && lineas.length > 0 && (
        <>
          <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <Table size="small" sx={sxTablaPanel}>
              <TableHead>
                <TableRow>
                  {COLS.map((col) => {
                    const activa = sort?.key === col.key;
                    const Icono = activa ? (sort.dir === 'asc' ? KeyboardArrowUpIcon : KeyboardArrowDownIcon) : UnfoldMoreIcon;
                    return (
                      <TableCell key={col.key} sx={{ px: 2, py: 1, fontSize: 12, textAlign: col.right ? 'right' : 'left' }}>
                        <Box component="button" type="button" onClick={() => ordenar(col.key)} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.25, color: activa ? 'text.primary' : 'text.secondary' }}>
                          {col.label}<Icono sx={{ fontSize: 13, opacity: activa ? 1 : 0.4 }} />
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {lineas.map((l) => (
                  <TableRow key={l.rowId} hover sx={{ '& td': { px: 2, py: 1.25, fontSize: 13, whiteSpace: 'nowrap' } }}>
                    <TableCell sx={{ color: 'text.secondary' }}>{normalize(l.codigo)}</TableCell>
                    <TableCell>{normalize(l.nombre)}</TableCell>
                    <TableCell align="right">{l.cantidad != null ? Number(l.cantidad).toLocaleString('es-AR') : '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{normalize(l.medida)}</TableCell>
                    <TableCell align="right">{fmtARS(num(l.neto))}</TableCell>
                    <TableCell align="right">{fmtARS(num(l.ivaTot))}</TableCell>
                    <TableCell align="right">{fmtARS(num(l.impNtTot))}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{fmtARS(totalLinea(l))}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{normalize(l.observac)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          {/* Es la factura completa, no solo el concepto desde el que se abrió: puede no coincidir con la fila. */}
          <Box sx={{ borderTop: 1, borderColor: 'divider', px: 3, py: 1.25, flexShrink: 0, display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 11, color: 'text.secondary' }}>
            <span>{lineas.length} línea{lineas.length !== 1 ? 's' : ''}</span>
            <span>Total comprobante <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{fmtARS(total)}</Box></span>
          </Box>
        </>
      )}
    </Dialog>
  );
}
