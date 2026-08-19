// src/componentes/TablaArticulos.jsx
/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useDeferredValue,
} from "react";
import { Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip } from "@mui/material";

import SubrubroAccionesMenu from "./SubrubroAccionesMenu";
import ArticuloAccionesMenu from "./ArticuloAccionesMenu";
import VentasCell from "./VentasCell";
import VirtualList from "./shared/VirtualList";
import RecetaModal from "./RecetaModal";
import { ensureTodo, getExclusiones } from "../servicios/apiAgrupacionesTodo";
import { BusinessesAPI, RecetasAPI } from "@/servicios/apiBusinesses";
import LinkChainIcon from "./LinkChainIcon";
import { IconButton } from "@mui/material";  // sumarlo al import de MUI que ya tenés
import TuneIcon from '@mui/icons-material/Tune';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { getRedondeoConfig, saveRedondeoConfig } from '@/utils/redondeoUtils';
import { BASE } from "@/servicios/apiBase";
import RubroEditModal from './RubroEditModal';
import { useOrganization } from '@/context/OrganizationContext';
import "../css/TablaArticulos.css";

/* ---------------- utils ---------------- */
const clean = (s) => String(s ?? "").trim();
const isSin = (s) => {
  const v = clean(s).toLowerCase();
  return (
    v === "" ||
    v === "sin categoría" ||
    v === "sin categoria" ||
    v === "sin subrubro"
  );
};
const prefer = (...vals) => {
  for (const v of vals) if (!isSin(v)) return clean(v);
  return clean(vals[0] ?? "");
};
const getDisplayCategoria = (a) =>
  prefer(a?.categoria, a?.raw?.categoria, a?.raw?.raw?.categoria);
const getDisplaySubrubro = (a) =>
  prefer(a?.subrubro, a?.raw?.subrubro, a?.raw?.raw?.subrubro);

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizeVenta = (venta, precioFallback = 0) => {
  if (!venta) return { qty: 0, amount: 0 };
  const qty = toNum(
    venta.qty ?? venta.quantity ?? venta.cantidad ?? venta.unidades ??
    venta.total_u ?? venta.total_qty ?? venta.qty_sum ?? venta.qtyMap
  );
  let amount = toNum(
    venta.calcAmount ?? venta.amount ?? venta.total ?? venta.total_amount ??
    venta.importe ?? venta.monto ?? venta.amountMap
  );
  if ((!amount || amount === 0) && qty > 0) {
    const p = toNum(venta.precio ?? precioFallback);
    if (p > 0) amount = qty * p;
  }
  return { qty, amount };
};

const getId = (x) => {
  const raw =
    x?.article_id ?? x?.articulo_id ?? x?.articuloId ?? x?.idArticulo ??
    x?.id ?? x?.codigo ?? x?.codigoArticulo;
  const id = Number(raw);
  // id !== 0 — acepta negativos (artículos manuales)
  return Number.isFinite(id) && id !== 0 ? id : null;
};

const num = (v) => Number(v ?? 0);
const fmt = (v, d = 0) =>
  Number(v ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

const fmtCurrency = (v) => {
  try {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(v || "");
  }
};

const esTodoGroup = (g) => {
  const n = String(g?.nombre || "").trim().toUpperCase();
  return (
    n === "TODO" || n === "SIN AGRUPACION" || n === "SIN AGRUPACIÓN" ||
    n === "SIN AGRUPAR" || n === "SIN GRUPO"
  );
};

const TABLE_TEXT = "#111827";
const TABLE_MUTED = "#6b7280";
const SECTION_TEXT = "#374151";
const SECTION_BG = "#f4f6f8";
const HEADER_BG = "#f1f5f9";
const HEADER_TEXT = "#1e293b";

function ColOrderModal({ open, cols, onSave, onClose }) {
  const [local, setLocal] = React.useState(cols);
  const dragIdx = React.useRef(null);

  React.useEffect(() => { if (open) setLocal(cols); }, [open, cols]);
  if (!open) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
        Configurar columnas
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Arrastrá para reordenar · activá/desactivá para mostrar u ocultar
        </Typography>

        {/* Fijas */}
        {['Código', 'Nombre', 'Ventas'].map(f => (
          <Box key={f} sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            py: 0.75, px: 1.5, mb: 0.5, borderRadius: 1,
            bgcolor: 'action.hover', opacity: 0.55,
          }}>
            <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>{f}</Typography>
            <Chip label="fija" size="small" sx={{ fontSize: '0.65rem', height: 16 }} />
          </Box>
        ))}

        {/* Reordenables */}
        <Box sx={{ mt: 1 }}>
          {local.map((col, i) => (
            <Box key={col.id} draggable
              onDragStart={() => { dragIdx.current = i; }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragIdx.current === null || dragIdx.current === i) return;
                const next = [...local];
                const [moved] = next.splice(dragIdx.current, 1);
                next.splice(i, 0, moved);
                dragIdx.current = null;
                setLocal([...next]);
              }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                py: 0.75, px: 1.5, mb: 0.5,
                border: '1px solid', borderColor: 'divider',
                borderRadius: 1, cursor: 'grab', bgcolor: 'background.paper',
                '&:hover': { borderColor: 'var(--color-primary)', bgcolor: 'action.hover' },
              }}>
              <Typography sx={{ color: 'text.disabled', mr: 0.5, fontSize: '1rem', lineHeight: 1 }}>⠿</Typography>
              <Typography variant="body2" sx={{ flex: 1 }}>{col.label}</Typography>
              <Button
                size="small"
                variant={col.visible ? 'contained' : 'outlined'}
                onClick={() => setLocal(prev => prev.map((c, j) => j === i ? { ...c, visible: !c.visible } : c))}
                sx={{
                  minWidth: 0, px: 1.25, py: 0.25, fontSize: '0.7rem',
                  ...(col.visible && {
                    bgcolor: 'var(--color-primary)',
                    '&:hover': { bgcolor: 'var(--color-primary)', filter: 'brightness(0.9)' },
                  }),
                }}>
                {col.visible ? 'Visible' : 'Oculta'}
              </Button>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button size="small" variant="text" color="inherit" onClick={onClose}>Cancelar</Button>
        <Button size="small" variant="contained"
          onClick={() => { onSave(local); onClose(); }}
          sx={{ bgcolor: 'var(--color-primary)', '&:hover': { bgcolor: 'var(--color-primary)', filter: 'brightness(0.9)' } }}>
          Aplicar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------------- componente principal ---------------- */
