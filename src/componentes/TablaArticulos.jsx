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
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import LinkChainIcon from "./LinkChainIcon";
import SettingsIcon from '@mui/icons-material/Settings';
import { useBusinessPrices } from '@/hooks/useBusinessPrices';
import { getRedondeoConfig, saveRedondeoConfig } from '@/utils/redondeoUtils';
import { setBusinessPriceList, getBusinessPriceList, getDiscountExceptions } from '@/servicios/apiPriceLists';
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
  return Number.isFinite(id) && id > 0 ? id : null;
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
  allPriceLists = [],
  onVisibleSubrubroChange,
}) {
  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

  const [categorias, setCategorias] = useState([]);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());
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
  const [ventasVista, setVentasVista] = useState('$');
  const [lastAppliedPct, setLastAppliedPct] = useState({});
  const [activePriceList, setActivePriceList] = useState(1);
  const [priceListLoading, setPriceListLoading] = useState(false);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [redondeoConfig, setRedondeoConfig] = useState({ valor: null, mostrarModal: true });
  const [redondeoModalPendiente, setRedondeoModalPendiente] = useState(null);
  const [visibleSubrubro, setVisibleSubrubro] = useState(null);
  const [dragOverColIdx, setDragOverColIdx] = useState(null);
  const [excludedFromDiscount, setExcludedFromDiscount] = useState(new Set()); // articleIds excluidos
  const [orgIdLocal, setOrgIdLocal] = useState(null);

  // ── Definición canónica de columnas reordenables ──
  const REORDERABLE_COLS = [
    { id: 'precio', label: 'Precio', width: '.3fr' },
    { id: 'costo', label: 'Costo $', width: '.3fr' },
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

  const visibleCols = useMemo(() => colConfig.filter(c => c.visible), [colConfig]);

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

  // Refetch cuando se crea un artículo manual desde Configuración
  useEffect(() => {
    const handler = () => refetchLocal();
    window.addEventListener('articulos:updated', handler);
    return () => window.removeEventListener('articulos:updated', handler);
  }, [refetchLocal]);

  const [bulkObjetivoDlg, setBulkObjetivoDlg] = useState(null);

  const [recetaArticulo, setRecetaArticulo] = useState(null);
  const listRef = useRef(null);
  const lastJumpedIdRef = useRef(null);
  const { organization } = useOrganization() || {};
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

  // ── Cargar lista de precios activa ──
  useEffect(() => {
    if (!activeBizId) return;
    getBusinessPriceList(activeBizId)
      .then(n => setActivePriceList(n || 1))
      .catch(() => setActivePriceList(1));
  }, [activeBizId]);

  // ── Cambiar lista de precios ──
  const handleChangePriceList = async (listNum) => {
    if (listNum === activePriceList) { setPriceListOpen(false); return; }
    setPriceListLoading(true);
    setPriceListOpen(false);
    try {
      await setBusinessPriceList(activeBizId, listNum);
      setActivePriceList(listNum);
      // Disparar evento para que ArticulosMain recargue precios
      window.dispatchEvent(new CustomEvent('pricelist:changed', { detail: { listNum, bizId: activeBizId } }));
    } catch (e) {
      console.warn('[handleChangePriceList]', e.message);
    } finally {
      setPriceListLoading(false);
    }
  };

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

  const allArticulos = useMemo(() => {
    const out = [];
    for (const sub of categorias || []) {
      const subrubroNombre = String(sub?.subrubro ?? sub?.nombre ?? "Sin subrubro");
      for (const cat of sub?.categorias || []) {
        const categoriaNombre = String(cat?.categoria ?? cat?.nombre ?? "Sin categoría");
        for (const a of cat?.articulos || []) {
          out.push({ ...a, subrubro: a?.subrubro ?? subrubroNombre, categoria: a?.categoria ?? categoriaNombre });
        }
      }
    }
    return out;
  }, [categorias]);

  const baseById = useMemo(() => {
    const m = new Map();
    for (const a of allArticulos) m.set(Number(a.id), a);
    return m;
  }, [allArticulos]);

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
      // Usar el precio de la lista activa si está disponible, sino el precio base
      const precioLista = activePriceList > 1
        ? (num(art?.[`precio${activePriceList}`]) || num(art?.precio ?? 0))
        : num(art?.precio ?? 0);
      const base = precioLista;

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
  }, [onBulkManualSave, onPriceConfigSave, baseById, manuales, priceConfig, redondeoConfig, activePriceList]);

  const triggerBulkPct = useCallback((pct, ids, inputRef, blockKey) => {
    if (pct == null || !Number.isFinite(Number(pct)) || Number(pct) === 0) return;
    const pctNum = Number(pct);

    // Si no hay redondeo configurado Y mostrarModal=true → interceptar
    if (!redondeoConfig?.mostrarModal) {
      // No mostrar modal, aplicar directo
      executeBulkPct(pctNum, ids, 'todos');
      return;
    }
    if (!redondeoConfig?.valor) {
      setRedondeoModalPendiente({ pct: pctNum, ids, inputRef, blockKey });
      return;
    }

    const idsConNuevoPrecio = ids.filter(id => {
      const key = String(id);
      return (manuales[key] !== undefined && manuales[key] !== '') ||
        priceConfig.byArticle?.[key]?.precioManual != null;
    });

    if (idsConNuevoPrecio.length > 0 && redondeoConfig?.mostrarModal) {
      setBulkPctDlg({ pct: pctNum, idsAll: ids, idsConNuevoPrecio, inputRef, blockKey });
    } else {
      executeBulkPct(pctNum, ids, 'todos');
      if (blockKey) {
        setBlockManuales(prev => { const n = { ...prev }; delete n[blockKey]; return n; });
        setLastAppliedPct(prev => ({ ...prev, [blockKey]: pctNum }));
      }
      if (inputRef?.current) inputRef.current.value = '';
    }
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
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
    [agrupacionesParaTodo]
  );

  const idsAsignadosGlobal = useMemo(() => {
    if (Array.isArray(orgAssignedIds) && orgAssignedIds.length > 0) {
      return new Set(orgAssignedIds.map(Number).filter(n => n > 0));
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
    switch (sortBy) {
      case "ventas": { const idNum = Number(id); if (!Number.isFinite(idNum)) return 0; return getVentasAmount(idNum); }
      case "ventasQty": { const idNum = Number(id); if (!Number.isFinite(idNum)) return 0; const venta = getVentaForId(idNum); const precio = toNum(baseById?.get?.(idNum)?.precio ?? 0); return normalizeVenta(venta, precio).qty; }
      case "codigo": return id;
      case "nombre": return a?.nombre ?? "";
      case "precio": return num(a?.precio);
      case "costo": return num(a?.costo);
      case "costoPct": { const p = num(a?.precio), c = num(a?.costo); return p > 0 ? (c / p) * 100 : -Infinity; }
      case "objetivo": return num(objetivos[id]) || 0;
      case "sugerido": { const obj = num(objetivos[id]) || 0; const c = num(a?.costo); const den = 100 - obj; return den > 0 ? c * (100 / den) : 0; }
      case "manual": return num(manuales[id]) || 0;
      default: return null;
    }
  }, [sortBy, objetivos, manuales, getVentasAmount, getVentaForId, baseById]);

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
    if (!filtroDefer) return articulosAMostrar;
    const q = String(filtroDefer).toLowerCase().trim();
    return articulosAMostrar.filter((a) => (a.nombre || "").toLowerCase().includes(q) || String(getId(a)).includes(q));
  }, [articulosAMostrar, filtroDefer]);

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

  useEffect(() => {
    if (!activeBizId) return;
    const token = localStorage.getItem('token') || '';

    // 1. Obtener orgId del negocio
    fetch(`${BASE}/businesses/${activeBizId}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(activeBizId) }
    })
      .then(r => r.json())
      .then(biz => {
        const oid = biz?.organization_id;
        if (!oid) return;
        setOrgIdLocal(oid);

        // 2. Cargar exclusiones para esta lista
        return getDiscountExceptions(oid, activePriceList)
          .then(exc => {
            const excSet = new Set();
            (exc || []).forEach(e => {
              if (e.scope === 'articulo') excSet.add(String(e.scope_id));
            });
            setExcludedFromDiscount(excSet);
          });
      })
      .catch(() => setExcludedFromDiscount(new Set()));
  }, [activeBizId, activePriceList]);

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

  const cellNum = { textAlign: "center", fontVariantNumeric: "tabular-nums", color: TABLE_TEXT };
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
    const rubroKey = String(a.categoria || a.rubro || '');
    const cfgRubro = priceConfig.byRubro?.[rubroKey];
    if (cfgRubro?.objetivo != null) return num(cfgRubro.objetivo);
    if (agrupacionId) {
      const cfgAgrup = priceConfig.byAgrupacion?.[String(agrupacionId)];
      if (cfgAgrup?.objetivo != null) return num(cfgAgrup.objetivo);
    }
    return globalCostoIdeal;
  }, [objetivos, priceConfig, globalCostoIdeal]);

  const getPrecioManualArticulo = useCallback((a) => {
    const id = String(getId(a));
    if (manuales[id] !== undefined && manuales[id] !== '') return num(manuales[id]);
    const cfgArt = priceConfig.byArticle?.[id];
    if (cfgArt?.precioManual != null) return num(cfgArt.precioManual);
    return null;
  }, [manuales, priceConfig]);

  const tieneReceta = useCallback((a) => {
    const id = String(getId(a));
    const r = recetasCostos[id] || recetasCostos[Number(id)];
    return r && r.costoTotal > 0;
  }, [recetasCostos]);

  const getPrecioEfectivo = useCallback((a) => {
    const id = String(getId(a));
    const precioBase = num(a.precio); // precio de lista principal (precio1)

    // Si está excluido de descuento o usa lista principal → precio base sin tocar
    if (excludedFromDiscount.has(id) || activePriceList === 1) {
      return precioBase;
    }

    // Buscar config de la lista activa
    const listCfg = allPriceLists.find(l => l.listNumber === activePriceList);
    if (!listCfg || listCfg.discountPct == null || listCfg.isPrincipal) {
      return precioBase;
    }

    const pct = Number(listCfg.discountPct);
    const tipo = listCfg.tipo || 'descuento';

    return tipo === 'recargo'
      ? precioBase * (1 + pct / 100)
      : precioBase * (1 - pct / 100);
  }, [excludedFromDiscount, activePriceList, allPriceLists]);

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
          <div style={{ gridColumn: selectionMode ? "2 / 4" : "1 / 3", color: "#1e1e2e", paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.nombre}
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
              return (
                <div key="precio" style={{ ...cellNum, position: 'relative' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPriceListOpen(o => !o); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
                      border: '1px solid var(--color-primary, #3b82f6)',
                      background: priceListOpen ? 'var(--color-primary, #3b82f6)' : 'transparent',
                      color: priceListOpen ? '#fff' : 'var(--color-primary, #3b82f6)',
                      fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.5,
                    }}
                    title="Cambiar lista de precios"
                  >
                    {priceListLoading
                      ? '…'
                      : (allPriceLists.find(l => l.listNumber === activePriceList)?.alias || `Lista ${activePriceList}`)
                    }
                    <span style={{ fontSize: '0.58rem' }}>{priceListOpen ? '▲' : '▼'}</span>
                  </button>
                  {priceListOpen && (
                    <div
                      style={{
                        position: 'absolute', top: '110%', right: 0, zIndex: 999,
                        background: '#fff', border: '1px solid #e2e8f0',
                        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                        minWidth: 110, padding: '4px 0',
                      }}
                      onMouseLeave={() => setPriceListOpen(false)}
                    >
                      {[1, 2, 3, 4].map(n => {
                        const listData = allPriceLists.find(l => l.listNumber === n);
                        const label = listData?.alias || `Lista ${n}`;
                        return (
                          <div
                            key={n}
                            onClick={(e) => { e.stopPropagation(); handleChangePriceList(n); }}
                            style={{
                              padding: '5px 12px', cursor: 'pointer',
                              fontSize: '0.78rem', fontWeight: activePriceList === n ? 700 : 400,
                              background: activePriceList === n ? 'var(--color-primary, #3b82f6)12' : 'transparent',
                              color: activePriceList === n ? 'var(--color-primary, #3b82f6)' : '#374151',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            {activePriceList === n && <span>✓</span>}
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            if (col.id === 'objetivo') {
              return (
                <div key="objetivo" style={{ ...cellNum, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="input-symbol-wrapper" data-symbol="%">
                    <input
                      type="number"
                      placeholder={String(globalCostoIdeal)}
                      value={blockObjetivos[bkObj] ?? objValDb}
                      onChange={(e) => setBlockObjetivos(prev => ({ ...prev, [bkObj]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.target.blur();
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        if (!onPriceConfigSave || val == null) return;
                        const idsAplicar = ids.filter(artId => !tieneObjetivoIndividual(artId));
                        const valAnterior = cfgAgrup.objetivo != null ? Number(cfgAgrup.objetivo) : null;
                        const label = agrupacionSeleccionada?.nombre || 'esta agrupación';
                        // Aplicar inmediatamente
                        setObjetivos(prev => { const next = { ...prev }; ids.forEach(artId => { next[String(artId)] = val; }); return next; });
                        onPriceConfigSave({ scope: 'agrupacion', scopeId: agrupId, objetivo: val, articleIds: ids, pisarTodo: true });
                        setBlockObjetivos(prev => { const n = { ...prev }; delete n[bkObj]; return n; });
                        // Emitir para notificaciones
                        try { window.dispatchEvent(new CustomEvent('ui:action', { detail: { kind: 'objetivo_change', title: `🎯 Objetivo ${val}% en ${label}`, message: `${ids.length} artículo(s) actualizados.`, createdAt: new Date().toISOString(), payload: { scope: 'agrupacion', scopeId: agrupId, val, valAnterior, articleIds: ids, pisarTodo: true } } })); } catch { }
                        // Toast con Deshacer
                        setPendingObjConfirm({ scope: 'agrupacion', scopeId: agrupId, val, ids, valAnterior, label, bkKey: bkObj });
                      }}
                      className="input-with-suffix input-group-level"
                      style={{ width: 52, fontSize: '0.78rem', textAlign: 'center', background: 'transparent', fontWeight: 600, color: TABLE_TEXT }}
                    />
                  </div>
                  <ClearBtn
                    visible={!!(blockObjetivos[bkObj] || objValDb)}
                    onClick={() => {
                      setBlockObjetivos(prev => { const n = { ...prev }; delete n[bkObj]; return n; });

                      // Borrar objetivo de la agrupación con DELETE
                      onPriceConfigSave?.({
                        scope: 'agrupacion',
                        scopeId: agrupId,
                        _deleteObjetivo: true,   // ← nueva señal
                        articleIds: ids,
                      });

                      setObjetivos(prev => {
                        const next = { ...prev };
                        ids.forEach(artId => { delete next[String(artId)]; });
                        return next;
                      });
                    }}
                  />
                </div>
              );
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
                    onClick={() => setClearDlg({ type: 'manual', ids, scopeType: 'agrupacion', scopeId: agrupId, bkBlock: bkManual, setBlock: setBlockManuales })} />
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
              });
            }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            {label}
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
              const rubroKey = tableHeaderMode === "cat-first" ? (row.subrubro || '') : (row.categoria || '');
              const cfgRubro = priceConfig.byRubro?.[rubroKey] || {};
              const objValDb = cfgRubro.objetivo;
              const firstObjLocal = ids.length ? objetivos[String(ids[0])] : undefined;
              const objMostrar = objValDb != null ? Number(objValDb)
                : firstObjLocal != null ? Number(firstObjLocal)
                  : null;
              return (
                <div
                  key="objetivo"
                  style={{
                    ...cellNum,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setRubroEditModal({
                      rubroKey,
                      rubroDisplay: tableHeaderMode === "cat-first"
                        ? `${row.subrubro} - ${row.categoria}`
                        : `${row.categoria} - ${row.subrubro}`,
                      articleIds: row.ids || [],
                      initialObjetivo: cfgRubro.objetivo,
                    });
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                >
                  <Typography variant="caption" sx={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: objMostrar != null ? TABLE_TEXT : TABLE_MUTED,
                  }}>
                    {objMostrar != null ? `${fmt(objMostrar, 0)}%` : '—'}
                  </Typography>
                </div>
              );
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
    const isLinked = linkByArticleId.has(Number(id));
    const linkInfo = linkByArticleId.get(Number(id)) ?? null;

    return (
      <div key={row.key} data-article-id={id}
        className={`table-item-row${isSelected ? " is-selected" : ""}`}
        style={{ ...style, display: "grid", alignItems: "center", gridTemplateColumns: gridTemplate, fontWeight: 500, fontSize: "0.85rem", background: rowBg, ...(selectedStyle || {}) }}>
        {leftBar}
        {selectionMode && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isLinked && selectionMode === 'link' ? (
              <LinkChainIcon articleId={id} groupInfo={linkInfo} nameById={nameById} onRemoveSelf={onRemoveMemberFromLink} onDeleteGroup={onDeleteLink} />
            ) : (
              <input type="checkbox" checked={isChecked} onChange={() => onToggleSelected?.(Number(id))}
                style={{ width: 14, height: 14, cursor: "pointer", accentColor: selectionMode === "link" ? "#7c3aed" : "#0369a1" }} />
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 4, color: TABLE_TEXT }}>
          {(selectionMode === 'list' || !selectionMode) && isLinked && (
            <LinkChainIcon articleId={id} groupInfo={linkInfo} nameById={nameById} onRemoveSelf={onRemoveMemberFromLink} onDeleteGroup={onDeleteLink} />
          )}
          {a.origen === 'manual'
            ? <span title="Artículo cargado manualmente en Lazarillo" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>L{id}</span>
            : <span>{id}</span>
          }
        </div>

        <div onClick={() => { const objetivoResuelto = getObjetivoArticulo(a, agrupId); setRecetaArticulo({ ...a, objetivoResuelto }); }}
          style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={hayReceta ? `Receta cargada — costo $${fmt(costoArticulo, 0)}` : `Cargar receta de ${a.nombre}`}>
          {hayAlertaInsumo && <span title="Algún insumo sin compra reciente" style={{ color: '#f59e0b', marginRight: 3, fontSize: '0.7rem' }}>⚠</span>}
          {hayReceta && !hayAlertaInsumo && <span style={{ color: '#6366f1', marginRight: 4, fontSize: '0.7rem' }}>●</span>}
          {hayReceta && hayAlertaInsumo && <span style={{ color: '#f59e0b', marginRight: 4, fontSize: '0.7rem' }}>●</span>}
          {a.nombre}
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
            case 'precio': {
              const precioLista = activePriceList > 1
                ? (num(a[`precio${activePriceList}`]) || num(a.precio))
                : num(a.precio);
              return (
                <div key="precio" style={cellNum}>
                  {fmtCurrency(precioLista)}
                  {activePriceList > 1 && num(a.precio1 || a.precio) !== precioLista && (
                    <span style={{ fontSize: '0.62rem', color: '#94a3b8', marginLeft: 2 }}>
                      L{activePriceList}
                    </span>
                  )}
                </div>
              );
            }

            case 'costo':
              return (
                <div key="costo" style={{ ...cellNum, color: hayReceta ? '#6366f1' : TABLE_TEXT }}>
                  {costoArticulo > 0 ? fmtCurrency(costoArticulo) : <span style={{ color: TABLE_MUTED }}>—</span>}
                </div>
              );

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

            case 'manual':
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
                          // Campo borrado — DELETE explícito
                          onPriceConfigSave?.({ scope: 'articulo', scopeId: String(id), _deleteManual: true });
                        } else {
                          onPriceConfigSave?.({ scope: 'articulo', scopeId: String(id), precioManual: val });
                        }
                      }}
                      style={{ width: 58, fontSize: '0.78rem', textAlign: 'right', border: 'none', outline: 'none', padding: '0 6px', color: TABLE_TEXT, background: 'transparent' }}
                    />
                  </div>
                </div>
              );

            case 'acciones':
              return (
                <div key="acciones" style={{ textAlign: 'center' }}>
                  <ArticuloAccionesMenu
                    onMutateGroups={onMutateGroups} baseById={baseById} articulo={a}
                    agrupaciones={agrupaciones} agrupacionSeleccionada={agrupacionSeleccionada}
                    todoGroupId={todoGroupId} isTodo={isTodo} onRefetch={refetchLocal}
                    onAfterMutation={(ids2) => afterMutation(ids2)}
                    notify={(m, t) => openSnack(m, t)} onGroupCreated={onGroupCreated}
                    onDiscontinuadoChange={onDiscontinuadoChange} treeMode={modalTreeMode}
                    allowedIds={filterIds} businessId={activeBizId} rootBizId={rootBizId}
                  />
                </div>
              );

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
          open={!!recetaArticulo} onClose={() => setRecetaArticulo(null)}
          articulo={recetaArticulo}
          businessId={activeBizId}
          esElaborado={false}
          costoObjetivoExterno={recetaArticulo.objetivoResuelto ?? null}
          recetasElaborados={recetasElaborados}
          onPriceConfigSave={onPriceConfigSave}
          allArticulos={allArticulos}
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
                <button
                  onClick={() => setVentasVista(v => v === '$' ? 'U' : '$')}
                  title={ventasVista === '$' ? 'Cambiar a unidades' : 'Cambiar a pesos'}
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
                  case 'costoPct': return <div key="costoPct" {...dragProps} onClick={() => toggleSort('costoPct')} className="col-sortable" style={dragIndicatorStyle}>Costo %{sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'objetivo': return <div key="objetivo" {...dragProps} onClick={() => toggleSort('objetivo')} className="col-sortable" style={dragIndicatorStyle}>Objetivo{sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'sugerido': return <div key="sugerido" {...dragProps} onClick={() => toggleSort('sugerido')} className="col-sortable" style={dragIndicatorStyle}>Sugerido{sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'manual': return <div key="manual" {...dragProps} onClick={() => toggleSort('manual')} className="col-sortable" style={dragIndicatorStyle}>Nuevo precio{sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</div>;
                  case 'acciones': return (
                    <div key="acciones" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.75rem' }}>Acciones</span>
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
                    console.log('[chip redondeo] op:', op, 'onRedondeoChange:', typeof onRedondeoChange);
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
              Se aplicará el aumento a <strong>{bulkPctDlg.idsAll.length}</strong> artículos.
              {redondeoConfig?.valor
                ? ` Los precios se redondearán al múltiplo de $${redondeoConfig.valor} más cercano.`
                : ' Sin redondeo configurado.'}
            </Typography>

            {/* Sección de redondeo */}
            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Redondeo de precios
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                {[2, 5, 10, 20, 50, 100, 500, 1000].map(op => (
                  <Chip
                    key={op}
                    label={`$${op}`}
                    size="small"
                    variant={redondeoConfig?.valor === op ? 'filled' : 'outlined'}
                    onClick={() => {
                      console.log('[chip redondeo] op:', op, 'onRedondeoChange:', typeof onRedondeoChange);
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
                  variant={!redondeoConfig?.valor ? 'filled' : 'outlined'}
                  onClick={() => {
                    saveRedondeoConfig(activeBizId, null, redondeoConfig?.mostrarModal ?? true);
                    setRedondeoConfig(prev => ({ ...prev, valor: null }));
                    onRedondeoChange?.(null);
                    window.dispatchEvent(new CustomEvent('config:updated', {
                      detail: { key: 'redondeo_precios', value: null }
                    }));
                  }}
                  sx={{
                    cursor: 'pointer',
                    ...(!redondeoConfig?.valor && { bgcolor: '#64748b', color: '#fff', borderColor: '#64748b' }),
                  }}
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
                    // ← agregar en los dos:
                    try {
                      BusinessesAPI.update(Number(activeBizId), {
                        props: { redondeo_mostrar_modal: !noMostrar }
                      });
                    } catch { }
                  }}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <label htmlFor="bulk-redondeo-no-mostrar" style={{ fontSize: '0.78rem', cursor: 'pointer', color: '#555' }}>
                  No volver a mostrar este aviso
                </label>
              </Box>
            </Box>
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
      {clearDlg && (
        <Dialog open onClose={() => setClearDlg(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
            ¿Borrar nuevo precio de {clearDlg.scopeType === 'agrupacion' ? 'la agrupación' : 'este rubro'}?
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Se borrará el nuevo precio de <strong>{clearDlg.ids.length}</strong> artículo{clearDlg.ids.length !== 1 ? 's' : ''}.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
            <Button size="small" variant="text" color="inherit" onClick={() => setClearDlg(null)}>Cancelar</Button>
            <Button size="small" variant="contained" color="error"
              onClick={() => {
                const { ids, bkBlock, setBlock } = clearDlg;
                setBlock(prev => { const n = { ...prev }; delete n[bkBlock]; return n; });
                setManuales(prev => { const next = { ...prev }; ids.forEach(id => { delete next[String(id)]; }); return next; });
                if (onBulkManualSave) {
                  onBulkManualSave(ids.map(artId => ({ artId, precioManual: null })));
                } else {
                  ids.forEach(artId => onPriceConfigSave?.({ scope: 'articulo', scopeId: String(artId), precioManual: null }));
                }
                setClearDlg(null);
              }}>
              Borrar
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <ColOrderModal open={colDlgOpen} cols={colConfig} onSave={saveColConfig} onClose={() => setColDlgOpen(false)} />

      {rubroEditModal && (
        <RubroEditModal
          open={!!rubroEditModal}
          onClose={() => setRubroEditModal(null)}
          rubroKey={rubroEditModal.rubroKey}
          rubroDisplay={rubroEditModal.rubroDisplay}
          articleIds={rubroEditModal.articleIds}
          initialObjetivo={rubroEditModal.initialObjetivo}
          globalCostoIdeal={globalCostoIdeal}
          priceLists={allPriceLists}
          orgId={organization?.id}
          onSave={({ objetivo, articleIds }) => {
            console.log('[RubroModal onSave] disparado', { objetivo, articleIds });
            if (!onPriceConfigSave) {
              console.warn('[RubroModal onSave] onPriceConfigSave NO EXISTE');
              return;
            }
            const rubroKey = rubroEditModal.rubroKey;
            const rubroLabel = rubroEditModal.rubroDisplay || 'este rubro';
            const valAnterior = rubroEditModal.initialObjetivo != null
              ? Number(rubroEditModal.initialObjetivo)
              : null;

            setObjetivos(prev => {
              const next = { ...prev };
              articleIds.forEach(artId => { next[String(artId)] = objetivo; });
              return next;
            });
            onPriceConfigSave({
              scope: 'rubro',
              scopeId: rubroKey,
              objetivo,
              articleIds,
              pisarTodo: true
            });

            console.log('[RubroModal onSave] disparando ui:action', {
              kind: 'objetivo_change',
              title: `🎯 Objetivo ${objetivo}% en ${rubroLabel}`,
              scope: 'rubro',
              scopeId: rubroKey,
            });
            try {
              window.dispatchEvent(new CustomEvent('ui:action', {
                detail: {
                  kind: 'objetivo_change',
                  title: objetivo != null
                    ? `🎯 Objetivo ${objetivo}% en ${rubroLabel}`
                    : `🗑 Objetivo borrado en ${rubroLabel}`,
                  message: `${articleIds.length} artículo(s) actualizados.`,
                  createdAt: new Date().toISOString(),
                  scope: 'articulo',
                  payload: {
                    scope: 'rubro',
                    scopeId: rubroKey,
                    val: objetivo,
                    valAnterior,
                    articleIds,
                    pisarTodo: true,
                  },
                },
              }));
              console.log('[RubroModal onSave] ui:action disparado OK');
            } catch (e) {
              console.error('[RubroModal onSave] error en dispatch:', e);
            }
          }}
        />
      )}
    </>
  );
}