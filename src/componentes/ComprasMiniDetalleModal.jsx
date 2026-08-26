/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/componentes/ComprasMiniDetalleModal.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Button, Typography, Stack, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Select, MenuItem, FormControl, InputLabel,
  Popover, Divider, Box, TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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

// Paleta ámbar de bonificaciones (spec §5): el chip de promoción es una ACCIÓN,
// se distingue de los chips verdes (datos del período) por color y posición.
const AMBER = {
  main: '#d97706',      // texto/acento ámbar
  bg: '#fffbeb',        // fondo banda / distintivo
  border: '#fcd34d',    // borde de la banda
  strong: '#b45309',    // texto énfasis
};

// Ratios ofrecidos en el selector manual (spec §5.3 "O elegí otra")
const RATIOS_MANUAL = [2, 3, 4];

/* ══════════════════════════════════════════════════════════
   CONTENIDO reutilizable (sin Dialog). Se usa:
   - dentro de ComprasMiniDetalleModal (envuelto en Dialog)
   - inline en la pestaña de compras del insumo (TabComprasInsumo)
   El prop `open` sigue existiendo para gatillar los fetch; cuando
   se usa inline, pasar open={true}.
══════════════════════════════════════════════════════════ */
export function ComprasDetalleContenido({
  open = true,
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

  // ─────────── Bonificaciones ───────────
  const [bonif, setBonif] = useState(null);        // respuesta de /bonificacion/estado
  const [bonifLoading, setBonifLoading] = useState(false);
  const [bonifBusy, setBonifBusy] = useState(false); // aplicar/descartar en curso
  const [popoverOpen, setPopoverOpen] = useState(false);
  const chipRef = useRef(null);
  const anchorRectRef = useRef(null); // cachea la posición del chip para que el popover no salte durante el re-render

  const [ratioCustom, setRatioCustom] = useState('');

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

  // ─────────── Fetch estado de bonificación ───────────
  const fetchBonif = useCallback(async () => {
    if (!insumoId || !businessId) return;
    setBonifLoading(true);
    const token = localStorage.getItem('token') || '';
    try {
      const res = await fetch(`${BASE}/insumos/${insumoId}/bonificacion/estado`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      });
      const data = await res.json().catch(() => null);
      setBonif(data?.ok ? data : null);
    } catch {
      setBonif(null);
    } finally {
      setBonifLoading(false);
    }
  }, [insumoId, businessId]);

  useEffect(() => {
    if (open) fetchBonif();
    else { setBonif(null); setPopoverOpen(false); setRatioCustom(''); }
  }, [open, fetchBonif]);

  // Aplicar promoción: n opcional (manual). Sin n → usa la detección automática.
  const aplicarPromo = useCallback(async (n = null) => {
    if (!insumoId || !businessId) return;
    setBonifBusy(true);
    const token = localStorage.getItem('token') || '';
    try {
      const res = await fetch(`${BASE}/insumos/${insumoId}/bonificacion/aplicar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(n != null ? { n } : {}),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        await fetchBonif();
        // Avisar al resto de la app que el costo del insumo cambió (cascada de recetas)
        window.dispatchEvent(new CustomEvent('insumos:updated', { detail: { insumoId } }));
        window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } }));
      }
    } catch { /* noop */ } finally {
      setBonifBusy(false);
    }
  }, [insumoId, businessId, fetchBonif]);

  const descartarPromo = useCallback(async () => {
    if (!insumoId || !businessId) return;
    setBonifBusy(true);
    const token = localStorage.getItem('token') || '';
    try {
      const res = await fetch(`${BASE}/insumos/${insumoId}/bonificacion/descartar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        await fetchBonif();
        window.dispatchEvent(new CustomEvent('insumos:updated', { detail: { insumoId } }));
        window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } }));
      }
    } catch { /* noop */ } finally {
      setBonifBusy(false);
    }
  }, [insumoId, businessId, fetchBonif]);

  const abrirPopover = useCallback(() => {
    setPopoverOpen(o => {
      if (!o && chipRef.current) anchorRectRef.current = chipRef.current.getBoundingClientRect();
      return !o;
    });
  }, []);
  const cerrarPopover = useCallback(() => setPopoverOpen(false), []);

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

  // ── Detección de comprobantes con bonificación (líneas en $0) para pintar la tabla ──
  // Agrupa las filas por comprobante (factura + purchase_id) y calcula facturadas/
  // bonificadas/recibidas. Sirve para la banda ámbar, el badge y el costo "si se aplicara".
  const compGrupos = useMemo(() => {
    const map = new Map();
    for (const it of sortedItems) {
      const key = `${it.factura ?? it.comprob ?? it.referencia ?? ''}__${it.purchase_id ?? ''}__${it._bizId ?? ''}`;
      if (!map.has(key)) {
        map.set(key, { facturadas: 0, bonificadas: 0, importe: 0, tieneBonif: false });
      }
      const g = map.get(key);
      const cant = Number(it.cantidad ?? 0);
      const total = Number(it.precio_total ?? it.importe ?? 0);
      if (total === 0) { g.bonificadas += cant; g.tieneBonif = true; }
      else { g.facturadas += cant; g.importe += total; }
    }
    // costo "si se aplicara" por grupo
    for (const g of map.values()) {
      const recibidas = g.facturadas + g.bonificadas;
      g.recibidas = recibidas;
      g.costoSiAplica = recibidas > 0 ? g.importe / recibidas : 0;
      g.ratioN = g.bonificadas > 0 ? g.facturadas / g.bonificadas : null;
      g.ratioEntero = g.ratioN != null && Math.abs(g.ratioN - Math.round(g.ratioN)) < 0.01
        ? Math.round(g.ratioN) : null;
    }
    return map;
  }, [sortedItems]);

  const keyDeItem = useCallback((it) =>
    `${it.factura ?? it.comprob ?? it.referencia ?? ''}__${it.purchase_id ?? ''}__${it._bizId ?? ''}`,
    []);

  // ¿Hay compras sin sucursal? Solo entonces tiene sentido la opción "Principal".
  const hayComprasSinSucursal = useMemo(() => {
    const all = [...(items || []), ...(extraItems || [])];
    return all.some(it => it.branch_id == null);
  }, [items, extraItems]);

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

    businesses.forEach(biz => {
      const bizId = Number(biz.id);
      map.set(bizId, {
        bizName: biz.nombre || biz.name || `Negocio #${bizId}`,
        bizColor: getBizColor(biz) || FALLBACK_COLORS[businesses.indexOf(biz) % FALLBACK_COLORS.length],
        branches: [],
      });
    });

    dynamicBranches.forEach(b => {
      const key = Number(b._bizId);
      if (map.has(key)) {
        map.get(key).branches.push(b);
      }
    });

    return map;
  }, [selectedBiz, dynamicBranches, businesses]);

  const unidadLabel = bonif?.unidad || insumoUnidad || 'u';

  // ─────────── Chip de bonificación (4 estados, spec §5.2) ───────────
  const renderChipBonif = () => {
    const estado = bonif?.estado || 'sin_promocion';
    const aplicada = estado === 'aplicada';
    const pendiente = estado === 'sugerencia_pendiente';
    const abierto = popoverOpen;

    const costoVigente = Number(bonif?.costo_vigente ?? 0);
    const promoLabel = aplicada ? (bonif?.promo || '') : null;
    const ahorroPct = aplicada && bonif?.sugerencia?.ahorro_pct != null
      ? bonif.sugerencia.ahorro_pct
      : null;

    // Estilo base según estado
    const bg = abierto ? '#1f2937' : (aplicada ? AMBER.bg : '#f8fafc');
    const fg = abierto ? '#fff' : (aplicada ? AMBER.strong : '#334155');
    const borderColor = aplicada ? AMBER.border : '#e2e8f0';

    return (
      <Box
        onClick={abrirPopover}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75,
          px: 1.25, py: 0.5, borderRadius: 999, cursor: 'pointer', userSelect: 'none',
          bgcolor: bg, color: fg, border: `1px solid ${borderColor}`,
          fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
          '&:hover': { filter: 'brightness(0.97)' },
        }}
      >
        <LocalOfferIcon sx={{ fontSize: 16, opacity: 0.8 }} />
        {aplicada && promoLabel && (
          <Box component="span" sx={{
            px: 0.75, py: 0.1, borderRadius: 1, fontSize: '0.72rem', fontWeight: 800,
            bgcolor: AMBER.main, color: '#fff',
          }}>
            {promoLabel}
          </Box>
        )}
        <span>{aplicada ? '' : 'Sin promoción · '}{fmtMoney(costoVigente)} / {unidadLabel}</span>
        {ahorroPct != null && (
          <Box component="span" sx={{ color: AMBER.strong, fontWeight: 700 }}>
            · −{fmtNum(ahorroPct, 1)} %
          </Box>
        )}
        {pendiente && (
          <Box component="span" sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.35,
            px: 0.75, py: 0.15, borderRadius: 1, fontSize: '0.68rem', fontWeight: 800,
            bgcolor: AMBER.main, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.03em',
          }}>
            <AccessTimeIcon sx={{ fontSize: 12 }} /> 1 sugerencia
          </Box>
        )}
        {abierto ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
      </Box>
    );
  };

  // ─────────── Popover (spec §5.3) ───────────
  const renderPopover = () => {
    const estado = bonif?.estado || 'sin_promocion';
    const aplicada = estado === 'aplicada';
    const pendiente = estado === 'sugerencia_pendiente';
    const costoVigente = Number(bonif?.costo_vigente ?? 0);
    const sug = bonif?.sugerencia || null;
    const facturaKey = bonif?.factura_key || null;
    const fecha = bonif?.fecha ? fmtFecha(bonif.fecha) : null;

    return (
      <Popover
        open={popoverOpen}
        anchorEl={() => ({
          nodeType: 1,
          getBoundingClientRect: () =>
            anchorRectRef.current || (chipRef.current
              ? chipRef.current.getBoundingClientRect()
              : new DOMRect(0, 0, 0, 0)),
        })}
        keepMounted
        disableScrollLock
        onClose={cerrarPopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxWidth: '92vw', borderRadius: 2, overflow: 'hidden' } }}
      >
        {/* Encabezado: costo vigente */}
        <Box sx={{ px: 2, pt: 1.75, pb: 1.5 }}>
          <Typography variant="caption" sx={{
            color: 'text.secondary', fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', fontSize: '0.68rem',
          }}>
            Costo de reposición — vigente hoy
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1, mt: 0.25 }}>
            {fmtMoney(costoVigente)}
            <Box component="span" sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'text.secondary', ml: 0.5 }}>
              / {unidadLabel}
            </Box>
          </Typography>
          {facturaKey && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
              {facturaKey.trim()}{fecha ? ` · ${fecha}` : ''}
              {aplicada ? ` · promoción ${bonif?.promo || ''} aplicada` : ' · sin promoción aplicada'}
            </Typography>
          )}
        </Box>

        {/* Bloque de sugerencia pendiente */}
        {pendiente && sug && (
          <Box sx={{
            mx: 1.5, mb: 1.5, p: 1.5, borderRadius: 1.5,
            bgcolor: AMBER.bg, borderLeft: `3px solid ${AMBER.main}`,
          }}>
            <Typography sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              color: AMBER.strong, fontWeight: 800, fontSize: '0.72rem',
              textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.75,
            }}>
              <AccessTimeIcon sx={{ fontSize: 14 }} /> Sugerencia
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.5 }}>
              La última compra trae <b>{fmtNum(bonif.bonificadas, 0)} unidades en $ 0</b> sobre{' '}
              {fmtNum(bonif.facturadas, 0)} facturadas. Es compatible con una promoción <b>{sug.promo}</b>.
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 1.25 }}>
              Si la aplicás, el costo pasa de{' '}
              <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{fmtMoney(costoVigente)}</span>{' '}
              a <b style={{ color: AMBER.strong }}>{fmtMoney(sug.costo_si_aplica)}</b>
              {sug.ahorro_pct != null && <> — −{fmtNum(sug.ahorro_pct, 1)} %</>}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small" variant="contained" disableElevation disabled={bonifBusy}
                onClick={() => aplicarPromo(null)}
                sx={{ bgcolor: AMBER.main, '&:hover': { bgcolor: AMBER.strong }, textTransform: 'none', fontWeight: 700 }}
              >
                Aplicar {sug.promo}
              </Button>
              <Button
                size="small" variant="outlined" disabled={bonifBusy}
                onClick={descartarPromo}
                sx={{ borderColor: '#cbd5e1', color: '#475569', textTransform: 'none', fontWeight: 700 }}
              >
                Descartar
              </Button>
            </Stack>
          </Box>
        )}

        {/* Si está aplicada: acción para volver a "sin promoción" */}
        {aplicada && (
          <Box sx={{ mx: 1.5, mb: 1.5 }}>
            <Button
              size="small" variant="outlined" fullWidth disabled={bonifBusy}
              onClick={descartarPromo}
              sx={{ borderColor: '#cbd5e1', color: '#475569', textTransform: 'none', fontWeight: 700 }}
            >
              Quitar promoción (volver a precio de lista)
            </Button>
          </Box>
        )}

        <Divider />

        {/* Selector manual: "O elegí otra" (spec §5.3) */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" sx={{
            color: 'text.secondary', fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', fontSize: '0.68rem',
          }}>
            O elegí otra
          </Typography>
          <Stack sx={{ mt: 0.75 }} divider={<Divider flexItem />}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.6 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Sin promoción</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                {fmtMoney(aplicada ? (bonif?.precio_lista ?? costoVigente) : costoVigente)} /{unidadLabel}
                {aplicada ? '' : ' · vigente'}
              </Typography>
            </Stack>
            {RATIOS_MANUAL.map((n) => {
              // costo hipotético manual = importe_real / (facturadas + facturadas/n)
              // importe_ultimo viene del endpoint: es lo efectivamente facturado
              // en el último comprobante (no depende del costo vigente ni de si
              // hay promo aplicada).
              const fact = Number(bonif?.facturadas ?? 0);
              const importeReal = Number(bonif?.importe_ultimo ?? 0);
              const recibidasN = fact > 0 ? fact + fact / n : 0;
              const costoN = recibidasN > 0 ? importeReal / recibidasN : 0;
              return (
                <Stack
                  key={n} direction="row" justifyContent="space-between" alignItems="center"
                  onClick={() => !bonifBusy && aplicarPromo(n)}
                  sx={{ py: 0.6, cursor: 'pointer', '&:hover': { color: AMBER.strong } }}
                >
                  <Typography variant="body2">{n} + 1 · {n + 1}x{n}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    {costoN > 0 ? `${fmtMoney(costoN)} /${unidadLabel}` : '—'}
                  </Typography>
                </Stack>
              );
            })}

            {/* Otra relación: ratio manual libre (spec §5.3) */}
            {(() => {
              const nCustom = parseInt(ratioCustom, 10);
              const valido = Number.isInteger(nCustom) && nCustom >= 1 && !RATIOS_MANUAL.includes(nCustom);
              const fact = Number(bonif?.facturadas ?? 0);
              const importeReal = Number(bonif?.importe_ultimo ?? 0);
              const recibidasN = valido && fact > 0 ? fact + fact / nCustom : 0;
              const costoN = recibidasN > 0 ? importeReal / recibidasN : 0;
              return (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.6 }}>
                  <Typography variant="body2" sx={{ flexShrink: 0 }}>Otra:</Typography>
                  <TextField
                    size="small" type="number" placeholder="N"
                    value={ratioCustom}
                    onChange={(e) => setRatioCustom(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && valido && !bonifBusy) aplicarPromo(nCustom); }}
                    inputProps={{ min: 1, step: 1, style: { padding: '4px 8px', width: 56 } }}
                    sx={{
                      '& .MuiOutlinedInput-root': { fontSize: '0.85rem' },
                      '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                        WebkitAppearance: 'none', margin: 0,
                      },
                      '& input[type=number]': { MozAppearance: 'textfield' },
                    }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', flex: 1 }}>
                    {valido && costoN > 0 ? `${nCustom} + 1 · ${fmtMoney(costoN)} /${unidadLabel}` : 'N + 1'}
                  </Typography>
                  <Button
                    size="small" variant="text" disabled={!valido || bonifBusy}
                    onClick={() => aplicarPromo(nCustom)}
                    sx={{ minWidth: 'auto', textTransform: 'none', fontWeight: 700, color: AMBER.strong }}
                  >
                    Aplicar
                  </Button>
                </Stack>
              );
            })()}
          </Stack>
          <Typography variant="caption" sx={{
            display: 'block', mt: 1, color: 'text.disabled', fontSize: '0.72rem', lineHeight: 1.4,
          }}>
            Lazarillo detecta pero nunca aplica solo. El costo cambia únicamente cuando lo confirmás acá.
          </Typography>
        </Box>
      </Popover>
    );
  };

  return (
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
                {hayComprasSinSucursal && (
                  <MenuItem value="main">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                      <span>Principal</span>
                    </Stack>
                  </MenuItem>
                )}

                {/* Modo "todos los negocios": agrupar por negocio con subheaders */}
                {selectedBiz === 'all' && branchesByBiz
                  ? Array.from(branchesByBiz.entries()).flatMap(([bizId, { bizName, bizColor, branches: bizBranches }]) => [
                    <MenuItem key={`header-${bizId}`} disabled sx={{ opacity: 1, py: 0.25, minHeight: 'auto' }}>
                      <Typography variant="caption" fontWeight={700} sx={{
                        fontSize: '0.65rem', textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: 'text.disabled',
                      }}>
                        {bizName}
                      </Typography>
                    </MenuItem>,

                    ...(hayComprasSinSucursal ? [(
                      <MenuItem key={`main-${bizId}`} value={`main-${bizId}`} sx={{ pl: 3 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: bizColor, flexShrink: 0 }} />
                          <span>Principal</span>
                        </Stack>
                      </MenuItem>
                    )] : []),

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

      {/* Chips de totales + chip de bonificación (alineado a la derecha, spec §5.1) */}
      {!isLoading && (
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Chip size="small" label={`${totales.facturas} compra${totales.facturas !== 1 ? 's' : ''}`}
            variant="outlined" sx={{ color: themeColors.primary, borderColor: themeColors.primary }} />
          <Chip size="small"
            label={`${fmtNum(totales.cantidad)} ${insumoUnidad || 'unidades'}`}
            variant="outlined" sx={{ color: themeColors.primary, borderColor: themeColors.primary }} />
          <Chip size="small" label={`Total: ${fmtMoney(totales.importe)}`}
            sx={{ bgcolor: `${themeColors.primary}15`, color: themeColors.primary, fontWeight: 700 }} />

          {/* separador flexible: empuja el chip de promoción al borde derecho */}
          <Box sx={{ flex: 1 }} />

          {!bonifLoading && bonif && (
            <Box ref={chipRef} sx={{ display: 'inline-flex' }}>
              {renderChipBonif()}
            </Box>
          )}
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

      {/* Leyenda de sucursales + referencia "Línea bonificada" */}
      {showBranchColumn && !isLoading && sortedItems.length > 0 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
          {selectedBiz === 'all' && branchesByBiz
            ? Array.from(branchesByBiz.entries()).flatMap(([bizId, { bizName, bizColor, branches: bizBranches }]) => [
              ...(hayComprasSinSucursal ? [(
                <Stack key={`leg-main-${bizId}`} direction="row" alignItems="center" spacing={0.5}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: bizColor, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary">
                    Principal <span style={{ opacity: 0.55, fontSize: '0.68rem' }}>({bizName})</span>
                  </Typography>
                </Stack>
              )] : []),
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
              {hayComprasSinSucursal && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: themeColors.primary, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary">Principal</Typography>
                </Stack>
              )}
              {dynamicBranches.map(branch => (
                <Stack key={`leg-${branch.id}`} direction="row" alignItems="center" spacing={0.5}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: branch.color || '#1976d2', flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary">{branch.name}</Typography>
                </Stack>
              ))}
            </>
          }
          {/* Referencia línea bonificada (spec §5.5) */}
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: AMBER.main, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">Línea bonificada</Typography>
          </Stack>
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

                // ── Bonificación: ¿esta línea es un $0? ¿su comprobante tiene bonif? ──
                const esBonificada = Number(it.precio_total ?? it.importe ?? 0) === 0;
                const grupo = compGrupos.get(keyDeItem(it));
                const compTieneBonif = grupo?.tieneBonif;
                const aplicadaEnInsumo = bonif?.estado === 'aplicada';

                // La fila anterior pertenece al mismo comprobante bonificado?
                const prev = sortedItems[i - 1];
                const esPrimeraDelGrupo = compTieneBonif &&
                  (!prev || keyDeItem(prev) !== keyDeItem(it));

                const rowBg = compTieneBonif
                  ? AMBER.bg
                  : ((showBizColumn || showBranchColumn) ? `${branchColor}12` : 'transparent');
                const borderLeft = compTieneBonif
                  ? `3px solid ${AMBER.main}`
                  : ((showBizColumn || showBranchColumn) ? `3px solid ${branchColor}60` : 'none');

                const branchName = branchId === 'main'
                  ? 'Principal'
                  : (dynamicBranches.find(b => String(b.id) === branchId)?.name
                    || (branches || []).find(b => String(b.id) === branchId)?.name
                    || `Suc. #${branchId}`);

                const colSpanTotal = 6 + (showBizColumn ? 1 : 0) + (showBranchColumn ? 1 : 0);

                return (
                  <React.Fragment key={i}>
                    {/* Banda de encabezado del grupo bonificado (spec §5.5) */}
                    {esPrimeraDelGrupo && grupo && (
                      <TableRow sx={{ bgcolor: AMBER.bg }}>
                        <TableCell colSpan={colSpanTotal} sx={{ py: 0.5, borderBottom: 'none' }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.5}>
                            <Typography variant="caption" sx={{ color: AMBER.strong, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocalOfferIcon sx={{ fontSize: 14 }} />
                              {(it.factura ?? it.comprob ?? it.referencia ?? '').toString().trim()} ·{' '}
                              {fmtNum(grupo.facturadas, 0)} facturadas + {fmtNum(grupo.bonificadas, 0)} bonificadas
                              {grupo.ratioEntero != null && ` · Compatible con ${grupo.ratioEntero}+1`}
                            </Typography>
                            <Typography variant="caption" sx={{ color: AMBER.strong, fontWeight: 700 }}>
                              {aplicadaEnInsumo
                                ? `Costo real: ${fmtMoney(grupo.costoSiAplica)} /u`
                                : `Si se aplicara: ${fmtMoney(grupo.costoSiAplica)} /u`}
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow
                      sx={{
                        bgcolor: rowBg,
                        borderLeft,
                        '&:hover': { bgcolor: compTieneBonif ? '#fff3d6' : `${branchColor}22` },
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
                        {esBonificada ? (
                          <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.75}>
                            <span style={{ color: '#94a3b8' }}>$ 0,00</span>
                            <Box component="span" sx={{
                              px: 0.6, py: 0.1, borderRadius: 0.75, fontSize: '0.62rem', fontWeight: 800,
                              letterSpacing: '0.03em', border: `1px solid ${AMBER.main}`, color: AMBER.strong,
                            }}>
                              BONIFICADA
                            </Box>
                          </Stack>
                        ) : (it.precio ? fmtMoney(it.precio) : '-')}
                      </TableCell>
                      <TableCell align="right" sx={{
                        fontWeight: 600,
                        color: esBonificada ? AMBER.strong : branchColor,
                      }}>
                        {fmtMoney(it.precio_total ?? it.importe)}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
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

      {/* Footer de totales + costo aplicado en recetas (spec §5.5) */}
      {!isLoading && (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body1" sx={{ flex: 1, fontWeight: 600 }}>
            Total del período:{' '}
            <span style={{ color: themeColors.primary, fontSize: '1.05rem' }}>
              {fmtMoney(totales.importe)}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: 8 }}>
              · {fmtNum(totales.cantidad)} {insumoUnidad || 'unidades'}
            </span>
          </Typography>

          {/* Costo aplicado en recetas: siempre el vigente (de lista si no hay promo aplicada) */}
          {bonif && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Costo aplicado en recetas:{' '}
              <span style={{
                color: bonif.estado === 'aplicada' ? AMBER.strong : themeColors.primary,
                fontWeight: 800, fontSize: '1.02rem',
              }}>
                {fmtMoney(bonif.costo_vigente)} / {unidadLabel}
              </span>
            </Typography>
          )}
        </Stack>
      )}

      {/* Popover del chip de bonificación */}
      {bonif && renderPopover()}
    </Stack>
  );
}

/* ══════════════════════════════════════════════════════════
   Wrapper MODAL: envuelve el contenido reutilizable en un Dialog.
   Se sigue usando desde la tabla de insumos (ComprasCell) igual que antes.
══════════════════════════════════════════════════════════ */
export default function ComprasMiniDetalleModal({
  open, onClose,
  insumoId, insumoNombre, insumoUnidad = '',
  rango, items = [], loading = false,
  businessId,
  businesses = [],
}) {
  const themeColors = useMemo(() => {
    if (typeof window === 'undefined') return { primary: '#0369a1' };
    const styles = getComputedStyle(document.documentElement);
    return { primary: styles.getPropertyValue('--color-primary')?.trim() || '#0369a1' };
  }, []);

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
        <ComprasDetalleContenido
          open={open}
          insumoId={insumoId}
          insumoNombre={insumoNombre}
          insumoUnidad={insumoUnidad}
          rango={rango}
          items={items}
          loading={loading}
          businessId={businessId}
          businesses={businesses}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained"
          sx={{ bgcolor: themeColors.primary, '&:hover': { filter: 'brightness(0.9)' } }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}