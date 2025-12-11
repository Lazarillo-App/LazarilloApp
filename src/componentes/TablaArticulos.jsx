// src/componentes/TablaArticulos.jsx
/* eslint-disable no-empty */
/* eslint-disable no-useless-catch */
/* eslint-disable no-unused-vars */
import React, {
  useEffect, useMemo, useRef, useState, useCallback, useDeferredValue, forwardRef, useImperativeHandle,
} from 'react';
import { Snackbar, Alert } from '@mui/material';

import SubrubroAccionesMenu from './SubrubroAccionesMenu';
import ArticuloAccionesMenu from './ArticuloAccionesMenu';
import VentasCell from './VentasCell';
import { ensureTodo, getExclusiones } from '../servicios/apiAgrupacionesTodo';
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import '../css/TablaArticulos.css';

/* ---------------- utils ---------------- */
const clean = (s) => String(s ?? '').trim();
const isSin = (s) => {
  const v = clean(s).toLowerCase();
  return v === '' || v === 'sin categoría' || v === 'sin categoria' || v === 'sin subrubro';
};
const prefer = (...vals) => { for (const v of vals) if (!isSin(v)) return clean(v); return clean(vals[0] ?? ''); };
const getDisplayCategoria = (a) => prefer(a?.categoria, a?.raw?.categoria, a?.raw?.raw?.categoria);
const getDisplaySubrubro = (a) => prefer(a?.subrubro, a?.raw?.subrubro, a?.raw?.raw?.subrubro);

const normKey = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getRubroBase = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return 'Sin rubro';
  const first = raw.split('-')[0].trim();
  return first || raw;
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
const fmt = (v, d = 0) => Number(v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtCurrency = (v) => {
  try {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(v || '');
  }
};

const esTodoGroup = (g) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return (
    n === 'TODO' ||
    n === 'SIN AGRUPACION' ||
    n === 'SIN AGRUPACIÓN' ||
    n === 'SIN AGRUPAR' ||
    n === 'SIN GRUPO'
  );
};

