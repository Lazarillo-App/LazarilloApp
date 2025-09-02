// src/componentes/TablaArticulos.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import Buscador from './Buscador';
import SubrubroAccionesMenu from './SubrubroAccionesMenu';
import SidebarCategorias from './SidebarCategorias';
import ArticuloAccionesMenu from './ArticuloAccionesMenu';
import '../css/TablaArticulos.css';
import { Snackbar, Alert } from '@mui/material';
import { ensureTodo, getExclusiones } from '../servicios/apiAgrupacionesTodo.js';
import VentasCell from '../componentes/VentasCell';

// Helpers
const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);
const num = (v) => Number(v ?? 0);
const fmt = (v, decimals = 0) =>
  Number(v ?? 0).toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

const esTodoGroup = (g, todoGroupId) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return g?.id === todoGroupId || n === 'TODO' || n === 'SIN AGRUPACIÓN' || n === 'SIN AGRUPACION';
};

const TablaArticulos = ({
  filtroBusqueda, setFiltroBusqueda,
  agrupacionSeleccionada, setAgrupacionSeleccionada,
  agrupaciones, categoriaSeleccionada, setCategoriaSeleccionada,
  refetchAgrupaciones,

  // fechas (vienen del contenedor)
  fechaDesdeProp,
  fechaHastaProp,
  calendarSlot,

  // ventas pre-computadas por agrupación (opcional)
  ventasPorArticulo,   // Map<number, number>
  ventasLoading,
}) => {
  // Usamos las fechas provistas
  const fechaDesde = fechaDesdeProp;
  const fechaHasta = fechaHastaProp;

  const [categorias, setCategorias] = useState([]);
  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});

  // TODO + exclusiones (para “Sin Agrupación”)
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());

  // UI feedback
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });
  const openSnack = (msg, type = 'success') => setSnack({ open: true, msg, type });

  // Cargar artículos + exclusiones
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const token = await obtenerToken();
        const articulosData = await obtenerArticulos(token, fechaDesde, fechaHasta);

        const categoriasData = articulosData.map((categoria) => ({
          id: categoria.id,
          nombre: categoria.nombre,
          subrubros: categoria.subrubros.map(s => ({
            ...s,
            articulos: s.articulos.map(a => ({ ...a, id: getId(a) })),
          })),
        }));
        setCategorias(categoriasData);

        try {
          const todo = await ensureTodo();
          if (todo?.id) {
            setTodoGroupId(todo.id);
            const ex = await getExclusiones(todo.id);
            const ids = ex.filter(e => e.scope === 'articulo').map(e => Number(e.ref_id));
            setExcludedIds(new Set(ids));
          }
        } catch {
          setExcludedIds(new Set());
        }
      } catch (error) {
        console.error('Error al cargar los datos:', error);
        openSnack('No se pudieron cargar datos o exclusiones', 'error');
      }
    };
    cargarDatos();
  }, [fechaDesde, fechaHasta]);

  // Índice maestro por id
  const baseById = useMemo(() => {
    const list = categorias.flatMap(c => c.subrubros.flatMap(s => s.articulos));
    return new Map(list.map(a => [getId(a), a]));
  }, [categorias]);

  // Todos los artículos de Maxi
  const allMaxi = useMemo(
    () => categorias.flatMap(c => c.subrubros.flatMap(s => s.articulos)),
    [categorias]
  );

  // IDs asignados a agrupaciones reales (no TODO / Sin Agrupación)
  const idsEnOtras = useMemo(() => new Set(
    (agrupaciones || [])
      .filter(g => !esTodoGroup(g, todoGroupId))
      .flatMap(g => (g.articulos || []).map(getId))
  ), [agrupaciones, todoGroupId]);

  // IDs “libres” para Sin Agrupación (no asignados ni excluidos)
  const idsSinAgrup = useMemo(() => new Set(
    allMaxi.map(getId).filter(id => !idsEnOtras.has(id) && !excludedIds.has(id))
  ), [allMaxi, idsEnOtras, excludedIds]);

  // ✅ Set de IDs activos del grupo actual (SIEMPRE)
  const activeIdsGroup = useMemo(() => {
    if (!agrupacionSeleccionada) return null;
    return esTodoGroup(agrupacionSeleccionada, todoGroupId)
      ? idsSinAgrup
      : new Set((agrupacionSeleccionada.articulos || []).map(getId));
  }, [agrupacionSeleccionada, todoGroupId, idsSinAgrup]);

  // ------------------ Qué artículos mostrar ------------------
  let articulosAMostrar = [];

  if (categoriaSeleccionada && agrupacionSeleccionada) {
    // ✅ Si la agrupación es “Sin Agrupación”, usamos idsSinAgrup (libres).
    //    Si es una agrupación real, usamos sus propios artículos.
    const idsFiltro = esTodoGroup(agrupacionSeleccionada, todoGroupId)
      ? idsSinAgrup
      : new Set((agrupacionSeleccionada.articulos || []).map(getId));

    articulosAMostrar = categoriaSeleccionada.subrubros
      .flatMap(sub => sub.articulos)
      .filter(a => idsFiltro.has(getId(a)));
  } else if (categoriaSeleccionada) {
    articulosAMostrar = categoriaSeleccionada.subrubros.flatMap(sub => sub.articulos);

  } else if (agrupacionSeleccionada) {
    const esTodo = esTodoGroup(agrupacionSeleccionada, todoGroupId);

    if (esTodo) {
      const arr = Array.isArray(agrupacionSeleccionada.articulos) ? agrupacionSeleccionada.articulos : [];

      if (arr.length > 0) {
        articulosAMostrar = arr.map(a => {
          const id = getId(a);
          const b = baseById.get(id) || {};
          return {
            ...b,
            ...a,
            id,
            nombre: a.nombre ?? b.nombre ?? `#${id}`,
            categoria: a.categoria ?? b.categoria ?? "Sin categoría",
            subrubro: a.subrubro ?? b.subrubro ?? "Sin subrubro",
            precio: num(a.precio ?? b.precio),
            costo: num(a.costo ?? b.costo),
          };
        });
      } else {
        // Fallback: “libres” (no están en otras agrupaciones ni excluidos)
        const all = categorias.flatMap(c => c.subrubros.flatMap(s => s.articulos));
        const enOtras = new Set(
          (agrupaciones || [])
            .filter(g => !esTodoGroup(g, todoGroupId))
            .flatMap(g => (g.articulos || []).map(getId))
        );
        articulosAMostrar = all.filter(a => {
          const id = getId(a);
          return !enOtras.has(id) && !excludedIds.has(id);
        });
      }
    } else {
      // Agrupación real
      const arr = agrupacionSeleccionada.articulos || [];
      articulosAMostrar = arr.map(a => {
        const id = getId(a);
        const b = baseById.get(id) || {};
        return {
          ...b,
          ...a,
          id,
          nombre: a.nombre ?? b.nombre ?? `#${id}`,
          categoria: a.categoria ?? b.categoria ?? "Sin categoría",
          subrubro: a.subrubro ?? b.subrubro ?? "Sin subrubro",
          precio: num(a.precio ?? b.precio),
          costo: num(a.costo ?? b.costo),
        };
      });
    }

  } else {
    // Vista general
    articulosAMostrar = categorias.flatMap(c => c.subrubros.flatMap(s => s.articulos));
  }

  const idsVisibles = useMemo(
    () => new Set(articulosAMostrar.map(a => getId(a))),
    [articulosAMostrar]
  );

  // Filtro buscador
  const articulosFiltrados = filtroBusqueda
    ? articulosAMostrar.filter((art) =>
        (art.nombre || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
        String(getId(art)).includes(String(filtroBusqueda).trim())
      )
    : articulosAMostrar;

  // Sugerencias
  const sugerencias = useMemo(() => {
    const uniq = new Map();
    for (const a of articulosAMostrar) {
      const id = getId(a);
      const etiqueta = `${id} — ${a.nombre ?? ""}`.trim();
      if (!uniq.has(id)) uniq.set(id, { id, label: etiqueta, value: a.nombre ?? String(id) });
    }
    return Array.from(uniq.values()).slice(0, 300);
  }, [articulosAMostrar]);

  // ------------------ Cálculos UI ------------------
  const calcularCostoPorcentaje = (art) => {
    const precio = num(art.precio);
    const costo = num(art.costo);
    return precio > 0 ? ((costo / precio) * 100).toFixed(2) : 0;
  };

  const calcularSugerido = (art) => {
    const objetivo = num(objetivos[getId(art)]) || 0; // %
    const costo = num(art.costo);
    const den = 100 - objetivo;
    return den > 0 ? costo * (100 / den) : 0;
  };

  const agruparPorRubroYSubrubro = (articulos) => {
    const agrupados = {};
    articulos.forEach((articulo) => {
      const categoria = categorias.find(cat =>
        cat.subrubros.some(sub =>
          sub.articulos.some(a => getId(a) === getId(articulo))
        )
      );
      if (categoria) {
        const rubro = categoria.nombre;
        const subrubro = categoria.subrubros.find(sub =>
          sub.articulos.some(a => getId(a) === getId(articulo))
        )?.nombre || 'Sin subrubro';
        if (!agrupados[rubro]) agrupados[rubro] = {};
        if (!agrupados[rubro][subrubro]) agrupados[rubro][subrubro] = [];
        agrupados[rubro][subrubro].push(articulo);
      }
    });
    return agrupados;
  };

  const articulosAgrupados = agruparPorRubroYSubrubro(articulosFiltrados);

  // ------------------ Ordenar (local) ------------------
  const [sortBy, setSortBy] = useState(null);      // 'codigo'|'nombre'|'precio'|'costo'|'costoPct'|'objetivo'|'sugerido'|'manual'
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
      case 'costo': return num(art?.costo);
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
      const sa = String(va ?? '');
      const sb = String(vb ?? '');
      const r = sa.localeCompare(sb, 'es', { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? r : -r;
    }

    const na = Number(va ?? 0), nb = Number(vb ?? 0);
    if (na < nb) return sortDir === 'asc' ? -1 : 1;
    if (na > nb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  };

  const isTodo = agrupacionSeleccionada ? esTodoGroup(agrupacionSeleccionada, todoGroupId) : false;
  const showAcciones = !!agrupacionSeleccionada;

  // 👉 Con columna "Ventas" sumamos +1 al colSpan
  const rubroColSpan = showAcciones ? 10 : 9;

  // estilos rápidos de header/nums (si querés, mover a CSS)
  const thSticky = { position: 'sticky', top: 0, zIndex: 2, background: '#fff', cursor: 'pointer', userSelect: 'none' };
  const tdNum = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

  return (
    <div className="tabla-articulos-container">
      <SidebarCategorias
        categorias={categorias}
        setCategoriaSeleccionada={setCategoriaSeleccionada}
        agrupaciones={agrupaciones}
        agrupacionSeleccionada={agrupacionSeleccionada}
        setAgrupacionSeleccionada={setAgrupacionSeleccionada}
        setFiltroBusqueda={setFiltroBusqueda}
        categoriaSeleccionada={categoriaSeleccionada}
        setBusqueda={setFiltroBusqueda}
        idsVisibles={idsVisibles}
        activeIds={activeIdsGroup}
      />

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

        {articulosFiltrados.length === 0 ? (
          <p style={{ marginTop: '2rem', fontSize: '1.2rem', color: '#777' }}>
            No hay artículos para mostrar en esta agrupación o categoría seleccionada.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort('codigo')} style={thSticky}>
                  Código {sortBy === 'codigo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('nombre')} style={thSticky}>
                  Nombre {sortBy === 'nombre' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>

                {/* ✅ Columna Ventas (no ordenamos por ahora) */}
                <th style={thSticky}>
                  Ventas {ventasLoading ? '…' : ''}
                </th>

                <th onClick={() => toggleSort('precio')} style={{ ...thSticky, ...tdNum }}>
                  Precio {sortBy === 'precio' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('costo')} style={{ ...thSticky, ...tdNum }}>
                  Costo ($) {sortBy === 'costo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('costoPct')} style={{ ...thSticky, ...tdNum }}>
                  Costo (%) {sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('objetivo')} style={{ ...thSticky, ...tdNum }}>
                  Objetivo (%) {sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('sugerido')} style={{ ...thSticky, ...tdNum }}>
                  Sugerido ($) {sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('manual')} style={{ ...thSticky, ...tdNum }}>
                  Manual ($) {sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                {showAcciones && <th style={{ ...thSticky, width: 64, textAlign: 'center' }}>Acciones</th>}
              </tr>
            </thead>

            <tbody>
              {Object.keys(articulosAgrupados).map((rubro) => (
                <React.Fragment key={rubro}>
                  {Object.keys(articulosAgrupados[rubro]).map((subrubro) => {
                    const itemsSubrubro = [...articulosAgrupados[rubro][subrubro]];
                    const articuloIdsSubrubro = itemsSubrubro.map(a => getId(a));

                    return (
                      <React.Fragment key={subrubro}>
                        <tr className="rubro-row">
                          <td colSpan={rubroColSpan}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <strong>{rubro} - {subrubro}</strong>

                              {/* Menú de acciones del SUBRUBRO (bloque) */}
                              {showAcciones && (
                                <SubrubroAccionesMenu
                                  // contexto
                                  isTodo={isTodo}
                                  agrupaciones={agrupaciones}
                                  agrupacionSeleccionada={agrupacionSeleccionada}
                                  todoGroupId={todoGroupId}
                                  // datos del bloque
                                  articuloIds={articuloIdsSubrubro}
                                  // feedback/refresh
                                  onRefetch={refetchAgrupaciones}
                                  notify={(m, t = 'success') => openSnack(m, t)}
                                />
                              )}
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
                            precio: num(articulo.precio)
                          };

                          return (
                            <tr key={id}>
                              <td>{id}</td>
                              <td>{articulo.nombre}</td>

                              {/* ✅ Celda Ventas */}
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
                              <td style={tdNum}>{calcularCostoPorcentaje(articulo)}%</td>
                              <td style={tdNum}>
                                <input
                                  type="number"
                                  value={objetivos[id] || ''}
                                  onChange={(e) => setObjetivos({ ...objetivos, [id]: e.target.value })}
                                  style={{ width: '60px' }}
                                />
                              </td>
                              <td style={tdNum}>${fmt(calcularSugerido(articulo), 2)}</td>
                              <td style={tdNum}>
                                <input
                                  type="number"
                                  value={manuales[id] || ''}
                                  onChange={(e) => setManuales({ ...manuales, [id]: e.target.value })}
                                  style={{ width: '80px' }}
                                />
                              </td>

                              {showAcciones && (
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
                              )}
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
        autoHideDuration={2500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.type} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default TablaArticulos;

