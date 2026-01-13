/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useEffect, useMemo, useCallback
} from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Tooltip,
} from '@mui/material';
import BlockActionsMenu from './BlockActionsMenu';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

import '../css/SidebarCategorias.css';

const norm = (s) => String(s || '').trim().toLowerCase();

const safeId = (a) => {
  const raw =
    a?.article_id ??   // 👈 mismo criterio que getArtId
    a?.articulo_id ??
    a?.articuloId ??
    a?.idArticulo ??
    a?.id ??
    a?.codigo ??
    a?.code;

  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return (
    n === 'todo' ||
    n === 'sin agrupacion' ||
    n === 'sin agrupación' ||
    n === 'sin agrupar' ||
    n === 'sin grupo'
  );
};

// 🆕 Nuevo: detectar agrupación "Discontinuados"
const esDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

// ahora simplemente mostramos el nombre real
const labelAgrup = (g) => g?.nombre || '';

// Formateador de moneda (Argentina)
const fmtCurrency = (v) => {
  try {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(v || '');
  }
};

/**
 * Helper local: intenta obtener el monto de ventas de un artículo de forma fiable.
 * - Primero usa getAmountForId (si viene desde el padre)
 * - Luego intenta leer campos comunes del objeto art
 * - Finalmente devuelve 0
 */
const resolveArticuloMonto = (art, getAmountForId, metaById) => {
  const id = safeId(art);
  if (Number.isFinite(Number(id)) && getAmountForId) {
    const m = Number(getAmountForId(Number(id)) || 0);
    if (Number.isFinite(m)) return m;
  }

  // fallback: intentar leer propiedades del propio art
  const v =
    art?.ventas_monto ??
    art?.ventasMonto ??
    art?.ventas_total ??
    art?.ventasTotal ??
    art?.monto ??
    art?.amount ??
    0;

  const n = Number(v);
  if (Number.isFinite(n)) return n;

  // último recurso: si no hay cantidad ni monto, intentar estimar con precio y cantidad
  const qty = Number(art?.qty ?? art?.cantidad ?? art?.ventas_u ?? 0);
  const precio = Number(metaById?.get?.(id)?.precio ?? art?.precio ?? 0);
  if (Number.isFinite(qty) && Number.isFinite(precio)) {
    return qty * precio;
  }

  return 0;
};