/* ---------------- VirtualList simple (sin librerías) ---------------- */
const VirtualList = forwardRef(function VirtualList(
  { rows = [], rowHeight = 44, height = 400, overscan = 6, onVisibleItemsIds, renderRow, getRowId },
  ref
) {
  const scrollRef = useRef(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = rows.length * rowHeight;

  const { startIdx, endIdx } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
    const end = Math.min(rows.length - 1, start + visibleCount);
    return { startIdx: start, endIdx: end };
  }, [scrollTop, rowHeight, height, overscan, rows.length]);

  const offsetY = startIdx * rowHeight;
  const visibleRows = rows.slice(startIdx, endIdx + 1);

  const prevIdsStrRef = useRef('');
  useEffect(() => {
    if (!onVisibleItemsIds) return;
    const ids = [];
    const arr = rowsRef.current;
    for (let i = startIdx; i <= endIdx; i++) {
      const r = arr[i];
      const id = getRowId?.(r);
      if (Number.isFinite(id)) ids.push(id);
    }
    const str = ids.join(',');
    if (str !== prevIdsStrRef.current) {
      prevIdsStrRef.current = str;
      onVisibleItemsIds(ids);
    }
  }, [startIdx, endIdx, getRowId, onVisibleItemsIds]);

  useImperativeHandle(ref, () => {
    const doScrollToIndex = (idx) => {
      if (!Number.isFinite(idx)) return;
      const top = Math.max(0, idx * rowHeight - Math.floor(height / 3));
      if (scrollRef.current) scrollRef.current.scrollTop = top;
      setScrollTop(top);
    };

    const doScrollToId = (id) => {
      if (!getRowId) return;
      const arr = rowsRef.current;
      let idx = -1;
      for (let i = 0; i < arr.length; i++) {
        if (Number(getRowId(arr[i])) === Number(id)) { idx = i; break; }
      }
      if (idx >= 0) doScrollToIndex(idx);
    };

    return {
      scrollToIndex: doScrollToIndex,
      scrollToId: doScrollToId,
    };
  }, [getRowId, rowHeight, height]);

  return (
    <div
      ref={scrollRef}
      style={{ height, overflow: 'auto', position: 'relative', willChange: 'transform' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleRows.map((row, i) => {
            const index = startIdx + i;
            const id = getRowId?.(row);

            // 🆕 key única: priorizamos row.key
            const reactKey =
              row && row.key != null
                ? row.key
                : (Number.isFinite(id) ? `row-${id}-${index}` : `row-${index}`);

            return (
              <div
                key={reactKey}
                data-article-id={Number.isFinite(id) ? id : undefined}
                style={{ height: rowHeight, display: 'block' }}
              >
                {renderRow({
                  row,
                  index,
                  style: {
                    height: rowHeight,
                    display: 'block',
                    color: '#373737ff',
                    fontWeight: 500,
                    fontSize: '0.95rem',
                  },
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ---------------- componente principal ---------------- */
export default function TablaArticulos({
  filtroBusqueda = '',
  agrupacionSeleccionada,
  agrupaciones = [],
  categoriaSeleccionada,
  refetchAgrupaciones,
  fechaDesdeProp,
  fechaHastaProp,
  ventasPorArticulo = new Map(),
  ventasLoading = false,
  onCategoriasLoaded,
  onIdsVisibleChange,
  activeBizId,
  reloadKey = 0,
  onTodoInfo,
  onTotalResolved,
  onGroupCreated,
  visibleIds,
  onMutateGroups,
  jumpToArticleId,
  selectedArticleId,
  tableHeaderMode = 'cat-first',
  modalTreeMode = 'cat-first',
  onDiscontinuadoChange,
  onDiscontinuarBloque,
}) {

  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

  const getVentasQty = React.useCallback(
    (artOrId) => {
      const id = typeof artOrId === 'number' ? artOrId : getId(artOrId);
      const idNum = Number(id);
      if (!Number.isFinite(idNum)) return 0;

      const venta = ventasPorArticulo?.get(idNum) ?? ventasPorArticulo?.get(String(idNum));
      if (!venta) return 0;

      const qty = Number(venta.qty ?? venta.quantity ?? 0);
      return Number.isFinite(qty) ? qty : 0;
    },
    [ventasPorArticulo]
  );

  // NUEVO: monto por artículo (desde ventasPorArticulo o fallback qty * precio)
  const getVentasAmount = React.useCallback(
    (artOrId) => {
      const id = typeof artOrId === 'number' ? artOrId : getId(artOrId);
      const idNum = Number(id);
      if (!Number.isFinite(idNum)) return 0;

      const venta = ventasPorArticulo?.get(idNum) ?? ventasPorArticulo?.get(String(idNum));
      if (venta) {
        const am = Number(venta.amount ?? venta.total ?? venta.importe ?? venta.monto ?? 0);
        if (Number.isFinite(am) && am !== 0) return am;
        // if no explicit amount but qty exists, fallback to qty * price if we know price later
        const qty = Number(venta.qty ?? venta.quantity ?? 0);
        if (Number.isFinite(qty) && qty > 0) {
          // price lookup later if available by baseById in outer scope
          // but here return qty and let callers multiply if they have price
          return { qtyOnly: qty };
        }
      }
      return 0;
    },
    [ventasPorArticulo]
  );

  const [categorias, setCategorias] = useState([]);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });
  const openSnack = useCallback((msg, type = 'success') => setSnack({ open: true, msg, type }), []);
  const loadReqId = useRef(0);

  // normalizamos a Set<number> o null
  const filterIds = useMemo(() => {
    if (!visibleIds) return null;
    return new Set(Array.from(visibleIds).map(Number));
  }, [visibleIds]);

  const [expandedRubro, setExpandedRubro] = useState(null);
  const [expandedCatByRubro, setExpandedCatByRubro] = useState({});

  // refetch sin F5
  const [reloadTick, setReloadTick] = useState(0);
  const refetchLocal = useCallback(async () => {
    try { await refetchAgrupaciones?.(); } catch { }
    setReloadTick((t) => t + 1);
  }, [refetchAgrupaciones]);

  const listRef = useRef(null);

  const findPath = useCallback((cats, id) => {
    for (const sub of cats || []) {
      const rubroName = sub?.subrubro || 'Sin subrubro';
      for (const cat of sub?.categorias || []) {
        const catName = cat?.categoria || 'Sin categoría';
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
  const [sortBy, setSortBy] = useState('ventas');
  const [sortDir, setSortDir] = useState('desc');

  const toggleSort = useCallback((k) => {
    setSortBy((prev) => {
      if (prev === k) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortDir('asc');
      return k;
    });
  }, []);

  // ========== Catálogo y base ==========
  const buildTreeFromFlat = useCallback((items = []) => {
    const flat = items.map(row => {
      const raw = row?.raw || {};
      const id = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
      return {
        id,
        nombre: String(row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`),
        categoria: String(row?.categoria ?? raw?.categoria ?? raw?.rubro ?? 'Sin categoría'),
        subrubro: String(row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? 'Sin subrubro'),
        precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
        costo: Number(row?.costo ?? raw?.costo ?? 0),
      };
    }).filter(a => Number.isFinite(a.id));

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

  // Carga catálogo + exclusiones
  useEffect(() => {
    let cancel = false;
    const myId = loadReqId.current;

    (async () => {
      try {
        const bizId = activeBizId;
        if (!bizId) {
          if (!cancel && myId === loadReqId.current) {
            setCategorias([]);
            onCategoriasLoaded?.([]);
          }
          openSnack('No hay negocio activo', 'warning');
          return;
        }

        try {
          const { tree = [] } = await BusinessesAPI.articlesTree(bizId);
          if (!cancel && myId === loadReqId.current) {
            setCategorias(tree);
            onCategoriasLoaded?.(tree);
          }
        } catch {
          try {
            const { items = [] } = await BusinessesAPI.articlesFromDB(bizId);
            const tree = buildTreeFromFlat(items);
            if (!cancel && myId === loadReqId.current) {
              setCategorias(tree);
              onCategoriasLoaded?.(tree);
            }
            openSnack('Catálogo cargado por fallback', 'info');
          } catch (e2) { throw e2; }
        }

        try {
          const todo = await ensureTodo();
          if (todo?.id && !cancel && myId === loadReqId.current) {
            setTodoGroupId(todo.id);
            const ex = await getExclusiones(todo.id);
            const ids = (ex || [])
              .filter((e) => e.scope === 'articulo')
              .map((e) => Number(e.ref_id))
              .filter(Boolean);
            setExcludedIds(new Set(ids));
          }
        } catch {
          if (!cancel && myId === loadReqId.current) setExcludedIds(new Set());
        }
      } catch (e) {
        console.error('TablaArticulos: cargar BD', e);
        if (!cancel && myId === loadReqId.current) {
          openSnack('No se pudieron cargar los artículos desde la base', 'error');
          setCategorias([]);
          onCategoriasLoaded?.([]);
        }
      }
    })();

    return () => { cancel = true; };
  }, [activeBizId, reloadKey, reloadTick, onCategoriasLoaded, buildTreeFromFlat, openSnack]);

  /* --------- flatten catálogo --------- */
  const allArticulos = useMemo(() => {
    const out = [];
    for (const sub of categorias || []) {
      const subrubroNombre = String(sub?.subrubro ?? sub?.nombre ?? 'Sin subrubro');
      for (const cat of sub?.categorias || []) {
        const categoriaNombre = String(cat?.categoria ?? cat?.nombre ?? 'Sin categoría');
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

  const idsEnOtras = useMemo(
    () => new Set(
      (agrupaciones || [])
        .filter((g) => !esTodoGroup(g))
        .flatMap((g) => (g.articulos || []).map(getId))
    ),
    [agrupaciones]
  );

  const idsSinAgrup = useMemo(() => {
    const s = new Set();
    for (const id of allArticulos.map(getId)) {
      if (!idsEnOtras.has(id) && !excludedIds.has(id)) s.add(id);
    }
    return s;  // Set<number>
  }, [allArticulos, idsEnOtras, excludedIds]);

  // Array estable a partir del Set para enviar al padre
  const idsSinAgrupArray = useMemo(
    () => Array.from(idsSinAgrup),
    [idsSinAgrup]
  );

  useEffect(() => {
    onTodoInfo?.({
      todoGroupId,
      idsSinAgrupCount: idsSinAgrup.size,
      idsSinAgrup: idsSinAgrupArray,   // 👈 ahora también mandamos la lista
    });
  }, [onTodoInfo, todoGroupId, idsSinAgrup.size, idsSinAgrupArray]);

    const getSortValue = useCallback((a) => {
    const id = getId(a);

    switch (sortBy) {
      case 'ventas': {
        // Ordenar por MONTO ($) en lugar de unidades
        const idNum = Number(id);
        if (!Number.isFinite(idNum)) return 0;

        const venta = ventasPorArticulo?.get(idNum) ?? ventasPorArticulo?.get(String(idNum));
        if (venta) {
          const am = Number(venta.amount ?? venta.total ?? venta.importe ?? venta.monto ?? 0);
          if (Number.isFinite(am) && am !== 0) return am;
          const qty = Number(venta.qty ?? venta.quantity ?? 0);
          const price = Number(baseById?.get?.(idNum)?.precio ?? 0);
          if (Number.isFinite(qty) && Number.isFinite(price)) return qty * price;
          return 0;
        }

        // no hay registro en ventasPorArticulo -> intentar qty * precio desde baseById / objeto
        const b = baseById?.get?.(idNum) || {};
        const qty2 = Number(a?.qty ?? b?.qty ?? a?.ventas_u ?? b?.ventas_u ?? 0);
        const price2 = Number(a?.precio ?? b?.precio ?? 0);
        if (Number.isFinite(qty2) && Number.isFinite(price2) && qty2 > 0) return qty2 * price2;

        return 0;
      }

      case 'codigo':
        return id;
      case 'nombre':
        return a?.nombre ?? '';
      case 'precio':
        return num(a?.precio);
      case 'costo':
        return num(a?.costo);
      case 'costoPct': {
        const p = num(a?.precio), c = num(a?.costo);
        return p > 0 ? (c / p) * 100 : -Infinity;
      }
      case 'objetivo':
        return num(objetivos[id]) || 0;
      case 'sugerido': {
        const obj = num(objetivos[id]) || 0;
        const c = num(a?.costo);
        const den = 100 - obj;
        return den > 0 ? c * (100 / den) : 0;
      }
      case 'manual':
        return num(manuales[id]) || 0;
      default:
        return null;
    }
  }, [sortBy, objetivos, manuales, ventasPorArticulo, baseById]);

  const cmp = useCallback((a, b) => {
    if (!sortBy) return 0;
    const va = getSortValue(a), vb = getSortValue(b);
    if (typeof va === 'string' || typeof vb === 'string') {
      const r = String(va ?? '').localeCompare(String(vb ?? ''), 'es', { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? r : -r;
    }
    const na = Number(va ?? 0), nb = Number(vb ?? 0);
    return sortDir === 'asc' ? na - nb : nb - na;
  }, [sortBy, sortDir, getSortValue]);

  /* --------- a mostrar + filtro --------- */
  const articulosAMostrar = useMemo(() => {
    let base = [];

    // 1) Hay categoría Y agrupación seleccionada
    if (categoriaSeleccionada && agrupacionSeleccionada) {
      const idsFiltro = esTodoGroup(agrupacionSeleccionada)
        ? idsSinAgrup                        // TODO virtual → solo sin agrupar
        : new Set((agrupacionSeleccionada.articulos || []).map(getId));

      base = (categoriaSeleccionada.categorias || [])
        .flatMap((c) => (c.articulos || []).map((a) => {
          const id = getId(a);
          const b = baseById.get(id) || {};
          return {
            ...b, ...a, id,
            nombre: a?.nombre ?? b?.nombre ?? `#${id}`,
            categoria: a?.categoria ?? b?.categoria ?? c?.categoria ?? "Sin categoría",
            subrubro: a?.subrubro ?? b?.subrubro ?? categoriaSeleccionada?.subrubro ?? "Sin subrubro",
            precio: num(a?.precio ?? b?.precio),
            costo: num(a?.costo ?? b?.costo),
          };
        }))
        .filter((a) => idsFiltro.has(getId(a)));
    }

    // 2) Solo categoría seleccionada (sin agrupación)
    else if (categoriaSeleccionada) {
      base = (categoriaSeleccionada.categorias || [])
        .flatMap((c) => (c.articulos || []).map((a) => {
          const id = getId(a);
          const b = baseById.get(id) || {};
          return {
            ...b, ...a, id,
            nombre: a?.nombre ?? b?.nombre ?? `#${id}`,
            categoria: a?.categoria ?? b?.categoria ?? c?.categoria ?? "Sin categoría",
            subrubro: a?.subrubro ?? b?.subrubro ?? categoriaSeleccionada?.subrubro ?? "Sin subrubro",
            precio: num(a?.precio ?? b?.precio),
            costo: num(a?.costo ?? b?.costo),
          };
        }));
    }

    // 3) Solo agrupación seleccionada (sin categoría)
    else if (agrupacionSeleccionada) {
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
              categoria: x?.categoria ?? b?.categoria ?? 'Sin categoría',
              subrubro: x?.subrubro ?? b?.subrubro ?? 'Sin subrubro',
              precio: num(x?.precio ?? b?.precio ?? 0),
              costo: num(x?.costo ?? b?.costo ?? 0),
            };
          });
        } else {
          base = [];
        }
      }
    }

    // 4) Sin categoría ni agrupación: vista general → todo el catálogo
    else {
      base = allArticulos;
    }

    // 🔎 Filtro final por IDs visibles (Sirve para ocultar discontinuados, etc.)
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

  // Filtro con defer para tecleo suave
  const filtroDefer = useDeferredValue(filtroBusqueda);
  const articulosFiltrados = useMemo(() => {
    if (!filtroDefer) return articulosAMostrar;
    const q = String(filtroDefer).toLowerCase().trim();
    return articulosAMostrar.filter((a) =>
      (a.nombre || '').toLowerCase().includes(q) || String(getId(a)).includes(q)
    );
  }, [articulosAMostrar, filtroDefer]);

  const isRubroView = tableHeaderMode === 'cat-first';
  const isSubrubroView = tableHeaderMode === 'sr-first';

  const bloques = useMemo(() => {
    const items = articulosFiltrados || [];
    const localeOpts = { sensitivity: 'base', numeric: true };

    // Siempre: RUBRO (categoría) -> SUBRUBRO
    // Construimos mapa categoria -> Map(subrubro -> { arts, ventasMonto })
    const byCat = new Map(); // categoria -> Map(subrubro -> { arts, ventasMonto })

    for (const a of items) {
      const cat = getDisplayCategoria(a) || 'Sin categoría';
      const sr = getDisplaySubrubro(a) || 'Sin subrubro';

      if (!byCat.has(cat)) byCat.set(cat, new Map());
      const bySr = byCat.get(cat);
      if (!bySr.has(sr)) bySr.set(sr, { arts: [], ventasMonto: 0 });
      const node = bySr.get(sr);
      node.arts.push(a);
      // calcular monto del artículo: preferimos ventasPorArticulo amount, si no usar qty*precio fallback
      const venta = ventasPorArticulo?.get(Number(getId(a))) ?? ventasPorArticulo?.get(String(getId(a)));
      let monto = 0;
      if (venta) {
        const am = Number(venta.amount ?? venta.total ?? venta.importe ?? venta.monto ?? 0);
        if (Number.isFinite(am) && am !== 0) monto = am;
        else {
          const qty = Number(venta.qty ?? venta.quantity ?? 0);
          const price = Number(a?.precio ?? 0);
          if (Number.isFinite(qty) && Number.isFinite(price)) monto = qty * price;
        }
      } else {
        // no hay registro de venta, fallback qty*precio if qty present in object
        const qty = Number(a?.qty ?? a?.ventas_u ?? 0);
        const price = Number(a?.precio ?? 0);
        if (Number.isFinite(qty) && Number.isFinite(price) && qty > 0) monto = qty * price;
      }
      node.ventasMonto += monto;
    }

    // Ahora transformamos cada categoria en objeto con subrubros y sumas
    const bloquesCat = Array.from(byCat, ([categoria, mapSr]) => {
      const subBlocks = Array.from(mapSr, ([subrubro, data]) => ({
        subrubro,
        arts: data.arts,
        __ventasMonto: data.ventasMonto || 0,
      }));

      // Ordenar subrubros por ventas desc (si empatan, alfabético)
      subBlocks.sort((a, b) => {
        if (b.__ventasMonto !== a.__ventasMonto) return b.__ventasMonto - a.__ventasMonto;
        return String(a.subrubro).localeCompare(String(b.subrubro), 'es', localeOpts);
      });

      // suma total del rubro (categoria)
      const totalRub = subBlocks.reduce((s, x) => s + (x.__ventasMonto || 0), 0);

      return {
        categoria,
        __ventasMonto: totalRub,
        subrubros: subBlocks.map(({ subrubro, arts, __ventasMonto }) => ({ subrubro, arts, __ventasMonto })),
      };
    });

    // Ordenar rubros por ventas total desc (si empatan, alfabético)
    bloquesCat.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) return b.__ventasMonto - a.__ventasMonto;
      return String(a.categoria).localeCompare(String(b.categoria), 'es', localeOpts);
    });

    // Normalizamos salida
    return bloquesCat.map(({ categoria, subrubros, __ventasMonto }) => ({ categoria, subrubros, __ventasMonto }));
  }, [articulosFiltrados, ventasPorArticulo]);

  const flatRows = useMemo(() => {
    const sections = [];

    // 1️⃣ Armamos secciones (bloque = rubro+subrubro con sus artículos)
    for (const blq of bloques) {
      const subList = blq.subrUbros || blq.subrubros || [];
      for (const sr of subList) {
        const srNorm = sr;
        const artsOrdenados = (srNorm.arts || sr.arts || [])
          .slice()
          .sort(cmp);

        // calculamos monto de la sección (sumando artículos)
        const sectionMonto = (srNorm.__ventasMonto != null)
          ? srNorm.__ventasMonto
          : artsOrdenados.reduce((acc, a) => {
            const venta = ventasPorArticulo?.get(Number(getId(a))) ?? ventasPorArticulo?.get(String(getId(a)));
            let am = 0;
            if (venta) {
              const val = Number(venta.amount ?? venta.total ?? venta.importe ?? venta.monto ?? 0);
              if (Number.isFinite(val) && val !== 0) am = val;
              else {
                const qty = Number(venta.qty ?? venta.quantity ?? 0);
                const price = Number(a?.precio ?? 0);
                if (Number.isFinite(qty) && Number.isFinite(price)) am = qty * price;
              }
            } else {
              const qty = Number(a?.qty ?? a?.ventas_u ?? 0);
              const price = Number(a?.precio ?? 0);
              if (Number.isFinite(qty) && Number.isFinite(price) && qty > 0) am = qty * price;
            }
            return acc + am;
          }, 0);

        sections.push({
          categoria: blq.categoria,
          subrubro: srNorm.subrubro,
          arts: artsOrdenados,
          __ventasMonto: sectionMonto,
        });
      }
    }

    // 2️⃣ Ordenamos las secciones para que sigan el orden del sidebar (por monto)
    //    👉 Vista RUBRO: orden por monto de la sección (desc)
    //    👉 Vista SUBRUBRO: dejamos el orden tal como viene (ya agrupado)
    const isRubroViewLocal = tableHeaderMode === 'cat-first';

    if (isRubroViewLocal) {
      sections.sort((a, b) => {
        if ((b.__ventasMonto || 0) !== (a.__ventasMonto || 0)) return (b.__ventasMonto || 0) - (a.__ventasMonto || 0);
        return String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true });
      });
    }
    // else keep natural order (already sorted by rubro ordering above)

    // 3️⃣ Aplanamos secciones en filas (header + items)
    const rows = [];

    for (const sec of sections) {
      const { categoria, subrubro, arts } = sec;

      rows.push({
        kind: 'header',
        key: `H|${categoria}|${subrubro}`,
        categoria,
        subrubro,
        ids: arts.map(getId),
        __ventasMonto: sec.__ventasMonto || 0,
      });

      for (const a of arts) {
        const id = getId(a);
        rows.push({
          kind: 'item',
          key: `I|${categoria}|${subrubro}|${id}`,
          categoria,
          subrubro,
          art: { ...a, id, precio: num(a.precio), costo: num(a.costo) },
        });
      }
    }

    return rows;
  }, [bloques, cmp, tableHeaderMode, ventasPorArticulo]);

  const idToIndex = useMemo(() => {
    const m = new Map();
    flatRows.forEach((r, i) => {
      if (r?.kind === 'item') {
        const id = Number(r?.art?.id);
        if (Number.isFinite(id)) m.set(id, i);
      }
    });
    return m;
  }, [flatRows]);

  // Scroll + efecto corto cuando llega jumpToArticleId
  useEffect(() => {
    const id = Number(jumpToArticleId);
    if (!Number.isFinite(id)) return;
    const path = findPath(categorias, id);
    if (!path) return;

    setExpandedRubro(path.rubroName);
    setExpandedCatByRubro(prev => ({ ...prev, [path.rubroName]: path.catName }));

    const idx = idToIndex.get(id);
    if (idx != null) {
      setTimeout(() => {
        listRef.current?.scrollToIndex(idx);
        setTimeout(() => {
          const el = document.querySelector(`[data-article-id="${id}"]`);
          if (el) {
            el.classList.add('highlight-jump');
            setTimeout(() => el.classList.remove('highlight-jump'), 1400);
          }
        }, 40);
      }, 50);
    } else {
      const tryScroll = () => {
        const el = document.querySelector(`[data-article-id="${id}"]`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.classList.add('highlight-jump');
          setTimeout(() => el.classList.remove('highlight-jump'), 1400);
          return true;
        }
        return false;
      };
      let tries = 0;
      const iv = setInterval(() => { if (tryScroll() || tries++ > 12) clearInterval(iv); }, 60);
      return () => clearInterval(iv);
    }
  }, [jumpToArticleId, categorias, findPath, idToIndex]);

  const [agrupSelView, setAgrupSelView] = useState(agrupacionSeleccionada);
  useEffect(() => { setAgrupSelView(agrupacionSeleccionada); }, [agrupacionSeleccionada]);

  const afterMutation = useCallback((removedIds) => {
    const ids = (removedIds || []).map(Number).filter(Number.isFinite);
    if (!ids.length) { refetchLocal(); return; }
    if (!agrupSelView?.id) { refetchLocal(); return; }
    const isTodo = agrupSelView ? esTodoGroup(agrupSelView) : false;
    if (isTodo) { refetchLocal(); return; }

    onMutateGroups?.({
      type: 'remove',
      groupId: Number(agrupSelView.id),
      ids
    });

    refetchLocal();
  }, [agrupSelView, todoGroupId, onMutateGroups, refetchLocal]);

  const handleVisibleIds = useCallback((ids) => {
    onIdsVisibleChange?.(new Set(ids));
  }, [onIdsVisibleChange]);

  // 👉 Discontinuar en bloque: llama al handler general por cada id

  const handleDiscontinuarBloque = useCallback(
    async (ids) => {
      // ids viene del SubrubroAccionesMenu
      if (!onDiscontinuadoChange) return;

      // Normalizamos: si tu handler actual solo acepta un id,
      // mantenemos compatibilidad llamando uno por uno.
      for (const rawId of ids || []) {
        const id = Number(rawId);
        if (!Number.isFinite(id)) continue;

        try {
          await onDiscontinuadoChange(id, true); // true = marcar como discontinuado
        } catch (e) {
          console.error("DISCONTINUAR_BLOQUE_ITEM_ERROR", id, e);
        }
      }
    },
    [onDiscontinuadoChange]
  );


  // ====== layout tipo “tabla” con CSS grid
  const gridTemplate = '.3fr .8fr .3fr .3fr .3fr .3fr .3fr .3fr .3fr .3fr .2fr';
  const cellNum = { textAlign: 'center', fontVariantNumeric: 'tabular-nums' };
  const ITEM_H = 44;

  const isTodo = agrupSelView ? esTodoGroup(agrupSelView) : false;

  const calcularCostoPct = (a) => {
    const p = num(a.precio), c = num(a.costo);
    return p > 0 ? ((c / p) * 100).toFixed(2) : 0;
  };

  const calcularSugerido = (a) => {
    const o = num(objetivos[getId(a)]) || 0;
    const c = num(a.costo);
    const den = 100 - o;
    return den > 0 ? c * (100 / den) : 0;
  };

  // render de cada fila (para VirtualList)
  const renderRow = ({ row, index, style }) => {
    if (row.kind === 'header') {
      let headerCat = row.categoria || 'Sin categoría';
      let headerSr = row.subrubro || 'Sin subrubro';

      // Recalculamos rubro/subrubro reales desde el primer artículo
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

      const label =
        isRubroView
          ? `${headerSr} - ${headerCat}`   // Rubro - Subrubro
          : `${headerCat} - ${headerSr}`;  // Subrubro - Rubro

      // 👇 Clave de agrupación según modo:
      // - sr-first (vista Subrubro): manda headerCat (ej: "Cafeteria")
      // - cat-first (vista Rubro):   manda headerSr  (ej: "Bebida")
      const groupKeyName =
        tableHeaderMode === 'sr-first' ? headerCat : headerSr;

      const ids = row.ids || [];
      const totalQty = ids.reduce((acc, id) => {
        const idNum = Number(id);
        if (!Number.isFinite(idNum)) return acc;

        const venta = ventasPorArticulo?.get(idNum) ?? ventasPorArticulo?.get(String(idNum));
        const q = Number(venta?.qty ?? venta?.quantity ?? 0);

        return acc + (Number.isFinite(q) ? q : 0);
      }, 0);

      const totalAmount = ids.reduce((acc, id) => {
        const idNum = Number(id);
        if (!Number.isFinite(idNum)) return acc;

        const venta = ventasPorArticulo?.get(idNum) ?? ventasPorArticulo?.get(String(idNum));
        let am = 0;
        if (venta) {
          const val = Number(venta?.amount ?? venta?.total ?? venta?.importe ?? venta?.monto ?? 0);
          if (Number.isFinite(val) && val !== 0) am = val;
          else {
            const qty = Number(venta.qty ?? venta.quantity ?? 0);
            const price = Number(baseById.get(idNum)?.precio ?? 0);
            if (Number.isFinite(qty) && Number.isFinite(price)) am = qty * price;
          }
        } else {
          const base = baseById.get(idNum);
          const qty = Number(base?.qty ?? base?.ventas_u ?? 0);
          const price = Number(base?.precio ?? 0);
          if (Number.isFinite(qty) && Number.isFinite(price) && qty > 0) am = qty * price;
        }

        return acc + (Number.isFinite(am) ? am : 0);
      }, 0);

      return (
        <div
          key={row.key}
          style={{
            ...style,
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            alignItems: 'center',
            background: 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
            color: 'var(--on-secondary)',
            fontWeight: 500,
            borderTop: '1px solid rgba(0,0,0,0.04)',
            borderBottom: '1px solid rgba(0,0,0,0.04)',
            padding: '4px 8px',
          }}
        >
          {/* Nombre del bloque ocupando Código + Nombre */}
          <div style={{ gridColumn: '1 / 3' }}>
            {label}
          </div>

          {/* Ventas U totales */}
          <div style={cellNum}>{fmt(totalQty, 0)}</div>

          {/* Ventas $ totales */}
          <div style={cellNum}>{fmtCurrency(totalAmount)}</div>

          {/* Columnas intermedias vacías */}
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
            onAfterMutation={(ids) => afterMutation(ids)}
            notify={(m, t = 'success') => openSnack(m, t)}
            onGroupCreated={onGroupCreated}
            treeMode={tableHeaderMode}
          />
        </div>
      );
    }
    // ---------- item ----------
    const a = row.art;
    const id = a.id;
    const isSelected = Number(selectedArticleId) === Number(id);

    const idNum = Number(id);
    const ventaObj = ventasPorArticulo?.get(idNum) ?? ventasPorArticulo?.get(String(id));

    // ✅ Cantidad de ventas
    const overrideQty =
      ventaObj && ventaObj.qty != null && !Number.isNaN(Number(ventaObj.qty))
        ? Number(ventaObj.qty)
        : undefined;

    // ✅ Amount SIEMPRE del hook (no calcular fallback)
    const overrideAmount =
      ventaObj && ventaObj.amount != null && !Number.isNaN(Number(ventaObj.amount))
        ? Number(ventaObj.amount)
        : undefined;

    const selectedStyle = isSelected
      ? {
        background: 'rgba(59,130,246,0.10)',
        boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.35)',
        position: 'relative',
      }
      : null;

    const leftBar = isSelected ? (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: 'rgba(59,130,246,0.95)',
          borderRadius: 2,
        }}
      />
    ) : null;

    return (
      <div
        key={row.key}
        style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          borderTop: '1px dashed #f0f0f0',
          padding: '4px 8px',
          ...(selectedStyle || {}),
        }}
      >
        {leftBar}
        {/* 1️⃣ Código */}
        <div>{id}</div>

        {/* 2️⃣ Nombre */}
        <div>{a.nombre}</div>

        {/* 3️⃣ Ventas U */}
        <div>
          <VentasCell
            articuloId={id}
            articuloNombre={a.nombre}
            from={fechaDesde}
            to={fechaHasta}
            defaultGroupBy="day"
            totalOverride={overrideQty}
            onTotalResolved={onTotalResolved}
          />
        </div>

        {/* 4️⃣ Ventas $ */}
        <div style={cellNum}>
          {overrideAmount != null
            ? fmtCurrency(overrideAmount)
            : '—'}
        </div>

        {/* 5️⃣ Precio */}
        <div style={cellNum}>{fmt(a.precio, 0)}</div>

        {/* 6️⃣ Costo */}
        <div style={cellNum}>{fmt(a.costo, 0)}</div>

        {/* 7️⃣ Costo % */}
        <div style={cellNum}>{calcularCostoPct(a)}%</div>

        {/* 8️⃣ Objetivo % */}
        <div style={cellNum}>
          <input
            type="number"
            value={objetivos[id] || ''}
            onChange={(e) => setObjetivos((s) => ({ ...s, [id]: e.target.value }))}
            style={{ width: 64 }}
          />
        </div>

        {/* 9️⃣ Sugerido */}
        <div style={cellNum}>{fmt(calcularSugerido(a), 2)}</div>

        {/* 🔟 Manual */}
        <div style={cellNum}>
          <input
            type="number"
            value={manuales[id] || ''}
            onChange={(e) => setManuales((s) => ({ ...s, [id]: e.target.value }))}
            style={{ width: 84 }}
          />
        </div>

        {/* 1️⃣1️⃣ Acciones */}
        <div style={{ textAlign: 'center' }}>
          <ArticuloAccionesMenu
            onMutateGroups={onMutateGroups}
            baseById={baseById}
            articulo={a}
            agrupaciones={agrupaciones}
            agrupacionSeleccionada={agrupacionSeleccionada}
            todoGroupId={todoGroupId}
            isTodo={isTodo}
            onRefetch={refetchLocal}
            onAfterMutation={(ids) => afterMutation(ids)}
            notify={(m, t) => openSnack(m, t)}
            onGroupCreated={onGroupCreated}
            onDiscontinuadoChange={onDiscontinuadoChange}
            treeMode={modalTreeMode}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="tabla-articulos-container">
      <div style={{ height: 'calc(100vh - 220px)', width: '100%' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 3,
            background: '#fff',
            borderBottom: '1px solid #eee',
            padding: '8px 8px 6px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: 0,
              fontWeight: 700,
              userSelect: 'none',
              alignItems: 'center',
              color: 'black',
              fontSize: '1rem',
            }}
          >
            <div onClick={() => toggleSort('codigo')} style={{ cursor: 'pointer' }}>
              Código {sortBy === 'codigo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div onClick={() => toggleSort('nombre')} style={{ cursor: 'pointer' }}>
              Nombre {sortBy === 'nombre' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div
              onClick={() => toggleSort('ventas')}
              style={{ cursor: 'pointer' }}
            >
              Ventas U {ventasLoading ? '…' : ''}{' '}
              {sortBy === 'ventas' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>

            <div>Ventas $ {ventasLoading ? '…' : ''}</div>
            <div
              onClick={() => toggleSort('precio')}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              Precio {sortBy === 'precio' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div
              onClick={() => toggleSort('costo')}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              Costo ($) {sortBy === 'costo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div
              onClick={() => toggleSort('costoPct')}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              Costo (%) {sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div
              onClick={() => toggleSort('objetivo')}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              Objetivo (%) {sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div
              onClick={() => toggleSort('sugerido')}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              Sugerido ($) {sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div
              onClick={() => toggleSort('manual')}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              Manual ($) {sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div style={{ textAlign: 'center' }}>Acciones</div>
          </div>
        </div>

        {flatRows.length === 0 ? (
          <p
            style={{
              marginTop: '2rem',
              fontSize: '1.2rem',
              color: '#777',
              padding: '0 8px',
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
              typeof window !== 'undefined' && window.innerHeight
                ? Math.max(240, window.innerHeight - 220)
                : 520
            }
            overscan={8}
            onVisibleItemsIds={handleVisibleIds}
            getRowId={(r) => (r?.kind === 'item' ? Number(r?.art?.id) : null)}
            renderRow={renderRow}
          />
        )}
      </div>

      <Snackbar
        open={snack.open}
        autoHideDuration={2600}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.type}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}
