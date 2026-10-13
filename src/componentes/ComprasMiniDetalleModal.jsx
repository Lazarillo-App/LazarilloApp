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
import { useRankingPorGasto } from '@/hooks/useRankingPorGasto';
import { downwardMenuProps } from '@/utils/menuProps';
import SalesPickerIcon from './SalesPickerIcon';

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

// Cuántas compras muestra el modo por defecto. Mirar el precio de las últimas N
// es lo que se usa en la práctica; el rango completo trae años y no dice nada.
const ULTIMAS_N = 10;

const precioUnit = (it) => {
  if (!it) return 0;
  const directo = Number(it.precio_unitario ?? it.precio ?? 0);
  if (Number.isFinite(directo) && directo > 0) return directo;
  const cant = Number(it.cantidad ?? 0);
  const tot = Number(it.precio_total ?? it.importe ?? 0);
  return cant > 0 ? tot / cant : 0;
};

const mesDe = (it) => String(it?.fecha ?? '').slice(0, 7);   // 'YYYY-MM'

// Facturación que cubre el lote, sumando la de cada mes presente.
// `facturacionPorMes` es opcional: si no llega, el ratio no se muestra.
const facturacionDe = (arr, porMes) => {
  if (!porMes) return 0;
  const meses = new Set(arr.map(mesDe).filter(Boolean));
  let t = 0;
  meses.forEach((m) => { t += Number(porMes[m] ?? 0); });
  return t;
};

