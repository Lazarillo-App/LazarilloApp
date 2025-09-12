// src/componentes/TablaArticulos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Snackbar, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

import Buscador from './Buscador';
import SubrubroAccionesMenu from './SubrubroAccionesMenu';
import ArticuloAccionesMenu from './ArticuloAccionesMenu';
import VentasCell from './VentasCell';

import '../css/TablaArticulos.css';

import { ensureTodo, getExclusiones } from '../servicios/apiAgrupacionesTodo';
import { BusinessesAPI } from '../servicios/apiBusinesses';

/* ---------- helpers ---------- */
const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);
const num = (v) => Number(v ?? 0);
const fmt = (v, decimals = 0) =>
  Number(v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// “TODO / Sin agrupación”
const esTodoGroup = (g, todoGroupId) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return g?.id === todoGroupId || n === 'TODO' || n === 'SIN AGRUPACIÓN' || n === 'SIN AGRUPACION';
};
const labelAgrup = (g) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return n === 'TODO' ? 'Sin Agrupación' : (g?.nombre || '');
};

// Deducimos “tipo” visual desde el rubro (como en lazarillo.com.ar)
const tipoDesdeRubro = (rubroNombre = '') =>
  rubroNombre.toUpperCase().includes('BEBIDA') ? 'Bebida' : 'Comida';

// Construye árbol Rubro → Subrubro → artículos desde nuestra BD
function buildCategoriasFromDB(items = []) {
  const norm = items.map(row => {
    const raw = row?.raw || {};
    const id  = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
    return {
      id,
      nombre   : String(row?.nombre    ?? raw?.nombre      ?? raw?.descripcion      ?? `#${id}`).trim(),
      categoria: String(row?.categoria ?? raw?.categoria   ?? raw?.rubro            ?? 'Sin categoría').trim() || 'Sin categoría',
      subrubro : String(row?.subrubro  ?? raw?.subrubro    ?? raw?.subRubro         ?? 'Sin subrubro').trim()  || 'Sin subrubro',
      precio   : Number(row?.precio    ?? raw?.precio      ?? raw?.precioVenta      ?? raw?.importe ?? 0),
      costo    : Number(row?.costo     ?? raw?.costo       ?? raw?.costoPromedio    ?? 0),
    };
  }).filter(a => Number.isFinite(a.id));

  const byCat = new Map();
  for (const a of norm) {
    if (!byCat.has(a.categoria)) byCat.set(a.categoria, new Map());
    const bySr = byCat.get(a.categoria);
    if (!bySr.has(a.subrubro)) bySr.set(a.subrubro, []);
    bySr.get(a.subrubro).push(a);
  }

  return Array.from(byCat, ([catNombre, bySr]) => ({
    id: catNombre,
    nombre: catNombre,
    subrubros: Array.from(bySr, ([srNombre, articulos]) => ({
      nombre: srNombre,
      articulos,
    })),
  }));
}