function SidebarCategorias({
  categorias = [],
  setCategoriaSeleccionada,
  agrupaciones = [],
  agrupacionSeleccionada,
  setAgrupacionSeleccionada,
  setFiltroBusqueda,
  setBusqueda,
  categoriaSeleccionada,
  todoGroupId,
  visibleIds,
  onManualPick,
  listMode = 'by-subrubro',
  onChangeListMode,
  favoriteGroupId,
  onSetFavorite,
  onEditGroup,
  onDeleteGroup,
  onRenameGroup,
  metaById,
  getAmountForId,
  onMutateGroups,
  onRefetch,
  notify,
}) {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];
  const loading = categoriasSafe.length === 0;

  // Select de agrupaciones
  const opcionesSelect = useMemo(() => {
    const arr = (Array.isArray(agrupaciones) ? agrupaciones : []).filter(Boolean);
    if (!arr.length) return [];

    const todoIdNum = Number(todoGroupId);

    const todo = arr.find(g => Number(g.id) === todoIdNum) || null;

    // separar Discontinuados
    const discontinuados = arr.filter(esDiscontinuadosGroup);
    const discIds = new Set(discontinuados.map(g => Number(g.id)));

    const middle = arr.filter(g => {
      const idNum = Number(g.id);
      if (todo && idNum === Number(todo.id)) return false;
      if (discIds.has(idNum)) return false;
      return true;
    });

    const ordered = [];
    if (todo) ordered.push(todo);
    ordered.push(...middle);
    // Discontinuados siempre al final
    ordered.push(...discontinuados);

    return ordered;
  }, [agrupaciones, todoGroupId]);

  // Valor seguro para el Select de agrupaciones
  const selectedAgrupValue = useMemo(() => {
    const idsOpciones = opcionesSelect.map(g => Number(g.id));

    const actualId = agrupacionSeleccionada
      ? Number(agrupacionSeleccionada.id)
      : null;

    if (actualId != null && idsOpciones.includes(actualId)) {
      return actualId;
    }

    const todoIdNum = Number(todoGroupId);
    if (Number.isFinite(todoIdNum) && idsOpciones.includes(todoIdNum)) {
      return todoIdNum;
    }

    return '';
  }, [opcionesSelect, agrupacionSeleccionada, todoGroupId]);

  // Set de ids activos
  const activeIds = useMemo(() => {
    if (visibleIds && visibleIds.size) return visibleIds;

    const g = agrupacionSeleccionada;
    if (!g) return null;

    if (esTodoGroup(g)) return null;

    const gActual = (agrupaciones || []).find(
      x => Number(x?.id) === Number(g?.id)
    );
    const arr = Array.isArray(gActual?.articulos) ? gActual.articulos : [];

    if (!arr.length) return new Set();

    return new Set(
      arr
        .map(a => safeId(a))
        .filter((id) => id != null)
    );
  }, [visibleIds, agrupacionSeleccionada, agrupaciones, todoGroupId]);

  useEffect(() => {
    if (!agrupacionSeleccionada) return;
    const g = (agrupaciones || []).find(x => Number(x?.id) === Number(agrupacionSeleccionada.id));
    if (!g) return;
    const changed =
      g.nombre !== agrupacionSeleccionada.nombre ||
      (Array.isArray(g.articulos) ? g.articulos.length : 0) !==
      (Array.isArray(agrupacionSeleccionada.articulos) ? agrupacionSeleccionada.articulos.length : 0);
    if (changed) setAgrupacionSeleccionada?.(g);
  }, [agrupaciones, agrupacionSeleccionada, setAgrupacionSeleccionada]);

  /* ==========================
     Árbol según modo + ORDEN POR VENTAS
  ========================== */

  const treeBySubrubro = useMemo(() => {
    if (!activeIds) return categoriasSafe;

    const pruned = categoriasSafe
      .map(sub => {
        const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
        const keepCategorias = cats
          .map(c => {
            const arts = (Array.isArray(c?.articulos) ? c.articulos : [])
              .filter(a => {
                if (!activeIds) return true;
                const id = safeId(a);
                return id != null && activeIds.has(id);
              });
            return { ...c, articulos: arts };
          })
          .filter(c => (Array.isArray(c.articulos) ? c.articulos.length : 0) > 0);
        return { ...sub, categorias: keepCategorias };
      })
      .filter(sub => {
        let total = 0;
        for (const c of (sub?.categorias || [])) {
          total += (Array.isArray(c?.articulos) ? c.articulos.length : 0);
        }
        return total > 0;
      });

    // 🧮 calcular ventas totales por subrubro usando getAmountForId
    const withVentas = pruned.map(sub => {
      let ventasMonto = 0;
      const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
      for (const c of cats) {
        const arts = Array.isArray(c?.articulos) ? c.articulos : [];
        for (const art of arts) {
          ventasMonto += resolveArticuloMonto(art, getAmountForId, metaById);
        }
      }
      return { ...sub, __ventasMonto: ventasMonto };
    });

    // Ordenar de mayor a menor ventas; si empatan, alfabético
    withVentas.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) {
        return b.__ventasMonto - a.__ventasMonto;
      }
      return String(a.subrubro).localeCompare(String(b.subrubro), 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    });

    return withVentas;
  }, [categoriasSafe, activeIds, getAmountForId, metaById]);

  const treeByCategoria = useMemo(() => {
    const catMap = new Map(); // categoria -> artículos
    for (const sub of categoriasSafe) {
      const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
      for (const c of cats) {
        const catName = String(c?.categoria || 'Sin categoría');
        const arts = Array.isArray(c?.articulos) ? c.articulos : [];
        if (!catMap.has(catName)) catMap.set(catName, []);
        catMap.get(catName).push(...arts);
      }
    }

    const out = [];
    for (const [catName, arts] of catMap.entries()) {
      const filtered = !activeIds
        ? arts
        : arts.filter(a => {
          const id = safeId(a);
          return id != null && activeIds.has(id);
        });
      if (filtered.length > 0) {
        // 🧮 ventas por categoría (monto)
        let ventasMonto = 0;
        for (const art of filtered) {
          ventasMonto += resolveArticuloMonto(art, getAmountForId, metaById);
        }

        out.push({
          subrubro: catName,
          categorias: [{ categoria: catName, articulos: filtered }],
          __ventasMonto: ventasMonto,
        });
      }
    }

    // Ordenar por ventas (desc) y luego alfabético
    out.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) {
        return b.__ventasMonto - a.__ventasMonto;
      }
      return String(a.subrubro).localeCompare(String(b.subrubro), 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    });

    return out;
  }, [categoriasSafe, activeIds, getAmountForId, metaById]);

  const listaBase = listMode === 'by-categoria' ? treeByCategoria : treeBySubrubro;

  // ✅ Ya no hay orden manual ni drag & drop: usamos directamente listaBase
  const listaParaMostrar = listaBase;

  /* ==========================
     UX: selección & contadores
  ========================== */
  useEffect(() => {
    if (!categoriaSeleccionada) return;
    const stillVisible = listaParaMostrar.some(
      sub => sub?.subrubro === categoriaSeleccionada?.subrubro
        && (sub?.categorias || []).some(c => (c?.articulos?.length || 0) > 0)
    );
    if (!stillVisible) setCategoriaSeleccionada?.(null);
  }, [listaParaMostrar, categoriaSeleccionada, setCategoriaSeleccionada]);

  const handleAgrupacionChange = useCallback((event) => {
    const idSel = Number(event.target.value);
    const seleccionada =
      (agrupaciones || []).find(g => Number(g?.id) === idSel) || null;

    setAgrupacionSeleccionada?.(seleccionada);
    setFiltroBusqueda?.('');
    setCategoriaSeleccionada?.(null);
    setBusqueda?.('');
    onManualPick?.();
  }, [agrupaciones, setAgrupacionSeleccionada, setFiltroBusqueda, setCategoriaSeleccionada, setBusqueda, onManualPick]);

  const handleCategoriaClick = useCallback((subItem) => {
    setCategoriaSeleccionada?.(
      categoriaSeleccionada?.subrubro === subItem?.subrubro ? null : subItem
    );
    setFiltroBusqueda?.('');
    setBusqueda?.('');
  }, [categoriaSeleccionada, setCategoriaSeleccionada, setFiltroBusqueda, setBusqueda]);

  const countArticulosSub = (sub) => {
    let total = 0;
    const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
    for (const c of cats) total += (Array.isArray(c?.articulos) ? c.articulos.length : 0);
    return total;
  };

  const montoArticulosSub = (sub) => {
    let total = 0;
    const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
    for (const c of cats) {
      const arts = Array.isArray(c?.articulos) ? c.articulos : [];
      for (const art of arts) {
        total += resolveArticuloMonto(art, getAmountForId, metaById);
      }
    }
    return total;
  };

  return (
    <div className="sidebar">
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Agrupaciones</InputLabel>
        <Select
          label="Agrupaciones"
          sx={{ fontWeight: '500' }}
          value={selectedAgrupValue}
          onChange={handleAgrupacionChange}
          renderValue={(value) => {
            const g = opcionesSelect.find(
              (x) => Number(x.id) === Number(value)
            );
            return g ? labelAgrup(g) : 'Sin agrupación';
          }}
        >
          {opcionesSelect.map(g => (
            <MenuItem key={g.id} value={Number(g.id)}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontStyle: esDiscontinuadosGroup(g) ? 'italic' : 'normal',
                    color: esDiscontinuadosGroup(g) ? '#555' : 'inherit',
                  }}
                >
                  {labelAgrup(g)}
                </span>

                <span
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {(() => {
                    const isTodo = esTodoGroup(g);
                    const isDisc = esDiscontinuadosGroup(g);

                    if (isDisc) return null;

                    if (isTodo) {
                      return (
                        onRenameGroup && (
                          <Tooltip title='Convertir "Sin agrupación" en una nueva agrupación con esos artículos'>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRenameGroup(g);
                              }}
                            >
                              <EditIcon fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        )
                      );
                    }

                    return (
                      <>
                        {onSetFavorite && (
                          <Tooltip
                            title={
                              Number(favoriteGroupId) === Number(g.id)
                                ? 'Quitar como favorita'
                                : 'Marcar como favorita'
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetFavorite(g.id);
                              }}
                            >
                              {Number(favoriteGroupId) === Number(g.id)
                                ? <StarIcon fontSize="inherit" color="warning" />
                                : <StarBorderIcon fontSize="inherit" />}
                            </IconButton>
                          </Tooltip>
                        )}

                        {onEditGroup && (
                          <Tooltip title="Renombrar agrupación">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditGroup(g);
                              }}
                            >
                              <EditIcon fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {onDeleteGroup && (
                          <Tooltip title="Eliminar agrupación">
                            <span>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteGroup(g);
                                }}
                              >
                                <DeleteIcon fontSize="inherit" color="error" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </>
                    );
                  })()}
                </span>
              </div>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <div style={{ padding: '2px 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 8, textTransform: 'uppercase', opacity: 0.65 }}>
        </span>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={listMode}
          onChange={(_, val) => {
            if (!val) return;
            onChangeListMode?.(val);
          }}
        >
          <ToggleButton value="by-subrubro">Rubro</ToggleButton>
          <ToggleButton value="by-categoria">SubRubro</ToggleButton>
        </ToggleButtonGroup>
      </div>

      <ul className="sidebar-draggable-list">
        {loading && (
          <li style={{ opacity: 0.7 }}>
            Cargando {listMode === 'by-categoria' ? 'categorías' : 'subrubros'}…
          </li>
        )}

        {!loading && listaParaMostrar.map((sub) => {
          const keyStr = String(
            sub?.subrubro || (listMode === 'by-categoria' ? 'Sin categoría' : 'Sin subrubro')
          );
          const active = categoriaSeleccionada?.subrubro === sub?.subrubro;

          const count = countArticulosSub(sub);
          const monto = montoArticulosSub(sub);

          return (
            <li
              key={keyStr}
              className={[
                active ? 'categoria-activa' : '',
              ].join(' ').trim()}
              title={keyStr}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span
                onClick={() => handleCategoriaClick(sub)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}
              >
                <span className="icono" />
                {keyStr}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <small style={{ opacity: 0.65 }}>
                  {count}
                  {typeof monto === 'number' && monto > 0 ? ` · ${fmtCurrency(monto)}` : ''}
                </small>
                <BlockActionsMenu
                  sub={sub}
                  agrupaciones={agrupaciones}
                  agrupacionSeleccionada={agrupacionSeleccionada}
                  todoGroupId={todoGroupId}
                  onMutateGroups={onMutateGroups}
                  onRefetch={onRefetch}
                  notify={notify}
                  baseById={metaById}
                />
              </div>
            </li>
          );
        })}

        {!loading && listaParaMostrar.length === 0 && (
          <li style={{ opacity: 0.7 }}>
            {agrupacionSeleccionada &&
              /discontinuad/i.test(agrupacionSeleccionada.nombre || '')
              ? 'No hay Rubros/Subrubros discontinuados.'
              : 'No hay Rubros/Subrubros en esta agrupación.'}
          </li>
        )}
      </ul>
    </div>
  );
}

export default React.memo(SidebarCategorias);
