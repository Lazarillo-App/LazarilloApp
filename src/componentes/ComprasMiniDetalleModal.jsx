// src/componentes/ComprasMiniDetalleModal.jsx
import React, { useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Button, Typography, Stack, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { format, parseISO } from 'date-fns';
import { es }               from 'date-fns/locale';

const fmtMoney = (v) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '-';
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (v, d = 2) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const fmtFecha = (s) => {
  try { return format(parseISO(String(s).slice(0, 10)), "EEE dd/MM/yyyy", { locale: es }); }
  catch { return String(s).slice(0, 10); }
};

/**
 * ComprasMiniDetalleModal
 *
 * Props:
 *   open          bool
 *   onClose       fn
 *   insumoNombre  string
 *   rango         { from, to }
 *   items         array de purchase_items del período para este insumo
 *                 cada item: { fecha, comprob/factura, proveedor_nombre, cantidad, precio, precio_total }
 *   loading       bool
 */
export default function ComprasMiniDetalleModal({ open, onClose, insumoNombre, rango, items = [], loading = false }) {
  const themeColors = useMemo(() => {
    if (typeof window === 'undefined') return { primary: '#0369a1', secondary: '#10b981' };
    const styles = getComputedStyle(document.documentElement);
    return {
      primary:   styles.getPropertyValue('--color-primary')?.trim()   || '#0369a1',
      secondary: styles.getPropertyValue('--color-secondary')?.trim() || '#10b981',
    };
  }, []);

  // Ordenar por fecha descendente
  const sortedItems = useMemo(() =>
    [...items].sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''))),
    [items]
  );

  const totales = useMemo(() => {
    let cantidad = 0, importe = 0;
    for (const it of sortedItems) {
      cantidad += Number(it.cantidad ?? 0);
      importe  += Number(it.precio_total ?? it.importe ?? 0);
    }
    return { cantidad, importe, facturas: sortedItems.length };
  }, [sortedItems]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ShoppingCartIcon sx={{ color: themeColors.primary }} />
          <span>Detalle de compras — {insumoNombre || 'Insumo'}</span>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Encabezado con rango y totales */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            {rango?.from && rango?.to && (
              <Typography variant="body2" color="text.secondary">
                📅 Período: {rango.from} — {rango.to}
              </Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={`${totales.facturas} compra${totales.facturas !== 1 ? 's' : ''}`}
                variant="outlined" sx={{ color: themeColors.primary, borderColor: themeColors.primary }} />
              <Chip size="small" label={`${fmtNum(totales.cantidad)} unidades`}
                variant="outlined" sx={{ color: themeColors.primary, borderColor: themeColors.primary }} />
              <Chip size="small" label={`Total: ${fmtMoney(totales.importe)}`}
                sx={{ bgcolor: `${themeColors.primary}15`, color: themeColors.primary, fontWeight: 700 }} />
            </Stack>
          </Stack>

          {/* Tabla de detalle */}
          {loading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary" mt={1}>Cargando compras...</Typography>
            </Stack>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Comprobante</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Proveedor</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Precio unit.</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.map((it, i) => (
                    <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell>{fmtFecha(it.fecha)}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        {it.factura ?? it.comprob ?? it.referencia ?? '-'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                        {it.proveedor_nombre ?? it.proveedor ?? '-'}
                      </TableCell>
                      <TableCell align="right">{fmtNum(it.cantidad)}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                        {it.precio ? fmtMoney(it.precio) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: themeColors.primary }}>
                        {fmtMoney(it.precio_total ?? it.importe)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && sortedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Sin compras registradas en el período seleccionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
          <Typography variant="body1" sx={{ flex: 1, fontWeight: 600 }}>
            Total del período:{' '}
            <span style={{ color: themeColors.primary, fontSize: '1.05rem' }}>
              {fmtMoney(totales.importe)}
            </span>
            <span style={{ color: 'text.secondary', fontSize: '0.85rem', marginLeft: 8 }}>
              · {fmtNum(totales.cantidad)} unidades
            </span>
          </Typography>
          <Button onClick={onClose} variant="contained"
            sx={{ bgcolor: themeColors.primary, '&:hover': { filter: 'brightness(0.9)' } }}>
            Cerrar
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}