/* ---------- componente ---------- */
export default function TablaArticulos({
  filtroBusqueda, setFiltroBusqueda,
  agrupacionSeleccionada, setAgrupacionSeleccionada,
  agrupaciones = [],
  categoriaSeleccionada, setCategoriaSeleccionada,
  refetchAgrupaciones,

  fechaDesdeProp,
  fechaHastaProp,
  calendarSlot,

  ventasPorArticulo,
  ventasLoading,
}) {
  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

  const [categorias, setCategorias] = useState([]);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });
  const openSnack = (msg, type = 'success') => setSnack({ open: true, msg, type });

  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});

  // Cargar catálogo desde BD + exclusiones del grupo TODO
  useEffect(() => {
    (async () => {
      try {
        const bizId = localStorage.getItem('activeBusinessId');
        if (!bizId) { setCategorias([]); openSnack('No hay negocio activo', 'warning'); return; }

        const { items = [] } = await BusinessesAPI.articlesFromDB(bizId);
        setCategorias(buildCategoriasFromDB(items));

        try {
          const todo = await ensureTodo();
          if (todo?.id) {
            setTodoGroupId(todo.id);
            const ex = await getExclusiones(todo.id);
            const ids = (ex || [])
              .filter(e => e.scope === 'articulo')
              .map(e => Number(e.ref_id))
              .filter(Boolean);
            setExcludedIds(new Set(ids));
          }
        } catch { setExcludedIds(new Set()); }
      } catch (e) {
        console.error('TablaArticulos: cargar BD', e);
        openSnack('No se pudieron cargar los artículos desde la base', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allArticulos = useMemo(
    () => categorias.flatMap(c => c.subrubros.flatMap(s => s.articulos)),
    [categorias]
  );
  const baseById = useMemo(() => new Map(allArticulos.map(a => [getId(a), a])), [allArticulos]);
  const categoriasByNombre = useMemo(() => new Map(categorias.map(c => [c.nombre, c])), [categorias]);

  const idsEnOtras = useMemo(() => new Set(
    (agrupaciones || [])
      .filter(g => !esTodoGroup(g, todoGroupId))
      .flatMap(g => (g.articulos || []).map(getId))
  ), [agrupaciones, todoGroupId]);

  const idsSinAgrup = useMemo(() => new Set(
    allArticulos.map(getId).filter(id => !idsEnOtras.has(id) && !excludedIds.has(id))
  ), [allArticulos, idsEnOtras, excludedIds]);

  // Qué mostrar
  let articulosAMostrar = [];
  if (categoriaSeleccionada && agrupacionSeleccionada) {
    const idsFiltro = esTodoGroup(agrupacionSeleccionada, todoGroupId)
      ? idsSinAgrup
      : new Set((agrupacionSeleccionada.articulos || []).map(getId));
    articulosAMostrar = categoriaSeleccionada.subrubros.flatMap(s => s.articulos).filter(a => idsFiltro.has(getId(a)));
  } else if (categoriaSeleccionada) {
    articulosAMostrar = categoriaSeleccionada.subrubros.flatMap(s => s.articulos);
  } else if (agrupacionSeleccionada) {
    const esTodo = esTodoGroup(agrupacionSeleccionada, todoGroupId);
    const arr = Array.isArray(agrupacionSeleccionada.articulos) ? agrupacionSeleccionada.articulos : [];
    if (esTodo && arr.length === 0) {
      const enOtras = new Set(
        (agrupaciones || [])
          .filter(g => !esTodoGroup(g, todoGroupId))
          .flatMap(g => (g.articulos || []).map(getId))
      );
      articulosAMostrar = allArticulos.filter(a => {
        const id = getId(a);
        return !enOtras.has(id) && !excludedIds.has(id);
      });
    } else if (arr.length > 0) {
      articulosAMostrar = arr.map(a => {
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
    } else {
      articulosAMostrar = allArticulos;
    }
  } else {
    articulosAMostrar = allArticulos;
  }

  // Buscador
  const articulosFiltrados = filtroBusqueda
    ? articulosAMostrar.filter((art) =>
        (art.nombre || '').toLowerCase().includes(String(filtroBusqueda).toLowerCase()) ||
        String(getId(art)).includes(String(filtroBusqueda).trim())
      )
    : articulosAMostrar;

  const sugerencias = useMemo(() => {
    const uniq = new Map();
    for (const a of articulosAMostrar) {
      const id = getId(a);
      const etiqueta = `${id} — ${a.nombre ?? ""}`.trim();
      if (!uniq.has(id)) uniq.set(id, { id, label: etiqueta, value: a.nombre ?? String(id) });
    }
    return Array.from(uniq.values()).slice(0, 300);
  }, [articulosAMostrar]);

  // Agrupar Rubro → Subrubro
  const agruparPorRubroYSubrubro = (arts) => {
    const out = {};
    for (const a of arts) {
      const rubro = String(a.categoria || 'Sin categoría');
      const sr = String(a.subrubro || 'Sin subrubro');
      if (!out[rubro]) out[rubro] = {};
      if (!out[rubro][sr]) out[rubro][sr] = [];
      out[rubro][sr].push(a);
    }
    return out;
  };
  const articulosAgrupados = useMemo(
    () => agruparPorRubroYSubrubro(articulosFiltrados),
    [articulosFiltrados]
  );

  // Orden local
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };
  const getSortValue = (art) => {
    const id = getId(art);
    switch (sortBy) {
      case 'codigo': return id;
      case 'nombre': return art?.nombre ?? '';
      case 'precio': return num(art?.precio);
      case 'costo':  return num(art?.costo);
      case 'costoPct': {
        const p = num(art?.precio), c = num(art?.costo);
        return p > 0 ? (c / p) * 100 : -Infinity;
      }
      case 'objetivo': return num(objetivos[id]) || 0;
      case 'sugerido': {
        const objetivo = num(objetivos[id]) || 0;
        const costo = num(art?.costo);
        const den = 100 - objetivo;
        return den > 0 ? costo * (100 / den) : Infinity;
      }
      case 'manual': return num(manuales[id]) || 0;
      default: return null;
    }
  };
  const cmp = (a, b) => {
    if (!sortBy) return 0;
    const va = getSortValue(a);
    const vb = getSortValue(b);

    if (typeof va === 'string' || typeof vb === 'string') {
      const r = String(va ?? '').localeCompare(String(vb ?? ''), 'es', { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? r : -r;
    }
    const na = Number(va ?? 0), nb = Number(vb ?? 0);
    if (na < nb) return sortDir === 'asc' ? -1 : 1;
    if (na > nb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  };

  const showAcciones = true;
  const isTodo = agrupacionSeleccionada ? esTodoGroup(agrupacionSeleccionada, todoGroupId) : false;

  const thStickyTop = { position: 'sticky', top: 0, zIndex: 2, background: '#fff', cursor: 'pointer', userSelect: 'none' };
  const tdNum = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

  const handleAgrupacionChange = (event) => {
    const value = event.target.value; // '' | id
    if (value === '') {
      setAgrupacionSeleccionada?.(null);
      setFiltroBusqueda?.('');
    } else {
      const idSel = Number(value);
      const seleccionada = (agrupaciones || []).find(a => Number(a?.id) === idSel) || null;
      setAgrupacionSeleccionada?.(seleccionada);
      setFiltroBusqueda?.('');
    }
    setCategoriaSeleccionada?.(null);
  };

  const calcularCostoPorcentaje = (art) => {
    const p = num(art.precio);
    const c = num(art.costo);
    return p > 0 ? ((c / p) * 100).toFixed(2) : 0;
  };
  const calcularSugerido = (art) => {
    const objetivo = num(objetivos[getId(art)]) || 0;
    const costo = num(art.costo);
    const den = 100 - objetivo;
    return den > 0 ? costo * (100 / den) : 0;
  };

  return (
    <div className="tabla-articulos-container">
      <div className="tabla-content">
        <h2>Gestión de Artículos</h2>

        <div className='filtros-container' style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {calendarSlot || null}
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Buscador
              value={filtroBusqueda}
              setFiltroBusqueda={setFiltroBusqueda}
              opciones={sugerencias}
              placeholder="Buscar por código o nombre…"
            />
          </div>
        </div>

        {Object.keys(articulosAgrupados).length === 0 ? (
          <p style={{ marginTop: '2rem', fontSize: '1.2rem', color: '#777' }}>
            No hay artículos para mostrar.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                {/* “sidebar” integrado: selector de agrupaciones */}
                <th className="sticky-left" style={{ ...thStickyTop, minWidth: 260 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Agrupaciones</InputLabel>
                    <Select
                      label="Agrupaciones"
                      value={agrupacionSeleccionada ? Number(agrupacionSeleccionada.id) : ''}
                      onChange={handleAgrupacionChange}
                    >
                      <MenuItem value="">Ver todas</MenuItem>
                      {(agrupaciones || []).map((g) => (
                        <MenuItem key={g.id} value={Number(g.id)}>
                          {labelAgrup(g)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </th>

                <th onClick={() => toggleSort('codigo')} style={thStickyTop}>Código {sortBy === 'codigo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('nombre')} style={thStickyTop}>Nombre {sortBy === 'nombre' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={thStickyTop}>Ventas {ventasLoading ? '…' : ''}</th>
                <th onClick={() => toggleSort('precio')} style={{ ...thStickyTop, ...tdNum }}>Precio {sortBy === 'precio' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('costo')} style={{ ...thStickyTop, ...tdNum }}>Costo ($) {sortBy === 'costo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('costoPct')} style={{ ...thStickyTop, ...tdNum }}>Costo (%) {sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('objetivo')} style={{ ...thStickyTop, ...tdNum }}>Objetivo (%) {sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('sugerido')} style={{ ...thStickyTop, ...tdNum }}>Sugerido ($) {sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('manual')} style={{ ...thStickyTop, ...tdNum }}>Manual ($) {sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ ...thStickyTop, width: 64, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {Object.keys(articulosAgrupados).map((rubro) => (
                <React.Fragment key={rubro}>
                  {Object.keys(articulosAgrupados[rubro]).map((subrubro) => {
                    const itemsSubrubro = [...articulosAgrupados[rubro][subrubro]];
                    const articuloIdsSubrubro = itemsSubrubro.map(a => getId(a));

                    const handleClickCategoria = () => {
                      const catObj = categoriasByNombre.get(rubro) || null;
                      setCategoriaSeleccionada?.((prev) => prev?.id === catObj?.id ? null : catObj);
                      setFiltroBusqueda?.('');
                    };

                    // 🔹 etiqueta EXACTA como en tu captura: SUBRUBRO – Tipo (Bebida/Comida)
                    const headingLabel = `${subrubro} - ${tipoDesdeRubro(rubro)}`;

                    return (
                      <React.Fragment key={`${rubro}|${subrubro}`}>
                        {/* Fila encabezado de Subrubro */}
                        <tr className="rubro-row">
                          <td className="sticky-left categoria-cell">
                            <button
                              className="categoria-badge"
                              onClick={handleClickCategoria}
                              title="Filtrar por categoría"
                            >
                              {rubro}
                            </button>
                          </td>

                          <td colSpan={10}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <strong style={{ textTransform: 'uppercase' }}>{headingLabel}</strong>

                              <SubrubroAccionesMenu
                                isTodo={isTodo}
                                agrupaciones={agrupaciones}
                                agrupacionSeleccionada={agrupacionSeleccionada}
                                todoGroupId={todoGroupId}
                                articuloIds={articuloIdsSubrubro}
                                onRefetch={refetchAgrupaciones}
                                notify={(m, t = 'success') => openSnack(m, t)}
                              />
                            </div>
                          </td>
                        </tr>

                        {itemsSubrubro.sort(cmp).map((articulo) => {
                          const id = getId(articulo);
                          const artHydrated = {
                            ...articulo,
                            id,
                            nombre: articulo.nombre,
                            categoria: articulo.categoria,
                            subrubro: articulo.subrubro,
                            precio: num(articulo.precio),
                            costo: num(articulo.costo),
                          };

                          return (
                            <tr key={id}>
                              {/* celda “sidebar” vacía para alinear */}
                              <td className="sticky-left" />
                              <td>{id}</td>
                              <td>{articulo.nombre}</td>
                              <td>
                                <VentasCell
                                  articuloId={id}
                                  articuloNombre={articulo.nombre}
                                  from={fechaDesde}
                                  to={fechaHasta}
                                  defaultGroupBy="day"
                                  totalOverride={ventasPorArticulo?.get(Number(id))}
                                />
                              </td>
                              <td style={tdNum}>${fmt(articulo.precio, 0)}</td>
                              <td style={tdNum}>${fmt(articulo.costo, 0)}</td>
                              <td style={tdNum}>{(calcularCostoPorcentaje(articulo))}%</td>
                              <td style={tdNum}>
                                <input
                                  type="number"
                                  value={objetivos[id] || ''}
                                  onChange={(e) => setObjetivos({ ...objetivos, [id]: e.target.value })}
                                  style={{ width: '64px' }}
                                />
                              </td>
                              <td style={tdNum}>${fmt(calcularSugerido(articulo), 2)}</td>
                              <td style={tdNum}>
                                <input
                                  type="number"
                                  value={manuales[id] || ''}
                                  onChange={(e) => setManuales({ ...manuales, [id]: e.target.value })}
                                  style={{ width: '84px' }}
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <ArticuloAccionesMenu
                                  articulo={artHydrated}
                                  agrupaciones={agrupaciones}
                                  agrupacionSeleccionada={agrupacionSeleccionada}
                                  todoGroupId={todoGroupId}
                                  isTodo={isTodo}
                                  onRefetch={refetchAgrupaciones}
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
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.type} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}
