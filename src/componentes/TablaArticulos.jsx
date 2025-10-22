/* eslint-disable no-empty */
/* eslint-disable no-useless-catch */
/* eslint-disable no-unused-vars */
import React, {
  useEffect, useMemo, useRef, useState, useCallback, useDeferredValue,
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

const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);
const num = (v) => Number(v ?? 0);
const fmt = (v, d = 0) => Number(v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const esTodoGroup = (g, todoGroupId) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return g?.id === todoGroupId || n === 'TODO' || n === 'SIN AGRUPACIÓN' || n === 'SIN AGRUPACION';
};

/* ---------------- VirtualList simple (sin librerías) ---------------- */
function VirtualList({
  rows = [],
  rowHeight = 44,
  height = 400,
  overscan = 6,
  onVisibleItemsIds,          // (ids:number[]) => void
  renderRow,                  // ({ row, index, style }) => JSX
  getRowId,                   // (row) => number | null
}) {
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

  // reportar ids visibles (solo items), SIN depender de `rows` para evitar loops
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

  return (
    <div
      ref={scrollRef}
      style={{ height, overflow: 'auto', position: 'relative', willChange: 'transform' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleRows.map((row, i) =>
            renderRow({
              row,
              index: startIdx + i,
              style: { height: rowHeight, display: 'block', color: '#373737ff', fontWeight: '500', fontSize: '0.95rem' },
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- componente principal ---------------- */
export default function TablaArticulos({
  filtroBusqueda = '',
  agrupacionSeleccionada,
  agrupaciones = [],
  categoriaSeleccionada,
  refetchAgrupaciones,
  fechaDesdeProp,
  fechaHastaProp,
  ventasPorArticulo,
  ventasLoading,
  onCategoriasLoaded,
  onIdsVisibleChange,
  activeBizId,
  reloadKey = 0,
  onTodoInfo,
  onTotalResolved,
  onGroupCreated,
  visibleIds,
  onMutateGroups
}) {
  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

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

  // refetch sin F5
  const [reloadTick, setReloadTick] = useState(0);
  const refetchLocal = useCallback(async () => {
    try { await refetchAgrupaciones?.(); } catch { }
    setReloadTick((t) => t + 1);
  }, [refetchAgrupaciones]);

  const [agrupSelView, setAgrupSelView] = useState(agrupacionSeleccionada);
  useEffect(() => { setAgrupSelView(agrupacionSeleccionada); }, [agrupacionSeleccionada]);

  // Recibe por props: onMutateGroups (definido en ArticulosMain)
  const afterMutation = useCallback((removedIds) => {
    const ids = (removedIds || []).map(Number).filter(Number.isFinite);
    if (!ids.length) { refetchLocal(); return; }
    if (!agrupSelView?.id) { refetchLocal(); return; }
    const isTodo = esTodoGroup(agrupSelView, todoGroupId);
    if (isTodo) { refetchLocal(); return; }

    // ✅ mutación optimista centralizada
    onMutateGroups?.({
      type: 'remove',
      groupId: Number(agrupSelView.id),
      ids
    });

    // opcional: ping al backend sin bloquear
    refetchLocal();
  }, [agrupSelView, todoGroupId, onMutateGroups, refetchLocal]);


  // build tree desde plano
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
    const myId = ++loadReqId.current;

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


  const idsEnOtras = useMemo(() => new Set(
    (agrupaciones || [])
      .filter((g) => !esTodoGroup(g, todoGroupId))
      .flatMap((g) => (g.articulos || []).map(getId))
  ), [agrupaciones, todoGroupId]);

  const idsSinAgrup = useMemo(() => {
    const s = new Set();
    for (const id of allArticulos.map(getId)) {
      if (!idsEnOtras.has(id) && !excludedIds.has(id)) s.add(id);
    }
    return s;  // 👈 Set
  }, [allArticulos, idsEnOtras, excludedIds]);

  useEffect(() => {
    onTodoInfo?.({ todoGroupId, idsSinAgrupCount: idsSinAgrup.size });
  }, [onTodoInfo, todoGroupId, idsSinAgrup.size]);

  /* --------- a mostrar + filtro --------- */
  const articulosAMostrar = useMemo(() => {
    if (categoriaSeleccionada && agrupacionSeleccionada) {
      const idsFiltro = esTodoGroup(agrupacionSeleccionada, todoGroupId)
        ? idsSinAgrup
        : new Set((agrupacionSeleccionada.articulos || []).map(getId));
      return (categoriaSeleccionada.categorias || [])
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
        })).filter((a) => idsFiltro.has(getId(a)));
    }

    if (categoriaSeleccionada) {
      return (categoriaSeleccionada.categorias || [])
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

    if (agrupSelView) {
      const esTodo = esTodoGroup(agrupSelView, todoGroupId);
      const arr = Array.isArray(agrupSelView.articulos) ? agrupSelView.articulos : [];
      if (esTodo && arr.length === 0) {
        return allArticulos.filter((a) => idsSinAgrup.has(getId(a)));
      }
      if (arr.length > 0) {
        return arr.map((a) => {
          const id = getId(a);
          const b = baseById.get(id) || {};
          return {
            ...b, ...a, id,
            nombre: a.nombre ?? b.nombre ?? `#${id}`,
            categoria: a.categoria ?? b.categoria ?? 'Sin categoría',
            subrubro: a.subrubro ?? b.subrubro ?? 'Sin subrubro',
            precio: num(a.precio ?? b.precio),
            costo: num(a.costo ?? b.costo),
          };
        });
      }
      return allArticulos;
    }

    return allArticulos;
  }, [
    categoriaSeleccionada, agrupSelView, agrupacionSeleccionada, todoGroupId,
    idsSinAgrup, baseById, agrupaciones, allArticulos, excludedIds
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

  /* --------- construcción de bloques y filas "planas" --------- */
  const bloques = useMemo(() => {
    const byCat = new Map();
    for (const a of articulosFiltrados) {
      const cat = getDisplayCategoria(a) || 'Sin categoría';
      const sr = getDisplaySubrubro(a) || 'Sin subrubro';
      if (!byCat.has(cat)) byCat.set(cat, new Map());
      const bySr = byCat.get(cat);
      if (!bySr.has(sr)) bySr.set(sr, []);
      bySr.get(sr).push(a);
    }
    return Array.from(byCat, ([categoria, mapSr]) => ({
      categoria,
      subrubros: Array.from(mapSr, ([subrubro, arts]) => ({ subrubro, arts })),
    }));
  }, [articulosFiltrados]);

  // ordenamiento
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = useCallback((k) => {
    setSortBy((prev) => {
      if (prev === k) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortDir('asc');
      return k;
    });
  }, []);
  const getSortValue = useCallback((a) => {
    const id = getId(a);
    switch (sortBy) {
      case 'codigo': return id;
      case 'nombre': return a?.nombre ?? '';
      case 'precio': return num(a?.precio);
      case 'costo': return num(a?.costo);
      case 'costoPct': {
        const p = num(a?.precio), c = num(a?.costo);
        return p > 0 ? (c / p) * 100 : -Infinity;
      }
      case 'objetivo': return num(objetivos[id]) || 0;
      case 'sugerido': {
        const obj = num(objetivos[id]) || 0;
        const c = num(a?.costo);
        const den = 100 - obj;
        return den > 0 ? c * (100 / den) : Infinity;
      }
      case 'manual': return num(manuales[id]) || 0;
      default: return null;
    }
  }, [sortBy, objetivos, manuales]);
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

  // filas planas: headers + items
  const flatRows = useMemo(() => {
    const rows = [];
    for (const blq of bloques) {
      for (const sr of blq.subrubros) {
        const artsOrdenados = sr.arts.slice().sort(cmp);
        rows.push({
          kind: 'header',
          key: `H|${blq.categoria}|${sr.subrubro}`,
          categoria: blq.categoria,
          subrubro: sr.subrubro,
          ids: artsOrdenados.map(getId),
        });
        for (const a of artsOrdenados) {
          const id = getId(a);
          rows.push({
            kind: 'item',
            key: `I|${blq.categoria}|${sr.subrubro}|${id}`,
            categoria: blq.categoria,
            subrubro: sr.subrubro,
            art: { ...a, id, precio: num(a.precio), costo: num(a.costo) },
          });
        }
      }
    }
    return rows;
  }, [bloques, cmp]);

  const ventasMapFiltrado = useMemo(() => {
    if (!filterIds) return ventasPorArticulo || new Map();
    const out = new Map();
    (ventasPorArticulo || new Map()).forEach((v, k) => {
      if (filterIds.has(Number(k))) out.set(Number(k), v);
    });
    return out;
  }, [ventasPorArticulo, filterIds]);

  // ====== layout tipo “tabla” con CSS grid
  const gridTemplate = '120px 1fr 110px 110px 110px 110px 110px 120px 110px 80px';

  const cellNum = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const ITEM_H = 44;

  const isTodo = agrupSelView ? esTodoGroup(agrupSelView, todoGroupId) : false;

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
      const headerCat = row.categoria || 'Sin categoría';
      const headerSr = row.subrubro || 'Sin subrubro';
      return (
        <div key={row.key} style={{ ...style, display: 'grid', gridTemplateColumns: gridTemplate, alignItems: 'center', background: '#fafafa', fontWeight: 600, borderTop: '1px solid #eee', padding: '4px 8px' }}>
          <div style={{ gridColumn: '1 / -2' }}>{headerCat} - {headerSr}</div>
          <div style={{ gridColumn: '-2 / -1', justifySelf: 'end' }}>
            <SubrubroAccionesMenu
              onMutateGroups={onMutateGroups}
              baseById={baseById}
              isTodo={isTodo}
              agrupaciones={agrupaciones}
              agrupacionSeleccionada={agrupacionSeleccionada}
              todoGroupId={todoGroupId}
              articuloIds={row.ids}
              onRefetch={refetchLocal}
              onAfterMutation={(ids) => afterMutation(ids)}
              notify={(m, t = 'success') => openSnack(m, t)}
              categoriaSeleccionada={{ subrubro: headerSr }}
              onGroupCreated={onGroupCreated}
            />
          </div>
        </div>
      );
    }

    // item
    const a = row.art;
    const id = a.id;
    return (
      <div key={row.key} style={{ ...style, display: 'grid', gridTemplateColumns: gridTemplate, alignItems: 'center', borderTop: '1px dashed #f0f0f0', padding: '4px 8px' }}>
        <div>{id}</div>
        <div>{a.nombre}</div>
        <div>
          <VentasCell
            articuloId={id}
            articuloNombre={a.nombre}
            from={fechaDesde}
            to={fechaHasta}
            defaultGroupBy="day"
            totalOverride={ventasPorArticulo?.get(id)}
            onTotalResolved={onTotalResolved}
          />
        </div>
        <div style={cellNum}>${fmt(a.precio, 0)}</div>
        <div style={cellNum}>${fmt(a.costo, 0)}</div>
        <div style={cellNum}>{calcularCostoPct(a)}%</div>
        <div style={cellNum}>
          <input
            type="number"
            value={objetivos[id] || ''}
            onChange={(e) => setObjetivos((s) => ({ ...s, [id]: e.target.value }))}
            style={{ width: 64 }}
          />
        </div>
        <div style={cellNum}>${fmt(calcularSugerido(a), 2)}</div>
        <div style={cellNum}>
          <input
            type="number"
            value={manuales[id] || ''}
            onChange={(e) => setManuales((s) => ({ ...s, [id]: e.target.value }))}
            style={{ width: 84 }}
          />
        </div>
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
          />
        </div>
      </div>
    );
  };

  // ids visibles (solo items) — estable y sin loops
  const handleVisibleIds = useCallback((ids) => {
    onIdsVisibleChange?.(new Set(ids));
  }, [onIdsVisibleChange]);

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
            <div>Ventas {ventasLoading ? '…' : ''}</div>
            <div onClick={() => toggleSort('precio')} style={{ cursor: 'pointer', textAlign: 'right' }}>
              Precio {sortBy === 'precio' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div onClick={() => toggleSort('costo')} style={{ cursor: 'pointer', textAlign: 'right' }}>
              Costo ($) {sortBy === 'costo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div onClick={() => toggleSort('costoPct')} style={{ cursor: 'pointer', textAlign: 'right' }}>
              Costo (%) {sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div onClick={() => toggleSort('objetivo')} style={{ cursor: 'pointer', textAlign: 'right' }}>
              Objetivo (%) {sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div onClick={() => toggleSort('sugerido')} style={{ cursor: 'pointer', textAlign: 'right' }}>
              Sugerido ($) {sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div onClick={() => toggleSort('manual')} style={{ cursor: 'pointer', textAlign: 'right' }}>
              Manual ($) {sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </div>
            <div style={{ textAlign: 'center' }}>Acciones</div>
          </div>
        </div>
        {flatRows.length === 0 ? (
          <p style={{ marginTop: '2rem', fontSize: '1.2rem', color: '#777', padding: '0 8px' }}>
            Cargando artículos.
          </p>
        ) : (
          <VirtualList
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
        <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.type} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}
