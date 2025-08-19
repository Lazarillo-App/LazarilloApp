// src/componentes/TablaArticulos.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import axios from 'axios';
import Buscador from './Buscador';
import SidebarCategorias from './SidebarCategorias';
import '../css/TablaArticulos.css';

// MUI
import { IconButton, Snackbar, Alert } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

// Exclusiones / TODO
import {
  ensureTodo, getExclusiones, addExclusiones, removeExclusiones
} from '../servicios/apiAgrupacionesTodo';

// Helpers
const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);
const num = (v) => Number(v ?? 0);

const TablaArticulos = ({
  filtroBusqueda, setFiltroBusqueda,
  agrupacionSeleccionada, setAgrupacionSeleccionada,
  agrupaciones, categoriaSeleccionada, setCategoriaSeleccionada,
  refetchAgrupaciones
}) => {
  const [categorias, setCategorias] = useState([]);
  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});
  const [fechaDesde, setFechaDesde] = useState('2025-01-01');
  const [fechaHasta, setFechaHasta] = useState('2025-04-01');

  // TODO + exclusiones
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set()); // ids excluidos de TODO

  // UI feedback
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });
  const openSnack = (msg, type = 'success') => setSnack({ open: true, msg, type });

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // 1) Maxi SIEMPRE
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

        // 2) Exclusiones (NO BLOQUEANTE)
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

  // ------------------ Qué artículos mostrar ------------------
  let articulosAMostrar = [];

  if (categoriaSeleccionada && agrupacionSeleccionada) {
    // Filtrar por categoría + agrupación
    articulosAMostrar = categoriaSeleccionada.subrubros
      .flatMap(sub => sub.articulos)
      .filter(art =>
        (agrupacionSeleccionada.articulos || []).some(
          a => getId(a) === getId(art)
        )
      );

  } else if (categoriaSeleccionada) {
    // Solo categoría
    articulosAMostrar = categoriaSeleccionada.subrubros.flatMap(
      sub => sub.articulos
    );

  } else if (agrupacionSeleccionada) {
    const esTodo =
      agrupacionSeleccionada.nombre === "TODO" ||
      (todoGroupId && agrupacionSeleccionada.id === todoGroupId);

    if (esTodo) {
      // TODO: todo lo de Maxi que NO esté en otra agrupación y NO esté excluido
      const allMaxi = categorias.flatMap(c =>
        c.subrubros.flatMap(s => s.articulos)
      );

      const idsEnOtras = new Set(
        (agrupaciones || [])
          .filter(g => g.id !== todoGroupId && g.nombre !== "TODO")
          .flatMap(g => (g.articulos || []).map(getId))
      );

      articulosAMostrar = allMaxi.filter(a => {
        const id = getId(a);
        return !idsEnOtras.has(id) && !excludedIds.has(id);
      });

    } else {
      // Agrupación “real”: hidratar con maestro
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
    // Vista general: todo Maxi
    articulosAMostrar = categorias.flatMap(c => c.subrubros.flatMap(s => s.articulos));
  }

  // ids visibles (para Sidebar si lo necesitás)
  const idsVisibles = useMemo(
    () => new Set(articulosAMostrar.map(a => getId(a))),
    [articulosAMostrar]
  );

  // Filtro por buscador
  const articulosFiltrados = filtroBusqueda
    ? articulosAMostrar.filter((art) =>
      (art.nombre || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
      String(getId(art)).includes(String(filtroBusqueda).trim())
    )
    : articulosAMostrar;

  // Sugerencias para el Buscador (por lo visible)
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

  // Agrupar por rubro/subrubro usando el maestro
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

  // ------------------ Toggle mover a TODO / exclusiones ------------------
  const toggleArticulo = async (art) => {
    const id = getId(art);

    // 1) Dentro de una agrupación (no TODO): quitar de la agrupación => queda en TODO
    if (agrupacionSeleccionada && agrupacionSeleccionada.id !== todoGroupId) {
      try {
        await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones/${agrupacionSeleccionada.id}/articulos/${id}`);
        // a) sacar de la UI local
        setAgrupacionSeleccionada(prev =>
          prev
            ? { ...prev, articulos: (prev.articulos || []).filter(a => getId(a) !== id) }
            : prev
        );
        // b) refrescar agrupaciones globales
        if (typeof refetchAgrupaciones === 'function') refetchAgrupaciones();
        openSnack(`Artículo #${id} movido a TODO (quitado de ${agrupacionSeleccionada.nombre}).`);
      } catch (e) {
        console.error(e);
        openSnack('No se pudo quitar el artículo de la agrupación', 'error');
      }
      return;
    }

    // 2) Sin agrupación seleccionada: detectar a cuál pertenece y quitarlo
    if (!agrupacionSeleccionada) {
      const grupo = (agrupaciones || []).find(g =>
        g.id !== todoGroupId && Array.isArray(g.articulos) && g.articulos.some(a => getId(a) === id)
      );
      if (grupo) {
        try {
          await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones/${grupo.id}/articulos/${id}`);
          if (typeof refetchAgrupaciones === 'function') refetchAgrupaciones();
          openSnack(`Artículo #${id} movido a TODO (quitado de ${grupo.nombre}).`);
        } catch (e) {
          console.error(e);
          openSnack('No se pudo quitar el artículo de la agrupación', 'error');
        }
        return;
      }
    }

    // 3) En TODO: usar exclusiones para ocultarlo de TODO (opcional)
    if (agrupacionSeleccionada && agrupacionSeleccionada.id === todoGroupId) {
      try {
        if (!todoGroupId) {
          const todo = await ensureTodo();
          if (todo?.id) setTodoGroupId(todo.id);
          else throw new Error('No se pudo obtener grupo TODO');
        }
        const isExcluded = excludedIds.has(id);
        if (isExcluded) {
          await removeExclusiones(todoGroupId, [{ scope: 'articulo', ref_id: String(id) }]);
          const copy = new Set(excludedIds); copy.delete(id); setExcludedIds(copy);
          openSnack(`Artículo #${id} habilitado en TODO.`);
        } else {
          await addExclusiones(todoGroupId, [{ scope: 'articulo', ref_id: String(id) }]);
          const copy = new Set(excludedIds); copy.add(id); setExcludedIds(copy);
          openSnack(`Artículo #${id} oculto de TODO.`);
        }
      } catch (e) {
        console.error(e);
        openSnack('No se pudo actualizar el estado del artículo en TODO', 'error');
      }
    }
  };

 // ------------------ Ordenar Columnas  ------------------
const [sortBy, setSortBy] = useState(null);      // 'codigo'|'nombre'|'precio'|'costo'|'costoPct'|'objetivo'|'sugerido'|'manual'
const [sortDir, setSortDir] = useState('asc');    // 'asc' | 'desc'

const toggleSort = (key) => {
  if (sortBy === key) {
    setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
  } else {
    setSortBy(key);
    setSortDir('asc');
  }
};

// valor usado para ordenar por cada columna
const getSortValue = (art) => {
  const id = getId(art);
  switch (sortBy) {
    case 'codigo':   return id;                         // number
    case 'nombre':   return art?.nombre ?? '';          // string
    case 'precio':   return num(art?.precio);
    case 'costo':    return num(art?.costo);
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
    case 'manual':   return num(manuales[id]) || 0;
    default:         return null;
  }
};

// comparador estable que maneja números/strings y acentos
const cmp = (a, b) => {
  if (!sortBy) return 0;
  const va = getSortValue(a);
  const vb = getSortValue(b);

  // strings con locale español y números “naturales”
  if (typeof va === 'string' || typeof vb === 'string') {
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    const r = sa.localeCompare(sb, 'es', { sensitivity: 'base', numeric: true });
    return sortDir === 'asc' ? r : -r;
  }

  // números
  const na = Number(va ?? 0);
  const nb = Number(vb ?? 0);
  if (na < nb) return sortDir === 'asc' ? -1 : 1;
  if (na > nb) return sortDir === 'asc' ? 1 : -1;
  return 0;
};

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
      />

      <div className="tabla-content">
        <h2>Gestión de Artículos</h2>

        <div className='filtros-container' style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filtros-fechas" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label>Desde:</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            <label>Hasta:</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <Buscador
              value={filtroBusqueda}
              setFiltroBusqueda={setFiltroBusqueda}
              opciones={sugerencias}   // <<— usamos las sugerencias locales
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
                <th onClick={() => toggleSort('codigo')} style={{ cursor: 'pointer' }}>
                  Código {sortBy === 'codigo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('nombre')} style={{ cursor: 'pointer' }}>
                  Nombre {sortBy === 'nombre' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('precio')} style={{ cursor: 'pointer' }}>
                  Precio {sortBy === 'precio' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('costo')} style={{ cursor: 'pointer' }}>
                  Costo ($) {sortBy === 'costo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('costoPct')} style={{ cursor: 'pointer' }}>
                  Costo (%) {sortBy === 'costoPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('objetivo')} style={{ cursor: 'pointer' }}>
                  Objetivo (%) {sortBy === 'objetivo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('sugerido')} style={{ cursor: 'pointer' }}>
                  Sugerido ($) {sortBy === 'sugerido' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => toggleSort('manual')} style={{ cursor: 'pointer' }}>
                  Manual ($) {sortBy === 'manual' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ width: 70, textAlign: 'center' }}>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(articulosAgrupados).map((rubro) => (
                <React.Fragment key={rubro}>
                  {Object.keys(articulosAgrupados[rubro]).map((subrubro) => (
                    <React.Fragment key={subrubro}>
                      <tr className="rubro-row">
                        <td colSpan="9"><strong>{rubro} - {subrubro}</strong></td>
                      </tr>
                     {[...articulosAgrupados[rubro][subrubro]].sort(cmp).map((articulo) => {
                        const id = getId(articulo);
                        const isExcluded = excludedIds.has(id);
                        return (
                          <tr key={id}>
                            <td>{id}</td>
                            <td>{articulo.nombre}</td>
                            <td>${num(articulo.precio)}</td>
                            <td>${num(articulo.costo)}</td>
                            <td>{calcularCostoPorcentaje(articulo)}%</td>
                            <td>
                              <input
                                type="number"
                                value={objetivos[id] || ''}
                                onChange={(e) => setObjetivos({ ...objetivos, [id]: e.target.value })}
                                style={{ width: '60px' }}
                              />
                            </td>
                            <td>${calcularSugerido(articulo).toFixed(2)}</td>
                            <td>
                              <input
                                type="number"
                                value={manuales[id] || ''}
                                onChange={(e) => setManuales({ ...manuales, [id]: e.target.value })}
                                style={{ width: '80px' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <IconButton
                                size="small"
                                onClick={() => toggleArticulo(articulo)}
                                title={isExcluded
                                  ? 'Oculto en TODO (click para habilitar)'
                                  : 'Visible en TODO (click para ocultar)'
                                }
                              >
                                {isExcluded ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
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