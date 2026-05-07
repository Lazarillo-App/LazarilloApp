/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/componentes/ComprasMiniDetalleModal.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Button, Typography, Stack, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { BASE } from '../servicios/apiBase';
import { useBranch } from '@/hooks/useBranch';

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

const getBizColor = (biz) => {
  const raw = biz?.props?.branding?.primary || biz?.branding?.primary || null;
  if (raw && /^#[0-9a-fA-F]{3,6}$/.test(raw)) return raw;
  return null;
};

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ComprasMiniDetalleModal({
  open, onClose,
  insumoId, insumoNombre, insumoUnidad = '',
  rango, items = [], loading = false,
  businessId,
  businesses = [],
}) {
  const themeColors = useMemo(() => {
    if (typeof window === 'undefined') return { primary: '#0369a1', secondary: '#10b981' };
    const styles = getComputedStyle(document.documentElement);
    return {
      primary: styles.getPropertyValue('--color-primary')?.trim() || '#0369a1',
      secondary: styles.getPropertyValue('--color-secondary')?.trim() || '#10b981',
    };
  }, []);

  const { branches, rawBranches } = useBranch() || {};
  const hasSucursales = (rawBranches || []).length > 0;

  const [selectedBiz, setSelectedBiz] = useState('current');
  const [extraItems, setExtraItems] = useState([]);
  const [extraLoading, setExtraLoading] = useState(false);

  const [selectedBranch, setSelectedBranch] = useState('all');
  const [branchItems, setBranchItems] = useState([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const [dynamicBranches, setDynamicBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Ref para que fetchForBranch lea siempre el valor fresco sin ser dependencia del useCallback
  const dynamicBranchesRef = useRef([]);
  useEffect(() => { dynamicBranchesRef.current = dynamicBranches; }, [dynamicBranches]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setSelectedBiz('current');
      setExtraItems([]);
      setSelectedBranch('all');
      setBranchItems([]);
      setDynamicBranches(rawBranches || []);
    }
  }, [open]); // eslint-disable-line

  // Cargar sucursales según negocio seleccionado
  useEffect(() => {
    if (!open) return;

    if (selectedBiz === 'current') {
      setDynamicBranches(rawBranches || []);
      return;
    }

    if (selectedBiz === 'all') {
      setBranchesLoading(true);
      const token = localStorage.getItem('token') || '';
      Promise.all(
        businesses.map(async (biz) => {
          try {
            const res = await fetch(`${BASE}/businesses/${biz.id}/branches`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Business-Id': String(biz.id),
              },
            });
            const data = await res.json().catch(() => ({}));
            const list = data?.branches || [];
            return list.map(b => ({
              ...b,
              _bizId: Number(biz.id),
              _bizName: biz.nombre || biz.name || `Negocio #${biz.id}`,
            }));
          } catch { return []; }
        })
      ).then(results => {
        setDynamicBranches(results.flat());
      }).finally(() => setBranchesLoading(false));
      return;
    }

    // Negocio específico distinto al actual
    setBranchesLoading(true);
    const token = localStorage.getItem('token') || '';
    fetch(`${BASE}/businesses/${selectedBiz}/branches`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Business-Id': String(selectedBiz),
      },
    })
      .then(r => r.json()).catch(() => ({}))
      .then(data => setDynamicBranches(data?.branches || []))
      .finally(() => setBranchesLoading(false));

  }, [open, selectedBiz]); // eslint-disable-line

  // Resetear sucursal al cambiar negocio
  useEffect(() => {
    setSelectedBranch('all');
    setBranchItems([]);
  }, [selectedBiz]);

  // Mapa de colores por sucursal (contexto + dinámicas)
  const branchColorMap = useMemo(() => {
    const map = new Map();
    [...(branches || []), ...dynamicBranches].forEach(b => {
      if (!map.has(String(b.id))) {
        map.set(String(b.id), b.color || '#1976d2');
      }
    });
    return map;
  }, [branches, dynamicBranches]);

  // Fetch compras por sucursal
  const fetchForBranch = useCallback(async (branchSel, bizSel) => {
    if (!insumoId || !rango?.from || !rango?.to) return;
    if (branchSel === 'all') { setBranchItems([]); return; }

    setBranchLoading(true);
    setBranchItems([]);
    const token = localStorage.getItem('token') || '';

    // Determinar a qué negocio pertenece la sucursal (usando ref para no necesitarla como dep)
    const branchOwner = dynamicBranchesRef.current.find(b => String(b.id) === branchSel);
    const isMainOfBiz = branchSel.startsWith('main-');
    const branchParam = isMainOfBiz ? 'none' : branchSel;

    const bid = isMainOfBiz
      ? Number(branchSel.replace('main-', ''))
      : (dynamicBranchesRef.current.find(b => String(b.id) === branchSel)?._bizId
        ?? (bizSel === 'current' || bizSel === 'all' ? businessId : Number(bizSel)));

    try {
      const branchParam = branchSel === 'main' ? 'none' : branchSel;
      const url = `${BASE}/purchases?insumo_id=${insumoId}&from=${rango.from}&to=${rango.to}&limit=500&branch_id=${branchParam}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(bid),
        },
      });
      const data = await res.json().catch(() => ({}));
      setBranchItems(Array.isArray(data?.data) ? data.data.map(r => ({ ...r, _bizId: bid })) : []);
    } catch {
      setBranchItems([]);
    } finally {
      setBranchLoading(false);
    }
  }, [insumoId, rango, businessId]);

  useEffect(() => {
    if (!open) return;
    fetchForBranch(selectedBranch, selectedBiz);
  }, [selectedBranch, selectedBiz, open, fetchForBranch]);

  // Mapa de colores por negocio
  const bizColorMap = useMemo(() => {
    const map = new Map();
    businesses.forEach((biz, idx) => {
      const color = getBizColor(biz) || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
      map.set(Number(biz.id), color);
    });
    return map;
  }, [businesses]);

  // Opciones del selector de negocio
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

  // Fetch compras de otro negocio
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
            headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(bid) },
          });
          const data = await res.json().catch(() => ({}));
          const rows = Array.isArray(data?.data) ? data.data : [];
          allRows = [...allRows, ...rows.map(r => ({ ...r, _bizId: bid }))];
        } catch { }
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

  // Items a mostrar
  const displayItems = useMemo(() => {
    if (selectedBranch !== 'all') return branchItems;
    if (selectedBiz === 'current') return items.map(r => ({ ...r, _bizId: Number(businessId) }));
    if (selectedBiz === 'all') return [...items.map(r => ({ ...r, _bizId: Number(businessId) })), ...extraItems];
    return extraItems;
  }, [selectedBranch, branchItems, selectedBiz, items, extraItems, businessId]);

  const sortedItems = useMemo(() =>
    [...displayItems].sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''))),
    [displayItems]
  );

  const totales = useMemo(() => {
    let cantidad = 0, importe = 0;
    for (const it of sortedItems) {
      cantidad += Number(it.cantidad ?? 0);
      importe += Number(it.precio_total ?? it.importe ?? 0);
    }
    return { cantidad, importe, facturas: sortedItems.length };
  }, [sortedItems]);

  const isLoading = loading || extraLoading || branchLoading || branchesLoading;

  const getBizName = useCallback((bizId) => {
    const biz = businesses.find(b => Number(b.id) === Number(bizId));
    return biz?.nombre || biz?.name || `Negocio #${bizId}`;
  }, [businesses]);

  const showBizColumn = selectedBiz === 'all' || (selectedBiz !== 'current' && businesses.length > 1);
  const showBranchColumn = (hasSucursales || dynamicBranches.length > 0) && selectedBranch === 'all';

  // Agrupar sucursales por negocio cuando se ve "todos"
  const branchesByBiz = useMemo(() => {
    if (selectedBiz !== 'all') return null;
    const map = new Map();

    // Agregar una entrada por cada negocio (para su "Principal")
    businesses.forEach(biz => {
      const bizId = Number(biz.id);
      map.set(bizId, {
        bizName: biz.nombre || biz.name || `Negocio #${bizId}`,
        bizColor: getBizColor(biz) || FALLBACK_COLORS[businesses.indexOf(biz) % FALLBACK_COLORS.length],
        branches: [],
      });
    });

    // Agregar las sucursales reales a su negocio correspondiente
    dynamicBranches.forEach(b => {
      const key = Number(b._bizId);
      if (map.has(key)) {
        map.get(key).branches.push(b);
      }
    });

    return map;
  }, [selectedBiz, dynamicBranches, businesses]);

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

          {/* Encabezado */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
            {rango?.from && rango?.to && (
              <Typography variant="body2" color="text.secondary">
                📅 Período: {rango.from} — {rango.to}
              </Typography>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              {/* Selector de negocio */}
              {bizOptions.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
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

              {/* Selector de sucursal */}
              {(hasSucursales || dynamicBranches.length > 0) && (
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Sucursal</InputLabel>
                  <Select
                    value={selectedBranch}
                    label="Sucursal"
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <MenuItem value="all">Todas</MenuItem>
                    <MenuItem value="main">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                        <span>Principal</span>
                      </Stack>
                    </MenuItem>

                    {/* Modo "todos los negocios": agrupar por negocio con subheaders */}
                    {selectedBiz === 'all' && branchesByBiz
                      ? Array.from(branchesByBiz.entries()).flatMap(([bizId, { bizName, bizColor, branches: bizBranches }]) => [
                        // Subheader del negocio
                        <MenuItem key={`header-${bizId}`} disabled sx={{ opacity: 1, py: 0.25, minHeight: 'auto' }}>
                          <Typography variant="caption" fontWeight={700} sx={{
                            fontSize: '0.65rem', textTransform: 'uppercase',
                            letterSpacing: '0.07em', color: 'text.disabled',
                          }}>
                            {bizName}
                          </Typography>
                        </MenuItem>,

                        // Principal de este negocio
                        <MenuItem key={`main-${bizId}`} value={`main-${bizId}`} sx={{ pl: 3 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: bizColor, flexShrink: 0 }} />
                            <span>Principal</span>
                          </Stack>
                        </MenuItem>,

                        // Sucursales reales de este negocio
                        ...bizBranches.map(branch => (
                          <MenuItem key={`${bizId}-${branch.id}`} value={String(branch.id)} sx={{ pl: 3 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: branch.color || '#1976d2', flexShrink: 0 }} />
                              <span>{branch.name}</span>
                            </Stack>
                          </MenuItem>
                        )),
                      ])
                      : dynamicBranches.map(branch => (
                        <MenuItem key={branch.id} value={String(branch.id)}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: branch.color || '#1976d2', flexShrink: 0 }} />
                            <span>{branch.name}</span>
                          </Stack>
                        </MenuItem>
                      ))
                    }
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Stack>

          {/* Chips de totales */}
          {!isLoading && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={`${totales.facturas} compra${totales.facturas !== 1 ? 's' : ''}`}
                variant="outlined" sx={{ color: themeColors.primary, borderColor: themeColors.primary }} />
              <Chip size="small"
                label={`${fmtNum(totales.cantidad)} ${insumoUnidad || 'unidades'}`}
                variant="outlined" sx={{ color: themeColors.primary, borderColor: themeColors.primary }} />
              <Chip size="small" label={`Total: ${fmtMoney(totales.importe)}`}
                sx={{ bgcolor: `${themeColors.primary}15`, color: themeColors.primary, fontWeight: 700 }} />
            </Stack>
          )}

          {/* Leyenda de negocios */}
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
                    {getBizName(id)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}

          {/* Leyenda de sucursales */}
          {showBranchColumn && !isLoading && sortedItems.length > 0 && (
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              {selectedBiz === 'all' && branchesByBiz
                ? Array.from(branchesByBiz.entries()).flatMap(([bizId, { bizName, bizColor, branches: bizBranches }]) => [
                  <Stack key={`leg-main-${bizId}`} direction="row" alignItems="center" spacing={0.5}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: bizColor, flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary">
                      Principal <span style={{ opacity: 0.55, fontSize: '0.68rem' }}>({bizName})</span>
                    </Typography>
                  </Stack>,
                  ...bizBranches.map(branch => (
                    <Stack key={`leg-${branch.id}`} direction="row" alignItems="center" spacing={0.5}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: branch.color || '#1976d2', flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary">
                        {branch.name} <span style={{ opacity: 0.55, fontSize: '0.68rem' }}>({bizName})</span>
                      </Typography>
                    </Stack>
                  )),
                ])
                : <>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: themeColors.primary, flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary">Principal</Typography>
                  </Stack>
                  {dynamicBranches.map(branch => (
                    <Stack key={`leg-${branch.id}`} direction="row" alignItems="center" spacing={0.5}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: branch.color || '#1976d2', flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary">{branch.name}</Typography>
                    </Stack>
                  ))}
                </>
              }
            </Stack>
          )}
          {/* Tabla */}
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
                    {showBizColumn && <TableCell sx={{ fontWeight: 700 }}>Negocio</TableCell>}
                    {showBranchColumn && <TableCell sx={{ fontWeight: 700 }}>Sucursal</TableCell>}
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Precio unit.</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.map((it, i) => {
                    const bizId = Number(it._bizId);
                    const bizColor = bizColorMap.get(bizId) || themeColors.primary;
                    const branchId = it.branch_id ? String(it.branch_id) : 'main';

                    const branchColor = showBranchColumn
                      ? (branchId === 'main'
                        ? (bizColorMap.get(bizId) || themeColors.primary)  
                        : branchColorMap.get(branchId) || bizColor)
                      : bizColor;

                    const rowBg = (showBizColumn || showBranchColumn) ? `${branchColor}12` : 'transparent';
                    const borderLeft = (showBizColumn || showBranchColumn) ? `3px solid ${branchColor}60` : 'none';

                    const branchName = branchId === 'main'
                      ? 'Principal'
                      : (dynamicBranches.find(b => String(b.id) === branchId)?.name
                        || (branches || []).find(b => String(b.id) === branchId)?.name
                        || `Suc. #${branchId}`);

                    return (
                      <TableRow
                        key={i}
                        sx={{
                          bgcolor: rowBg,
                          borderLeft,
                          '&:hover': { bgcolor: `${branchColor}22` },
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
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: bizColor, flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ fontSize: '0.78rem' }}>
                                {getBizName(bizId)}
                              </Typography>
                            </Stack>
                          </TableCell>
                        )}

                        {showBranchColumn && (
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: branchColor }} />
                              <Typography variant="caption" sx={{ fontSize: '0.78rem' }}>
                                {branchName}
                              </Typography>
                            </Stack>
                          </TableCell>
                        )}

                        <TableCell align="right">
                          {fmtNum(it.cantidad)}
                          {insumoUnidad && (
                            <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.disabled', ml: 0.5 }}>
                              {insumoUnidad}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>
                          {it.precio ? fmtMoney(it.precio) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: branchColor }}>
                          {fmtMoney(it.precio_total ?? it.importe)}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {sortedItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6 + (showBizColumn ? 1 : 0) + (showBranchColumn ? 1 : 0)}
                        align="center"
                        sx={{ py: 3, color: 'text.secondary' }}
                      >
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
              · {fmtNum(totales.cantidad)} {insumoUnidad || 'unidades'}
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