/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';
import SubrubroAccionesMenu from './SubrubroAccionesMenu';
import ArticuloAccionesMenu from './ArticuloAccionesMenu';
import VentasCell from './VentasCell';
import { ensureTodo, getExclusiones } from '../servicios/apiAgrupacionesTodo';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import '../css/TablaArticulos.css';

const clean = (s) => String(s ?? '').trim();
const isSin = (s) => {
  const v = clean(s).toLowerCase();
  return v === '' || v === 'sin categoría' || v === 'sin categoria' || v === 'sin subrubro';
};
const prefer = (...vals) => {
  for (const v of vals) {
    if (!isSin(v)) return clean(v);
  }
  return clean(vals[0] ?? '');
};
const getDisplayCategoria = (a) =>
  prefer(a?.categoria, a?.raw?.categoria, a?.raw?.raw?.categoria);
const getDisplaySubrubro = (a) =>
  prefer(a?.subrubro, a?.raw?.subrubro, a?.raw?.raw?.subrubro);

const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);
const num = (v) => Number(v ?? 0);
const fmt = (v, d = 0) =>
  Number(v ?? 0).toLocaleString('es-AR', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

const esTodoGroup = (g, todoGroupId) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return g?.id === todoGroupId || n === 'TODO' || n === 'SIN AGRUPACIÓN' || n === 'SIN AGRUPACION';
};
const tipoDesdeRubro = (rubro = '') =>
  rubro.toUpperCase().includes('BEBIDA') ? 'Bebida' : 'Comida';

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
}) {
  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

  const [categorias, setCategorias] = useState([]);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });
  const openSnack = (msg, type = 'success') => setSnack({ open: true, msg, type });
  const loadReqId = useRef(0);

  // ✅ fuerza refetch “en vivo” sin F5
  const [reloadTick, setReloadTick] = useState(0);
  const refetchLocal = async () => {
    // eslint-disable-next-line no-empty
    try { await refetchAgrupaciones?.(); } catch { }
    setReloadTick((t) => t * 1); // re-consulta articlesTree
  };

  const [agrupSelView, setAgrupSelView] = useState(agrupacionSeleccionada);
  useEffect(() => { setAgrupSelView(agrupacionSeleccionada); }, [agrupacionSeleccionada]);

  const afterMutation = (removedIds = []) => {
    if (!agrupSelView?.id) { refetchLocal(); return; }
    const isTodo = esTodoGroup(agrupSelView, todoGroupId);
    if (isTodo) { refetchLocal(); return; }
    const rem = new Set(removedIds.map(Number));
    const actual = Array.isArray(agrupSelView.articulos) ? agrupSelView.articulos : [];
    const next = actual.filter(a => !rem.has(getId(a)));
    setAgrupSelView({ ...agrupSelView, articulos: next });
    refetchLocal();
  };

  // helper local para armar tree desde items planos
  function buildTreeFromFlat(items = []) {
    const flat = items
      .map(row => {
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
      })
      .filter(a => Number.isFinite(a.id));

    // subrubro → categorias → articulos
    const bySub = new Map(); // subrubro => Map(categoria => articulos[])
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
  }

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

        // 1) intento principal
        try {
          const { tree = [] } = await BusinessesAPI.articlesTree(bizId);
          if (!cancel && myId === loadReqId.current) {
            setCategorias(tree);
            onCategoriasLoaded?.(tree);
          }
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          // 2) fallback: plano → tree
          // eslint-disable-next-line no-useless-catch
          try {
            const { items = [] } = await BusinessesAPI.articlesFromDB(bizId);
            const tree = buildTreeFromFlat(items);
            if (!cancel && myId === loadReqId.current) {
              setCategorias(tree);
              onCategoriasLoaded?.(tree);
            }
            openSnack('Catálogo cargado por fallback', 'info');
          } catch (e2) {
            throw e2; // si también falla, mostramos error general abajo
          }
        }

        // TODO  exclusiones (como ya lo tenías)
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
  }, [activeBizId, reloadKey, reloadTick]);

  const allArticulos = useMemo(() => {
    const out = [];
    for (const sub of categorias || []) {
      const subrubroNombre =
        String(sub?.subrubro ?? sub?.nombre ?? 'Sin subrubro');
      for (const cat of sub?.categorias || []) {
        const categoriaNombre =
          String(cat?.categoria ?? cat?.nombre ?? 'Sin categoría');
        for (const a of cat?.articulos || []) {
          out.push({
            ...a,
            // si el artículo ya traía estos campos, respetamos; si no, heredamos del árbol
            subrubro: a?.subrubro ?? subrubroNombre,
            categoria: a?.categoria ?? categoriaNombre,
          });
        }
      }
    }
    return out;
  }, [categorias]);

  const baseById = useMemo(
    () => new Map(allArticulos.map((a) => [getId(a), a])),
    [allArticulos]
  );

  const idsEnOtras = useMemo(
    () =>
      new Set(
        (agrupaciones || [])
          .filter((g) => !esTodoGroup(g, todoGroupId))
          .flatMap((g) => (g.articulos || []).map(getId))
      ),
    [agrupaciones, todoGroupId]
  );

  const idsSinAgrup = useMemo(
    () =>
      new Set(
        allArticulos
          .map(getId)
          .filter((id) => !idsEnOtras.has(id) && !excludedIds.has(id))
      ),
    [allArticulos, idsEnOtras, excludedIds]
  );

  // Filtro principal
  let articulosAMostrar = [];
  if (categoriaSeleccionada && agrupSelView) {
    const idsFiltro = esTodoGroup(agrupacionSeleccionada, todoGroupId)
      ? idsSinAgrup
      : new Set((agrupacionSeleccionada.articulos || []).map(getId));
    articulosAMostrar = (categoriaSeleccionada.categorias || [])
      .flatMap((c) => c.articulos || [])
      .filter((a) => idsFiltro.has(getId(a)));
  } else if (categoriaSeleccionada) {
    articulosAMostrar = (categoriaSeleccionada.categorias || []).flatMap(
      (c) => c.articulos || []
    );
  } else if (agrupSelView) {
    const esTodo = esTodoGroup(agrupSelView, todoGroupId);
    const arr = Array.isArray(agrupSelView.articulos) ? agrupSelView.articulos : [];
    if (esTodo && arr.length === 0) {
      const enOtras = new Set(
        (agrupaciones || [])
          .filter((g) => !esTodoGroup(g, todoGroupId))
          .flatMap((g) => (g.articulos || []).map(getId))
      );
      articulosAMostrar = allArticulos.filter(
        (a) => !enOtras.has(getId(a)) && !excludedIds.has(getId(a))
      );
    } else if (arr.length > 0) {
      articulosAMostrar = arr.map((a) => {
        const id = getId(a);
        const b = baseById.get(id) || {};
        return {
          ...b,
          ...a,
          id,
          nombre: a.nombre ?? b.nombre ?? `#${id}`,
          categoria: a.categoria ?? b.categoria ?? 'Sin categoría',
          subrubro: a.subrubro ?? b.subrubro ?? 'Sin subrubro',
          precio: num(a.precio ?? b.precio),
          costo: num(a.costo ?? b.costo),
        };
      });
    } else {
      articulosAMostrar = allArticulos;
    }
  } else {
    articulosAMostrar = allArticulos;
  }

  // Buscador
  const articulosFiltrados = filtroBusqueda
    ? articulosAMostrar.filter(
      (a) =>
        (a.nombre || '')
          .toLowerCase()
          .includes(String(filtroBusqueda).toLowerCase()) ||
        String(getId(a)).includes(String(filtroBusqueda).trim())
    )
    : articulosAMostrar;

  // Reportar ids visibles
  useEffect(() => {
    const ids = new Set(articulosFiltrados.map(getId));
    onIdsVisibleChange?.(ids);
  }, [onIdsVisibleChange, articulosFiltrados]);

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

  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (k) => {
    if (sortBy === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(k);
      setSortDir('asc');
    }
  };
  const getSortValue = (a) => {
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
  };
  const cmp = (a, b) => {
    if (!sortBy) return 0;
    const va = getSortValue(a), vb = getSortValue(b);
    if (typeof va === 'string' || typeof vb === 'string') {
      const r = String(va ?? '').localeCompare(String(vb ?? ''), 'es', { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? r : -r;
    }
    const na = Number(va ?? 0), nb = Number(vb ?? 0);
    return sortDir === 'asc' ? na - nb : nb - na;
  };

  const isTodo = agrupSelView ? esTodoGroup(agrupSelView, todoGroupId) : false;

  // Estilos mínimos
  const thStickyTop = {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#fff',
    userSelect: 'none',
  };
  const tdNum = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
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

  return (
    <div className="tabla-articulos-container">
      <div className="tabla-content">
        {bloques.size === 0 ? (
          <p style={{ marginTop: '2rem', fontSize: '1.2rem', color: '#777' }}>
            Cargando artículos.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort('codigo')} style={thStickyTop}>
                  Código {sortBy === 'codigo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('nombre')} style={thStickyTop}>
                  Nombre {sortBy === 'nombre' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={thStickyTop}>
                  Ventas {ventasLoading ? '…' : ''}
                </th>
                <th onClick={() => toggleSort('precio')} style={{ ...thStickyTop, ...tdNum }}>
                  Precio {sortBy === 'precio' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('costo')} style={{ ...thStickyTop, ...tdNum }}>
                  Costo ($) {sortBy === 'costo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('costoPct')} style={{ ...thStickyTop, ...tdNum }}>
                  Costo (%) {sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('objetivo')} style={{ ...thStickyTop, ...tdNum }}>
                  Objetivo (%) {sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('sugerido')} style={{ ...thStickyTop, ...tdNum }}>
                  Sugerido ($) {sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('manual')} style={{ ...thStickyTop, ...tdNum }}>
                  Manual ($) {sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...thStickyTop, width: 64, textAlign: 'center' }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {bloques.map((blq) => (
                <React.Fragment key={`cat:${blq.categoria}`}>
                  {blq.subrubros.map((par) => {
                    const headerCat = blq.categoria || 'Sin categoría';
                    const headerSr = par.subrubro || 'Sin subrubro';
                    const artsOrdenados = par.arts.slice().sort(cmp);
                    const articuloIdsDeLaPareja = artsOrdenados.map(getId);
                    return (
                      <React.Fragment key={`cat:${headerCat}|sr:${headerSr}`}>
                        <tr className="pair-header-row">
                          <td colSpan={10}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <strong>{headerCat} - {headerSr}</strong>
                              <SubrubroAccionesMenu
                                isTodo={isTodo}
                                agrupaciones={agrupaciones}
                                agrupacionSeleccionada={agrupacionSeleccionada}
                                todoGroupId={todoGroupId}
                                articuloIds={articuloIdsDeLaPareja}
                                onRefetch={refetchLocal}
                                onAfterMutation={afterMutation}
                                notify={(m, t = 'success') => openSnack(m, t)}
                                categoriaSeleccionada={{ subrubro: headerSr }}
                              />
                            </div>
                          </td>
                        </tr>
                        {artsOrdenados.map((a) => {
                          const id = getId(a);
                          const artHydrated = { ...a, id, precio: num(a.precio), costo: num(a.costo) };
                          return (
                            <tr key={`row:${headerCat}|${headerSr}|${id}`}>
                              <td>{id}</td>
                              <td>{a.nombre}</td>
                              <td>
                                <VentasCell
                                  articuloId={id}
                                  articuloNombre={a.nombre}
                                  from={fechaDesde}
                                  to={fechaHasta}
                                  defaultGroupBy="day"
                                  totalOverride={ventasPorArticulo?.get(id)}
                                />
                              </td>
                              <td style={tdNum}>${fmt(a.precio, 0)}</td>
                              <td style={tdNum}>${fmt(a.costo, 0)}</td>
                              <td style={tdNum}>{calcularCostoPct(a)}%</td>
                              <td style={tdNum}>
                                <input
                                  type="number"
                                  value={objetivos[id] || ''}
                                  onChange={(e) => setObjetivos({ ...objetivos, [id]: e.target.value })}
                                  style={{ width: 64 }}
                                />
                              </td>
                              <td style={tdNum}>${fmt(calcularSugerido(a), 2)}</td>
                              <td style={tdNum}>
                                <input
                                  type="number"
                                  value={manuales[id] || ''}
                                  onChange={(e) => setManuales({ ...manuales, [id]: e.target.value })}
                                  style={{ width: 84 }}
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <ArticuloAccionesMenu
                                  articulo={artHydrated}
                                  agrupaciones={agrupaciones}
                                  agrupacionSeleccionada={agrupacionSeleccionada}
                                  todoGroupId={todoGroupId}
                                  isTodo={isTodo}
                                  onRefetch={refetchLocal}
                                  onAfterMutation={afterMutation}
                                  notify={(m, t) => openSnack(m, t)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
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
