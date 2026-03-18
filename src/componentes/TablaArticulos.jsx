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
import { Snackbar, Alert } from "@mui/material";

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

// Normaliza cualquier forma de "venta" a { qty, amount }
const normalizeVenta = (venta, precioFallback = 0) => {
  if (!venta) return { qty: 0, amount: 0 };

  const qty = toNum(
    venta.qty ??
    venta.quantity ??
    venta.cantidad ??
    venta.unidades ??
    venta.total_u ??
    venta.total_qty ??
    venta.qty_sum ??
    venta.qtyMap // 👈 por si tu resumen lo trae así
  );

  // amount: priorizar calcAmount y luego variantes
  let amount = toNum(
    venta.calcAmount ??
    venta.amount ??
    venta.total ??
    venta.total_amount ??
    venta.importe ??
    venta.monto ??
    venta.amountMap
  );

  // fallback qty*precio si amount vino 0 pero hay qty
  if ((!amount || amount === 0) && qty > 0) {
    const p = toNum(venta.precio ?? precioFallback);
    if (p > 0) amount = qty * p;
  }

  return { qty, amount };
};

const getId = (x) => {
  const raw =
    x?.article_id ??
    x?.articulo_id ??
    x?.articuloId ??
    x?.idArticulo ??
    x?.id ??
    x?.codigo ??
    x?.codigoArticulo;

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
    n === "TODO" ||
    n === "SIN AGRUPACION" ||
    n === "SIN AGRUPACIÓN" ||
    n === "SIN AGRUPAR" ||
    n === "SIN GRUPO"
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
  orgAssignedIds = null,   // IDs asignados en agrupaciones reales de TODA la org (global)
}) {
  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

  const [categorias, setCategorias] = useState([]);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});
  const [snack, setSnack] = useState({ open: false, msg: "", type: "success" });
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
    try {
      await refetchAgrupaciones?.();
    } catch { }
    setReloadTick((t) => t + 1);
  }, [refetchAgrupaciones]);
  const [recetaArticulo, setRecetaArticulo] = useState(null);

  const listRef = useRef(null);
  const lastJumpedIdRef = useRef(null);

  const findPath = useCallback((cats, id) => {
    for (const sub of cats || []) {
      const rubroName = sub?.subrubro || "Sin subrubro";
      for (const cat of sub?.categorias || []) {
        const catName = cat?.categoria || "Sin categoría";
        for (const a of cat?.articulos || []) {
          if (Number(a?.id) === Number(id)) {
            return { rubroName, catName };
          }
        }
      }
    }
    return null;
  }, []);

  // ---- ordenamiento ----
  const [sortBy, setSortBy] = useState("ventas");
  const [sortDir, setSortDir] = useState("desc");

  const sortByRef = React.useRef(sortBy);
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

  // ========== Catálogo y base ==========
  const buildTreeFromFlat = useCallback((items = []) => {
    const flat = items
      .map((row) => {
        const raw = row?.raw || {};
        const id = Number(
          row?.id ??
          raw?.id ??
          raw?.articulo_id ??
          raw?.codigo ??
          raw?.codigoArticulo
        );
        return {
          id,
          nombre: String(
            row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`
          ),
          categoria: String(
            row?.categoria ?? raw?.categoria ?? raw?.rubro ?? "Sin categoría"
          ),
          subrubro: String(
            row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? "Sin subrubro"
          ),
          precio: Number(
            row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0
          ),
          costo: Number(row?.costo ?? raw?.costo ?? 0),
        };
      })
      .filter((a) => Number.isFinite(a.id));

    const bySub = new Map();
    for (const a of flat) {
      if (!bySub.has(a.subrubro)) bySub.set(a.subrubro, new Map());
      const byCat = bySub.get(a.subrubro);
      if (!byCat.has(a.categoria)) byCat.set(a.categoria, []);
      byCat.get(a.categoria).push(a);
    }
    return Array.from(bySub, ([subrubro, byCat]) => ({
      subrubro,
      categorias: Array.from(byCat, ([categoria, articulos]) => ({
        categoria,
        articulos,
      })),
    }));
  }, []);

  // Carga catálogo + exclusiones
  useEffect(() => {
    console.log('[TablaArticulos] cargando con activeBizId:', activeBizId);

    // ✅ NUEVO: Limpiar estado al cambiar negocio
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
          if (!cancel && myId === loadReqId.current) {
            setCategorias([]);
            onCategoriasLoaded?.([]);
          }
          openSnack("No hay negocio activo", "warning");
          return;
        }

        try {
          const resp = await BusinessesAPI.articlesTree(bizId);
          const tree = Array.isArray(resp?.tree) ? resp.tree : [];

          // ✅ si tree vino vacío, hacemos fallback a DB igual
          if (tree.length > 0) {
            if (!cancel && myId === loadReqId.current) {
              setCategorias(tree);
              onCategoriasLoaded?.(tree);
            }
          } else {
            const resp2 = await BusinessesAPI.articlesFromDB(bizId);
            const items = Array.isArray(resp2?.items) ? resp2.items : [];
            const tree2 = buildTreeFromFlat(items);

            if (!cancel && myId === loadReqId.current) {
              setCategorias(tree2);
              onCategoriasLoaded?.(tree2);
            }
            openSnack("Tree vacío → catálogo cargado por fallback DB", "info");
          }
        } catch (e) {
          // si tree falló de verdad, fallback normal
          const resp2 = await BusinessesAPI.articlesFromDB(bizId);
          const items = Array.isArray(resp2?.items) ? resp2.items : [];
          const tree2 = buildTreeFromFlat(items);

          if (!cancel && myId === loadReqId.current) {
            setCategorias(tree2);
            onCategoriasLoaded?.(tree2);
          }
          openSnack("Catálogo cargado por fallback DB (error en tree)", "info");
        }
        try {
          // Usar rootBizId para que subnegocios from_group compartan
          // el mismo Sin Agrupacion y Discontinuados del principal
          const todoBizId = rootBizId ?? activeBizId;
          const todo = await ensureTodo(todoBizId);
          if (todo?.id && !cancel && myId === loadReqId.current) {
            setTodoGroupId(todo.id);
            const ex = await getExclusiones(todo.id, todoBizId);
            const ids = (ex || [])
              .filter((e) => e.scope === "articulo")
              .map((e) => Number(e.ref_id))
              .filter(Boolean);
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

    return () => {
      cancel = true;
    };
  }, [
    activeBizId,
    rootBizId,
    reloadKey,
    reloadTick,
    onCategoriasLoaded,
    buildTreeFromFlat,
    openSnack,
  ]);

  /* --------- flatten catálogo --------- */
  const allArticulos = useMemo(() => {
    const out = [];
    for (const sub of categorias || []) {
      const subrubroNombre = String(
        sub?.subrubro ?? sub?.nombre ?? "Sin subrubro"
      );
      for (const cat of sub?.categorias || []) {
        const categoriaNombre = String(
          cat?.categoria ?? cat?.nombre ?? "Sin categoría"
        );
        for (const a of cat?.articulos || []) {
          out.push({
            ...a,
            subrubro: a?.subrubro ?? subrubroNombre,
            categoria: a?.categoria ?? categoriaNombre,
          });
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

  // -------- ventas helpers (DESPUÉS de baseById) --------
  const getVentaForId = useCallback(
    (idNum) => {
      const n = Number(idNum);
      if (!Number.isFinite(n)) return null;
      return ventasPorArticulo?.get(n) ?? ventasPorArticulo?.get(String(n)) ?? null;
    },
    [ventasPorArticulo]
  );

  const getVentasQty = useCallback(
    (artOrId) => {
      const id = typeof artOrId === "number" ? artOrId : getId(artOrId);
      const idNum = Number(id);
      if (!Number.isFinite(idNum)) return 0;

      const venta = getVentaForId(idNum);
      const precio = toNum(baseById?.get?.(idNum)?.precio ?? 0);
      return normalizeVenta(venta, precio).qty;
    },
    [getVentaForId, baseById]
  );

  const getVentasAmount = useCallback(
    (artOrId) => {
      const id = typeof artOrId === "number" ? artOrId : getId(artOrId);
      const idNum = Number(id);
      if (!Number.isFinite(idNum)) return 0;

      const venta = getVentaForId(idNum);
      const precio = toNum(baseById?.get?.(idNum)?.precio ?? 0);
      return normalizeVenta(venta, precio).amount;
    },
    [getVentaForId, baseById]
  );

  const agrupacionesParaTodo = Array.isArray(agrupacionesAll) ? agrupacionesAll : agrupaciones;

  const idsEnOtras = useMemo(
    () =>
      new Set(
        (agrupacionesParaTodo || [])
          .filter((g) => g && !esTodoGroup(g))
          .flatMap((g) => (g.articulos || []).map(getId))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    [agrupacionesParaTodo]
  );

  // IDs asignados en toda la org (incluye los de otros negocios de la org)
  // Cuando orgAssignedIds llega del backend, lo usamos en lugar de idsEnOtras locales
  const idsAsignadosGlobal = useMemo(() => {
    if (Array.isArray(orgAssignedIds) && orgAssignedIds.length > 0) {
      return new Set(orgAssignedIds.map(Number).filter(n => n > 0));
    }
    return idsEnOtras; // fallback: sin org, usar solo las agrupaciones locales
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
    onTodoInfo?.({
      todoGroupId,
      idsSinAgrupCount: idsSinAgrup.size,
      idsSinAgrup: idsSinAgrupArray,
    });
  }, [onTodoInfo, todoGroupId, idsSinAgrup.size, idsSinAgrupArray]);

  const getSortValue = useCallback(
    (a) => {
      const id = getId(a);

      switch (sortBy) {
        case "ventas": {
          const idNum = Number(id);
          if (!Number.isFinite(idNum)) return 0;
          return getVentasAmount(idNum); // ordena por importe $
        }
        case "ventasQty": {
          const idNum = Number(id);
          if (!Number.isFinite(idNum)) return 0;
          const venta = getVentaForId(idNum);
          const precio = toNum(baseById?.get?.(idNum)?.precio ?? 0);
          return normalizeVenta(venta, precio).qty;
        }

        case "codigo":
          return id;
        case "nombre":
          return a?.nombre ?? "";
        case "precio":
          return num(a?.precio);
        case "costo":
          return num(a?.costo);
        case "costoPct": {
          const p = num(a?.precio),
            c = num(a?.costo);
          return p > 0 ? (c / p) * 100 : -Infinity;
        }
        case "objetivo":
          return num(objetivos[id]) || 0;
        case "sugerido": {
          const obj = num(objetivos[id]) || 0;
          const c = num(a?.costo);
          const den = 100 - obj;
          return den > 0 ? c * (100 / den) : 0;
        }
        case "manual":
          return num(manuales[id]) || 0;
        default:
          return null;
      }
    },
    [sortBy, objetivos, manuales, getVentasAmount, getVentaForId, baseById]
  );

  const cmp = useCallback(
    (a, b) => {
      if (!sortBy) return 0;
      const va = getSortValue(a),
        vb = getSortValue(b);
      if (typeof va === "string" || typeof vb === "string") {
        const r = String(va ?? "").localeCompare(String(vb ?? ""), "es", {
          sensitivity: "base",
          numeric: true,
        });
        return sortDir === "asc" ? r : -r;
      }
      const na = Number(va ?? 0),
        nb = Number(vb ?? 0);
      return sortDir === "asc" ? na - nb : nb - na;
    },
    [sortBy, sortDir, getSortValue]
  );

  /* --------- a mostrar + filtro --------- */
  const articulosAMostrar = useMemo(() => {
    let base = [];

    if (categoriaSeleccionada && agrupacionSeleccionada) {
      // Usar filterIds (visibleIds) para filtrar - tiene los IDs correctos del catalogo
      base = (categoriaSeleccionada.categorias || [])
        .flatMap((c) =>
          (c.articulos || []).map((a) => {
            const id = getId(a);
            const b = baseById.get(id) || {};
            return {
              ...b,
              ...a,
              id,
              nombre: a?.nombre ?? b?.nombre ?? `#${id}`,
              categoria:
                a?.categoria ?? b?.categoria ?? c?.categoria ?? "Sin categoría",
              subrubro:
                a?.subrubro ??
                b?.subrubro ??
                categoriaSeleccionada?.subrubro ??
                "Sin subrubro",
              precio: num(a?.precio ?? b?.precio),
              costo: num(a?.costo ?? b?.costo),
            };
          })
        )
        .filter((a) => !filterIds || filterIds.has(getId(a)));
    } else if (categoriaSeleccionada) {
      base = (categoriaSeleccionada.categorias || []).flatMap((c) =>
        (c.articulos || []).map((a) => {
          const id = getId(a);
          const b = baseById.get(id) || {};
          return {
            ...b,
            ...a,
            id,
            nombre: a?.nombre ?? b?.nombre ?? `#${id}`,
            categoria:
              a?.categoria ?? b?.categoria ?? c?.categoria ?? "Sin categoría",
            subrubro:
              a?.subrubro ??
              b?.subrubro ??
              categoriaSeleccionada?.subrubro ??
              "Sin subrubro",
            precio: num(a?.precio ?? b?.precio),
            costo: num(a?.costo ?? b?.costo),
          };
        })
      );
    } else if (agrupacionSeleccionada) {
      if (esTodoGroup(agrupacionSeleccionada)) {
        base = allArticulos.filter((a) => idsSinAgrup.has(getId(a)));
      } else {
        const arr = Array.isArray(agrupacionSeleccionada.articulos)
          ? agrupacionSeleccionada.articulos
          : [];

        if (arr.length > 0) {
          base = arr.map((x) => {
            const id = getId(x);
            const b = baseById.get(id) || {};
            return {
              id,
              nombre: x?.nombre ?? b?.nombre ?? `#${id}`,
              categoria: x?.categoria ?? b?.categoria ?? "Sin categoría",
              subrubro: x?.subrubro ?? b?.subrubro ?? "Sin subrubro",
              precio: num(x?.precio ?? b?.precio ?? 0),
              costo: num(x?.costo ?? b?.costo ?? 0),
            };
          });
        } else {
          base = [];
        }
      }
    } else {
      base = allArticulos;
    }

    if (filterIds && filterIds.size) {
      base = base.filter((a) => filterIds.has(getId(a)));
    }

    return base;
  }, [
    categoriaSeleccionada,
    agrupacionSeleccionada,
    idsSinAgrup,
    baseById,
    allArticulos,
    filterIds,
  ]);

  const filtroDefer = useDeferredValue(filtroBusqueda);
  const articulosFiltrados = useMemo(() => {
    if (!filtroDefer) return articulosAMostrar;
    const q = String(filtroDefer).toLowerCase().trim();
    return articulosAMostrar.filter(
      (a) =>
        (a.nombre || "").toLowerCase().includes(q) ||
        String(getId(a)).includes(q)
    );
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
      if (!bySr.has(sr)) bySr.set(sr, { arts: [], ventasMonto: 0 });
      const node = bySr.get(sr);
      node.arts.push(a);

      const idNum = Number(getId(a));
      node.ventasMonto += getVentasAmount(idNum);
    }

    const bloquesCat = Array.from(byCat, ([categoria, mapSr]) => {
      const subBlocks = Array.from(mapSr, ([subrubro, data]) => ({
        subrubro,
        arts: data.arts,
        __ventasMonto: data.ventasMonto || 0,
      }));

      subBlocks.sort((a, b) => {
        if (b.__ventasMonto !== a.__ventasMonto)
          return b.__ventasMonto - a.__ventasMonto;
        return String(a.subrubro).localeCompare(String(b.subrubro), "es", localeOpts);
      });

      const totalRub = subBlocks.reduce((s, x) => s + (x.__ventasMonto || 0), 0);

      return {
        categoria,
        __ventasMonto: totalRub,
        subrubros: subBlocks.map(({ subrubro, arts, __ventasMonto }) => ({
          subrubro,
          arts,
          __ventasMonto,
        })),
      };
    });

    bloquesCat.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) return b.__ventasMonto - a.__ventasMonto;
      return String(a.categoria).localeCompare(String(b.categoria), "es", localeOpts);
    });

    return bloquesCat.map(({ categoria, subrubros, __ventasMonto }) => ({
      categoria,
      subrubros,
      __ventasMonto,
    }));
  }, [articulosFiltrados, getVentasAmount]);

  const flatRows = useMemo(() => {
    const sections = [];

    for (const blq of bloques) {
      const subList = blq.subrubros || [];
      for (const sr of subList) {
        const artsOrdenados = (sr?.arts || [])
          .slice()
          .sort(cmp);

        const sectionMonto =
          sr?.__ventasMonto != null
            ? sr.__ventasMonto
            : artsOrdenados.reduce((acc, a) => acc + getVentasAmount(getId(a)), 0);

        sections.push({
          categoria: blq.categoria,
          subrubro: sr.subrubro,
          arts: artsOrdenados,
          __ventasMonto: sectionMonto,
        });
      }
    }

    const isRubroViewLocal = tableHeaderMode === "cat-first";
    if (isRubroViewLocal) {
      sections.sort((a, b) => {
        if ((b.__ventasMonto || 0) !== (a.__ventasMonto || 0))
          return (b.__ventasMonto || 0) - (a.__ventasMonto || 0);
        return String(a.subrubro).localeCompare(String(b.subrubro), "es", {
          sensitivity: "base",
          numeric: true,
        });
      });
    }

    const rows = [];
    for (const sec of sections) {
      const { categoria, subrubro, arts } = sec;

      rows.push({
        kind: "header",
        key: `H|${categoria}|${subrubro}`,
        categoria,
        subrubro,
        ids: arts.map(getId),
        __ventasMonto: sec.__ventasMonto || 0,
      });

      for (const a of arts) {
        const id = getId(a);
        rows.push({
          kind: "item",
          key: `I|${categoria}|${subrubro}|${id}`,
          categoria,
          subrubro,
          art: { ...a, id, precio: num(a.precio), costo: num(a.costo) },
        });
      }
    }

    return rows;
  }, [bloques, cmp, tableHeaderMode, getVentasAmount]);

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
          if (el) {
            el.classList.add("highlight-jump");
            setTimeout(() => el.classList.remove("highlight-jump"), 1400);
          }
        }, 40);
      }, 50);
    } else {
      const tryScroll = () => {
        const el = document.querySelector(`[data-article-id="${id}"]`);
        if (el) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          el.classList.add("highlight-jump");
          setTimeout(() => el.classList.remove("highlight-jump"), 1400);
          return true;
        }
        return false;
      };
      let tries = 0;
      const iv = setInterval(() => {
        if (tryScroll() || tries++ > 12) clearInterval(iv);
      }, 60);
      return () => clearInterval(iv);
    }
  }, [jumpToArticleId, categorias, findPath, idToIndex]);

  useEffect(() => {
    if (!jumpToArticleId) {
      lastJumpedIdRef.current = null;
    }
  }, [jumpToArticleId]);

  const [agrupSelView, setAgrupSelView] = useState(agrupacionSeleccionada);
  useEffect(() => {
    setAgrupSelView(agrupacionSeleccionada);
  }, [agrupacionSeleccionada]);

  const afterMutation = useCallback(
    (removedIds) => {
      const ids = (removedIds || []).map(Number).filter(Number.isFinite);
      if (!ids.length) {
        refetchLocal();
        return;
      }
      if (!agrupSelView?.id) {
        refetchLocal();
        return;
      }
      const isTodo = agrupSelView ? esTodoGroup(agrupSelView) : false;
      if (isTodo) {
        // En Sin Agrupación: solo excluir localmente, SIN refetch
        // El refetch resetea el scroll y pierde el contexto de trabajo.
        // La mutación optimista con setExcludedIds es suficiente — el artículo
        // desaparece de la vista inmediatamente sin necesidad de ir al servidor.
        if (ids.length) {
          setExcludedIds(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.add(id));
            return next;
          });
        }
        // ✅ NO llamar refetchLocal() — mantiene scroll y vista intactos
        return;
      }

      onMutateGroups?.({
        type: "remove",
        groupId: Number(agrupSelView.id),
        ids,
      });

      refetchLocal();
    },
    [agrupSelView, onMutateGroups, refetchLocal, setExcludedIds]
  );

  const handleVisibleIds = useCallback(
    (ids) => {
      onIdsVisibleChange?.(new Set(ids));
    },
    [onIdsVisibleChange]
  );

  const gridTemplate =
    ".3fr .8fr .3fr .3fr .3fr .3fr .3fr .3fr .3fr .3fr .2fr";
  const cellNum = { textAlign: "center", fontVariantNumeric: "tabular-nums" };
  const ITEM_H = 44;

  const isTodo = agrupSelView ? esTodoGroup(agrupSelView) : false;

  const calcularCostoPct = (a) => {
    const p = num(a.precio),
      c = num(a.costo);
    return p > 0 ? ((c / p) * 100).toFixed(2) : 0;
  };

  const calcularSugerido = (a) => {
    const o = num(objetivos[getId(a)]) || 0;
    const c = num(a.costo);
    const den = 100 - o;
    return den > 0 ? c * (100 / den) : 0;
  };

  const renderRow = ({ row, index, style }) => {
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

      const label = isRubroView
        ? `${headerSr} - ${headerCat}`
        : `${headerCat} - ${headerSr}`;

      const groupKeyName = tableHeaderMode === "sr-first" ? headerCat : headerSr;

      const ids = row.ids || [];

      // ✅ totales consistentes (misma fuente que la tabla)
      const totalQty = ids.reduce((acc, id) => acc + getVentasQty(id), 0);
      const totalAmount = ids.reduce((acc, id) => acc + getVentasAmount(id), 0);

      return (
        <div
          key={row.key}
          className="table-section-row"
          style={{
            ...style,
            display: "grid",
            alignItems: "center",
            gridTemplateColumns: gridTemplate,
          }}
        >
          <div style={{ gridColumn: "1 / 3" }}>{label}</div>

          <div style={cellNum}>{fmt(totalQty, 0)}</div>
          <div style={cellNum}>{fmtCurrency(totalAmount)}</div>

          <div />
          <div />
          <div />
          <div />
          <div />
          <div />

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

    const a = row.art;
    const id = a.id;
    const isSelected = Number(id) === Number(selectedArticleId);

    const overrideQty = getVentasQty(id);
    const overrideAmount = getVentasAmount(id);

    const selectedStyle = isSelected
      ? {
        background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 35%, transparent)",
        position: "relative",
      }
      : null;

    const leftBar = isSelected ? (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: "var(--color-primary)",
          borderRadius: 2,
        }}
      />
    ) : null;

    return (
      <div
        key={row.key}
        data-article-id={id}
        className={`table-item-row${isSelected ? " is-selected" : ""}`}
        style={{
          ...style,
          display: "grid",
          alignItems: "center",
          gridTemplateColumns: gridTemplate,
          fontWeight: 500,
          fontSize: "0.85rem",
          ...(selectedStyle || {}),
        }}
      >
        {leftBar}
        <div>{id}</div>
        <div
          onClick={() => setRecetaArticulo(a)}
          style={{
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={`Ver receta de ${a.nombre}`}
        >
          {a.nombre}
        </div>
        <div>
          <VentasCell
            articuloId={id}
            articuloNombre={a.nombre}
            from={fechaDesde}
            to={fechaHasta}
            defaultGroupBy="day"
            totalOverride={overrideQty}
            onTotalResolved={onTotalResolved}
             businessId={activeBizId}
          />
        </div>

        <div style={cellNum}>{fmtCurrency(overrideAmount)}</div>

        <div style={cellNum}>{fmt(a.precio, 0)}</div>
        <div style={cellNum}>{fmt(a.costo, 0)}</div>
        <div style={cellNum}>{calcularCostoPct(a)}%</div>

        <div style={cellNum}>
          <input
            type="number"
            value={objetivos[id] || ""}
            onChange={(e) =>
              setObjetivos((s) => ({ ...s, [id]: e.target.value }))
            }
            style={{ width: 64 }}
          />
        </div>

        <div style={cellNum}>{fmt(calcularSugerido(a), 2)}</div>

        <div style={cellNum}>
          <input
            type="number"
            value={manuales[id] || ""}
            onChange={(e) =>
              setManuales((s) => ({ ...s, [id]: e.target.value }))
            }
            style={{ width: 84 }}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <ArticuloAccionesMenu
            onMutateGroups={onMutateGroups}
            baseById={baseById}
            articulo={a}
            agrupaciones={agrupaciones}
            agrupacionSeleccionada={agrupacionSeleccionada}
            todoGroupId={todoGroupId}
            isTodo={isTodo}
            onRefetch={refetchLocal}
            onAfterMutation={(ids2) => afterMutation(ids2)}
            notify={(m, t) => openSnack(m, t)}
            onGroupCreated={onGroupCreated}
            onDiscontinuadoChange={onDiscontinuadoChange}
            treeMode={modalTreeMode}
            allowedIds={filterIds}
            businessId={activeBizId}
            rootBizId={rootBizId}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {recetaArticulo && (
        <RecetaModal
          open={!!recetaArticulo}
          onClose={() => setRecetaArticulo(null)}
          articulo={recetaArticulo}
          businessId={rootBizId ?? activeBizId}
        />
      )}
      <div className="tabla-articulos-container">
        <div style={{ height: "calc(100vh - 220px)", width: "100%" }}>
      <div className="table-col-header">
            <div
              className="table-col-header-inner"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div onClick={() => toggleSort("codigo")} className="col-sortable">
                Código {sortBy === "codigo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("nombre")} className="col-sortable">
                Nombre {sortBy === "nombre" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("ventasQty")} className="col-sortable">
                Ventas U {ventasLoading ? "…" : ""}{" "}
                {sortBy === "ventasQty" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>

              <div onClick={() => toggleSort("ventas")} className="col-sortable">
                Ventas $ {ventasLoading ? "…" : ""}{" "}
                {sortBy === "ventas" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>

              <div onClick={() => toggleSort("precio")} className="col-sortable">
                Precio {sortBy === "precio" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("costo")} className="col-sortable">
                Costo ($) {sortBy === "costo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("costoPct")} className="col-sortable">
                Costo (%){" "}
                {sortBy === "costoPct" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("objetivo")} className="col-sortable">
                Objetivo (%){" "}
                {sortBy === "objetivo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("sugerido")} className="col-sortable">
                Sugerido ($){" "}
                {sortBy === "sugerido" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div onClick={() => toggleSort("manual")} className="col-sortable">
                Manual ($){" "}
                {sortBy === "manual" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </div>
              <div style={{ textAlign: "center" }}>Acciones</div>
            </div>
          </div>

          {flatRows.length === 0 ? (
            <p
              style={{
                marginTop: "2rem",
                fontSize: "1.2rem",
                color: "#777",
                padding: "0 8px",
              }}
            >
              No hay artículos.
            </p>
          ) : (
            <VirtualList
              ref={listRef}
              rows={flatRows}
              rowHeight={ITEM_H}
              height={
                typeof window !== "undefined" && window.innerHeight
                  ? Math.max(240, window.innerHeight - 220)
                  : 520
              }
              overscan={8}
              onVisibleItemsIds={handleVisibleIds}
              getRowId={(r) => (r?.kind === "item" ? Number(r?.art?.id) : null)}
              renderRow={renderRow}
              extraData={ventasPorArticulo?.size || 0}
            />
          )}
        </div>

        <Snackbar
          open={snack.open}
          autoHideDuration={2600}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            severity={snack.type}
            sx={{ width: "100%" }}
          >
            {snack.msg}
          </Alert>
        </Snackbar>
      </div>
    </>
  );
}