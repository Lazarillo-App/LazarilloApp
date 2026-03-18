/* eslint-disable no-unused-vars */
// src/componentes/ComprasMiniDetalleModal.jsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Button, Typography, Stack, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { format, parseISO } from 'date-fns';
import { es }               from 'date-fns/locale';
import { BASE }             from '../servicios/apiBase';

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

// Extrae color primario del branding de un negocio
const getBizColor = (biz) => {
  const raw = biz?.props?.branding?.primary || biz?.branding?.primary || null;
  if (raw && /^#[0-9a-fA-F]{3,6}$/.test(raw)) return raw;
  return null;
};

// Paleta de colores fallback para negocios sin branding
const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/**
 * ComprasMiniDetalleModal
 *
 * Props:
 *   open          bool
 *   onClose       fn
 *   insumoId      number
 *   insumoNombre  string
 *   rango         { from, to }
 *   items         array — compras del negocio activo (pre-cargadas por ComprasCell)
 *   loading       bool
 *   businessId    number  — negocio activo
 *   businesses    array   — todos los negocios de la org [{ id, name/nombre, props, branding }]
 */
export default function ComprasMiniDetalleModal({
  open, onClose,
  insumoId, insumoNombre,
  rango, items = [], loading = false,
  businessId,
  businesses = [],
}) {
  const themeColors = useMemo(() => {
    if (typeof window === 'undefined') return { primary: '#0369a1', secondary: '#10b981' };
    const styles = getComputedStyle(document.documentElement);
    return {
      primary:   styles.getPropertyValue('--color-primary')?.trim()   || '#0369a1',
      secondary: styles.getPropertyValue('--color-secondary')?.trim() || '#10b981',
    };
  }, []);

  // ── Selector de negocio ──
  // 'current' = negocio activo (usa items prop), 'all' = todos, o un bizId específico
  const [selectedBiz, setSelectedBiz] = useState('current');
  const [extraItems, setExtraItems] = useState([]);
  const [extraLoading, setExtraLoading] = useState(false);

  // Resetear al abrir
  useEffect(() => {
    if (open) {
      setSelectedBiz('current');
      setExtraItems([]);
    }
  }, [open]);

  // Construir mapa de colores por bizId
  const bizColorMap = useMemo(() => {
    const map = new Map();
    businesses.forEach((biz, idx) => {
      const color = getBizColor(biz) || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
      map.set(Number(biz.id), color);
    });
    return map;
  }, [businesses]);

  // Color del negocio activo
  const currentBizColor = bizColorMap.get(Number(businessId)) || themeColors.primary;

  // Opciones del selector
  const bizOptions = useMemo(() => {
    const opts = [{ value: 'current', label: 'Negocio actual' }];
    if (businesses.length > 1) {
      opts.push({ value: 'all', label: 'Todos los negocios' });
      businesses.forEach(biz => {
        const id = Number(biz.id);
        if (id !== Number(businessId)) {
          opts.push({
            value: String(id),
            label: biz.nombre || biz.name || `Negocio #${id}`,
          });
        }
      });
    }
    return opts;
  }, [businesses, businessId]);

  // Fetch compras de otro negocio o de todos
  const fetchForBiz = useCallback(async (bizSel) => {
    if (!insumoId || !rango?.from || !rango?.to) return;
    if (bizSel === 'current') { setExtraItems([]); return; }

    setExtraLoading(true);
    setExtraItems([]);

    const token = localStorage.getItem('token') || '';

    try {
      let allRows = [];

      const targetBizIds = bizSel === 'all'
        ? businesses.map(b => Number(b.id)).filter(id => id !== Number(businessId))
        : [Number(bizSel)];

      await Promise.all(targetBizIds.map(async (bid) => {
        try {
          const url = `${BASE}/purchases?insumo_id=${insumoId}&from=${rango.from}&to=${rango.to}&limit=500`;
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Business-Id': String(bid),
            },
          });
          const data = await res.json().catch(() => ({}));
          const rows = Array.isArray(data?.data) ? data.data : [];
          // Anotar cada fila con su bizId para colorear
          allRows = [...allRows, ...rows.map(r => ({ ...r, _bizId: bid }))];
        } catch { /* ignorar errores individuales */ }
      }));

      setExtraItems(allRows);
    } finally {
      setExtraLoading(false);
    }
  }, [insumoId, rango, businesses, businessId]);

  useEffect(() => {
    if (!open) return;
    fetchForBiz(selectedBiz);
  }, [selectedBiz, open, fetchForBiz]);

  // Items a mostrar según selección
  const displayItems = useMemo(() => {
    if (selectedBiz === 'current') {
      // items del negocio activo, anotados con su bizId
      return items.map(r => ({ ...r, _bizId: Number(businessId) }));
    }
    if (selectedBiz === 'all') {
      // items del activo + todos los extras
      const currentAnnotated = items.map(r => ({ ...r, _bizId: Number(businessId) }));
      return [...currentAnnotated, ...extraItems];
    }
    // Un negocio específico distinto al actual
    return extraItems;
  }, [selectedBiz, items, extraItems, businessId]);

  // Ordenar por fecha descendente
  const sortedItems = useMemo(() =>
    [...displayItems].sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''))),
    [displayItems]
  );

  const totales = useMemo(() => {
    let cantidad = 0, importe = 0;
    for (const it of sortedItems) {
      cantidad += Number(it.cantidad ?? 0);
      importe  += Number(it.precio_total ?? it.importe ?? 0);
    }
    return { cantidad, importe, facturas: sortedItems.length };
  }, [sortedItems]);

  const isLoading = loading || extraLoading;

  // Nombre del negocio para una fila
  const getBizName = useCallback((bizId) => {
    const biz = businesses.find(b => Number(b.id) === Number(bizId));
    return biz?.nombre || biz?.name || `Negocio #${bizId}`;
  }, [businesses]);

  const showBizColumn = selectedBiz === 'all' || (selectedBiz !== 'current' && businesses.length > 1);

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
          {/* Encabezado con rango, selector de negocio y totales */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
            {rango?.from && rango?.to && (
              <Typography variant="body2" color="text.secondary">
                📅 Período: {rango.from} — {rango.to}
              </Typography>
            )}

            {/* Selector de negocio — solo si hay más de uno */}
            {bizOptions.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Ver compras de</InputLabel>
                <Select
                  value={selectedBiz}
                  label="Ver compras de"
                  onChange={(e) => setSelectedBiz(e.target.value)}
                >
                  {bizOptions.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {opt.value !== 'current' && opt.value !== 'all' && (
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: bizColorMap.get(Number(opt.value)) || themeColors.primary,
                            flexShrink: 0,
                          }} />
                        )}
                        <span>{opt.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {/* Chips de totales */}
          {!isLoading && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={`${totales.facturas} compra${totales.facturas !== 1 ? 's' : ''}`}
                variant="outlined" sx={{ color: themeColors.primary, borderColor: themeColors.primary }} />
              <Chip size="small" label={`${fmtNum(totales.cantidad)} unidades`}
                variant="outlined" sx={{ color: themeColors.primary, borderColor: themeColors.primary }} />
              <Chip size="small" label={`Total: ${fmtMoney(totales.importe)}`}
                sx={{ bgcolor: `${themeColors.primary}15`, color: themeColors.primary, fontWeight: 700 }} />
            </Stack>
          )}

          {/* Leyenda de colores si hay múltiples negocios */}
          {showBizColumn && !isLoading && sortedItems.length > 0 && (
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              {(selectedBiz === 'all'
                ? [Number(businessId), ...businesses.filter(b => Number(b.id) !== Number(businessId)).map(b => Number(b.id))]
                : [Number(selectedBiz)]
              ).filter(id => sortedItems.some(r => Number(r._bizId) === id)).map(id => (
                <Stack key={id} direction="row" alignItems="center" spacing={0.5}>
                  <span style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: bizColorMap.get(id) || themeColors.primary,
                    flexShrink: 0,
                  }} />
                  <Typography variant="caption" color="text.secondary">
                    {id === Number(businessId) ? 'Negocio actual' : getBizName(id)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}

          {/* Tabla de detalle */}
          {isLoading ? (
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
                    {showBizColumn && (
                      <TableCell sx={{ fontWeight: 700 }}>Negocio</TableCell>
                    )}
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Precio unit.</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.map((it, i) => {
                    const bizId = Number(it._bizId);
                    const bizColor = bizColorMap.get(bizId) || themeColors.primary;
                    const rowBg = showBizColumn
                      ? `${bizColor}12` // 12 = ~7% opacidad
                      : 'transparent';
                    const borderLeft = showBizColumn
                      ? `3px solid ${bizColor}60`
                      : 'none';

                    return (
                      <TableRow
                        key={i}
                        sx={{
                          bgcolor: rowBg,
                          borderLeft,
                          '&:hover': { bgcolor: `${bizColor}22` },
                          transition: 'background 0.12s',
                        }}
                      >
                        <TableCell>{fmtFecha(it.fecha)}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                          {it.factura ?? it.comprob ?? it.referencia ?? '-'}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                          {it.proveedor_nombre ?? it.proveedor ?? '-'}
                        </TableCell>
                        {showBizColumn && (
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <span style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: bizColor, flexShrink: 0,
                              }} />
                              <Typography variant="caption" sx={{ fontSize: '0.78rem' }}>
                                {bizId === Number(businessId) ? 'Actual' : getBizName(bizId)}
                              </Typography>
                            </Stack>
                          </TableCell>
                        )}
                        <TableCell align="right">{fmtNum(it.cantidad)}</TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>
                          {it.precio ? fmtMoney(it.precio) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: bizColor }}>
                          {fmtMoney(it.precio_total ?? it.importe)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!isLoading && sortedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={showBizColumn ? 7 : 6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
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
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: 8 }}>
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