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
}) {
  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

  const [categorias, setCategorias] = useState([]);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});
  const [manualesIndividuales, setManualesIndividuales] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, msg: "", type: "success" });
  const [blockObjetivos, setBlockObjetivos] = useState({});
  const [blockManuales, setBlockManuales] = useState({});
  const [bulkPctDlg, setBulkPctDlg] = useState(null);
  const [clearDlg, setClearDlg] = useState(null);
  const [ventasVista, setVentasVista] = useState('$'); // '$' | 'U'
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
  const [bulkObjetivoDlg, setBulkObjetivoDlg] = useState(null);

  const [recetaArticulo, setRecetaArticulo] = useState(null);
  const listRef = useRef(null);
  const lastJumpedIdRef = useRef(null);

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

    // Si fue seteado por bulk → no considerarlo manual individual
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
      const base = num(baseById.get(artId)?.precio ?? 0);
      if (base > 0) {
        updates.push({ artId, precioManual: Math.round(base * (1 + pct / 100)) });
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
  }, [onBulkManualSave, onPriceConfigSave, baseById, manuales, priceConfig]);

  const triggerBulkPct = useCallback((pct, ids, inputRef, blockKey) => {
    if (pct == null || !Number.isFinite(Number(pct)) || Number(pct) === 0) return;
    const pctNum = Number(pct);

    const idsConNuevoPrecio = ids.filter(id => {
      const key = String(id);
      return (manuales[key] !== undefined && manuales[key] !== '') ||
        priceConfig.byArticle?.[key]?.precioManual != null;
    });

    if (idsConNuevoPrecio.length > 0) {
      setBulkPctDlg({ pct: pctNum, idsAll: ids, idsConNuevoPrecio, inputRef, blockKey });
    } else {
      executeBulkPct(pctNum, ids, 'todos');
      if (blockKey) setBlockManuales(prev => { const n = { ...prev }; delete n[blockKey]; return n; });
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
    // filterIds === null → sin filtro (mostrar todo)
    // filterIds instanceof Set → filtrar siempre, incluso si está vacío (agrupación sin artículos = mostrar nada)
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

  // ── BLOQUES con totales por sucursal ──
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

      // Sumar por sucursal
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

  // ── FLAT ROWS con totales por sucursal propagados ──
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

    if (esAgrupEspecifica && sections.length > 0) {
      // Todos los IDs de la agrupación (sin filtrar por rubro)
      const todosIdsAgrup = (agrupacionSeleccionada?.articulos || [])
        .map(getId)
        .filter(Boolean);

      const totalVentasAgrup = todosIdsAgrup.reduce((acc, id) => acc + getVentasAmount(id), 0);

      const agrupByBranch = {};
      // Sumar por sucursal también sobre todos los IDs de la agrupación
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
        ids: todosIdsAgrup,  // ← todos los IDs para las acciones bulk
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

  // ── Grid: sin Ventas U cuando hay branches ──
  const hasBranches = branches && branches.length > 0;
  const checkCol = selectionMode ? "28px " : "";
  const branchCols = hasBranches ? branches.map(() => ".28fr").join(" ") : "";
  // ── Grid dinámico según columnas visibles ──
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

    // ── Header de agrupación ──
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
          {/* Código + Nombre juntos */}
          <div style={{ gridColumn: selectionMode ? "2 / 4" : "1 / 3", color: "#1e1e2e", paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.nombre}
          </div>

          {/* Ventas $ principal (solo sin branches) o total general */}
          <div style={{ ...cellNum, color: TABLE_TEXT, fontWeight: 700 }}>
            {row.totalVentas > 0
              ? ventasVista === '$'
                ? fmtCurrency(row.totalVentas)
                : fmt(row.ids.reduce((acc, id) => acc + getVentasQty(id), 0), 0)
              : ''}
          </div>

          {/* Columnas por sucursal */}
          {/* Columnas por sucursal */}
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
                        setObjetivos(prev => { const next = { ...prev }; idsAplicar.forEach(artId => { next[String(artId)] = val; }); return next; });
                        onPriceConfigSave({ scope: 'agrupacion', scopeId: agrupId, objetivo: val, articleIds: idsAplicar });
                        setBlockObjetivos(prev => { const n = { ...prev }; delete n[bkObj]; return n; });
                      }}
                      className="input-with-suffix input-group-level"
                      style={{ width: 52, fontSize: '0.78rem', textAlign: 'center', background: 'transparent', fontWeight: 600, color: TABLE_TEXT }}
                    />
                  </div>
                  <ClearBtn
                    visible={!!(blockObjetivos[bkObj] || objValDb)}
                    onClick={() => {
                      setBlockObjetivos(prev => { const n = { ...prev }; delete n[bkObj]; return n; });
                      onPriceConfigSave?.({ scope: 'agrupacion', scopeId: agrupId, objetivo: null, articleIds: ids });
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
                      placeholder=""
                      value={blockManuales[bkManual] ?? ''}
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

    // ── Header de subrubro ──
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
          <div style={{ gridColumn: selectionMode ? "2 / 4" : "1 / 3" }}>{label}</div>

          <div style={cellNum}>
            {ventasVista === '$' ? fmtCurrency(totalAmount) : fmt(totalQty, 0)}
          </div>

          {/* Subtotales por sucursal */}
          {(branches || []).map(branch => {
            const bKey = branch.id;
            const amt = row.__ventasByBranch?.[bKey] || row.__ventasByBranch?.[String(bKey)] || 0;
            const branchColor = branch.color || 'var(--color-primary)';
            // Para qty por sucursal en sección, sumar los artículos del bloque
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
              const objValDb = cfgRubro.objetivo != null ? String(cfgRubro.objetivo) : '';
              const firstObjLocal = ids.length ? objetivos[String(ids[0])] : undefined;
              const bkRubroObj = `rubro-obj-${rubroKey}`;
              return (
                <div key="objetivo" style={{ ...cellNum, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="input-symbol-wrapper" data-symbol="%">
                    <input type="number"
                      placeholder={firstObjLocal != null ? String(firstObjLocal) : String(globalCostoIdeal)}
                      value={blockObjetivos[bkRubroObj] ?? (ids.length && objetivos[String(ids[0])] != null ? String(objetivos[String(ids[0])]) : objValDb)}
                      onChange={(e) => setBlockObjetivos(prev => ({ ...prev, [bkRubroObj]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.target.blur();
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        if (!onPriceConfigSave || val == null) return;
                        const idsAplicar = ids.filter(artId => !tieneObjetivoIndividual(artId));
                        setObjetivos(prev => { const next = { ...prev }; idsAplicar.forEach(artId => { next[String(artId)] = val; }); return next; });
                        onPriceConfigSave({ scope: 'rubro', scopeId: rubroKey, objetivo: val, articleIds: idsAplicar });
                        setBlockObjetivos(prev => { const n = { ...prev }; delete n[bkRubroObj]; return n; });
                      }}
                      className="input-with-suffix"
                      style={{ width: 52, fontSize: '0.75rem', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: 4, color: TABLE_TEXT }}
                    />
                  </div>
                  <ClearBtn
                    visible={!!(blockObjetivos[bkRubroObj] || objValDb)}
                    onClick={() => {
                      setBlockObjetivos(prev => { const n = { ...prev }; delete n[bkRubroObj]; return n; });
                      onPriceConfigSave?.({ scope: 'rubro', scopeId: rubroKey, objetivo: null, articleIds: ids });
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
            if (col.id === 'manual' && esAgrupEspecifica) {
              const rubroKeyManual = tableHeaderMode === "cat-first" ? (row.subrubro || '') : (row.categoria || '');
              const bkRubroMan = `rubro-man-${rubroKeyManual}`;
              return (
                <div key="manual" style={{ ...cellNum, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="input-symbol-wrapper" data-symbol="%">
                    <input type="number" placeholder=""
                      value={blockManuales[bkRubroMan] ?? ''}
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
                  <ClearBtn onClick={() => setClearDlg({ type: 'manual', ids, scopeType: 'rubro', scopeId: rubroKeyManual, bkBlock: bkRubroMan, setBlock: setBlockManuales })} />
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

    // ── Fila de artículo ──
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
    const precioBase = num(a.precio); // precio Maxi, siempre fijo
    const precioRef = precioManual ?? precioBase;
    const costoPct = precioBase > 0 ? (costoArticulo / precioBase) * 100 : 0;
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
            {isLinked ? (
              <LinkChainIcon
                articleId={id} groupInfo={linkInfo} nameById={nameById}
                onRemoveSelf={onRemoveMemberFromLink} onDeleteGroup={onDeleteLink}
              />
            ) : (
              <input
                type="checkbox" checked={isChecked}
                onChange={() => onToggleSelected?.(Number(id))}
                style={{
                  width: 14, height: 14, cursor: "pointer",
                  accentColor: selectionMode === "link" ? "#7c3aed" : "#0369a1"
                }}
              />
            )}
          </div>
        )}

        {/* Código */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: TABLE_TEXT }}>
          {!selectionMode && isLinked && (
            <LinkChainIcon
              articleId={id} groupInfo={linkInfo} nameById={nameById}
              onRemoveSelf={onRemoveMemberFromLink} onDeleteGroup={onDeleteLink}
            />
          )}
          <span>{id}</span>
        </div>

        {/* Nombre */}
        <div onClick={() => { const objetivoResuelto = getObjetivoArticulo(a, agrupId); setRecetaArticulo({ ...a, objetivoResuelto }); }}
          style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={hayReceta ? `Receta cargada — costo $${fmt(costoArticulo, 0)}` : `Cargar receta de ${a.nombre}`}>
          {hayAlertaInsumo && <span title="Algún insumo sin compra reciente" style={{ color: '#f59e0b', marginRight: 3, fontSize: '0.7rem' }}>⚠</span>}
          {hayReceta && !hayAlertaInsumo && <span style={{ color: '#6366f1', marginRight: 4, fontSize: '0.7rem' }}>●</span>}
          {hayReceta && hayAlertaInsumo && <span style={{ color: '#f59e0b', marginRight: 4, fontSize: '0.7rem' }}>●</span>}
          {a.nombre}
        </div>

        {/* Ventas — una sola columna */}
        <div style={cellNum}>
          {ventasVista === '$'
            ? fmtCurrency(overrideAmount)
            : <VentasCell
              articuloId={id} articuloNombre={a.nombre}
              from={fechaDesde} to={fechaHasta}
              defaultGroupBy="day" totalOverride={overrideQty}
              onTotalResolved={onTotalResolved} businessId={activeBizId}
            />
          }
        </div>



        {/* Columnas por sucursal */}
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
              return (
                <div key="precio" style={cellNum}>
                  {fmtCurrency(num(a.precio))}
                </div>
              );

            case 'costo':
              return (
                <div key="costo" style={{ ...cellNum, color: hayReceta ? '#6366f1' : TABLE_TEXT }}>
                  {costoArticulo > 0 ? fmtCurrency(costoArticulo) : <span style={{ color: TABLE_MUTED }}>—</span>}
                </div>
              );

            case 'costoPct':
              return (
                <div key="costoPct" style={{ ...cellNum, color: superaObjetivo ? '#ef4444' : undefined, fontWeight: superaObjetivo ? 700 : 500 }}>
                  {costoPct > 0 ? `${fmt(costoPct, 1)}%` : <span style={{ color: TABLE_MUTED }}>—</span>}
                </div>
              );

            case 'objetivo':
              return (
                <div key="objetivo" style={cellNum}>
                  <span
                    style={{ fontSize: '0.78rem', color: tieneObjetivoIndividual(id) ? '#6366f1' : TABLE_TEXT }}
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
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    border: '1px solid #d1d5db', borderRadius: 6,
                    overflow: 'hidden', background: '#fff',
                  }}>
                    <span style={{
                      padding: '0 5px', fontSize: '0.72rem', color: TABLE_MUTED,
                      background: '#f9fafb', borderRight: '1px solid #e5e7eb',
                      lineHeight: '28px', userSelect: 'none',
                    }}>$</span>
                    <input type="number"
                      value={manuales[id] !== undefined ? manuales[id] : (priceConfig.byArticle?.[String(id)]?.precioManual ?? '')}
                      onChange={(e) => setManuales(s => ({ ...s, [id]: e.target.value }))}
                      onBlur={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        bulkSetIdsRef.current.delete(Number(id));
                        onPriceConfigSave?.({ scope: 'articulo', scopeId: String(id), precioManual: val });
                      }}
                      style={{
                        width: 68, fontSize: '0.78rem', textAlign: 'right',
                        border: 'none', outline: 'none', padding: '0 6px',
                        color: TABLE_TEXT, background: 'transparent',
                      }}
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
          articulo={recetaArticulo} businessId={rootBizId ?? activeBizId}
          costoObjetivoExterno={recetaArticulo.objetivoResuelto ?? null}
          recetasElaborados={recetasElaborados}
          onPriceConfigSave={onPriceConfigSave}
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
                  <input
                    type="checkbox"
                    checked={isAllSelected}
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
                <span
                  onClick={() => toggleSort("ventas")}
                  className="col-sortable"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Ventas {ventasLoading ? "…" : ""}
                  {sortBy === "ventas" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </span>
                {/* Switch $ | U */}
                <div style={{
                  display: 'inline-flex', borderRadius: 4, overflow: 'hidden',
                  border: '1px solid #cbd5e1', fontSize: '0.68rem', flexShrink: 0,
                }}>
                  {['$', 'U'].map(v => (
                    <button key={v} onClick={() => setVentasVista(v)}
                      style={{
                        padding: '1px 6px', border: 'none', cursor: 'pointer',
                        fontWeight: 700, lineHeight: 1.4,
                        background: ventasVista === v ? HEADER_TEXT : 'transparent',
                        color: ventasVista === v ? '#fff' : HEADER_TEXT,
                        transition: 'background 0.15s',
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {hasBranches && branches.map(branch => (
                <div key={branch.id} style={{ fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', color: branch.color || 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: `2px solid ${branch.color || 'var(--color-primary)'}30`, paddingLeft: 4 }}
                  title={`Ventas ${ventasVista} — ${branch.name}`}>
                  {branch.name} {ventasVista}
                </div>
              ))}
              {visibleCols.map(col => {
                switch (col.id) {
                  case 'precio':
                    return (
                      <div key="precio" onClick={() => toggleSort('precio')} className="col-sortable">
                        Precio{sortBy === 'precio' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </div>
                    );
                  case 'costo':
                    return (
                      <div key="costo" onClick={() => toggleSort('costo')} className="col-sortable">
                        Costo{sortBy === 'costo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </div>
                    );
                  case 'costoPct':
                    return (
                      <div key="costoPct" onClick={() => toggleSort('costoPct')} className="col-sortable">
                        Costo %{sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </div>
                    );
                  case 'objetivo':
                    return (
                      <div key="objetivo" onClick={() => toggleSort('objetivo')} className="col-sortable">
                        Objetivo{sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </div>
                    );
                  case 'sugerido':
                    return (
                      <div key="sugerido" onClick={() => toggleSort('sugerido')} className="col-sortable">
                        Sugerido{sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </div>
                    );
                  case 'manual':
                    return (
                      <div key="manual" onClick={() => toggleSort('manual')} className="col-sortable">
                        Nuevo precio{sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </div>
                    );
                  case 'acciones':
                    return (
                      <div key="acciones" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.75rem' }}>Acciones</span>
                        <button
                          onClick={e => { e.stopPropagation(); setColDlgOpen(true); }}
                          title="Configurar columnas"
                          style={{
                            padding: '2px 6px', fontSize: '0.65rem',
                            border: '1px solid #e5e7eb', borderRadius: 4,
                            background: '#fff', cursor: 'pointer', lineHeight: 1.4,
                          }}>
                         <SettingsIcon />
                        </button>
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
            <VirtualList
              ref={listRef} rows={flatRows} rowHeight={ITEM_H}
              height={typeof window !== "undefined" && window.innerHeight ? Math.max(240, window.innerHeight - 220) : 520}
              overscan={8} onVisibleItemsIds={handleVisibleIds}
              getRowId={(r) => (r?.kind === "item" ? Number(r?.art?.id) : null)}
              renderRow={renderRow} extraData={(ventasPorArticulo?.size || 0) + selectedIds.size + (selectionMode ? 1 : 0)}
            />
          )}
        </div>

        <Snackbar open={snack.open} autoHideDuration={2600} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
          <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.type} sx={{ width: "100%" }}>{snack.msg}</Alert>
        </Snackbar>


      </div>
      {bulkPctDlg && (
        <Dialog open onClose={() => setBulkPctDlg(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Aplicar aumento de precio
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {`${bulkPctDlg.idsConNuevoPrecio.length} de ${bulkPctDlg.idsAll.length} artículos ya tienen nuevo precio individual.`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ¿A cuáles aplicar el aumento?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 2, pb: 2 }}>
            <Button variant="contained" size="small"
              onClick={() => {
                executeBulkPct(bulkPctDlg.pct, bulkPctDlg.idsAll, 'todos');
                if (bulkPctDlg.blockKey) setBlockManuales(prev => { const n = { ...prev }; delete n[bulkPctDlg.blockKey]; return n; });
                if (bulkPctDlg.inputRef?.current) bulkPctDlg.inputRef.current.value = '';
                setBulkPctDlg(null);
              }}
              sx={{ textTransform: 'none', justifyContent: 'flex-start', bgcolor: 'var(--color-primary)', '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' } }}>
              A todos ({bulkPctDlg.idsAll.length} artículos)
            </Button>
            <Button variant="outlined" size="small"
              onClick={() => {
                executeBulkPct(bulkPctDlg.pct, bulkPctDlg.idsAll, 'solo_sin_manual');
                if (bulkPctDlg.blockKey) setBlockManuales(prev => { const n = { ...prev }; delete n[bulkPctDlg.blockKey]; return n; });
                if (bulkPctDlg.inputRef?.current) bulkPctDlg.inputRef.current.value = '';
                setBulkPctDlg(null);
              }}
              sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
              Solo los que NO tienen nuevo precio ({bulkPctDlg.idsAll.length - bulkPctDlg.idsConNuevoPrecio.length} artículos)
            </Button>
            <Button variant="text" size="small" color="inherit"
              onClick={() => setBulkPctDlg(null)}
              sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {clearDlg && (
        <Dialog open onClose={() => setClearDlg(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Borrar nuevo precio $
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {`¿A cuáles artículos de este ${clearDlg.scopeType === 'agrupacion' ? 'grupo' : 'bloque'} borrar el nuevo precio?`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {`${clearDlg.ids.length} artículos en total.`}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 2, pb: 2 }}>
            <Button variant="contained" size="small"
              // En el clearDlg, opción "Borrar a todos":
              onClick={() => {
                const { ids, bkBlock, setBlock } = clearDlg;
                setBlock(prev => { const n = { ...prev }; delete n[bkBlock]; return n; });

                // ✅ Un solo bulk en vez de N llamadas individuales
                const updates = ids.map(artId => ({ artId, precioManual: null }));
                if (onBulkManualSave) {
                  onBulkManualSave(updates);
                } else {
                  ids.forEach(artId => onPriceConfigSave?.({ scope: 'articulo', scopeId: String(artId), precioManual: null }));
                }

                setManuales(prev => { const next = { ...prev }; ids.forEach(id => { delete next[String(id)]; }); return next; });
                setClearDlg(null);
              }}
              sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
              Borrar a todos ({clearDlg.ids.length} artículos)
            </Button>
            <Button variant="outlined" size="small"
              onClick={() => {
                const { ids, bkBlock, setBlock } = clearDlg;
                const sinIndividual = ids.filter(artId => {
                  const key = String(artId);
                  return !((manuales[key] !== undefined && manuales[key] !== '') || priceConfig.byArticle?.[key]?.precioManual != null);
                });
                setBlock(prev => { const n = { ...prev }; delete n[bkBlock]; return n; });
                sinIndividual.forEach(artId => onPriceConfigSave?.({ scope: 'articulo', scopeId: String(artId), precioManual: null }));
                setManuales(prev => { const next = { ...prev }; sinIndividual.forEach(id => { delete next[String(id)]; }); return next; });
                setClearDlg(null);
              }}
              sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
              Solo los sin precio individual ({
                clearDlg.ids.filter(artId => {
                  const key = String(artId);
                  return !((manuales[key] !== undefined && manuales[key] !== '') || priceConfig.byArticle?.[key]?.precioManual != null);
                }).length
              } artículos)
            </Button>
            <Button variant="text" size="small" color="inherit"
              onClick={() => setClearDlg(null)}
              sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <ColOrderModal
        open={colDlgOpen}
        cols={colConfig}
        onSave={saveColConfig}
        onClose={() => setColDlgOpen(false)}
      />
    </>
  );
}