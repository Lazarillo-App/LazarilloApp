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
import { Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";

import SubrubroAccionesMenu from "./SubrubroAccionesMenu";
import ArticuloAccionesMenu from "./ArticuloAccionesMenu";
import VentasCell from "./VentasCell";
import VirtualList from "./shared/VirtualList";
import RecetaModal from "./RecetaModal";
import { ensureTodo, getExclusiones } from "../servicios/apiAgrupacionesTodo";
import { BusinessesAPI } from "@/servicios/apiBusinesses";
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

  const executeBulkPct = useCallback((pct, idsAll, mode, _idsConManualSnapshot) => {
    if (!onBulkManualSave && !onPriceConfigSave) return;

    const excluir = mode === 'solo_sin_manual'
      ? new Set(idsAll.filter(id => {
        const val = getCurrentManual(id);
        console.log(`[bulk] id=${id} getCurrentManual=${val} → ${val != null ? 'EXCLUIR' : 'incluir'}`);
        return val != null;
      }).map(Number))
      : new Set();

    console.log('[bulk] excluir set:', Array.from(excluir));
    const updates = [];
    idsAll.forEach(artId => {
      if (excluir.has(Number(artId))) return;
      const base = num(baseById.get(artId)?.precio ?? 0);
      console.log(`[bulk update] id=${artId} base=${base} excluido=${excluir.has(Number(artId))}`);
      if (base > 0) {
        updates.push({ artId, precioManual: Math.round(base * (1 + pct / 100)) });
      }
    });
    console.log('[bulk] updates:', updates);
    if (!updates.length) return;
    updates.forEach(({ artId }) => bulkSetIdsRef.current.add(Number(artId)));
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
  }, [onBulkManualSave, onPriceConfigSave, baseById, getCurrentManual, setManuales]);

  const triggerBulkPct = useCallback((pct, ids, inputRef, blockKey) => {
    if (pct == null || !Number.isFinite(Number(pct)) || Number(pct) === 0) return;
    const pctNum = Number(pct);
    const idsConManual = ids.filter(id => getCurrentManual(id) != null);
    if (idsConManual.length > 0) {
      setBulkPctDlg({ pct: pctNum, idsAll: ids, idsConManual, inputRef, blockKey });
    } else {
      executeBulkPct(pctNum, ids, 'todos', []);
      if (blockKey) setBlockManuales(prev => { const n = { ...prev }; delete n[blockKey]; return n; });
      if (inputRef?.current) inputRef.current.value = '';
    }
  }, [getCurrentManual, executeBulkPct]);

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
    if (filterIds && filterIds.size) base = base.filter((a) => filterIds.has(getId(a)));
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
      const todosIds = sections.flatMap(sec => (sec.arts || []).map(getId)).filter(Boolean);
      const totalVentasAgrup = todosIds.reduce((acc, id) => acc + getVentasAmount(id), 0);
      const agrupByBranch = {};
      sections.forEach(sec => {
        Object.entries(sec.__ventasByBranch || {}).forEach(([bKey, amt]) => {
          agrupByBranch[bKey] = (agrupByBranch[bKey] || 0) + amt;
        });
      });
      rows.push({
        kind: "agrupacion-header",
        key: "AGRUP-HEADER",
        ids: todosIds,
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
  const branchCols = hasBranches ? branches.map(() => '.28fr').join(' ') : '';
  const gridTemplate = hasBranches
    ? `.3fr .8fr .3fr ${branchCols} .3fr .3fr .3fr .3fr .3fr .2fr`
    : ".3fr .8fr .3fr .3fr .3fr .3fr .3fr .3fr .3fr .3fr .2fr";

  const cellNum = { textAlign: "center", fontVariantNumeric: "tabular-nums" };
  const ITEM_H = 44;
  const isTodo = agrupSelView ? esTodoGroup(agrupSelView) : false;

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
          {/* Código + Nombre juntos */}
          <div style={{ gridColumn: "1 / 3", color: "var(--color-primary)", paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.nombre}
          </div>
          {/* Este div desaparece cuando hay mas de 1 sucursal (mostrar todas las sucursales) */}
          {!hasBranches && <div style={cellNum}></div>}

          {/* Ventas $ principal (solo sin branches) o total general */}
          <div style={{ ...cellNum, color: "var(--color-primary)" }}>
            {row.totalVentas > 0 ? fmtCurrency(row.totalVentas) : ''}
          </div>

          {/* Columnas por sucursal */}
          {(branches || []).map(branch => {
            const bKey = branch.id;
            const amt = row.ventasByBranch?.[bKey] || row.ventasByBranch?.[String(bKey)] || 0;
            const branchColor = branch.color || 'var(--color-primary)';
            return (
              <div key={branch.id} style={{ ...cellNum, color: amt ? branchColor : '#94a3b8', fontWeight: 600 }}>
                {amt > 0 ? fmtCurrency(amt) : '—'}
              </div>
            );
          })}

          {/* Precio */}
          <div />
          {/* Costo $ */}
          <div />
          {/* Costo % */}
          <div />

          {/* Objetivo % */}
          <div style={cellNum}>
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
                  const conOverride = ids.filter(artId => tieneObjetivoIndividual(artId));
                  const doSave = (idsToApply) => {
                    setObjetivos(prev => { const next = { ...prev }; idsToApply.forEach(artId => { next[String(artId)] = val; }); return next; });
                    if (idsToApply.length === ids.length) {
                      onPriceConfigSave({ scope: 'agrupacion', scopeId: agrupId, objetivo: val, articleIds: ids });
                    } else {
                      idsToApply.forEach(artId => { onPriceConfigSave({ scope: 'articulo', scopeId: String(artId), objetivo: val }); });
                    }
                    setBlockObjetivos(prev => { const n = { ...prev }; delete n[bkObj]; return n; });
                  };
                  if (conOverride.length > 0) {
                    setBulkObjetivoDlg({ val, ids, conOverride: conOverride.length, scopeId: agrupId, bkKey: bkObj, doSave });
                  } else {
                    doSave(ids);
                  }
                }}
                // Sin onBlur — evita disparar al abrir diálogo de confirmación
                className="input-with-suffix input-group-level"
                style={{ width: 52, fontSize: '0.78rem', textAlign: 'center', background: 'transparent', fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Sugerido */}
          <div />

          {/* Manual % bulk */}
          <div style={cellNum}>
            <div className="input-symbol-wrapper" data-symbol="%">
              <input
                type="number"
                placeholder="+%"
                value={blockManuales[bkManual] ?? ''}
                onChange={(e) => setBlockManuales(prev => ({ ...prev, [bkManual]: e.target.value }))}
                onBlur={(e) => {
                  const pct = e.target.value === '' ? null : Number(e.target.value);
                  if (pct == null) return;
                  triggerBulkPct(pct, ids, { current: e.target }, bkManual);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                className="input-with-suffix input-group-level"
                style={{ width: 52, fontSize: '0.78rem', textAlign: 'center', background: 'transparent', fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Acciones */}
          <div />
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
          <div style={{ gridColumn: "1 / 3" }}>{label}</div>

          {/* Ventas U — solo sin branches */}
          {!hasBranches && <div style={cellNum}>{fmt(totalQty, 0)}</div>}

          {/* Ventas $ principal */}
          <div style={cellNum}>{fmtCurrency(totalAmount)}</div>

          {/* Subtotales por sucursal */}
          {(branches || []).map(branch => {
            const bKey = branch.id;
            const amt = row.__ventasByBranch?.[bKey] || row.__ventasByBranch?.[String(bKey)] || 0;
            const branchColor = branch.color || 'var(--color-primary)';
            return (
              <div key={branch.id} style={{ ...cellNum, color: amt ? branchColor : '#94a3b8', fontSize: '0.78rem' }}>
                {amt > 0 ? fmtCurrency(amt) : '—'}
              </div>
            );
          })}
          {/* Precio */}
          <div />
          {/* Costo $ */}
          <div />
          {/* Costo % */}
          <div />

          {/* Objetivo % por rubro */}
          {esAgrupEspecifica ? (() => {
            const rubroKey = tableHeaderMode === "cat-first" ? (row.subrubro || '') : (row.categoria || '');
            const cfgRubro = priceConfig.byRubro?.[rubroKey] || {};
            const objValDb = cfgRubro.objetivo != null ? String(cfgRubro.objetivo) : '';
            const firstObjLocal = ids.length ? objetivos[String(ids[0])] : undefined;
            const bkRubroObj = `rubro-obj-${rubroKey}`;
            return (
              <div style={cellNum}>
                <div className="input-symbol-wrapper" data-symbol="%">
                  <input type="number"
                    placeholder={firstObjLocal != null ? String(firstObjLocal) : String(globalCostoIdeal)}
                    value={blockObjetivos[bkRubroObj] ?? objValDb}
                    onChange={(e) => setBlockObjetivos(prev => ({ ...prev, [bkRubroObj]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.target.blur();
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      if (!onPriceConfigSave || val == null) return;
                      // Verificar si hay artículos con objetivo individual → preguntar
                      const conObjetivoIndividual = ids.filter(artId => {
                        const cfg = priceConfig.byArticle?.[String(artId)];
                        return cfg?.objetivo != null;
                      });
                      const doSave = () => {
                        setObjetivos(prev => {
                          const next = { ...prev };
                          ids.forEach(artId => { next[String(artId)] = val; });
                          return next;
                        });
                        onPriceConfigSave({ scope: 'rubro', scopeId: rubroKey, objetivo: val, articleIds: ids });
                        setBlockObjetivos(prev => { const n = { ...prev }; delete n[bkRubroObj]; return n; });
                      };
                      if (conObjetivoIndividual.length > 0) {
                        // Reusar el mismo diálogo de bulk pero para objetivo
                        setBulkObjetivoDlg({ val, ids, doSave, conOverride: conObjetivoIndividual.length, scopeId: rubroKey });
                      } else {
                        doSave();
                      }
                    }}
                    className="input-with-suffix"
                    style={{ width: 52, fontSize: '0.75rem', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: 4 }}
                  />
                </div>
              </div>
            );
          })() : <div />}

          <div />

          {/* Manual % bulk por rubro */}
          {esAgrupEspecifica ? (() => {
            const rubroKeyManual = tableHeaderMode === "cat-first" ? (row.subrubro || '') : (row.categoria || '');
            const bkRubroMan = `rubro-man-${rubroKeyManual}`;
            return (
              <div style={cellNum}>
                <div className="input-symbol-wrapper" data-symbol="%">
                  <input type="number" placeholder="+%"
                    value={blockManuales[bkRubroMan] ?? ''}
                    onChange={(e) => setBlockManuales(prev => ({ ...prev, [bkRubroMan]: e.target.value }))}
                    onBlur={(e) => {
                      const pct = e.target.value === '' ? null : Number(e.target.value);
                      if (pct == null) return;
                      triggerBulkPct(pct, ids, { current: e.target }, bkRubroMan);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                    className="input-with-suffix"
                    style={{ width: 52, fontSize: '0.75rem', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: 4 }}
                  />
                </div>
              </div>
            );
          })() : <div />}

          <SubrubroAccionesMenu
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
    const precioRef = precioManual ?? num(a.precio);
    const costoPct = precioRef > 0 ? (costoArticulo / precioRef) * 100 : 0;
    const sugerido = objetivoArticulo > 0 && objetivoArticulo < 100 ? costoArticulo / (objetivoArticulo / 100) : 0;
    const superaObjetivo = costoPct > 0 && objetivoArticulo > 0 && costoPct > objetivoArticulo;

    const rowBg = hayAlertaInsumo ? "rgba(245,158,11,0.08)" : superaObjetivo ? "rgba(239,68,68,0.06)" : undefined;
    const selectedStyle = isSelected ? { background: "color-mix(in srgb, var(--color-primary) 10%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 35%, transparent)", position: "relative" } : null;
    const leftBar = isSelected ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--color-primary)", borderRadius: 2 }} /> : null;

    return (
      <div key={row.key} data-article-id={id}
        className={`table-item-row${isSelected ? " is-selected" : ""}`}
        style={{ ...style, display: "grid", alignItems: "center", gridTemplateColumns: gridTemplate, fontWeight: 500, fontSize: "0.85rem", background: rowBg, ...(selectedStyle || {}) }}>
        {leftBar}

        {/* Código */}
        <div>{id}</div>

        {/* Nombre */}
        <div onClick={() => { const objetivoResuelto = getObjetivoArticulo(a, agrupId); setRecetaArticulo({ ...a, objetivoResuelto }); }}
          style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={hayReceta ? `Receta cargada — costo $${fmt(costoArticulo, 0)}` : `Cargar receta de ${a.nombre}`}>
          {hayAlertaInsumo && <span title="Algún insumo sin compra reciente" style={{ color: '#f59e0b', marginRight: 3, fontSize: '0.7rem' }}>⚠</span>}
          {hayReceta && !hayAlertaInsumo && <span style={{ color: 'var(--color-primary)', marginRight: 4, fontSize: '0.7rem' }}>●</span>}
          {hayReceta && hayAlertaInsumo && <span style={{ color: '#f59e0b', marginRight: 4, fontSize: '0.7rem' }}>●</span>}
          {a.nombre}
        </div>

        {/* Ventas U — solo sin branches */}
        {!hasBranches && (
          <div>
            <VentasCell
              articuloId={id} articuloNombre={a.nombre}
              from={fechaDesde} to={fechaHasta}
              defaultGroupBy="day" totalOverride={overrideQty}
              onTotalResolved={onTotalResolved} businessId={activeBizId}
            />
          </div>
        )}

        {/* Ventas $ principal */}
        <div style={cellNum}>{fmtCurrency(overrideAmount)}</div>

        {/* Columnas por sucursal */}
        {hasBranches && branches.map(branch => {
          const bKey = branch.id;
          const bMap = ventasMapByBranch[bKey] || ventasMapByBranch[String(bKey)];
          const bData = bMap ? (bMap.get(id) || bMap.get(String(id)) || { amount: 0 }) : { amount: 0 };
          const branchColor = branch.color || 'var(--color-primary)';
          return (
            <div key={branch.id} style={{ ...cellNum, fontSize: '0.78rem', color: bData.amount ? branchColor : '#94a3b8', borderLeft: `2px solid ${branchColor}20` }}>
              {bData.amount > 0 ? fmtCurrency(bData.amount) : '—'}
            </div>
          );
        })}

        {/* Precio */}
        <div style={{ ...cellNum, color: precioManual != null ? 'var(--color-primary)' : undefined }}>
          {fmt(precioRef, 0)}
        </div>

        {/* Costo $ */}
        <div style={{ ...cellNum, color: hayReceta ? 'var(--color-primary)' : undefined }}>
          {costoArticulo > 0 ? fmt(costoArticulo, 0) : '—'}
        </div>

        {/* Costo % */}
        <div style={{ ...cellNum, color: superaObjetivo ? '#ef4444' : undefined, fontWeight: superaObjetivo ? 700 : 500 }}>
          {costoPct > 0 ? `${fmt(costoPct, 1)}%` : '—'}
        </div>

        {/* Objetivo % */}
        <div style={cellNum}>
          <input type="number"
            value={objetivos[id] !== undefined ? objetivos[id] : (priceConfig.byArticle?.[String(id)]?.objetivo ?? '')}
            onChange={(e) => setObjetivos((s) => ({ ...s, [id]: e.target.value }))}
            onBlur={(e) => { const val = e.target.value === '' ? null : Number(e.target.value); onPriceConfigSave?.({ scope: 'articulo', scopeId: String(id), objetivo: val }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            placeholder={String(objetivoArticulo)}
            style={{ width: 52, fontSize: '0.78rem', textAlign: 'center' }}
          />
        </div>

        {/* Sugerido $ */}
        <div style={{ ...cellNum, color: sugerido > 0 ? '#16a34a' : undefined }}>
          {sugerido > 0 ? fmt(sugerido, 0) : '—'}
        </div>

        {/* Manual $ */}
        <div style={cellNum}>
          <input type="number"
            value={manuales[id] !== undefined ? manuales[id] : (priceConfig.byArticle?.[String(id)]?.precioManual ?? '')}
            onChange={(e) => setManuales((s) => ({ ...s, [id]: e.target.value }))}
            onBlur={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              // Si el usuario lo editó manualmente, ya no es "solo bulk, entonces lo sacamos de la lista de ids a modificar en bloque (si es que estaba)"
              bulkSetIdsRef.current.delete(Number(id));
              onPriceConfigSave?.({ scope: 'articulo', scopeId: String(id), precioManual: val });
            }}
            style={{ width: 72, fontSize: '0.78rem', textAlign: 'center' }}
          />
        </div>

        {/* Acciones */}
        <div style={{ textAlign: "center" }}>
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
          onSaved={(savedReceta) => {
            if (savedReceta?.article_id && savedReceta?.costo_total != null) onSaved?.(savedReceta);
            setRecetaArticulo(null);
          }}
        />
      )}

      <div className="tabla-articulos-container">
        <div style={{ height: "calc(100vh - 220px)", width: "100%" }}>
          <div className="table-col-header">
            <div className="table-col-header-inner" style={{ gridTemplateColumns: gridTemplate }}>
              <div onClick={() => toggleSort("codigo")} className="col-sortable">
                Código {sortBy === "codigo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("nombre")} className="col-sortable">
                Nombre {sortBy === "nombre" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              {!hasBranches && (
                <div onClick={() => toggleSort("ventasQty")} className="col-sortable">
                  Ventas U {ventasLoading ? "…" : ""}{sortBy === "ventasQty" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </div>
              )}
              <div onClick={() => toggleSort("ventas")} className="col-sortable">
                Ventas $ {ventasLoading ? "…" : ""}{sortBy === "ventas" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              {hasBranches && branches.map(branch => (
                <div key={branch.id} style={{ fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', color: branch.color || 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: `2px solid ${branch.color || 'var(--color-primary)'}30`, paddingLeft: 4 }}
                  title={`Ventas $ — ${branch.name}`}>
                  {branch.name} $
                </div>
              ))}
              <div onClick={() => toggleSort("precio")} className="col-sortable">
                Precio {sortBy === "precio" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("costo")} className="col-sortable">
                Costo ($) {sortBy === "costo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("costoPct")} className="col-sortable">
                Costo (%) {sortBy === "costoPct" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("objetivo")} className="col-sortable">
                Objetivo (%) {sortBy === "objetivo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("sugerido")} className="col-sortable">
                Sugerido ($) {sortBy === "sugerido" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("manual")} className="col-sortable">
                Manual ($) {sortBy === "manual" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div style={{ textAlign: "center" }}>Acciones</div>
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
              renderRow={renderRow} extraData={ventasPorArticulo?.size || 0}
            />
          )}
        </div>

        <Snackbar open={snack.open} autoHideDuration={2600} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
          <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.type} sx={{ width: "100%" }}>{snack.msg}</Alert>
        </Snackbar>

        {bulkObjetivoDlg && (
          <Dialog open onClose={() => setBulkObjetivoDlg(null)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Cambiar objetivo %</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {`${bulkObjetivoDlg.conOverride} de ${bulkObjetivoDlg.ids.length} artículos ya tienen objetivo % individual.`}
              </Typography>
              <Typography variant="body2" color="text.secondary">¿A cuáles aplicar el nuevo objetivo?</Typography>
            </DialogContent>
            <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 2, pb: 2 }}>
              <Button variant="contained" size="small"
                onClick={() => { bulkObjetivoDlg.doSave(bulkObjetivoDlg.ids); setBulkObjetivoDlg(null); }}
                sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
                A todos ({bulkObjetivoDlg.ids.length} artículos)
              </Button>
              <Button variant="outlined" size="small"
                onClick={() => {
                  const sinOverride = bulkObjetivoDlg.ids.filter(artId => !tieneObjetivoIndividual(artId));
                  setObjetivos(prev => { const next = { ...prev }; sinOverride.forEach(artId => { next[String(artId)] = bulkObjetivoDlg.val; }); return next; });
                  sinOverride.forEach(artId => { onPriceConfigSave?.({ scope: 'articulo', scopeId: String(artId), objetivo: bulkObjetivoDlg.val }); });
                  if (bulkObjetivoDlg.bkKey) setBlockObjetivos(prev => { const n = { ...prev }; delete n[bulkObjetivoDlg.bkKey]; return n; });
                  setBulkObjetivoDlg(null);
                }}
                sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
                Solo los que NO tienen objetivo individual ({bulkObjetivoDlg.ids.length - bulkObjetivoDlg.conOverride} artículos)
              </Button>
              <Button variant="text" size="small" color="inherit" onClick={() => setBulkObjetivoDlg(null)} sx={{ textTransform: 'none' }}>Cancelar</Button>
            </DialogActions>
          </Dialog>
        )}
      </div>
    </>
  );
}