export default function TablaArticulos({
  filtroBusqueda = "",
  agrupacionSeleccionada,
  agrupaciones = [],
  agrupacionesAll = null,
  categoriaSeleccionada,
  refetchAgrupaciones,
  fechaDesdeProp,
  fechaHastaProp,
  ventasPorArticulo = new Map(),
  ventasLoading = false,
  onCategoriasLoaded,
  onIdsVisibleChange,
  activeBizId,
  rootBizId = null,
  reloadKey = 0,
  onTodoInfo,
  onTotalResolved,
  onGroupCreated,
  visibleIds,
  onMutateGroups,
  jumpToArticleId,
  selectedArticleId,
  tableHeaderMode = "cat-first",
  modalTreeMode = "cat-first",
  onDiscontinuadoChange,
  onDiscontinuarBloque,
  discIds: discIdsProp,
  orgAssignedIds = null,
  recetasCostos = {},
  priceConfig = { byArticle: {}, byRubro: {}, byAgrupacion: {} },
  globalCostoIdeal = 30,
  onPriceConfigSave,
  onBulkManualSave,
  onSaved,
  branches = [],
  ventasMapByBranch = {},
  recetasElaborados = {},
  selectionMode = null,
  selectedIds = new Set(),
  onToggleSelected,
  onSelectAll,
  linkByArticleId = new Map(),
  nameById = new Map(),
  onRemoveMemberFromLink,
  onDeleteLink,
  totalBizAmount = 0,
  onRedondeoChange,
  priceLists = [],
  currentPriceListId = null,
  isPriceListFavorite = true,
  calcPrecioPorLista,
  currentPriceList = null,
  onVisibleSubrubroChange,
  priceListsByList = {},
  soloConVentas = false,
  onToggleSoloConVentas,
  onAddMembersToLink,
  editingGroup = null,
}) {
  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

  const [categorias, setCategorias] = useState([]);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());

  // 🆕 Escuchar evento de "incluir de vuelta" (cuando se reactiva un artículo desde Discontinuados)
  // Limpia los IDs del Set excludedIds para que vuelvan a verse en Sin Agrupación al instante.
  useEffect(() => {
    const handler = (ev) => {
      const ids = (ev?.detail?.ids || []).map(Number).filter(Number.isFinite);
      if (!ids.length) return;
      setExcludedIds(prev => {
        const next = new Set(prev);
        let changed = false;
        for (const id of ids) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    };
    window.addEventListener('articulos:include-back', handler);
    return () => window.removeEventListener('articulos:include-back', handler);
  }, []);

  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});

  // Escuchar eventos de undo para limpiar objetivos locales
  useEffect(() => {
    const onClearLocal = (e) => {
      const { articleIds } = e.detail || {};
      if (!Array.isArray(articleIds) || articleIds.length === 0) return;
      setObjetivos(prev => {
        const next = { ...prev };
        articleIds.forEach(id => { delete next[String(id)]; });
        return next;
      });
    };
    window.addEventListener('articulos:clear-local-objetivos', onClearLocal);
    return () => window.removeEventListener('articulos:clear-local-objetivos', onClearLocal);
  }, []);

  const [manualesIndividuales, setManualesIndividuales] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, msg: "", type: "success" });
  const [blockObjetivos, setBlockObjetivos] = useState({});
  const [pendingObjConfirm, setPendingObjConfirm] = useState(null);
  const [blockManuales, setBlockManuales] = useState({});
  const [bulkPctDlg, setBulkPctDlg] = useState(null);
  const [clearDlg, setClearDlg] = useState(null);
  const [ventasVista, setVentasVista] = useState('U');
  const [lastAppliedPct, setLastAppliedPct] = useState({});
  const [redondeoConfig, setRedondeoConfig] = useState({ valor: null, mostrarModal: true });
  const [redondeoModalPendiente, setRedondeoModalPendiente] = useState(null);
  const [visibleSubrubro, setVisibleSubrubro] = useState(null);
  const [dragOverColIdx, setDragOverColIdx] = useState(null);
  const [promoComponentIds, setPromoComponentIds] = useState(() => new Set());
  const [promoIds, setPromoIds] = useState(() => new Set());
  const [ventaSinPromoMap, setVentaSinPromoMap] = useState({});

  // ── Definición canónica de columnas reordenables ──
  const REORDERABLE_COLS = [
    { id: 'precio', label: 'Precio', width: '.3fr' },
    { id: 'costo', label: 'Costo $', width: '.3fr' },
    { id: 'ganancia', label: 'Ganancia', width: '.3fr' },
    { id: 'costoPct', label: 'Costo %', width: '.3fr' },
    { id: 'objetivo', label: 'Objetivo %', width: '.3fr' },
    { id: 'sugerido', label: 'Sugerido', width: '.3fr' },
    { id: 'manual', label: 'Nuevo precio', width: '.35fr' },
    { id: 'acciones', label: 'Acciones', width: '.2fr' },
  ];

  const [colConfig, setColConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('tabla_col_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        const base = REORDERABLE_COLS.map(c => {
          const s = parsed.find(p => p.id === c.id);
          return { ...c, visible: s ? s.visible : true };
        });
        const order = parsed.map(p => p.id);
        return base.sort((a, b) => {
          const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
      }
    } catch (e) { }
    return REORDERABLE_COLS.map(c => ({ ...c, visible: true }));
  });

  const [colDlgOpen, setColDlgOpen] = useState(false);

  const saveColConfig = useCallback((newCols) => {
    setColConfig(newCols);
    try {
      localStorage.setItem('tabla_col_order',
        JSON.stringify(newCols.map(c => ({ id: c.id, visible: c.visible })))
      );
    } catch (e) { }
  }, []);

 // ¿Estás viendo la agrupación "Promociones"? Solo ahí se muestra la columna "$ Sin Promo".
  const estaEnPromociones = useMemo(() => {
    const n = String(agrupacionSeleccionada?.nombre ?? agrupacionSeleccionada?.name ?? '').trim().toLowerCase();
    return n === 'promociones';
  }, [agrupacionSeleccionada]);

  const visibleCols = useMemo(() => {
    const cols = colConfig.filter(c => c.visible);
    if (!estaEnPromociones) return cols;
    // Inyectar "$ Sin Promo" justo después de "costo" (o al inicio si no está)
    const idx = cols.findIndex(c => c.id === 'costo');
    const sinPromoCol = { id: 'sinPromo', label: '$ Sin Promo', width: '.35fr', visible: true };
    if (idx === -1) return [sinPromoCol, ...cols];
    return [...cols.slice(0, idx + 1), sinPromoCol, ...cols.slice(idx + 1)];
  }, [colConfig, estaEnPromociones]);

  const openSnack = useCallback(
    (msg, type = "success") => setSnack({ open: true, msg, type }),
    []
  );
  const loadReqId = useRef(0);

  const filterIds = useMemo(() => {
    if (!visibleIds) return null;
    return new Set(Array.from(visibleIds).map(Number));
  }, [visibleIds]);

  const [expandedRubro, setExpandedRubro] = useState(null);
  const [expandedCatByRubro, setExpandedCatByRubro] = useState({});
  const [reloadTick, setReloadTick] = useState(0);
  const refetchLocal = useCallback(async () => {
    try { await refetchAgrupaciones?.(); } catch { }
    setReloadTick((t) => t + 1);
  }, [refetchAgrupaciones]);

  const { organization } = useOrganization() || {};

  // Refetch cuando se crea un artículo manual desde Configuración
  useEffect(() => {
    const handler = () => refetchLocal();
    window.addEventListener('articulos:updated', handler);
    return () => window.removeEventListener('articulos:updated', handler);
  }, [refetchLocal]);

  const [bulkObjetivoDlg, setBulkObjetivoDlg] = useState(null);

  const [recetaArticulo, setRecetaArticulo] = useState(null);
  useEffect(() => {
    if (recetaArticulo === null) console.trace('[CIERRE MODAL] recetaArticulo pasó a null');
  }, [recetaArticulo]);
  const listRef = useRef(null);
  const lastJumpedIdRef = useRef(null);

  const [rubroEditModal, setRubroEditModal] = useState(null);

  const findPath = useCallback((cats, id) => {
    for (const sub of cats || []) {
      const rubroName = sub?.subrubro || "Sin subrubro";
      for (const cat of sub?.categorias || []) {
        const catName = cat?.categoria || "Sin categoría";
        for (const a of cat?.articulos || []) {
          if (Number(a?.id) === Number(id)) return { rubroName, catName };
        }
      }
    }
    return null;
  }, []);

  const [sortBy, setSortBy] = useState("ventas");
  const [sortDir, setSortDir] = useState("desc");
  const sortByRef = React.useRef(sortBy);
  const bulkSetIdsRef = useRef(new Set());
  React.useEffect(() => { sortByRef.current = sortBy; }, [sortBy]);

  const toggleSort = useCallback((k) => {
    const isSameColumn = sortByRef.current === k;
    if (isSameColumn) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(k);
      setSortDir('asc');
    }
  }, []);

  const buildTreeFromFlat = useCallback((items = []) => {
    const flat = items.map((row) => {
      const raw = row?.raw || {};
      const id = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
      return {
        id,
        nombre: String(row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`),
        categoria: String(row?.categoria ?? raw?.categoria ?? raw?.rubro ?? "Sin categoría"),
        subrubro: String(row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? "Sin subrubro"),
        precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
        costo: Number(row?.costo ?? raw?.costo ?? 0),
        origen: row?.origen ?? raw?.origen ?? null,
      };
    }).filter((a) => Number.isFinite(a.id));

    const bySub = new Map();
    for (const a of flat) {
      if (!bySub.has(a.subrubro)) bySub.set(a.subrubro, new Map());
      const byCat = bySub.get(a.subrubro);
      if (!byCat.has(a.categoria)) byCat.set(a.categoria, []);
      byCat.get(a.categoria).push(a);
    }
    return Array.from(bySub, ([subrubro, byCat]) => ({
      subrubro,
      categorias: Array.from(byCat, ([categoria, articulos]) => ({ categoria, articulos })),
    }));
  }, []);

  // ── Cargar redondeo config ──
  useEffect(() => {
    if (!activeBizId) return;
    setRedondeoConfig(getRedondeoConfig(activeBizId));

    const onChanged = (e) => {
      if (String(e.detail?.bizId) === String(activeBizId)) {
        setRedondeoConfig({ valor: e.detail.valor ?? null, mostrarModal: !!e.detail.mostrarModal });
      }
    };

    const onConfigUpdated = (e) => {
      const { key, value } = e?.detail || {};
      if (key === 'redondeo_precios') {
        setRedondeoConfig(prev => ({ ...prev, valor: value }));
        saveRedondeoConfig(activeBizId, value, redondeoConfig?.mostrarModal ?? true);
        // ← guardar en DB también
        try {
          BusinessesAPI.update(Number(activeBizId), {
            props: { redondeo_precios: value }
          });
        } catch { }
      }
      if (key === 'redondeo_mostrar_modal') {
        setRedondeoConfig(prev => ({ ...prev, mostrarModal: value }));
        saveRedondeoConfig(activeBizId, redondeoConfig?.valor ?? null, value);
      }
    };

    window.addEventListener('redondeo:changed', onChanged);
    window.addEventListener('config:updated', onConfigUpdated);
    return () => {
      window.removeEventListener('redondeo:changed', onChanged);
      window.removeEventListener('config:updated', onConfigUpdated);
    };
  }, [activeBizId]);

  useEffect(() => {
    setCategorias([]);
    setTodoGroupId(null);
    setExcludedIds(new Set());
    let cancel = false;
    loadReqId.current += 1;
    const myId = loadReqId.current;

    (async () => {
      try {
        const bizId = activeBizId;
        if (!bizId) {
          if (!cancel && myId === loadReqId.current) { setCategorias([]); onCategoriasLoaded?.([]); }
          openSnack("No hay negocio activo", "warning");
          return;
        }
        try {
          const resp = await BusinessesAPI.articlesTree(bizId);
          const tree = Array.isArray(resp?.tree) ? resp.tree : [];
          if (tree.length > 0) {
            if (!cancel && myId === loadReqId.current) { setCategorias(tree); onCategoriasLoaded?.(tree); }
          } else {
            const resp2 = await BusinessesAPI.articlesFromDB(bizId);
            const items = Array.isArray(resp2?.items) ? resp2.items : [];
            const tree2 = buildTreeFromFlat(items);
            if (!cancel && myId === loadReqId.current) { setCategorias(tree2); onCategoriasLoaded?.(tree2); }
          }
        } catch (e) {
          const resp2 = await BusinessesAPI.articlesFromDB(bizId);
          const items = Array.isArray(resp2?.items) ? resp2.items : [];
          const tree2 = buildTreeFromFlat(items);
          if (!cancel && myId === loadReqId.current) { setCategorias(tree2); onCategoriasLoaded?.(tree2); }
        }
        try {
          const todoBizId = rootBizId ?? activeBizId;
          const todo = await ensureTodo(todoBizId);
          if (todo?.id && !cancel && myId === loadReqId.current) {
            setTodoGroupId(todo.id);
            const ex = await getExclusiones(todo.id, todoBizId);
            const ids = (ex || []).filter((e) => e.scope === "articulo").map((e) => Number(e.ref_id)).filter(Boolean);
            setExcludedIds(new Set(ids));
          }
        } catch {
          if (!cancel && myId === loadReqId.current) setExcludedIds(new Set());
        }
      } catch (e) {
        console.error("TablaArticulos: cargar BD", e);
        if (!cancel && myId === loadReqId.current) {
          openSnack("No se pudieron cargar los artículos desde la base", "error");
          setCategorias([]);
          onCategoriasLoaded?.([]);
        }
      }
    })();
    return () => { cancel = true; };
  }, [activeBizId, rootBizId, reloadKey, reloadTick, onCategoriasLoaded, buildTreeFromFlat, openSnack]);

  useEffect(() => {
    if (!activeBizId) { setPromoComponentIds(new Set()); return; }
    let cancel = false;
    RecetasAPI.getPromoComponents(activeBizId)
      .then(r => {
        if (cancel) return;
        setPromoComponentIds(new Set((r?.ids || []).map(Number)));
      })
      .catch(() => { if (!cancel) setPromoComponentIds(new Set()); });
    return () => { cancel = true; };
  }, [activeBizId, reloadKey, reloadTick]);

  useEffect(() => {
    if (!activeBizId) { setPromoIds(new Set()); return; }
    let cancel = false;
    RecetasAPI.getPromoIds(activeBizId)
      .then(r => { if (!cancel) setPromoIds(new Set((r?.ids || []).map(Number))); })
      .catch(() => { if (!cancel) setPromoIds(new Set()); });
    return () => { cancel = true; };
  }, [activeBizId, reloadKey, reloadTick]);

  // Venta sin promo por promo (suma precios de venta de componentes, con nuevo precio de lista principal)
  useEffect(() => {
    if (!activeBizId) { setVentaSinPromoMap({}); return; }
    let cancel = false;
    RecetasAPI.getVentaSinPromo(activeBizId)
      .then(r => { if (!cancel) setVentaSinPromoMap(r?.ventaSinPromo || {}); })
      .catch(() => { if (!cancel) setVentaSinPromoMap({}); });
    return () => { cancel = true; };
  }, [activeBizId, reloadKey, reloadTick]);

  const allArticulos = useMemo(() => {
    const out = [];
    for (const sub of categorias || []) {
      const subrubroNombre = String(sub?.subrubro ?? sub?.nombre ?? "Sin subrubro");
      for (const cat of sub?.categorias || []) {
        const categoriaNombre = String(cat?.categoria ?? cat?.nombre ?? "Sin categoría");
        for (const a of cat?.articulos || []) {
          const _id = Number(a?.id ?? a?.articulo_id);
          const _rec = recetasCostos[String(_id)] || recetasCostos[_id];
          out.push({
            ...a,
            subrubro: a?.subrubro ?? subrubroNombre,
            categoria: a?.categoria ?? categoriaNombre,
            costoTotal: Number(_rec?.costoTotal) || 0,  // costo de su receta (para sugerido en promos)
          });
        }
      }
    }
    return out;
  }, [categorias, recetasCostos]);

  const baseById = useMemo(() => {
    const m = new Map();
    for (const a of allArticulos) m.set(Number(a.id), a);
    return m;
  }, [allArticulos]);

  // IDs de artículos que VIVEN en la agrupación "Promociones" (fuente de verdad de ubicación).
  // Se usa para tratar como promo a un artículo que está en esa agrupación aunque su receta
  // aún no tenga es_promo=TRUE (ej. recién movido, sin componentes todavía).
  const promoGroupIds = useMemo(() => {
    const s = new Set();
    const norm = (x) => String(x ?? '').trim().toLowerCase();
    const fuente = Array.isArray(agrupacionesAll) ? agrupacionesAll : agrupaciones;
    for (const g of fuente || []) {
      if (norm(g?.nombre ?? g?.name) !== 'promociones') continue;
      for (const x of (g?.articulos || [])) {
        const id = getId(x);
        if (Number.isFinite(id)) s.add(id);
      }
    }
    return s;
  }, [agrupaciones, agrupacionesAll]);

  const getCurrentManual = useCallback((artId) => {
    const key = String(artId);
    const idNum = Number(artId);
    if (bulkSetIdsRef.current.has(idNum)) return null;
    if (manuales[key] !== undefined && manuales[key] !== '') return num(manuales[key]);
    const cfg = priceConfig.byArticle?.[key];
    if (cfg?.precioManual != null) return num(cfg.precioManual);
    const base = baseById?.get?.(Number(artId));
    if (base?.precioManual != null) return num(base.precioManual);
    return null;
  }, [manuales, priceConfig, baseById]);

  const tieneObjetivoIndividual = useCallback((artId) => {
    const key = String(artId);
    const localObj = objetivos[key];
    if (localObj !== undefined && localObj !== '') return true;
    return priceConfig.byArticle?.[key]?.objetivo != null;
  }, [objetivos, priceConfig]);

  const executeBulkPct = useCallback((pct, idsAll, mode) => {
    if (!onBulkManualSave && !onPriceConfigSave) return;

    const updates = [];
    idsAll.forEach(artId => {
      if (mode === 'solo_sin_manual') {
        const key = String(artId);
        const tieneManual =
          (manuales[key] !== undefined && manuales[key] !== '') ||
          priceConfig.byArticle?.[key]?.precioManual != null;
        if (tieneManual) return;
      }

      const art = baseById.get(artId);
      // Base = precio actual (manual si existe, sino precio de la favorita)
      const manualActual = num(manuales[String(artId)] ?? priceConfig.byArticle?.[String(artId)]?.precioManual);
      const base = manualActual > 0 ? manualActual : num(art?.precio ?? 0);

      if (base > 0) {
        const precioCalculado = base * (1 + pct / 100);
        const redondeo = redondeoConfig?.valor;
        const precioFinal = redondeo > 0
          ? Math.round(precioCalculado / redondeo) * redondeo
          : Math.round(precioCalculado);
        updates.push({ artId, precioManual: precioFinal });
      }
    });

    if (!updates.length) return;

    setManuales(prev => {
      const next = { ...prev };
      updates.forEach(({ artId, precioManual }) => { next[String(artId)] = precioManual; });
      return next;
    });

    if (onBulkManualSave) {
      onBulkManualSave(updates);
    } else {
      updates.forEach(({ artId, precioManual }) => {
        onPriceConfigSave({ scope: 'articulo', scopeId: String(artId), precioManual });
      });
    }
  }, [onBulkManualSave, onPriceConfigSave, baseById, manuales, priceConfig, redondeoConfig]);

  const triggerBulkPct = useCallback((pct, ids, inputRef, blockKey) => {
    if (pct == null || !Number.isFinite(Number(pct)) || Number(pct) === 0) return;
    const pctNum = Number(pct);

    const idsConNuevoPrecio = ids.filter(id => {
      const key = String(id);
      return (manuales[key] !== undefined && manuales[key] !== '') ||
        priceConfig.byArticle?.[key]?.precioManual != null;
    });

    const necesitaConfigurarRedondeo = !redondeoConfig?.valor;
    const necesitaConfirmarManuales = idsConNuevoPrecio.length > 0 && (redondeoConfig?.mostrarModal ?? true);

    // Sin razón para modal → aplicar directo
    if (!necesitaConfigurarRedondeo && !necesitaConfirmarManuales) {
      executeBulkPct(pctNum, ids, 'todos');
      if (blockKey) {
        setBlockManuales(prev => { const n = { ...prev }; delete n[blockKey]; return n; });
        setLastAppliedPct(prev => ({ ...prev, [blockKey]: pctNum }));
      }
      if (inputRef?.current) inputRef.current.value = '';
      return;
    }

    // Hay al menos una razón → un solo modal
    setBulkPctDlg({
      pct: pctNum,
      idsAll: ids,
      idsConNuevoPrecio,
      inputRef,
      blockKey,
      motivoConfigRedondeo: necesitaConfigurarRedondeo,
    });
  }, [manuales, priceConfig, executeBulkPct, redondeoConfig]);

  // Helper para continuar después del modal de redondeo
  const continuarDespuesDeRedondeo = useCallback((pct, ids, inputRef, blockKey) => {
    const idsConNuevoPrecio = ids.filter(id => {
      const key = String(id);
      return (manuales[key] !== undefined && manuales[key] !== '') ||
        priceConfig.byArticle?.[key]?.precioManual != null;
    });
    if (idsConNuevoPrecio.length > 0) {
      setBulkPctDlg({ pct, idsAll: ids, idsConNuevoPrecio, inputRef, blockKey });
    } else {
      executeBulkPct(pct, ids, 'todos');
      if (blockKey) {
        setBlockManuales(prev => { const n = { ...prev }; delete n[blockKey]; return n; });
        setLastAppliedPct(prev => ({ ...prev, [blockKey]: pct }));
      }
      if (inputRef?.current) inputRef.current.value = '';
    }
  }, [manuales, priceConfig, executeBulkPct]);

  const getVentaForId = useCallback((idNum) => {
    const n = Number(idNum);
    if (!Number.isFinite(n)) return null;
    return ventasPorArticulo?.get(n) ?? ventasPorArticulo?.get(String(n)) ?? null;
  }, [ventasPorArticulo]);

  const getVentasQty = useCallback((artOrId) => {
    const id = typeof artOrId === "number" ? artOrId : getId(artOrId);
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) return 0;
    const venta = getVentaForId(idNum);
    const precio = toNum(baseById?.get?.(idNum)?.precio ?? 0);
    return normalizeVenta(venta, precio).qty;
  }, [getVentaForId, baseById]);

  const getVentasAmount = useCallback((artOrId) => {
    const id = typeof artOrId === "number" ? artOrId : getId(artOrId);
    const idNum = Number(id);
    if (!Number.isFinite(idNum)) return 0;
    const venta = getVentaForId(idNum);
    const precio = toNum(baseById?.get?.(idNum)?.precio ?? 0);
    return normalizeVenta(venta, precio).amount;
  }, [getVentaForId, baseById]);

  const agrupacionesParaTodo = Array.isArray(agrupacionesAll) ? agrupacionesAll : agrupaciones;

  const idsEnOtras = useMemo(
    () => new Set(
      (agrupacionesParaTodo || [])
        .filter((g) => g && !esTodoGroup(g))
        .flatMap((g) => (g.articulos || []).map(getId))
        .filter((id) => Number.isFinite(id) && id !== 0)
    ),
    [agrupacionesParaTodo]
  );

  const idsAsignadosGlobal = useMemo(() => {
    if (Array.isArray(orgAssignedIds) && orgAssignedIds.length > 0) {
      return new Set(orgAssignedIds.map(Number).filter(n => Number.isFinite(n) && n !== 0));
    }
    return idsEnOtras;
  }, [orgAssignedIds, idsEnOtras]);

  const idsSinAgrup = useMemo(() => {
    const s = new Set();
    const discExclude = discIdsProp instanceof Set ? discIdsProp : new Set();
    for (const id of allArticulos.map(getId)) {
      if (!idsAsignadosGlobal.has(id) && !excludedIds.has(id) && !discExclude.has(id)) s.add(id);
    }
    return s;
  }, [allArticulos, idsAsignadosGlobal, excludedIds, discIdsProp]);

  const idsSinAgrupArray = useMemo(() => Array.from(idsSinAgrup), [idsSinAgrup]);

  useEffect(() => {
    onTodoInfo?.({ todoGroupId, idsSinAgrupCount: idsSinAgrup.size, idsSinAgrup: idsSinAgrupArray });
  }, [onTodoInfo, todoGroupId, idsSinAgrup.size, idsSinAgrupArray]);

  const getSortValue = useCallback((a) => {
    const id = getId(a);
    // Costo REAL (mismo criterio que getCostoArticulo y las columnas): receta.costoTotal
    // /porciones si tiene receta, si no a.costo. Antes el sort usaba a.costo crudo, por eso
    // Costo/Ganancia/Costo %/Sugerido no ordenaban acorde a lo mostrado.
    const rec = recetasCostos[String(id)] || recetasCostos[Number(id)];
    const costoReal = (rec && rec.costoTotal > 0)
      ? (rec.porciones > 1 ? rec.costoTotal / rec.porciones : rec.costoTotal)
      : num(a?.costo);
    // Objetivo con la MISMA jerarquía que getObjetivoArticulo: individual > rubro > global.
    // (Sin agrupación acá: el sort no tiene el contexto de agrupación por fila; article/rubro/global cubren el caso.)
    const objetivoResuelto = (() => {
      if (objetivos[id] !== undefined && objetivos[id] !== '') return num(objetivos[id]);
      const cfgArt = priceConfig.byArticle?.[String(id)];
      if (cfgArt?.objetivo != null) return num(cfgArt.objetivo);
      const cfgRubroSub = priceConfig.byRubro?.[String(a.subrubro || '')];
      if (cfgRubroSub?.objetivo != null) return num(cfgRubroSub.objetivo);
      const cfgRubroCat = priceConfig.byRubro?.[String(a.categoria || a.rubro || '')];
      if (cfgRubroCat?.objetivo != null) return num(cfgRubroCat.objetivo);
      return globalCostoIdeal;
    })();
    switch (sortBy) {
      case "ventas": { const idNum = Number(id); if (!Number.isFinite(idNum)) return 0; return getVentasAmount(idNum); }
      case "ventasQty": { const idNum = Number(id); if (!Number.isFinite(idNum)) return 0; const venta = getVentaForId(idNum); const precio = toNum(baseById?.get?.(idNum)?.precio ?? 0); return normalizeVenta(venta, precio).qty; }
      case "codigo": return id;
      case "nombre": return a?.nombre ?? "";
      case "precio": return num(a?.precio);
      case "costo": return costoReal;
      case "ganancia": return costoReal > 0 ? (num(a?.precio) - costoReal) : -Infinity;
      case "costoPct": { const p = num(a?.precio); return p > 0 && costoReal > 0 ? (costoReal / p) * 100 : -Infinity; }
      case "objetivo": return objetivoResuelto;
      case "sugerido": { const den = 100 - objetivoResuelto; return (den > 0 && costoReal > 0) ? costoReal * (100 / den) : 0; }
      case "manual": return num(manuales[id]) || 0;
      default: return null;
    }
  }, [sortBy, objetivos, manuales, getVentasAmount, getVentaForId, baseById, recetasCostos, priceConfig, globalCostoIdeal]);

  const cmp = useCallback((a, b) => {
    if (!sortBy) return 0;
    const va = getSortValue(a), vb = getSortValue(b);
    if (typeof va === "string" || typeof vb === "string") {
      const r = String(va ?? "").localeCompare(String(vb ?? ""), "es", { sensitivity: "base", numeric: true });
      return sortDir === "asc" ? r : -r;
    }
    const na = Number(va ?? 0), nb = Number(vb ?? 0);
    return sortDir === "asc" ? na - nb : nb - na;
  }, [sortBy, sortDir, getSortValue]);

  const articulosAMostrar = useMemo(() => {
    let base = [];
    if (categoriaSeleccionada && agrupacionSeleccionada) {
      base = (categoriaSeleccionada.categorias || [])
        .flatMap((c) => (c.articulos || []).map((a) => {
          const id = getId(a); const b = baseById.get(id) || {};
          return { ...b, ...a, id, nombre: a?.nombre ?? b?.nombre ?? `#${id}`, categoria: a?.categoria ?? b?.categoria ?? c?.categoria ?? "Sin categoría", subrubro: a?.subrubro ?? b?.subrubro ?? categoriaSeleccionada?.subrubro ?? "Sin subrubro", precio: num(a?.precio ?? b?.precio), costo: num(a?.costo ?? b?.costo) };
        }))
        .filter((a) => !filterIds || filterIds.has(getId(a)));
    } else if (categoriaSeleccionada) {
      base = (categoriaSeleccionada.categorias || []).flatMap((c) =>
        (c.articulos || []).map((a) => {
          const id = getId(a); const b = baseById.get(id) || {};
          return { ...b, ...a, id, nombre: a?.nombre ?? b?.nombre ?? `#${id}`, categoria: a?.categoria ?? b?.categoria ?? c?.categoria ?? "Sin categoría", subrubro: a?.subrubro ?? b?.subrubro ?? categoriaSeleccionada?.subrubro ?? "Sin subrubro", precio: num(a?.precio ?? b?.precio), costo: num(a?.costo ?? b?.costo) };
        })
      );
    } else if (agrupacionSeleccionada) {
      if (esTodoGroup(agrupacionSeleccionada)) {
        base = allArticulos.filter((a) => idsSinAgrup.has(getId(a)));
      } else {
        const arr = Array.isArray(agrupacionSeleccionada.articulos) ? agrupacionSeleccionada.articulos : [];
        base = arr.length > 0 ? arr.map((x) => {
          const id = getId(x); const b = baseById.get(id) || {};
          return { id, nombre: x?.nombre ?? b?.nombre ?? `#${id}`, categoria: x?.categoria ?? b?.categoria ?? "Sin categoría", subrubro: x?.subrubro ?? b?.subrubro ?? "Sin subrubro", precio: num(x?.precio ?? b?.precio ?? 0), costo: num(x?.costo ?? b?.costo ?? 0) };
        }) : [];
      }
    } else {
      base = allArticulos;
    }
    if (filterIds instanceof Set) base = base.filter((a) => filterIds.has(getId(a)));
    return base;
  }, [categoriaSeleccionada, agrupacionSeleccionada, idsSinAgrup, baseById, allArticulos, filterIds]);

  const filtroDefer = useDeferredValue(filtroBusqueda);
  const articulosFiltrados = useMemo(() => {
    let base = articulosAMostrar;
    // Ocultar componentes de promo (están dentro de la promo, no son filas propias)
    if (promoComponentIds.size > 0) {
      base = base.filter((a) => !promoComponentIds.has(Number(getId(a))));
    }
    if (filtroDefer) {
      const q = String(filtroDefer).toLowerCase().trim();
      base = base.filter((a) => (a.nombre || "").toLowerCase().includes(q) || String(getId(a)).includes(q));
    }
    if (soloConVentas) {
      base = base.filter((a) => {
        const qty = getVentasQty(a);
        return Number(qty) > 0;
      });
    }
    return base;
  }, [articulosAMostrar, filtroDefer, soloConVentas, getVentasQty, promoComponentIds]);

  const isRubroView = tableHeaderMode === "cat-first";

  const bloques = useMemo(() => {
    const items = articulosFiltrados || [];
    const localeOpts = { sensitivity: "base", numeric: true };
    const byCat = new Map();

    for (const a of items) {
      const cat = getDisplayCategoria(a) || "Sin categoría";
      const sr = getDisplaySubrubro(a) || "Sin subrubro";
      if (!byCat.has(cat)) byCat.set(cat, new Map());
      const bySr = byCat.get(cat);
      if (!bySr.has(sr)) bySr.set(sr, { arts: [], ventasMonto: 0, ventasByBranch: {} });
      const node = bySr.get(sr);
      const artId = Number(getId(a));
      node.arts.push(a);
      node.ventasMonto += getVentasAmount(artId);

      (branches || []).forEach(branch => {
        const bKey = branch.id;
        const bMap = ventasMapByBranch[bKey] || ventasMapByBranch[String(bKey)];
        const bEntry = bMap ? (bMap.get(artId) || bMap.get(String(artId))) : null;
        const bAmount = bEntry?.amount ?? 0;
        node.ventasByBranch[bKey] = (node.ventasByBranch[bKey] || 0) + Number(bAmount);
      });
    }

    const bloquesCat = Array.from(byCat, ([categoria, mapSr]) => {
      const subBlocks = Array.from(mapSr, ([subrubro, data]) => ({
        subrubro, arts: data.arts,
        __ventasMonto: data.ventasMonto || 0,
        __ventasByBranch: data.ventasByBranch || {},
      }));
      subBlocks.sort((a, b) => {
        if (b.__ventasMonto !== a.__ventasMonto) return b.__ventasMonto - a.__ventasMonto;
        return String(a.subrubro).localeCompare(String(b.subrubro), "es", localeOpts);
      });
      const totalRub = subBlocks.reduce((s, x) => s + (x.__ventasMonto || 0), 0);
      const totalByBranch = {};
      subBlocks.forEach(sb => {
        Object.entries(sb.__ventasByBranch || {}).forEach(([bKey, amt]) => {
          totalByBranch[bKey] = (totalByBranch[bKey] || 0) + amt;
        });
      });
      return {
        categoria, __ventasMonto: totalRub, __ventasByBranch: totalByBranch,
        subrubros: subBlocks.map(({ subrubro, arts, __ventasMonto, __ventasByBranch }) =>
          ({ subrubro, arts, __ventasMonto, __ventasByBranch })
        ),
      };
    });

    bloquesCat.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) return b.__ventasMonto - a.__ventasMonto;
      return String(a.categoria).localeCompare(String(b.categoria), "es", localeOpts);
    });

    return bloquesCat.map(({ categoria, subrubros, __ventasMonto, __ventasByBranch }) =>
      ({ categoria, subrubros, __ventasMonto, __ventasByBranch })
    );
  }, [articulosFiltrados, getVentasAmount, branches, ventasMapByBranch]);

    // Rubros-UI existentes (= subrubro DB) para el selector "Mover a otro rubro"
  const rubrosDisponibles = useMemo(() => {
    const set = new Set();
    for (const blq of bloques) {
      for (const sr of (blq.subrubros || [])) {
        const r = (sr.subrubro || '').trim();
        if (r && r !== 'Sin subrubro') set.add(r);
      }
    }
    return Array.from(set).sort((a, b) =>
      String(a).localeCompare(String(b), 'es', { sensitivity: 'base', numeric: true })
    );
  }, [bloques]);

  const esAgrupEspecifica = agrupacionSeleccionada && !esTodoGroup(agrupacionSeleccionada);

  // Total de ventas de todas las agrupaciones reales (excluye Sin Agrupación y Discontinuados)
  // Es el denominador correcto para el % del header de agrupación
  const totalTodasAgrupaciones = useMemo(() => {
    const isDisc = (g) => {
      const n = String(g?.nombre || '').trim().toLowerCase();
      return n === 'discontinuados' || n === 'descontinuados';
    };
    let total = 0;
    for (const g of agrupaciones || []) {
      if (esTodoGroup(g) || isDisc(g)) continue;
      for (const a of (g.articulos || [])) {
        const id = getId(a);
        if (id) total += getVentasAmount(id);
      }
    }
    return total;
  }, [agrupaciones, getVentasAmount]);

  const flatRows = useMemo(() => {
    const sections = [];

    for (const blq of bloques) {
      const subList = blq.subrubros || [];
      for (const sr of subList) {
        const artsOrdenados = (sr?.arts || []).slice().sort(cmp);
        const sectionMonto = sr?.__ventasMonto != null
          ? sr.__ventasMonto
          : artsOrdenados.reduce((acc, a) => acc + getVentasAmount(getId(a)), 0);
        sections.push({
          categoria: blq.categoria,
          subrubro: sr.subrubro,
          arts: artsOrdenados,
          __ventasMonto: sectionMonto,
          __ventasByBranch: sr.__ventasByBranch || {},
        });
      }
    }

    if (tableHeaderMode === "cat-first") {
      sections.sort((a, b) => {
        if ((b.__ventasMonto || 0) !== (a.__ventasMonto || 0)) return (b.__ventasMonto || 0) - (a.__ventasMonto || 0);
        return String(a.subrubro).localeCompare(String(b.subrubro), "es", { sensitivity: "base", numeric: true });
      });
    }

    const rows = [];
    let totalVentasAgrup = 0;

    if (esAgrupEspecifica && sections.length > 0) {
      const todosIdsAgrup = (agrupacionSeleccionada?.articulos || [])
        .map(getId)
        .filter(Boolean);

      totalVentasAgrup = todosIdsAgrup.reduce((acc, id) => acc + getVentasAmount(id), 0);

      const agrupByBranch = {};
      todosIdsAgrup.forEach(id => {
        (branches || []).forEach(branch => {
          const bKey = branch.id;
          const bMap = ventasMapByBranch[bKey] || ventasMapByBranch[String(bKey)];
          const bEntry = bMap ? (bMap.get(id) || bMap.get(String(id))) : null;
          const amt = bEntry?.amount ?? 0;
          agrupByBranch[bKey] = (agrupByBranch[bKey] || 0) + Number(amt);
        });
      });

      rows.push({
        kind: "agrupacion-header",
        key: "AGRUP-HEADER",
        ids: todosIdsAgrup,
        totalVentas: totalVentasAgrup,
        ventasByBranch: agrupByBranch,
        nombre: agrupacionSeleccionada?.nombre || '',
      });
    }

    for (const sec of sections) {
      const { categoria, subrubro, arts } = sec;
      rows.push({
        kind: "header",
        key: `H|${categoria}|${subrubro}`,
        categoria, subrubro,
        ids: arts.map(getId),
        __ventasMonto: sec.__ventasMonto || 0,
        __ventasByBranch: sec.__ventasByBranch || {},
        agrupTotalVentas: totalVentasAgrup,
      });
      for (const a of arts) {
        const id = getId(a);
        rows.push({
          kind: "item",
          key: `I|${categoria}|${subrubro}|${id}`,
          categoria, subrubro,
          art: { ...a, id, precio: num(a.precio), costo: num(a.costo) },
        });
      }
    }

    return rows;
  }, [bloques, cmp, tableHeaderMode, getVentasAmount, esAgrupEspecifica, agrupacionSeleccionada]);

  // Habilitación de las flechas (hay anterior / hay siguiente)
  const navReceta = useMemo(() => {
    const curId = Number(recetaArticulo?.id);
    if (!curId) return { prev: false, next: false };
    const items = flatRows.filter(r => r.kind === "item").map(r => r.art);
    const idx = items.findIndex(a => Number(getId(a)) === curId);
    return { prev: idx > 0, next: idx >= 0 && idx < items.length - 1 };
  }, [recetaArticulo, flatRows]);

  const handleScroll = useCallback((e) => {
    const scrollTop = e.currentTarget.scrollTop;
    const firstVisibleIdx = Math.floor(scrollTop / ITEM_H);

    let lastHeader = null;
    for (let i = Math.min(firstVisibleIdx, flatRows.length - 1); i >= 0; i--) {
      if (flatRows[i].kind === 'header') { lastHeader = flatRows[i]; break; }
    }
    const sub = lastHeader?.subrubro || null;
    setVisibleSubrubro(sub);
    onVisibleSubrubroChange?.(sub);
  }, [flatRows]);

  const idToIndex = useMemo(() => {
    const m = new Map();
    flatRows.forEach((r, i) => {
      if (r?.kind === "item") {
        const id = Number(r?.art?.id);
        if (Number.isFinite(id)) m.set(id, i);
      }
    });
    return m;
  }, [flatRows]);

  useEffect(() => {
    const id = Number(jumpToArticleId);
    if (!Number.isFinite(id)) return;
    if (lastJumpedIdRef.current === id) return;
    lastJumpedIdRef.current = id;
    const path = findPath(categorias, id);
    if (!path) return;
    setExpandedRubro(path.rubroName);
    setExpandedCatByRubro((prev) => ({ ...prev, [path.rubroName]: path.catName }));
    const idx = idToIndex.get(id);
    if (idx != null) {
      setTimeout(() => {
        listRef.current?.scrollToIndex(idx);
        setTimeout(() => {
          const el = document.querySelector(`[data-article-id="${id}"]`);
          if (el) { el.classList.add("highlight-jump"); setTimeout(() => el.classList.remove("highlight-jump"), 1400); }
        }, 40);
      }, 50);
    } else {
      const tryScroll = () => {
        const el = document.querySelector(`[data-article-id="${id}"]`);
        if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("highlight-jump"); setTimeout(() => el.classList.remove("highlight-jump"), 1400); return true; }
        return false;
      };
      let tries = 0;
      const iv = setInterval(() => { if (tryScroll() || tries++ > 12) clearInterval(iv); }, 60);
      return () => clearInterval(iv);
    }
  }, [jumpToArticleId, categorias, findPath, idToIndex]);

  useEffect(() => { if (!jumpToArticleId) lastJumpedIdRef.current = null; }, [jumpToArticleId]);

  const [agrupSelView, setAgrupSelView] = useState(agrupacionSeleccionada);
  useEffect(() => { setAgrupSelView(agrupacionSeleccionada); }, [agrupacionSeleccionada]);

  const afterMutation = useCallback((removedIds) => {
    const ids = (removedIds || []).map(Number).filter(Number.isFinite);
    if (!ids.length) { refetchLocal(); return; }
    if (!agrupSelView?.id) { refetchLocal(); return; }
    if (isTodo) {
      if (ids.length) setExcludedIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
      return;
    }
    onMutateGroups?.({ type: "remove", groupId: Number(agrupSelView.id), ids });
    refetchLocal();
  }, [agrupSelView, onMutateGroups, refetchLocal, setExcludedIds]);

  const handleVisibleIds = useCallback((ids) => { onIdsVisibleChange?.(new Set(ids)); }, [onIdsVisibleChange]);

  const hasBranches = branches && branches.length > 0;
  const checkCol = selectionMode ? "28px " : "";
  const branchCols = hasBranches ? branches.map(() => ".28fr").join(" ") : "";
  const gridTemplate = useMemo(() => {
    const check = selectionMode ? '28px ' : '';
    const branchCols = hasBranches ? branches.map(() => '.28fr').join(' ') + ' ' : '';
    const dynCols = visibleCols.map(c => c.width).join(' ');
    return `${check}.3fr .7fr .35fr ${branchCols}${dynCols}`;
  }, [selectionMode, hasBranches, branches, visibleCols]);

  const cellNum = { textAlign: "left", fontVariantNumeric: "tabular-nums", color: TABLE_TEXT };
  const ITEM_H = 44;
  const isTodo = agrupSelView ? esTodoGroup(agrupSelView) : false;

  const currentVisibleArticleIds = useMemo(
    () => flatRows.filter(r => r.kind === "item").map(r => getId(r.art)).filter(Boolean),
    [flatRows]
  );
  const isAllSelected = currentVisibleArticleIds.length > 0
    && currentVisibleArticleIds.every(id => selectedIds.has(id));

  const getCostoArticulo = useCallback((a) => {
    const id = String(getId(a));
    const receta = recetasCostos[id] || recetasCostos[Number(id)];
    if (receta && receta.costoTotal > 0) return receta.porciones > 1 ? receta.costoTotal / receta.porciones : receta.costoTotal;
    return num(a.costo);
  }, [recetasCostos]);

  const getObjetivoArticulo = useCallback((a, agrupacionId) => {
    const id = String(getId(a));
    if (objetivos[id] !== undefined && objetivos[id] !== '') return num(objetivos[id]);
    const cfgArt = priceConfig.byArticle?.[id];
    if (cfgArt?.objetivo != null) return num(cfgArt.objetivo);
    // El rubro puede estar guardado bajo subrubro (vista cat-first) o categoria (vista sr-first).
    // Probamos ambos: si el usuario cambia de vista, el objetivo guardado debe seguir aplicando.
    const cfgRubroSub = priceConfig.byRubro?.[String(a.subrubro || '')];
    if (cfgRubroSub?.objetivo != null) return num(cfgRubroSub.objetivo);
    const cfgRubroCat = priceConfig.byRubro?.[String(a.categoria || a.rubro || '')];
    if (cfgRubroCat?.objetivo != null) return num(cfgRubroCat.objetivo);
    if (agrupacionId) {
      const cfgAgrup = priceConfig.byAgrupacion?.[String(agrupacionId)];
      if (cfgAgrup?.objetivo != null) return num(cfgAgrup.objetivo);
    }
    return globalCostoIdeal;
  }, [objetivos, priceConfig, globalCostoIdeal]);

   // Navegación entre recetas (anterior/siguiente) recorriendo la lista ordenada
  // por rubro. Pasa entre rubros, ignora agrupaciones (usa flatRows de items).
  const navegarReceta = useCallback((dir) => {
    const curId = Number(recetaArticulo?.id);
    if (!curId) return;
    const items = flatRows.filter(r => r.kind === "item").map(r => r.art);
    const idx = items.findIndex(a => Number(getId(a)) === curId);
    if (idx === -1) return;
    const nextIdx = dir === 'prev' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= items.length) return;
    const a = items[nextIdx];
    const esPromo = a.origen === 'promo' || promoIds.has(Number(getId(a))) || promoGroupIds.has(Number(getId(a)));
    const objetivoResuelto = getObjetivoArticulo(a, String(agrupacionSeleccionada?.id || ''));
    setRecetaArticulo({ ...a, objetivoResuelto, esPromo });
  }, [recetaArticulo, flatRows, promoIds, promoGroupIds, getObjetivoArticulo, agrupacionSeleccionada]);


  const getPrecioManualArticulo = useCallback((a) => {
    const id = String(getId(a));
    if (manuales[id] !== undefined && manuales[id] !== '') return num(manuales[id]);
    const cfgArt = priceConfig.byArticle?.[id];
    if (cfgArt?.precioManual != null) return num(cfgArt.precioManual);
    return null;
  }, [manuales, priceConfig]);

  // ── Color de la lista activa (para teñir UI) ──
  const DEFAULT_LIST_COLORS = ['#2492C8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const currentListColor = useMemo(() => {
    if (!currentPriceList) return 'var(--color-primary)';
    if (currentPriceList.color) return currentPriceList.color;
    const idx = priceLists.findIndex(l => Number(l.id) === Number(currentPriceListId));
    return DEFAULT_LIST_COLORS[(idx < 0 ? 0 : idx) % DEFAULT_LIST_COLORS.length];
  }, [currentPriceList, priceLists, currentPriceListId]);

  // ── Precio efectivo en la lista activa para un artículo ──
  // Si estamos en la favorita: devuelve null (la celda usa el comportamiento de "Nuevo precio" actual).
  // Si no: aplica el cálculo con jerarquía via calcPrecioPorLista().
  const getPrecioListaActiva = useCallback((a, agrupacionId) => {
    if (isPriceListFavorite || !calcPrecioPorLista) return null;
    const id = Number(getId(a));
    const rubroKey = String(a.categoria || a.rubro || '');
    // Base = precio manual (si existe) o precio de lista
    const base = getPrecioManualArticulo(a) ?? num(a.precio);
    return calcPrecioPorLista(base, id, rubroKey, agrupacionId, currentPriceListId);
  }, [isPriceListFavorite, calcPrecioPorLista, currentPriceListId, getPrecioManualArticulo]);

  const tieneReceta = useCallback((a) => {
    const id = String(getId(a));
    const r = recetasCostos[id] || recetasCostos[Number(id)];
    return r && r.costoTotal > 0;
  }, [recetasCostos]);

  const dragColIdx = useRef(null);

  const handleColDragStart = useCallback((i) => {
    dragColIdx.current = i;
  }, []);

  const handleColDrop = useCallback((i) => {
    if (dragColIdx.current === null || dragColIdx.current === i) return;
    const next = [...colConfig];
    const [moved] = next.splice(dragColIdx.current, 1);
    next.splice(i, 0, moved);
    dragColIdx.current = null;
    saveColConfig(next);
  }, [colConfig, saveColConfig]);

  const ClearBtn = ({ onClick, visible = true }) => {
    if (!visible) return null;
    return (
      <button onClick={onClick} title="Borrar" style={{
        marginLeft: 3, padding: '1px 5px', fontSize: '0.65rem',
        lineHeight: 1, border: '1px solid #e5e7eb', borderRadius: 4,
        background: '#fff', color: '#9ca3af', cursor: 'pointer', flexShrink: 0,
      }}
        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
      >✕</button>
    );
  };

  const renderRow = ({ row, index, style }) => {

    if (row.kind === "agrupacion-header") {
      const agrupId = String(agrupacionSeleccionada?.id || '');
      const cfgAgrup = priceConfig.byAgrupacion?.[agrupId] || {};
      const objValDb = cfgAgrup.objetivo != null ? String(cfgAgrup.objetivo) : '';
      const bkObj = `agrup-obj-${agrupId}`;
      const bkManual = `agrup-man-${agrupId}`;
      const ids = row.ids || [];

      return (
        <div key={row.key} style={{
          ...style, display: "grid", alignItems: "center",
          gridTemplateColumns: gridTemplate,
          fontSize: "0.82rem", fontWeight: 600,
          background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
          borderBottom: "2px solid color-mix(in srgb, var(--color-primary) 30%, transparent)",
          padding: "0 4px",
        }}>
          {selectionMode && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <input
                type="checkbox"
                checked={ids.every(id => selectedIds.has(id)) && ids.length > 0}
                onChange={() => {
                  const allChecked = ids.every(id => selectedIds.has(id));
                  ids.forEach(id => {
                    if (allChecked) { if (selectedIds.has(id)) onToggleSelected?.(id); }
                    else { if (!selectedIds.has(id)) onToggleSelected?.(id); }
                  });
                }}
                style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#0369a1" }}
              />
            </div>
          )}
          <div
            style={{
              gridColumn: selectionMode ? "2 / 4" : "1 / 3",
              color: "#1e1e2e",
              paddingLeft: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
            onClick={() => {
              const cfgAgrup = priceConfig.byAgrupacion?.[agrupId] || {};
              setRubroEditModal({
                scope: 'agrupacion',
                rubroKey: agrupId,
                rubroDisplay: row.nombre,
                articleIds: row.ids || [],
                initialObjetivo: cfgAgrup.objetivo,
              });
            }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            {row.nombre}
            {(() => {
              const objA = priceConfig.byAgrupacion?.[agrupId]?.objetivo;
              return objA != null ? (
                <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
                  · objetivo {fmt(objA, 0)}%
                </span>
              ) : null;
            })()}
          </div>

          <div style={{ ...cellNum, color: TABLE_TEXT, fontWeight: 700 }}>
            {row.totalVentas > 0 && ventasVista === '$' && (
              <>
                {fmtCurrency(row.totalVentas)}
                {/* {totalTodasAgrupaciones > 0 && (
                  <span style={{ color: 'var(--color-primary)', fontSize: '0.72rem', fontWeight: 600, marginLeft: 5, opacity: 0.9 }}>
                    {`(${(row.totalVentas / totalTodasAgrupaciones * 100).toFixed(1).replace('.', ',')}%)`}
                  </span>
                )} */}
              </>
            )}
            {row.totalVentas > 0 && ventasVista === 'U' && (
              fmt(row.ids.reduce((acc, id) => acc + getVentasQty(id), 0), 0)
            )}
          </div>

          {(branches || []).map(branch => {
            const bKey = branch.id;
            const amt = row.ventasByBranch?.[bKey] || row.ventasByBranch?.[String(bKey)] || 0;
            const branchColor = branch.color || 'var(--color-primary)';
            const qty = ventasVista === 'U'
              ? (row.ids || []).reduce((acc, artId) => {
                const bMap = ventasMapByBranch[bKey] || ventasMapByBranch[String(bKey)];
                const entry = bMap ? (bMap.get(artId) || bMap.get(String(artId))) : null;
                return acc + (entry?.qty ?? 0);
              }, 0)
              : 0;
            const val = ventasVista === '$' ? amt : qty;
            return (
              <div key={branch.id} style={{ ...cellNum, color: val ? branchColor : '#94a3b8', fontWeight: 600 }}>
                {val > 0 ? (ventasVista === '$' ? fmtCurrency(val) : fmt(val, 0)) : '—'}
              </div>
            );
          })}

          {visibleCols.map(col => {
            if (col.id === 'precio') {
              return <div key="precio" />;
            }
            if (col.id === 'objetivo') {
              return <div key="objetivo" />;
            }
            if (col.id === 'manual') {
              return (
                <div key="manual" style={{ ...cellNum, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="input-symbol-wrapper" data-symbol="%">
                    <input
                      type="number"
                      value={blockManuales[bkManual] ?? ''}
                      placeholder={lastAppliedPct[bkManual] != null ? String(lastAppliedPct[bkManual]) : ''}
                      onChange={(e) => setBlockManuales(prev => ({ ...prev, [bkManual]: e.target.value }))}
                      onBlur={(e) => {
                        const pct = e.target.value === '' ? null : Number(e.target.value);
                        if (pct == null) return;
                        triggerBulkPct(pct, row.ids, { current: e.target }, bkManual);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      className="input-with-suffix input-group-level"
                      style={{ width: 52, fontSize: '0.78rem', textAlign: 'center', background: 'transparent', fontWeight: 600, color: TABLE_TEXT }}
                    />
                  </div>
                  <ClearBtn
                    onClick={() => {
                      setBlockManuales(prev => { const n = { ...prev }; delete n[bkManual]; return n; });
                      setManuales(prev => { const next = { ...prev }; ids.forEach(id => { delete next[String(id)]; }); return next; });
                      if (onBulkManualSave) {
                        onBulkManualSave(ids.map(artId => ({ artId, precioManual: null })));
                      } else {
                        ids.forEach(artId => onPriceConfigSave?.({ scope: 'articulo', scopeId: String(artId), precioManual: null }));
                      }
                    }} />
                </div>
              );
            }
            return <div key={col.id} />;
          })}
        </div>
      );
    }

    if (row.kind === "header") {
      let headerCat = row.categoria || "Sin categoría";
      let headerSr = row.subrubro || "Sin subrubro";
      if (row.ids && row.ids.length > 0) {
        const firstId = Number(row.ids[0]);
        const base = baseById.get(firstId);
        if (base) {
          const rubro = getDisplayCategoria(base);
          const sub = getDisplaySubrubro(base);
          if (rubro) headerCat = rubro;
          if (sub) headerSr = sub;
        }
      }
      const label = isRubroView ? `${headerSr} - ${headerCat}` : `${headerCat} - ${headerSr}`;
      const groupKeyName = tableHeaderMode === "sr-first" ? headerCat : headerSr;
      const ids = row.ids || [];
      const totalQty = ids.reduce((acc, id) => acc + getVentasQty(id), 0);
      const totalAmount = ids.reduce((acc, id) => acc + getVentasAmount(id), 0);

      return (
        <div key={row.key} className="table-section-row"
          style={{ ...style, display: "grid", alignItems: "center", gridTemplateColumns: gridTemplate }}>
          {selectionMode && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <input
                type="checkbox"
                checked={ids.every(id => selectedIds.has(id)) && ids.length > 0}
                onChange={() => {
                  const allChecked = ids.every(id => selectedIds.has(id));
                  ids.forEach(id => {
                    if (allChecked) { if (selectedIds.has(id)) onToggleSelected?.(id); }
                    else { if (!selectedIds.has(id)) onToggleSelected?.(id); }
                  });
                }}
                style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#0369a1" }}
              />
            </div>
          )}
          <div
            style={{
              gridColumn: selectionMode ? "2 / 4" : "1 / 3",
              cursor: 'pointer',
            }}
            onClick={() => {
             const rubroKey = tableHeaderMode === "cat-first" ? (row.subrubro || '') : (row.categoria || '');
              const cfgRubro = priceConfig.byRubro?.[rubroKey] || {};
              setRubroEditModal({
                rubroKey,
                rubroDisplay: label,
                articleIds: row.ids || [],
                initialObjetivo: cfgRubro.objetivo,
                // Para el renombre: si el header está en cat-first, el bloque es un RUBRO UI;
                // si no, un SUBRUBRO UI. rubroNombreActual es el nombre a renombrar (old).
                esRubro: tableHeaderMode === "cat-first",
                rubroNombreActual: rubroKey,
              });
            }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            {label}
            {(() => {
              const rubroKey = tableHeaderMode === "cat-first" ? (row.subrubro || '') : (row.categoria || '');
              const objR = priceConfig.byRubro?.[rubroKey]?.objetivo;
              return objR != null ? (
                <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
                  · objetivo {fmt(objR, 0)}%
                </span>
              ) : null;
            })()}
          </div>

          <div style={cellNum}>
            {ventasVista === '$' ? (
              <>
                {fmtCurrency(totalAmount)}
                {row.agrupTotalVentas > 0 && totalAmount > 0 && (
                  <span style={{ color: 'var(--color-primary)', fontSize: '0.7rem', fontWeight: 600, marginLeft: 4, opacity: 0.85 }}>
                    {`(${(totalAmount / row.agrupTotalVentas * 100).toFixed(1).replace('.', ',')}%)`}
                  </span>
                )}
              </>
            ) : fmt(totalQty, 0)}
          </div>

          {(branches || []).map(branch => {
            const bKey = branch.id;
            const amt = row.__ventasByBranch?.[bKey] || row.__ventasByBranch?.[String(bKey)] || 0;
            const branchColor = branch.color || 'var(--color-primary)';
            const qty = ventasVista === 'U'
              ? (row.ids || []).reduce((acc, artId) => {
                const bMap = ventasMapByBranch[bKey] || ventasMapByBranch[String(bKey)];
                const entry = bMap ? (bMap.get(artId) || bMap.get(String(artId))) : null;
                return acc + (entry?.qty ?? 0);
              }, 0)
              : 0;
            const val = ventasVista === '$' ? amt : qty;
            return (
              <div key={branch.id} style={{ ...cellNum, color: val ? branchColor : '#94a3b8', fontSize: '0.78rem' }}>
                {val > 0 ? (ventasVista === '$' ? fmtCurrency(val) : fmt(val, 0)) : '—'}
              </div>
            );
          })}

          {visibleCols.map(col => {
            if (col.id === 'objetivo' && esAgrupEspecifica) {
              return <div key="objetivo" />;
            } if (col.id === 'manual' && esAgrupEspecifica) {
              const rubroKeyManual = tableHeaderMode === "cat-first" ? (row.subrubro || '') : (row.categoria || '');
              const bkRubroMan = `rubro-man-${rubroKeyManual}`;
              return (
                <div key="manual" style={{ ...cellNum, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="input-symbol-wrapper" data-symbol="%">
                    <input type="number"
                      value={blockManuales[bkRubroMan] ?? ''}
                      placeholder={lastAppliedPct[bkRubroMan] != null ? String(lastAppliedPct[bkRubroMan]) : ''}
                      onChange={(e) => setBlockManuales(prev => ({ ...prev, [bkRubroMan]: e.target.value }))}
                      onBlur={(e) => {
                        const pct = e.target.value === '' ? null : Number(e.target.value);
                        if (pct == null) return;
                        triggerBulkPct(pct, ids, { current: e.target }, bkRubroMan);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      className="input-with-suffix"
                      style={{ width: 52, fontSize: '0.75rem', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: 4, color: TABLE_TEXT }}
                    />
                  </div>
                  <ClearBtn onClick={() => {
                    setBlockManuales(prev => { const n = { ...prev }; delete n[bkRubroMan]; return n; });
                    setManuales(prev => { const next = { ...prev }; ids.forEach(id => { delete next[String(id)]; }); return next; });
                    if (onBulkManualSave) {
                      onBulkManualSave(ids.map(artId => ({ artId, precioManual: null })));
                    } else {
                      ids.forEach(artId => onPriceConfigSave?.({ scope: 'articulo', scopeId: String(artId), precioManual: null }));
                    }
                  }} />
                </div>
              );
            }
            if (col.id === 'acciones') {
              return (
                <SubrubroAccionesMenu
                  key="acciones"
                  subrubro={groupKeyName}
                  todosArticulos={categorias}
                  onMutateGroups={onMutateGroups}
                  baseById={baseById}
                  isTodo={isTodo}
                  agrupaciones={agrupaciones}
                  agrupacionSeleccionada={agrupacionSeleccionada}
                  todoGroupId={todoGroupId}
                  articuloIds={row.ids}
                  articuloIdsArray={row.ids}
                  onRefetch={refetchLocal}
                  onAfterMutation={(ids2) => afterMutation(ids2)}
                  notify={(m, t = "success") => openSnack(m, t)}
                  onGroupCreated={onGroupCreated}
                  treeMode={tableHeaderMode}
                  onDiscontinuarBloque={onDiscontinuarBloque}
                  allowedIds={filterIds}
                  rootBizId={rootBizId}
                  priceLists={priceLists}
                  priceListsByList={priceListsByList}
                  rootBizId={rootBizId}
                />
              );
            }
            return <div key={col.id} />;
          })}
        </div>
      );
    }

    const a = row.art;
    const id = a.id;
    const agrupId = String(agrupacionSeleccionada?.id || '');
    const isSelected = Number(id) === Number(selectedArticleId);

    const overrideQty = getVentasQty(id);
    const overrideAmount = getVentasAmount(id);
    const costoArticulo = getCostoArticulo(a);
    const hayReceta = tieneReceta(a);
    const recetaData = recetasCostos[String(id)] || recetasCostos[Number(id)];
    const hayAlertaInsumo = hayReceta && recetaData?.tieneAlerta === true;
    const objetivoArticulo = getObjetivoArticulo(a, agrupId);
    const precioManual = getPrecioManualArticulo(a);
    const precioBase = num(a.precio);
    const precioRef = precioManual ?? precioBase;
    const precioParaCosto = precioManual != null && precioManual > 0 ? precioManual : precioBase;
    const costoPct = precioParaCosto > 0 ? (costoArticulo / precioParaCosto) * 100 : 0;
    const sugerido = objetivoArticulo > 0 && objetivoArticulo < 100 ? costoArticulo / (objetivoArticulo / 100) : 0;
    const superaObjetivo = costoPct > 0 && objetivoArticulo > 0 && costoPct > objetivoArticulo;
    const isChecked = selectionMode ? selectedIds.has(Number(id)) : false;
    const rowBg = isChecked ? "rgba(3,105,161,0.07)" : hayAlertaInsumo ? "rgba(245,158,11,0.08)" : superaObjetivo ? "rgba(239,68,68,0.06)" : undefined;
    const selectedStyle = isSelected ? { background: "color-mix(in srgb, var(--color-primary) 10%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 35%, transparent)", position: "relative" } : null;
    const leftBar = isSelected ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--color-primary)", borderRadius: 2 }} /> : null;
    // linkByArticleId ahora devuelve un array de grupos (uno por tipo)
    const linkInfo = linkByArticleId.get(Number(id)) ?? null;
    const linkGroupsList = Array.isArray(linkInfo) ? linkInfo : (linkInfo ? [linkInfo] : []);
    const isLinked = linkGroupsList.length > 0;
    // En el modo "vincular" (que es de precio), solo bloqueamos check si ya hay vinculación de precio
    const isLinkedByPrecio = linkGroupsList.some(g => g.linkType === 'precio');

    return (
      <div key={row.key} data-article-id={id}
        className={`table-item-row${isSelected ? " is-selected" : ""}`}
        style={{ ...style, display: "grid", alignItems: "center", gridTemplateColumns: gridTemplate, fontWeight: 500, fontSize: "0.85rem", background: rowBg, ...(selectedStyle || {}) }}>
        {leftBar}
        {selectionMode && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isLinkedByPrecio && selectionMode === 'link' && !editingGroup ? (
              // Fuera de edición: los ya vinculados por precio muestran el icono de cadena (no check).
              <LinkChainIcon
                articleId={id} groupInfo={linkGroupsList.find(g => g.linkType === 'precio')}
                nameById={nameById}
                onRemoveSelf={onRemoveMemberFromLink}
                onDeleteGroup={onDeleteLink}
                onAddMembers={onAddMembersToLink}
              />
            ) : (
              // En edición (o no vinculado): checkbox normal. Los miembros del grupo entran
              // pre-marcados (selectedIds los trae), así se ven marcados y se pueden desmarcar.
              <input type="checkbox" checked={isChecked} onChange={() => onToggleSelected?.(Number(id))}
                style={{ width: 14, height: 14, cursor: "pointer", accentColor: selectionMode === "link" ? "#7c3aed" : "#0369a1" }} />
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 4, color: TABLE_TEXT }}>
          <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
            {(selectionMode === 'list' || !selectionMode) && isLinked && (
              <>
                {linkGroupsList.filter(g => g.linkType === 'precio').map(g => (
                  <LinkChainIcon
                    key={g.groupId ?? g.id}
                    articleId={id} groupInfo={g}
                    nameById={nameById}
                    onRemoveSelf={onRemoveMemberFromLink}
                    onDeleteGroup={onDeleteLink}
                    onAddMembers={onAddMembersToLink}
                  />
                ))}
              </>
            )}
          </span>
          {(a.origen === 'manual' || Number(id) < 0)
            ? <span title="Artículo cargado manualmente en Lazarillo" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>L{id}</span>
            : <span>{id}</span>
          }
        </div>

        <div onClick={() => {
          const esPromo = a.origen === 'promo' || promoIds.has(Number(getId(a))) || promoGroupIds.has(Number(getId(a)));
          const objetivoResuelto = getObjetivoArticulo(a, agrupId);
          setRecetaArticulo({ ...a, objetivoResuelto, esPromo });
        }}
          style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
          title={hayReceta ? `Receta cargada — costo $${fmt(costoArticulo, 0)}` : `Cargar receta de ${a.nombre}`}>
          <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem' }}>
            {hayAlertaInsumo ? <span style={{ color: '#f59e0b' }}>⚠</span>
              : hayReceta ? <span style={{ color: '#6366f1' }}>●</span>
                : null}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre}</span>
        </div>

        <div style={cellNum}>
          {ventasVista === '$'
            ? fmtCurrency(overrideAmount)
            : <VentasCell articuloId={id} articuloNombre={a.nombre} from={fechaDesde} to={fechaHasta}
              defaultGroupBy="day" totalOverride={overrideQty} onTotalResolved={onTotalResolved} businessId={activeBizId} />
          }
        </div>

        {hasBranches && branches.map(branch => {
          const bKey = branch.id;
          const bMap = ventasMapByBranch[bKey] || ventasMapByBranch[String(bKey)];
          const bData = bMap ? (bMap.get(id) || bMap.get(String(id)) || { amount: 0, qty: 0 }) : { amount: 0, qty: 0 };
          const branchColor = branch.color || 'var(--color-primary)';
          const val = ventasVista === '$' ? bData.amount : bData.qty;
          const display = val > 0 ? (ventasVista === '$' ? fmtCurrency(val) : fmt(val, 0)) : '—';
          return (
            <div key={branch.id} style={{ ...cellNum, fontSize: '0.78rem', color: val ? branchColor : '#94a3b8', borderLeft: `2px solid ${branchColor}20` }}>
              {display}
            </div>
          );
        })}

        {visibleCols.map(col => {
          switch (col.id) {
            case 'precio':
              // La columna "Precio" siempre muestra el precio de la favorita (precio base).
              // La columna que cambia con la lista es "Nuevo precio".
              return <div key="precio" style={cellNum}>{fmtCurrency(num(a.precio))}</div>;
            case 'sinPromo': {
              const vsp = ventaSinPromoMap?.[Number(getId(a))] ?? 0;
              return <div key="sinPromo" style={{ ...cellNum, color: '#7c3aed', fontWeight: 700 }}>{vsp > 0 ? fmtCurrency(vsp) : '—'}</div>;
            }

            case 'costo':
              return (
                <div key="costo" style={{ ...cellNum, color: hayReceta ? '#6366f1' : TABLE_TEXT }}>
                  {costoArticulo > 0 ? fmtCurrency(costoArticulo) : <span style={{ color: TABLE_MUTED }}>—</span>}
                </div>
              );

            case 'ganancia': {
              const ganancia = num(a.precio) - costoArticulo;
              return (
                <div key="ganancia" style={{ ...cellNum, color: costoArticulo > 0 ? (ganancia >= 0 ? '#16a34a' : '#ef4444') : TABLE_MUTED }}>
                  {costoArticulo > 0 ? fmtCurrency(ganancia) : <span style={{ color: TABLE_MUTED }}>—</span>}
                </div>
              );
            }

            case 'costoPct': {
              const bajoPorcentaje = costoPct > 0 && objetivoArticulo > 0 && costoPct < (objetivoArticulo / 2);
              const colorCosto = superaObjetivo || bajoPorcentaje ? '#ef4444' : undefined;
              const boldCosto = superaObjetivo || bajoPorcentaje;
              return (
                <div key="costoPct" style={{ ...cellNum, color: colorCosto, fontWeight: boldCosto ? 700 : 500 }}>
                  {costoPct > 0 ? `${fmt(costoPct, 1)}%` : <span style={{ color: TABLE_MUTED }}>—</span>}
                </div>
              );
            }

            case 'objetivo':
              return (
                <div key="objetivo" style={cellNum}>
                  <span style={{ fontSize: '0.78rem', color: tieneObjetivoIndividual(id) ? '#6366f1' : TABLE_TEXT }}
                    title={tieneObjetivoIndividual(id) ? 'Objetivo definido individualmente' : ''}>
                    {objetivoArticulo > 0 ? `${fmt(objetivoArticulo, 0)}%` : <span style={{ color: TABLE_MUTED }}>—</span>}
                  </span>
                </div>
              );

            case 'sugerido':
              return (
                <div key="sugerido" style={{ ...cellNum, color: sugerido > 0 ? '#16a34a' : undefined }}>
                  {sugerido > 0 ? fmtCurrency(sugerido) : <span style={{ color: TABLE_MUTED }}>—</span>}
                </div>
              );

            case 'manual': {
              const precioListaCalc = getPrecioListaActiva(a, agrupId);

              // En lista no-favorita → celda editable con ingeniería inversa al guardar
              if (precioListaCalc) {
                const { precio, excluido, ajuste } = precioListaCalc;
                const redondeo = redondeoConfig?.valor;
                const precioFinal = redondeo > 0
                  ? Math.round(precio / redondeo) * redondeo
                  : Math.round(precio);

                // Si está excluido → mostrar gris, no editable
                if (excluido) {
                  return (
                    <div key="manual" style={{ ...cellNum, position: 'relative' }}>
                      <div
                        title="Excluido — usa precio de la lista favorita"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
                          width: 85, padding: '4px 8px', borderRadius: 6,
                          border: '1px dashed #cbd5e1', background: '#f8fafc',
                          color: '#94a3b8', fontWeight: 700, fontSize: '0.78rem',
                          lineHeight: '20px',
                        }}
                      >
                        {fmtCurrency(precioFinal)}
                      </div>
                    </div>
                  );
                }

                // Editable con ingeniería inversa: el usuario ve y edita el precio en la lista actual,
                // pero internamente guardamos el precio base de la favorita.
                const localOverride = manuales[`__list_${currentPriceListId}_${id}`];
                const valorMostrado = localOverride !== undefined ? localOverride : precioFinal;

                return (
                  <div key="manual" style={{ ...cellNum, position: 'relative' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center',
                      border: `1px solid ${currentListColor}50`,
                      borderRadius: 6, overflow: 'hidden',
                      background: `${currentListColor}08`,
                      width: 85,
                    }}>
                      <span style={{
                        padding: '0 5px', fontSize: '0.72rem',
                        color: currentListColor,
                        background: `${currentListColor}15`,
                        borderRight: `1px solid ${currentListColor}30`,
                        lineHeight: '28px', userSelect: 'none', fontWeight: 700,
                      }}>$</span>
                      <input
                        type="text"
                        title={`${currentPriceList?.name} · ${ajuste > 0 ? '+' : ''}${ajuste}% sobre favorita`}
                        value={(() => {
                          if (valorMostrado === '' || valorMostrado == null) return '';
                          const n = Number(String(valorMostrado).replace(/\./g, ''));
                          return Number.isFinite(n) ? n.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : String(valorMostrado);
                        })()}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                          setManuales(s => ({ ...s, [`__list_${currentPriceListId}_${id}`]: raw === '' ? '' : Number(raw) }));
                        }}
                        onBlur={(e) => {
                          const raw = String(manuales[`__list_${currentPriceListId}_${id}`] ?? '').replace(/\./g, '').replace(/[^0-9]/g, '');
                          const valEnLista = raw === '' ? null : Number(raw);

                          if (valEnLista === null) {
                            // Limpiar solo el override de visualización, no tocar nada más
                            setManuales(s => { const next = { ...s }; delete next[`__list_${currentPriceListId}_${id}`]; return next; });
                            return;
                          }

                          // Ingeniería inversa: precio_base_favorita = valEnLista / (1 + ajuste/100)
                          const factor = 1 + (Number(ajuste) || 0) / 100;
                          if (factor <= 0) {
                            setManuales(s => { const next = { ...s }; delete next[`__list_${currentPriceListId}_${id}`]; return next; });
                            return;
                          }
                          const baseSinRedondear = valEnLista / factor;
                          const redondeo = redondeoConfig?.valor;
                          const precioBaseNuevo = redondeo > 0
                            ? Math.round(baseSinRedondear / redondeo) * redondeo
                            : Math.round(baseSinRedondear);

                          // Actualizar el manual local de la favorita ANTES de limpiar el override de la lista.
                          // Así el próximo render ve el nuevo precio base mientras esperamos la respuesta del backend.
                          setManuales(s => {
                            const next = { ...s };
                            next[id] = precioBaseNuevo;                       // nuevo manual de favorita
                            delete next[`__list_${currentPriceListId}_${id}`]; // limpiar override visual
                            return next;
                          });

                          bulkSetIdsRef.current.delete(Number(id));
                          onPriceConfigSave?.({
                            scope: 'articulo',
                            scopeId: String(id),
                            precioManual: precioBaseNuevo,
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                        }}
                        style={{
                          width: 58, fontSize: '0.78rem', textAlign: 'right',
                          border: 'none', outline: 'none', padding: '0 6px',
                          color: currentListColor, fontWeight: 700, background: 'transparent',
                        }}
                      />
                    </div>
                  </div>
                );
              }

              // En la favorita → input editable (comportamiento clásico)
              return (
                <div key="manual" style={{ ...cellNum, position: 'relative' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', background: '#fff', width: 85 }}>
                    <span style={{ padding: '0 5px', fontSize: '0.72rem', color: TABLE_MUTED, background: '#f9fafb', borderRight: '1px solid #e5e7eb', lineHeight: '28px', userSelect: 'none' }}>$</span>
                    <input
                      type="text"
                      value={(() => {
                        const raw = manuales[id] !== undefined ? manuales[id] : (priceConfig.byArticle?.[String(id)]?.precioManual ?? '');
                        if (raw === '' || raw == null) return '';
                        const n = Number(String(raw).replace(/\./g, ''));
                        return Number.isFinite(n) ? n.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : String(raw);
                      })()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                        setManuales(s => ({ ...s, [id]: raw === '' ? '' : Number(raw) }));
                      }}
                      onBlur={(e) => {
                        const raw = String(manuales[id] ?? '').replace(/\./g, '').replace(/[^0-9]/g, '');
                        const val = raw === '' ? null : Number(raw);
                        bulkSetIdsRef.current.delete(Number(id));
                        if (val === null) {
                          onPriceConfigSave?.({ scope: 'articulo', scopeId: String(id), _deleteManual: true });
                        } else {
                          onPriceConfigSave?.({ scope: 'articulo', scopeId: String(id), precioManual: val });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.target.blur();
                        }
                      }}
                      style={{ width: 58, fontSize: '0.78rem', textAlign: 'right', border: 'none', outline: 'none', padding: '0 6px', color: TABLE_TEXT, background: 'transparent' }}
                    />
                  </div>
                </div>
              );
            }

            case 'acciones': {
              const esPromo = a.origen === 'promo' || promoIds.has(Number(getId(a))) || promoGroupIds.has(Number(getId(a)));
              return (
                <div key="acciones" style={{ textAlign: 'center' }}>
                  <ArticuloAccionesMenu
                    onMutateGroups={onMutateGroups} baseById={baseById} articulo={a}
                    esPromo={esPromo}
                    onCrearPromo={(art) => {
                      setRecetaArticulo({
                        __promoNueva: true,
                        id: null,
                        nombre: '',
                        esPromo: true,
                        componentePrecargado: art,
                      });
                    }}
                    agrupaciones={agrupaciones} 
                    agrupacionSeleccionada={agrupacionSeleccionada}
                    todoGroupId={todoGroupId} 
                    isTodo={isTodo} onRefetch={refetchLocal}
                    onAfterMutation={(ids2) => afterMutation(ids2)}
                    notify={(m, t) => openSnack(m, t)} 
                    onGroupCreated={onGroupCreated}
                    rubrosDisponibles={rubrosDisponibles}
                    onDiscontinuadoChange={onDiscontinuadoChange} 
                    treeMode={modalTreeMode}
                    allowedIds={filterIds} 
                    businessId={activeBizId} 
                    rootBizId={rootBizId}
                    priceLists={priceLists}
                    priceListsByList={priceListsByList}
                    priceConfig={priceConfig}
                    promoIds={new Set([...promoIds, ...promoGroupIds])}
                  />
                </div>
              );
            }
            default: return null;
          }
        })}
      </div>
    );
  };

  return (
    <>
      {recetaArticulo && (
        <RecetaModal
          open={!!recetaArticulo} onClose={() => { console.trace('[CIERRE MODAL] onClose disparado'); setRecetaArticulo(null); }}
          articulo={recetaArticulo}
          modoPromoNueva={recetaArticulo.__promoNueva === true}
          businessId={activeBizId}
          insumosBizId={rootBizId || activeBizId}
          calcPrecioPorLista={calcPrecioPorLista}
          esElaborado={false}
          onNavigate={navegarReceta}
          canNavigate={navReceta}
          esPromo={recetaArticulo.esPromo === true}
          costoObjetivoExterno={recetaArticulo.objetivoResuelto ?? null}
          recetasElaborados={recetasElaborados}
          onPriceConfigSave={onPriceConfigSave}
          allArticulos={allArticulos}
          promoIds={promoIds}
          priceLists={priceLists}
          priceListsByList={priceListsByList}
          onSaved={(savedReceta) => {
            if (savedReceta?.article_id && savedReceta?.costo_total != null) onSaved?.(savedReceta);
          }}
        />
      )}

      <div className="tabla-articulos-container">
        <div style={{ height: "calc(100vh - 220px)", width: "100%" }}>
          <div className="table-col-header">
            <div className="table-col-header-inner" style={{ gridTemplateColumns: gridTemplate }}>
              {selectionMode && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <input type="checkbox" checked={isAllSelected}
                    onChange={() => {
                      if (isAllSelected) currentVisibleArticleIds.forEach(id => selectedIds.has(id) && onToggleSelected?.(id));
                      else onSelectAll?.(currentVisibleArticleIds);
                    }}
                    title={isAllSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                    style={{ width: 14, height: 14, cursor: "pointer", accentColor: selectionMode === "link" ? "#7c3aed" : "#0369a1" }}
                  />
                </div>
              )}

              <div onClick={() => toggleSort("codigo")} className="col-sortable">
                Código {sortBy === "codigo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("nombre")} className="col-sortable">
                Nombre {sortBy === "nombre" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span onClick={() => toggleSort("ventas")} className="col-sortable" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Ventas {ventasLoading ? "…" : ""}
                  {sortBy === "ventas" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </span>
                <span
                  onClick={() => onToggleSoloConVentas?.()}
                  title={soloConVentas ? 'Mostrando solo con ventas — click para ver todos' : 'Filtrar: solo artículos con ventas'}
                  style={{
                    cursor: 'pointer', fontSize: '0.8rem',
                    opacity: soloConVentas ? 1 : 0.35,
                    color: soloConVentas ? 'var(--color-primary)' : 'inherit',
                    lineHeight: 1, userSelect: 'none',
                  }}
                >
                  👁
                </span>
                <button
                  onClick={() => setVentasVista(v => v === 'U' ? '$' : 'U')}
                  title={ventasVista === '$' ? 'Cambiar a pesos' : 'Cambiar a unidades'}
                  style={{ padding: '1px 7px', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontWeight: 700, lineHeight: 1.4, fontSize: '0.68rem', flexShrink: 0, background: HEADER_TEXT, color: '#fff', transition: 'background 0.15s' }}>
                  {ventasVista}
                </button>
              </div>

              {hasBranches && branches.map(branch => (
                <div key={branch.id}
                  style={{ fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', color: branch.color || 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: `2px solid ${branch.color || 'var(--color-primary)'}30`, paddingLeft: 4 }}
                  title={`Ventas ${ventasVista} — ${branch.name}`}>
                  {branch.name} {ventasVista}
                </div>
              ))}

              {visibleCols.map((col, colIdx) => {
                const isDragOver = dragOverColIdx === colIdx && dragColIdx.current !== colIdx;
                const dragIndicatorStyle = {
                  cursor: 'grab',
                  borderLeft: isDragOver ? '3px solid var(--color-primary)' : '3px solid transparent',
                  background: isDragOver ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : undefined,
                  transition: 'all 0.1s',
                };

                const dragProps = {
                  draggable: true,
                  onDragStart: (e) => { e.stopPropagation(); handleColDragStart(colIdx); },
                  onDragOver: (e) => { e.preventDefault(); setDragOverColIdx(colIdx); },
                  onDragLeave: () => setDragOverColIdx(null),
                  onDrop: (e) => { e.stopPropagation(); handleColDrop(colIdx); setDragOverColIdx(null); },
                };

                switch (col.id) {
                  case 'precio': return <div key="precio" {...dragProps} onClick={() => toggleSort('precio')} className="col-sortable" style={dragIndicatorStyle}>Precio{sortBy === 'precio' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'costo': return <div key="costo" {...dragProps} onClick={() => toggleSort('costo')} className="col-sortable" style={dragIndicatorStyle}>Costo{sortBy === 'costo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'sinPromo': return <div key="sinPromo" style={{ textAlign: 'center', fontWeight: 700  }}>$ Sin Promo</div>;
                  case 'ganancia': return <div key="ganancia" {...dragProps} onClick={() => toggleSort('ganancia')} className="col-sortable" style={dragIndicatorStyle}>Ganancia{sortBy === 'ganancia' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'costoPct': return <div key="costoPct" {...dragProps} onClick={() => toggleSort('costoPct')} className="col-sortable" style={dragIndicatorStyle}>Costo %{sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'objetivo': return <div key="objetivo" {...dragProps} onClick={() => toggleSort('objetivo')} className="col-sortable" style={dragIndicatorStyle}>Objetivo{sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'sugerido': return <div key="sugerido" {...dragProps} onClick={() => toggleSort('sugerido')} className="col-sortable" style={dragIndicatorStyle}>Sugerido{sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'manual': {
                    const headerLabel = !isPriceListFavorite && currentPriceList?.name
                      ? currentPriceList.name
                      : 'Nuevo precio';
                    const headerColor = !isPriceListFavorite ? currentListColor : undefined;
                    return (
                      <div key="manual" {...dragProps} onClick={() => toggleSort('manual')} className="col-sortable"
                        style={{ ...dragIndicatorStyle, color: headerColor, fontWeight: !isPriceListFavorite ? 700 : undefined }}>
                        {headerLabel}{sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </div>
                    );
                  }
                  case 'acciones': return (
                    <div key="acciones" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <IconButton
                        size="small"
                        onClick={() => setColDlgOpen(true)}
                        title="Configurar columnas"
                        sx={{ p: 0.25, opacity: 0.55, '&:hover': { opacity: 1 } }}
                      >
                        <TuneIcon sx={{ fontSize: 20, color: 'black' }} />
                      </IconButton>
                    </div>
                  );
                  default: return null;
                }
              })}
            </div>
          </div>

          {flatRows.length === 0 ? (
            <p style={{ marginTop: "2rem", fontSize: "1.2rem", color: "#777", padding: "0 8px" }}>No hay artículos.</p>
          ) : (
            <div onScroll={handleScroll}>
              <VirtualList
                ref={listRef} rows={flatRows} rowHeight={ITEM_H}
                height={typeof window !== "undefined" && window.innerHeight ? Math.max(240, window.innerHeight - 220) : 520}
                overscan={8} onVisibleItemsIds={handleVisibleIds}
                getRowId={(r) => (r?.kind === "item" ? Number(r?.art?.id) : null)}
                renderRow={renderRow} extraData={(ventasPorArticulo?.size || 0) + selectedIds.size + (selectionMode ? 1 : 0)}
              />
            </div>
          )}
        </div>

        <Snackbar open={snack.open} autoHideDuration={2600} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
          <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.type} sx={{ width: "100%" }}>{snack.msg}</Alert>
        </Snackbar>
      </div>

      {/* ── Modal de redondeo de precios ── */}
      {redondeoModalPendiente && (
        <Dialog open onClose={() => {
          const { pct, ids, inputRef, blockKey } = redondeoModalPendiente;
          setRedondeoModalPendiente(null);
          continuarDespuesDeRedondeo(pct, ids, inputRef, blockKey);
        }} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Configurar redondeo de precios
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" gutterBottom>
              ¿A qué múltiplo querés redondear los nuevos precios?
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              {[2, 5, 10, 20, 50, 100, 500, 1000].map(op => (
                <Chip
                  key={op}
                  label={`$${op}`}
                  onClick={() => {
                    saveRedondeoConfig(activeBizId, op, redondeoConfig?.mostrarModal ?? true);
                    setRedondeoConfig(prev => ({ ...prev, valor: op }));
                    onRedondeoChange?.(op);
                    BusinessesAPI.update(Number(activeBizId), { props: { redondeo_precios: op } }).catch(() => { });
                    window.dispatchEvent(new CustomEvent('config:updated', {
                      detail: { key: 'redondeo_precios', value: op }
                    }));
                  }}
                  variant="outlined"
                  size="small"
                  sx={{ cursor: 'pointer', fontWeight: 500 }}
                />
              ))}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="checkbox"
                id="redondeo-no-mostrar"
                checked={!(redondeoConfig?.mostrarModal ?? true)}
                onChange={(e) => {
                  const noMostrar = e.target.checked;
                  saveRedondeoConfig(activeBizId, redondeoConfig?.valor ?? null, !noMostrar);
                  setRedondeoConfig(prev => ({ ...prev, mostrarModal: !noMostrar }));
                  // ← agregar en los dos:
                  try {
                    BusinessesAPI.update(Number(activeBizId), {
                      props: { redondeo_mostrar_modal: !noMostrar }
                    });
                  } catch { }
                }}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
              <label htmlFor="redondeo-no-mostrar" style={{ fontSize: '0.8rem', cursor: 'pointer', color: '#555' }}>
                No volver a mostrar (configurar desde Ajustes → Artículos)
              </label>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button size="small" variant="text" color="inherit"
              onClick={() => {
                const { pct, ids, inputRef, blockKey } = redondeoModalPendiente;
                setRedondeoModalPendiente(null);
                continuarDespuesDeRedondeo(pct, ids, inputRef, blockKey);
              }}>
              Sin redondeo
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {bulkPctDlg && (
        <Dialog open onClose={() => setBulkPctDlg(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Aplicar aumento de precio
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Se aplicará un aumento de <strong>{bulkPctDlg.pct}%</strong> a <strong>{bulkPctDlg.idsAll.length}</strong> artículo{bulkPctDlg.idsAll.length !== 1 ? 's' : ''}.
              {redondeoConfig?.valor
                ? ` Los precios se redondearán al múltiplo de $${redondeoConfig.valor} más cercano.`
                : ''}
            </Typography>

            {bulkPctDlg.idsConNuevoPrecio.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2, fontSize: '0.82rem' }}>
                {bulkPctDlg.idsConNuevoPrecio.length} artículo{bulkPctDlg.idsConNuevoPrecio.length !== 1 ? 's tienen' : ' tiene'} un nuevo precio cargado manualmente que será reemplazado.
              </Alert>
            )}

            {/* Sección de redondeo solo si no hay valor configurado */}
            {bulkPctDlg.motivoConfigRedondeo && (
              <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Redondeo de precios (sin configurar)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                  {[2, 5, 10, 20, 50, 100, 500, 1000].map(op => (
                    <Chip
                      key={op}
                      label={`$${op}`}
                      size="small"
                      variant={redondeoConfig?.valor === op ? 'filled' : 'outlined'}
                      onClick={() => {
                        saveRedondeoConfig(activeBizId, op, redondeoConfig?.mostrarModal ?? true);
                        setRedondeoConfig(prev => ({ ...prev, valor: op }));
                        onRedondeoChange?.(op);
                        BusinessesAPI.update(Number(activeBizId), { props: { redondeo_precios: op } }).catch(() => { });
                        window.dispatchEvent(new CustomEvent('config:updated', {
                          detail: { key: 'redondeo_precios', value: op }
                        }));
                      }}
                      sx={{
                        cursor: 'pointer',
                        fontWeight: redondeoConfig?.valor === op ? 700 : 400,
                        ...(redondeoConfig?.valor === op && {
                          bgcolor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)',
                        }),
                      }}
                    />
                  ))}
                  <Chip
                    key="none"
                    label="Sin redondeo"
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      // Dejar explícito que no quiere redondeo → cerrar y aplicar
                      executeBulkPct(bulkPctDlg.pct, bulkPctDlg.idsAll, 'todos');
                      if (bulkPctDlg.blockKey) {
                        setBlockManuales(prev => { const n = { ...prev }; delete n[bulkPctDlg.blockKey]; return n; });
                        setLastAppliedPct(prev => ({ ...prev, [bulkPctDlg.blockKey]: bulkPctDlg.pct }));
                      }
                      if (bulkPctDlg.inputRef?.current) bulkPctDlg.inputRef.current.value = '';
                      setBulkPctDlg(null);
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <input
                    type="checkbox"
                    id="bulk-redondeo-no-mostrar"
                    checked={!(redondeoConfig?.mostrarModal ?? true)}
                    onChange={(e) => {
                      const noMostrar = e.target.checked;
                      saveRedondeoConfig(activeBizId, redondeoConfig?.valor ?? null, !noMostrar);
                      setRedondeoConfig(prev => ({ ...prev, mostrarModal: !noMostrar }));
                      try {
                        BusinessesAPI.update(Number(activeBizId), {
                          props: { redondeo_mostrar_modal: !noMostrar }
                        });
                      } catch { }
                      window.dispatchEvent(new CustomEvent('config:updated', {
                        detail: { key: 'redondeo_mostrar_modal', value: !noMostrar }
                      }));
                    }}
                    style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                  <label htmlFor="bulk-redondeo-no-mostrar" style={{ fontSize: '0.78rem', cursor: 'pointer', color: '#555' }}>
                    No volver a mostrar este aviso
                  </label>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
            <Button size="small" variant="text" color="inherit" onClick={() => setBulkPctDlg(null)}>
              Cancelar
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                executeBulkPct(bulkPctDlg.pct, bulkPctDlg.idsAll, 'todos');
                if (bulkPctDlg.blockKey) {
                  setBlockManuales(prev => { const n = { ...prev }; delete n[bulkPctDlg.blockKey]; return n; });
                  setLastAppliedPct(prev => ({ ...prev, [bulkPctDlg.blockKey]: bulkPctDlg.pct }));
                }
                if (bulkPctDlg.inputRef?.current) bulkPctDlg.inputRef.current.value = '';
                setBulkPctDlg(null);
              }}
              sx={{ bgcolor: 'var(--color-primary)', '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' } }}>
              Aplicar a todos
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <ColOrderModal open={colDlgOpen} cols={colConfig} onSave={saveColConfig} onClose={() => setColDlgOpen(false)} />

      {rubroEditModal && (
        <RubroEditModal
          open={!!rubroEditModal}
          onClose={() => setRubroEditModal(null)}
          scope={rubroEditModal.scope || 'rubro'}
          rubroKey={rubroEditModal.rubroKey}
          rubroDisplay={rubroEditModal.rubroDisplay}
          articleIds={rubroEditModal.articleIds}
          initialObjetivo={rubroEditModal.initialObjetivo}
          esRubro={rubroEditModal.esRubro ?? null}
          rubroNombreActual={rubroEditModal.rubroNombreActual ?? ''}
          globalCostoIdeal={globalCostoIdeal}
          orgId={organization?.id}
          businessId={activeBizId}
          onSave={({ objetivo, articleIds }) => {
            if (!onPriceConfigSave) return;
            const scope = rubroEditModal.scope || 'rubro';
            const scopeKey = rubroEditModal.rubroKey;
            const scopeLabel = rubroEditModal.rubroDisplay || (scope === 'agrupacion' ? 'esta agrupación' : 'este rubro');
            const valAnterior = rubroEditModal.initialObjetivo != null
              ? Number(rubroEditModal.initialObjetivo)
              : null;

            setObjetivos(prev => {
              const next = { ...prev };
              articleIds.forEach(artId => { delete next[String(artId)]; });
              return next;
            });

            onPriceConfigSave({
              scope,
              scopeId: scopeKey,
              objetivo,
              articleIds,
            });

            try {
              window.dispatchEvent(new CustomEvent('ui:action', {
                detail: {
                  kind: 'objetivo_change',
                  title: objetivo != null
                    ? `🎯 Objetivo ${objetivo}% en ${scopeLabel}`
                    : `🗑 Objetivo borrado en ${scopeLabel}`,
                  message: `${articleIds.length} artículo(s) afectado(s).`,
                  createdAt: new Date().toISOString(),
                  scope: 'articulo',
                  payload: { scope, scopeId: scopeKey, val: objetivo, valAnterior, articleIds },
                },
              }));
            } catch (e) {
              console.error('[RubroModal onSave] error en dispatch:', e);
            }
          }}
        />
      )}
    </>
  );
}