const variacion = (actual, anterior) => {
  if (anterior == null || !Number.isFinite(anterior) || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
};

const fmtVar = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}%`;

// Índices donde la serie cambia de dirección. Son las fechas que vale la pena
// rotular: los extremos y los puntos de inflexión, no cada punto.
const inflexiones = (v) => {
  if (v.length < 2) return v.map((_, i) => i);
  const signos = [];
  let ultimo = 0;
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    const sg = d > 0 ? 1 : d < 0 ? -1 : 0;
    signos.push(sg || ultimo);
    if (sg) ultimo = sg;
  }
  const out = new Set([0, v.length - 1]);
  for (let j = 1; j < signos.length; j++) {
    if (signos[j] !== signos[j - 1] && signos[j] !== 0 && signos[j - 1] !== 0) out.add(j);
  }
  return [...out].sort((a, b) => a - b);
};

// Ratios ofrecidos en el selector manual (spec §5.3 "O elegí otra")
const RATIOS_MANUAL = [2, 3, 4];

/* ══════════════════════════════════════════════════════════
   Celda de KPI. Grilla de tres filas de alto fijo: así los rótulos, los
   números y los pies quedan alineados entre celdas aunque el texto de una
   sea más largo. Sin esto el pie se parte en dos renglones y empuja la celda.
══════════════════════════════════════════════════════════ */
function KpiCelda({ titulo, valor, pie, delta = null, deltaTexto = null, color }) {
  const txt = deltaTexto ?? (delta != null ? fmtVar(delta) : null);
  const colorDelta = deltaTexto
    ? 'text.disabled'
    : delta == null ? 'text.disabled' : delta > 0 ? '#C0392B' : '#2E8B57';
  return (
    <Box sx={{
      px: 1.6, py: 1.2, flex: '1 1 118px', minWidth: 0,
      borderLeft: '1px solid', borderColor: 'divider',
      '&:first-of-type': { borderLeft: 'none' },
      display: 'grid', gridTemplateRows: '12px 22px 14px', rowGap: 0.5, alignContent: 'start',
    }}>
      <Typography sx={{
        fontSize: '0.53rem', fontWeight: 800, letterSpacing: '.06em',
        color: 'text.disabled', lineHeight: '12px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{titulo}</Typography>
      <Typography sx={{
        fontSize: '1.18rem', fontWeight: 700, lineHeight: '22px',
        letterSpacing: '-.02em', color: color || 'text.primary',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}>{valor}</Typography>
      <Typography component="div" sx={{
        fontSize: '0.62rem', color: 'text.secondary', lineHeight: '14px',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {pie}
        {txt && <Box component="span" sx={{ color: colorDelta, fontWeight: 700, ml: 0.6 }}>{txt}</Box>}
      </Typography>
    </Box>
  );
}

/* ══════════════════════════════════════════════════════════
   Gráfico de evolución. Canvas, sin librerías.
   Rotula solo los puntos de inflexión y muestra un tooltip al pasar el mouse.
══════════════════════════════════════════════════════════ */
function EvolucionChart({ puntos, color, formato, alto = 70 }) {
  const ref = useRef(null);
  const ptsRef = useRef([]);
  const [tip, setTip] = useState(null);

  const dibujar = useCallback(() => {
    const cv = ref.current;
    if (!cv || !puntos.length) return;
    const g = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 400;
    const H = alto;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const vals = puntos.map((p) => p.valor);
    const mx = Math.max(...vals), mn = Math.min(...vals);
    const colchon = mx === mn ? (Math.abs(mx) * 0.1 || 1) : (mx - mn) * 0.35;
    const hi = mx + colchon, lo = Math.max(0, mn - colchon);
    const L = 44, R = 8, T = 10, B = 16;
    const w = W - L - R, h = H - T - B;
    const px = (i) => L + (puntos.length < 2 ? w / 2 : (i * w) / (puntos.length - 1));
    const py = (v) => T + h - ((v - lo) / (hi - lo || 1)) * h;

    g.font = '8.5px -apple-system, Segoe UI, Helvetica, Arial';
    g.strokeStyle = 'rgba(140,155,150,.22)';
    g.fillStyle = '#8B9A95';
    g.textAlign = 'right';
    [0, 1].forEach((t) => {
      const v = lo + (hi - lo) * t, y = Math.round(py(v)) + 0.5;
      g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke();
      g.fillText(formato.eje(v), L - 6, y + 3);
    });

    g.beginPath();
    puntos.forEach((p, i) => { const X = px(i), Y = py(p.valor); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.lineTo(px(puntos.length - 1), T + h); g.lineTo(px(0), T + h); g.closePath();
    g.fillStyle = `${color}20`; g.fill();

    g.beginPath();
    puntos.forEach((p, i) => { const X = px(i), Y = py(p.valor); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.strokeStyle = color; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();

    puntos.forEach((p, i) => {
      const X = px(i), Y = py(p.valor), esUlt = i === puntos.length - 1;
      g.beginPath(); g.arc(X, Y, esUlt ? 4 : 2.6, 0, Math.PI * 2);
      g.fillStyle = esUlt ? color : '#fff'; g.strokeStyle = color; g.lineWidth = 2;
      g.fill(); if (!esUlt) g.stroke();
    });

    g.fillStyle = '#8B9A95';
    let ultX = -99;
    inflexiones(vals).forEach((i) => {
      const X = px(i);
      if (X - ultX < 44) return;
      ultX = X;
      g.textAlign = i === 0 ? 'left' : i === puntos.length - 1 ? 'right' : 'center';
      g.fillText(puntos[i].etiqueta, i === 0 ? X - 4 : i === puntos.length - 1 ? X + 4 : X, H - 3);
    });

    ptsRef.current = puntos.map((p, i) => ({ x: px(i), y: py(p.valor), p }));
  }, [puntos, color, formato, alto]);

  useEffect(() => { dibujar(); }, [dibujar]);
  useEffect(() => {
    const onResize = () => dibujar();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dibujar]);

  const buscar = (e) => {
    const cv = ref.current; if (!cv) return;
    const b = cv.getBoundingClientRect();
    const mx = e.clientX - b.left, my = e.clientY - b.top;
    let mejor = null, dist = 1e9;
    ptsRef.current.forEach((q) => {
      const d = Math.hypot(q.x - mx, q.y - my);
      if (d < dist) { dist = d; mejor = q; }
    });
    setTip(dist < 26 ? mejor : null);
  };

  return (
    <Box sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <canvas ref={ref}
        style={{ width: '100%', height: alto, display: 'block', cursor: 'crosshair' }}
        onMouseMove={buscar} onMouseLeave={() => setTip(null)} />
      {tip && (
        <Box sx={{
          position: 'absolute', left: tip.x, top: tip.y - 9, transform: 'translate(-50%,-100%)',
          bgcolor: '#1F2933', color: '#fff', borderRadius: 1.2, px: 1.2, py: 0.6,
          fontSize: '0.65rem', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
          boxShadow: '0 6px 18px rgba(16,30,26,.3)',
        }}>
          <b style={{ marginRight: 8 }}>{tip.p.etiqueta}</b>
          <span style={{ color: '#7FD3A0', fontWeight: 700 }}>{formato.tip(tip.p.valor)}</span>
        </Box>
      )}
    </Box>
  );
}

const fmtCorto = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `$ ${(v / 1e6).toFixed(2).replace('.', ',')} M`;
  if (v >= 1e3) return `$ ${Math.round(v / 1e3)} k`;
  return fmtMoney(v);
};

/* ══════════════════════════════════════════════════════════
   Chip "Top N por gasto" — ranking de insumos del período, con el
   desplegable (rail) para saltar a otro sin cerrar el modal.
   El cierre al hacer clic afuera usa una bandera en mousedown (no
   contains() en el click): al re-renderizar la lista, el nodo clickeado
   deja de existir en el DOM y un contains() sobre el target se resuelve
   solo, cerrando el panel cada vez que se toca algo de adentro.
══════════════════════════════════════════════════════════ */
export function RankingChip({ ranking, loading, activeInsumoId, onPick, variant = 'default' }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const dentro = useRef(false);

  useEffect(() => {
    const down = (e) => (dentro.current = !!raiz.current?.contains(e.target));
    const up = () => { if (!dentro.current) setAbierto(false); };
    document.addEventListener('mousedown', down, true);
    document.addEventListener('click', up);
    return () => {
      document.removeEventListener('mousedown', down, true);
      document.removeEventListener('click', up);
    };
  }, []);

  if (loading || !ranking || !ranking.items?.length) return null;

  const { items, total_insumos: totalInsumos, total_gasto: totalGasto } = ranking;
  const activeIdNum = Number(activeInsumoId);
  const activo = items.find((it) => Number(it.id) === activeIdNum);
  // Si el activo no vino en el top (quedó afuera del corte del backend), su fila
  // igual llega gracias a `pin` — pero puede no estar entre las primeras N.
  const topN = items.filter((it) => !activo || it.id !== activo.id || it.rank <= 20);
  const fueraDelTop = activo && !topN.some((it) => it.id === activo.id);

  const pctActivo = activo && totalGasto > 0 ? (activo.total / totalGasto) * 100 : null;
  const top10Pct = totalGasto > 0
    ? (topN.slice(0, 10).reduce((a, it) => a + it.total, 0) / totalGasto) * 100
    : 0;

  const label = activo
    ? `#${activo.rank} de ${totalInsumos}${pctActivo != null ? ` · ${pctActivo.toFixed(1).replace('.', ',')}% del gasto` : ''}`
    : `Top ${topN.length} por gasto`;

  return (
    <Box ref={raiz} sx={{ position: 'relative' }}>
      <Box
        onClick={() => setAbierto((a) => !a)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none',
          flexShrink: 0, whiteSpace: 'nowrap',
          px: 1.25, py: 0.5, borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
          // En el header de RecetaModal el fondo es oscuro (color de marca): un
          // fondo translúcido quedaba invisible o se aplastaba en una línea con
          // poco lugar (nombre largo) y el texto se envolvía en vertical dentro
          // del pill. Blanco sólido, como las pestañas activas, no tiene ese problema.
          ...(variant === 'onPrimary'
            ? {
              border: '1px solid', borderColor: fueraDelTop ? '#fbbf24' : 'transparent',
              bgcolor: fueraDelTop ? '#fffbeb' : '#fff',
              color: fueraDelTop ? '#92400e' : '#1f2933',
            }
            : {
              border: '1px solid', borderColor: fueraDelTop ? '#fbbf24' : 'divider',
              bgcolor: fueraDelTop ? '#fffbeb' : 'action.hover',
              color: fueraDelTop ? '#92400e' : 'text.secondary',
            }),
        }}
      >
        {label}
        <Box component="span" sx={{ fontSize: '0.7rem', transition: 'transform .2s', transform: abierto ? 'rotate(180deg)' : 'none' }}>▾</Box>
      </Box>

      {abierto && (
        <Box sx={{
          position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 20,
          width: 340, maxWidth: '90vw', border: '1px solid', borderColor: 'divider',
          borderRadius: 2, bgcolor: 'background.paper', boxShadow: 6, overflow: 'hidden',
          // El chip puede vivir en un header de fondo oscuro (RecetaModal) con
          // color de texto blanco heredado — sin esto, el texto de las filas
          // (sin color propio) heredaba ese blanco y quedaba invisible sobre
          // el fondo blanco del desplegable.
          color: 'text.primary',
        }}>
          <Box sx={{ px: 2, py: 1.25, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '.05em', color: 'text.secondary' }}>
              TOP {topN.length} POR GASTO DE COMPRA
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {fmtMoney(totalGasto)} en total · {totalInsumos} insumos
            </Typography>
          </Box>

          <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
            {topN.map((it) => {
              const on = activo && it.id === activo.id;
              const max = topN[0]?.total || 1;
              return (
                <Box
                  key={it.id}
                  onClick={() => { setAbierto(false); if (!on) onPick?.(it); }}
                  sx={{
                    position: 'relative', display: 'flex', alignItems: 'center', gap: 1,
                    px: 2, py: 0.85, fontSize: '0.8rem', cursor: on ? 'default' : 'pointer',
                    bgcolor: on ? 'action.selected' : 'transparent',
                    borderLeft: on ? '3px solid' : '3px solid transparent',
                    borderLeftColor: on ? 'var(--color-primary, #0369a1)' : 'transparent',
                    borderBottom: '1px solid', borderBottomColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': on ? {} : { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography sx={{ width: 20, textAlign: 'right', fontSize: '0.72rem', color: 'text.disabled', flexShrink: 0 }}>
                    {it.rank}
                  </Typography>
                  <Typography sx={{
                    flex: 1, minWidth: 0, fontWeight: on ? 700 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {it.nombre}
                  </Typography>
                  <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', flexShrink: 0 }}>
                    {fmtCorto(it.total)}
                  </Typography>
                  <Box sx={{
                    position: 'absolute', left: 0, bottom: 0, height: 2, opacity: 0.55,
                    width: `${(it.total / max) * 100}%`, bgcolor: '#57BB7F',
                  }} />
                </Box>
              );
            })}
          </Box>

          {fueraDelTop && activo && (
            <>
              <Box sx={{ px: 2, pt: 1, pb: 0.25, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '.05em', color: '#92400e', bgcolor: '#fffbeb' }}>
                EL QUE ESTÁS VIENDO · fuera del top {topN.length}
              </Box>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.85, fontSize: '0.8rem',
                bgcolor: '#fffbeb',
              }}>
                <Typography sx={{ width: 20, textAlign: 'right', fontSize: '0.72rem', color: '#92400e', flexShrink: 0 }}>
                  {activo.rank}
                </Typography>
                <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activo.nombre}
                </Typography>
                <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', flexShrink: 0 }}>
                  {fmtCorto(activo.total)}
                </Typography>
              </Box>
            </>
          )}

          <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              Los primeros 10 son el <b>{top10Pct.toFixed(0)}%</b> del gasto del período.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

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
  // Facturación del negocio por mes: { '2026-07': 9200000, ... }
  // Opcional: sin esto no se puede saber cuánto pesa la compra sobre lo vendido,
  // así que ese KPI y esa serie del gráfico simplemente no se muestran.
  facturacionPorMes = null,
  // Cambiar al insumo elegido en el ranking "Top por gasto", sin cerrar el
  // modal. Recibe la fila completa del ranking ({id, nombre, unidad_med, ...}).
  // Opcional: sin esto, el chip del ranking simplemente no aparece (cuando
  // este contenido corre dentro de RecetaModal, el chip vive en su header
  // junto al nombre en vez de acá, así que este caller no pasa esta prop).
  onCambiarInsumo = null,
  // Pisar el período consultado con un rango puntual ("📅 Fechas"). Recibe
  // {from, to}. Opcional: sin esto, el botón simplemente no aparece.
  onCambiarRango = null,
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

  // ─────────── KPI de compras (período, switch y serie del gráfico) ───────────
  const [modoPeriodo, setModoPeriodo] = useState('ultimas');   // 'ultimas' | 'rango'
  const [vistaKpi, setVistaKpi] = useState('kpi');             // 'kpi' | 'grafico'
  const [serieGraf, setSerieGraf] = useState('precio');        // 'precio' | 'unidades' | 'ratio'

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

  // ─────────── Ranking "Top por gasto" (solo si hay con quién navegar) ───────────
  // Acá se muestra inline (no hay un header propio para ponerlo al lado del
  // nombre, a diferencia de cuando este contenido corre dentro de RecetaModal).
  const { ranking, loading: rankingLoading } = useRankingPorGasto({
    businessId, rango, insumoId, habilitado: open && !!onCambiarInsumo,
  });

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

  // Si el negocio ya tiene sucursales definidas, "sin sucursal" no es una categoría real
  // CUANDO hay duplicación real: mismo dato ya asignado a su sucursal aparte (mismo
  // comprobante, misma fecha, mismo importe). Pero "el negocio tiene sucursales
  // configuradas" no significa que CADA compra individual tenga una — un insumo cuyas
  // compras nunca se etiquetaron con sucursal (branch_id siempre null) no tiene ningún
  // duplicado que descartar; filtrar igual tiraba las 6 compras reales y el modal
  // quedaba vacío aunque el backend las devolviera bien (bug real, no de red: `items`
  // llegaba con datos, pero este filtro las vaciaba antes de llegar a la tabla). Ahora
  // el descarte solo corre si en el MISMO lote hay al menos una fila que sí trae
  // branch_id (ahí sí hay duplicación real que limpiar).
  const sortedItems = useMemo(() => {
    const hayFilasConSucursal = displayItems.some(it => it.branch_id != null);
    const base = (hasSucursales || dynamicBranches.length > 0) && hayFilasConSucursal
      ? displayItems.filter(it => it.branch_id != null)
      : displayItems;
    return [...base].sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
  }, [displayItems, hasSucursales, dynamicBranches]);

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

  // Las compras que realmente se muestran. Por defecto las últimas N: el rango
  // completo trae años y el precio viejo no dice nada. No se vuelve a pedir al
  // backend, `items` ya trajo todo el rango.
  const itemsVisibles = useMemo(
    () => (modoPeriodo === 'ultimas' ? sortedItems.slice(0, ULTIMAS_N) : sortedItems),
    [sortedItems, modoPeriodo]);

  // Ventana anterior del mismo tamaño, para la variación. Si no hay N compras
  // hacia atrás no se compara: mejor nada que un número a medias.
  const itemsPrevios = useMemo(
    () => (modoPeriodo === 'ultimas' ? sortedItems.slice(ULTIMAS_N, ULTIMAS_N * 2) : []),
    [sortedItems, modoPeriodo]);

  const resumir = useCallback((arr) => {
    let cantidad = 0, importe = 0;
    for (const it of arr) {
      cantidad += Number(it.cantidad ?? 0);
      importe += Number(it.precio_total ?? it.importe ?? 0);
    }
    const facturacion = facturacionDe(arr, facturacionPorMes);
    return {
      cantidad, importe, facturas: arr.length,
      promedio: cantidad > 0 ? importe / cantidad : 0,   // ponderado por cantidad
      ratio: facturacion > 0 ? (importe / facturacion) * 100 : null,
    };
  }, [facturacionPorMes]);

  const totales = useMemo(() => resumir(itemsVisibles), [resumir, itemsVisibles]);
  const previos = useMemo(
    () => (itemsPrevios.length === ULTIMAS_N ? resumir(itemsPrevios) : null),
    [resumir, itemsPrevios]);

  const ultimoPrecio = useMemo(() => precioUnit(itemsVisibles[0]), [itemsVisibles]);
  const picoPrecio = useMemo(
    () => itemsVisibles.reduce((m, it) => Math.max(m, precioUnit(it)), 0),
    [itemsVisibles]);

  const SERIES = useMemo(() => ({
    precio: {
      label: 'Precio', color: '#2E8B57',
      val: (it) => precioUnit(it),
      eje: (v) => Math.round(v).toLocaleString('es-AR'),
      tip: (v) => fmtMoney(v),
    },
    unidades: {
      label: 'Unidades', color: '#3C9BD6',
      val: (it) => Number(it.cantidad ?? 0),
      eje: (v) => Math.round(v).toLocaleString('es-AR'),
      tip: (v) => `${fmtNum(v, 0)} ${insumoUnidad || 'U'}`,
    },
    ratio: {
      label: 'Sobre facturación', color: '#C77C0B',
      val: (it) => {
        const f = Number(facturacionPorMes?.[mesDe(it)] ?? 0);
        return f > 0 ? (Number(it.precio_total ?? it.importe ?? 0) / f) * 100 : 0;
      },
      eje: (v) => fmtNum(v, 2),
      tip: (v) => `${fmtNum(v, 2)} %`,
    },
  }), [insumoUnidad, facturacionPorMes]);

  const seriesDisponibles = useMemo(
    () => (facturacionPorMes ? ['precio', 'unidades', 'ratio'] : ['precio', 'unidades']),
    [facturacionPorMes]);

  const puntosGraf = useMemo(() => {
    const S = SERIES[serieGraf] || SERIES.precio;
    // el gráfico va de la compra más vieja a la más nueva
    return [...itemsVisibles].reverse().map((it) => ({
      etiqueta: String(it.fecha ?? '').slice(5, 10).split('-').reverse().join('/'),
      valor: S.val(it),
    }));
  }, [itemsVisibles, serieGraf, SERIES]);

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
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          {rango?.from && rango?.to && (
            <Typography variant="body2" color="text.secondary">
              📅 Período: {rango.from} — {rango.to}
            </Typography>
          )}
          {onCambiarInsumo && (
            <RankingChip
              ranking={ranking}
              loading={rankingLoading}
              activeInsumoId={insumoId}
              onPick={onCambiarInsumo}
            />
          )}

          {/* Último 10 vs todo el rango consultado: un solo botón, no un switch
              de dos opciones — ver "todo el período" se resuelve eligiendo un
              rango puntual con el calendario de al lado (ahí sí tiene sentido
              ver todo lo que haya, no solo las últimas N). */}
          {sortedItems.length > ULTIMAS_N && (
            <Box onClick={() => setModoPeriodo('ultimas')}
              sx={{
                px: 1.5, py: 0.8, borderRadius: 1, cursor: 'pointer', fontSize: '0.72rem', whiteSpace: 'nowrap',
                border: '1px solid', borderColor: modoPeriodo === 'ultimas' ? themeColors.primary : 'divider',
                bgcolor: modoPeriodo === 'ultimas' ? themeColors.primary : 'transparent',
                color: modoPeriodo === 'ultimas' ? '#fff' : 'text.secondary',
                fontWeight: modoPeriodo === 'ultimas' ? 700 : 400,
              }}>
              Últimas {ULTIMAS_N}
            </Box>
          )}

          {/* Ajustar el período consultado a mano, sin salir del modal. Elegir
              un rango acá muestra TODO lo que haya en esa ventana (no solo las
              últimas N): si lo acotás a mano es porque querés verlo completo. */}
          {onCambiarRango && rango?.from && rango?.to && (
            <SalesPickerIcon
              value={{ mode: 'custom', from: rango.from, to: rango.to }}
              onChange={(v) => { onCambiarRango({ from: v.from, to: v.to }); setModoPeriodo('rango'); }}
              labelOverride="Fechas"
              compact
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Selector de negocio */}
          {bizOptions.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Ver compras de</InputLabel>
              <Select MenuProps={downwardMenuProps()}
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
              <Select MenuProps={downwardMenuProps()}
                value={selectedBranch}
                label="Sucursal"
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <MenuItem value="all">Todas</MenuItem>

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

      {/* ───────── Franja de KPI / gráfico ─────────
          Reemplaza a los tres chips de totales. El switch de la derecha cambia
          números por evolución sin sumar altura: los dos modos miden casi lo mismo. */}
      {!isLoading && itemsVisibles.length > 0 && (
        <Box sx={{
          border: '1px solid', borderColor: 'divider', borderRadius: 2,
          bgcolor: 'action.hover', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch',
        }}>
          {vistaKpi === 'kpi' ? (
            <>
              <KpiCelda
                titulo="TOTAL COMPRADO"
                valor={fmtMoney(totales.importe)}
                pie={`${totales.facturas} compra${totales.facturas !== 1 ? 's' : ''}`} />
              <KpiCelda
                titulo="PRECIO PROMEDIO"
                valor={fmtMoney(totales.promedio)}
                pie="ponderado"
                delta={previos ? variacion(totales.promedio, previos.promedio) : null} />
              <KpiCelda
                titulo="ÚLTIMO PRECIO"
                valor={fmtMoney(ultimoPrecio)}
                color="#2E8B57"
                pie={picoPrecio > 0 && ultimoPrecio !== picoPrecio
                  ? `${fmtVar(variacion(ultimoPrecio, picoPrecio))} del pico`
                  : 'es el máximo'} />
              <KpiCelda
                titulo="UNIDADES"
                valor={`${fmtNum(totales.cantidad, 0)} ${insumoUnidad || 'U'}`}
                pie={`${fmtNum(totales.cantidad / Math.max(totales.facturas, 1), 0)} por compra`}
                delta={previos ? variacion(totales.cantidad, previos.cantidad) : null} />
              {totales.ratio != null && (
                <KpiCelda
                  titulo="SOBRE FACTURACIÓN"
                  valor={`${fmtNum(totales.ratio, 2)} %`}
                  pie="del período"
                  deltaTexto={previos?.ratio != null
                    ? `${totales.ratio - previos.ratio >= 0 ? '+' : '−'}${Math.abs(totales.ratio - previos.ratio).toFixed(2).replace('.', ',')} pts`
                    : null} />
              )}
              {previos && (
                <Typography variant="caption" sx={{
                  alignSelf: 'center', color: 'text.disabled', px: 2,
                  borderLeft: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap',
                }}>
                  vs período anterior
                </Typography>
              )}
            </>
          ) : (
            <>
              <Stack direction="column" spacing={0.5} sx={{ p: 1.2, justifyContent: 'center', flex: '0 0 auto' }}>
                {seriesDisponibles.map((k) => (
                  <Box key={k} onClick={() => setSerieGraf(k)}
                    sx={{
                      px: 1.4, py: 0.5, borderRadius: 1, cursor: 'pointer', textAlign: 'center',
                      fontSize: '0.7rem', whiteSpace: 'nowrap',
                      border: '1px solid',
                      borderColor: serieGraf === k ? themeColors.primary : 'divider',
                      bgcolor: serieGraf === k ? themeColors.primary : 'background.paper',
                      color: serieGraf === k ? '#fff' : 'text.secondary',
                      fontWeight: serieGraf === k ? 700 : 400,
                    }}>
                    {SERIES[k].label}
                  </Box>
                ))}
              </Stack>
              <Stack direction="column" sx={{ flex: 1, minWidth: 0, pl: 1.5, py: 1 }}>
                <Typography variant="caption" sx={{ textAlign: 'right', pr: 1, color: 'text.secondary' }}>
                  {puntosGraf.length > 1 && (
                    <>
                      {SERIES[serieGraf].tip(puntosGraf[0].valor)}
                      {' → '}
                      <b>{SERIES[serieGraf].tip(puntosGraf[puntosGraf.length - 1].valor)}</b>
                    </>
                  )}
                </Typography>
                <EvolucionChart
                  puntos={puntosGraf}
                  color={SERIES[serieGraf].color}
                  formato={{ eje: SERIES[serieGraf].eje, tip: SERIES[serieGraf].tip }} />
              </Stack>
            </>
          )}

          <Stack direction="row" sx={{
            alignSelf: 'center', mr: 1.2, ml: 'auto', border: '1px solid',
            borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: 'background.paper',
          }}>
            {[['kpi', '▦'], ['grafico', '∿']].map(([v, ic]) => (
              <Box key={v} onClick={() => setVistaKpi(v)}
                sx={{
                  px: 1.2, py: 0.7, cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1,
                  bgcolor: vistaKpi === v ? themeColors.primary : 'transparent',
                  color: vistaKpi === v ? '#fff' : 'text.secondary',
                }}>
                {ic}
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Chip de bonificación: pasa a su propia línea, alineado a la derecha */}
      {!isLoading && !bonifLoading && bonif && (
        <Stack direction="row" alignItems="center">
          <Box sx={{ flex: 1 }} />
          <Box ref={chipRef} sx={{ display: 'inline-flex' }}>
            {renderChipBonif()}
          </Box>
        </Stack>
      )}

      {/* Leyenda de negocios */}
      {showBizColumn && !isLoading && itemsVisibles.length > 0 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {(selectedBiz === 'all'
            ? [Number(businessId), ...businesses.filter(b => Number(b.id) !== Number(businessId)).map(b => Number(b.id))]
            : [Number(selectedBiz)]
          ).filter(id => itemsVisibles.some(r => Number(r._bizId) === id)).map(id => (
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
      {showBranchColumn && !isLoading && itemsVisibles.length > 0 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
          {selectedBiz === 'all' && branchesByBiz
            ? Array.from(branchesByBiz.entries()).flatMap(([bizId, { bizName, bizColor, branches: bizBranches }]) => [
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
              {itemsVisibles.map((it, i) => {
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
                const prev = itemsVisibles[i - 1];
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

              {itemsVisibles.length === 0 && (
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
  facturacionPorMes = null,
  onCambiarInsumo = null,
  onCambiarRango = null,
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
          facturacionPorMes={facturacionPorMes}
          onCambiarInsumo={onCambiarInsumo}
          onCambiarRango={onCambiarRango}
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
