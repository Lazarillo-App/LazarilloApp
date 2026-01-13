/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
// src/componentes/InsumosSidebar.jsx
import React, { useMemo, useCallback } from 'react';
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
import InsumoRubroAccionesMenu from './InsumoRubroAccionesMenu';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

const norm = (s) => String(s || '').trim().toLowerCase();

const safeId = (insumo) => {
  const raw = insumo?.id ?? insumo?.insumo_id ?? insumo?.codigo;
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

const esDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

const fmtCurrency = (v) => {
  try {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(v || '');
  }
};

/**
 * ✅ Helper: resolver monto de un insumo
 */
const resolveInsumoMonto = (insumo, rubrosMap) => {
  // Prioridad: usar campos del insumo directamente
  const monto = Number(
    insumo?.total_gastos_periodo ??
    insumo?.total_gastos ??
    insumo?.importe_total ??
    insumo?.monto ??
    0
  );

  if (Number.isFinite(monto) && monto !== 0) return monto;

  // Fallback: qty * precio
  const qty = Number(insumo?.unidades_compradas ?? insumo?.total_unidades ?? 0);
  const precio = Number(insumo?.precio_ref ?? insumo?.precio ?? 0);

  if (Number.isFinite(qty) && Number.isFinite(precio)) {
    return qty * precio;
  }

  return 0;
};

function InsumosSidebar({
  rubros = [],
  rubroSeleccionado,
  setRubroSeleccionado,
  businessId,
  vista,
  onVistaChange,
  groups = [],
  groupsLoading,
  selectedGroupId,
  onSelectGroupId,
  favoriteGroupId,
  onSetFavorite,
  onEditGroup,
  onDeleteGroup,
  onRenameGroup,
  todoGroupId,
  idsSinAgrupCount,
  onMutateGroups,
  onRefetch,
  notify,
  visibleIds,
  rubrosMap,
}) {
  const rubrosSafe = Array.isArray(rubros) ? rubros : [];
  const loading = groupsLoading || rubrosSafe.length === 0;

  // ✅ Select de grupos
  const opcionesSelect = useMemo(() => {
    const arr = (Array.isArray(groups) ? groups : []).filter(Boolean);
    if (!arr.length) return [];

    const todoIdNum = Number(todoGroupId);
    const todo = arr.find((g) => Number(g.id) === todoIdNum) || null;

    const discontinuados = arr.filter(esDiscontinuadosGroup);
    const discIds = new Set(discontinuados.map((g) => Number(g.id)));

    const middle = arr.filter((g) => {
      const idNum = Number(g.id);
      if (todo && idNum === Number(todo.id)) return false;
      if (discIds.has(idNum)) return false;
      return true;
    });

    const ordered = [];
    if (todo) ordered.push(todo);
    ordered.push(...middle);
    ordered.push(...discontinuados);

    return ordered;
  }, [groups, todoGroupId]);

  // ✅ Valor seleccionado en el Select
  const selectedGroupValue = useMemo(() => {
    const idsOpciones = opcionesSelect.map((g) => Number(g.id));

    const actualId = selectedGroupId ? Number(selectedGroupId) : null;

    if (actualId != null && idsOpciones.includes(actualId)) {
      return actualId;
    }

    const todoIdNum = Number(todoGroupId);
    if (Number.isFinite(todoIdNum) && idsOpciones.includes(todoIdNum)) {
      return todoIdNum;
    }

    return '';
  }, [opcionesSelect, selectedGroupId, todoGroupId]);

  // ✅ Set de IDs activos (igual que ArticulosMain)
  const activeIds = useMemo(() => {
    // 1. Si tenemos visibleIds del padre, usarlo
    if (visibleIds && visibleIds.size) {
      return visibleIds;
    }

    // 2. Si no hay grupo seleccionado, mostrar todos
    if (!selectedGroupId) {
      return null;
    }

    // 3. Si es grupo TODO, retornar null (se maneja en padre)
    const grupoSeleccionado = groups.find((g) => Number(g.id) === Number(selectedGroupId));
    if (esTodoGroup(grupoSeleccionado)) {
      return visibleIds || null;
    }

    // 4. Si es otro grupo, extraer sus IDs
    const items = grupoSeleccionado?.items || grupoSeleccionado?.insumos || [];
    if (!items.length) {
      return new Set();
    }

    const ids = new Set(
      items
        .map((item) => {
          const id = Number(item.insumo_id ?? item.id);
          return Number.isFinite(id) && id > 0 ? id : null;
        })
        .filter(Boolean)
    );

    return ids;
  }, [visibleIds, selectedGroupId, groups, todoGroupId]);

  const treeByRubro = useMemo(() => {
    // PASO 1: Filtrar por vista
    let rubrosFiltrados = rubrosSafe;

    if (vista === 'elaborados') {
      rubrosFiltrados = rubrosSafe.filter(rubro => {
        const codigo = String(rubro.codigo || '');
        const rubroInfo = rubrosMap.get(codigo);
        return rubroInfo?.es_elaborador === true;
      });
    } else if (vista === 'no-elaborados') {
      rubrosFiltrados = rubrosSafe.filter(rubro => {
        const codigo = String(rubro.codigo || '');
        const rubroInfo = rubrosMap.get(codigo);
        return rubroInfo?.es_elaborador !== true;
      });
    }

    // PASO 2: Filtrar por activeIds
    if (!activeIds) {
      return rubrosFiltrados;
    }

    const pruned = rubrosFiltrados
      .map((rubro) => {
        const insumos = Array.isArray(rubro?.insumos) ? rubro.insumos : [];
        const filtered = insumos.filter((insumo) => {
          const id = safeId(insumo);
          return id != null && activeIds.has(id);
        });
        return { ...rubro, insumos: filtered };
      })
      .filter((rubro) => (rubro?.insumos?.length || 0) > 0);

    // PASO 3: Ordenar
    const withVentas = pruned.map((rubro) => {
      let ventasMonto = 0;
      (rubro.insumos || []).forEach(insumo => {
        ventasMonto += resolveInsumoMonto(insumo, rubrosMap);
      });
      return { ...rubro, __ventasMonto: ventasMonto };
    });

    withVentas.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) {
        return b.__ventasMonto - a.__ventasMonto;
      }
      return String(a.nombre).localeCompare(String(b.nombre), 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    });

    return withVentas;
  }, [rubrosSafe, activeIds, rubrosMap, vista]);

  // ✅ Handlers
  const handleGroupChange = useCallback(
    (event) => {
      const idSel = Number(event.target.value);
      onSelectGroupId?.(idSel);
      setRubroSeleccionado?.(null);
    },
    [onSelectGroupId, setRubroSeleccionado]
  );

  const handleRubroClick = useCallback(
    (rubro) => {
      const isActive = rubroSeleccionado?.codigo === rubro?.codigo;
      setRubroSeleccionado?.(isActive ? null : rubro);
    },
    [rubroSeleccionado, setRubroSeleccionado]
  );

  const countInsumosRubro = (rubro) => {
    return Array.isArray(rubro?.insumos) ? rubro.insumos.length : 0;
  };

  const montoInsumosRubro = (rubro) => {
    let total = 0;
    const insumos = Array.isArray(rubro?.insumos) ? rubro.insumos : [];

    for (const insumo of insumos) {
      total += resolveInsumoMonto(insumo, rubrosMap);
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
          value={selectedGroupValue}
          onChange={handleGroupChange}
          renderValue={(value) => {
            const g = opcionesSelect.find((x) => Number(x.id) === Number(value));
            return g ? g.nombre : 'Sin agrupación';
          }}
        >
          {opcionesSelect.map((g) => (
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
                  {g.nombre}
                  {esTodoGroup(g) && idsSinAgrupCount > 0 && (
                    <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                      {' '}
                      ({idsSinAgrupCount})
                    </span>
                  )}
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
                          <Tooltip title='Convertir "Sin agrupación" en nueva agrupación'>
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
                              {Number(favoriteGroupId) === Number(g.id) ? (
                                <StarIcon fontSize="inherit" color="warning" />
                              ) : (
                                <StarBorderIcon fontSize="inherit" />
                              )}
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
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteGroup(g);
                              }}
                            >
                              <DeleteIcon fontSize="inherit" color="error" />
                            </IconButton>
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

      <div
        style={{
          padding: '2px 0 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={vista}
          onChange={(_, val) => {
            if (!val) return;
            onVistaChange?.(val);
          }}
        >
          <ToggleButton value="no-elaborados">No elaborados</ToggleButton>
          <ToggleButton value="elaborados">Elaborados</ToggleButton>
        </ToggleButtonGroup>
      </div>

      <ul className="sidebar-draggable-list">
        {loading && <li style={{ opacity: 0.7 }}>Cargando rubros…</li>}

        {!loading &&
          treeByRubro.map((rubro) => {
            const keyStr = String(rubro?.codigo || rubro?.nombre || 'sin-codigo');
            const active = rubroSeleccionado?.codigo === rubro?.codigo;

            const count = countInsumosRubro(rubro);
            const monto = montoInsumosRubro(rubro);

            return (
              <li
                key={keyStr}
                className={active ? 'categoria-activa' : ''}
                title={rubro.nombre}
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
                  onClick={() => handleRubroClick(rubro)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                  }}
                >
                  <span className="icono" />
                  {rubro.nombre}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <small style={{ opacity: 0.65 }}>
                    {count}
                    {typeof monto === 'number' && monto > 0
                      ? ` · ${fmtCurrency(monto)}`
                      : ''}
                  </small>
                  <InsumoRubroAccionesMenu
                    rubroLabel={rubro.nombre}
                    insumoIds={rubro.insumos?.map(safeId).filter(Boolean) || []}
                    groups={groups}
                    selectedGroupId={selectedGroupId}
                    discontinuadosGroupId={
                      groups.find(esDiscontinuadosGroup)?.id || null
                    }
                    todoGroupId={todoGroupId}
                    isTodoView={
                      todoGroupId &&
                      selectedGroupId &&
                      Number(selectedGroupId) === Number(todoGroupId)
                    }
                    onRefetch={onRefetch}
                    notify={notify}
                    onMutateGroups={onMutateGroups}
                    fromSidebar={true}
                  />
                </div>
              </li>
            );
          })}

        {!loading && treeByRubro.length === 0 && (
          <li style={{ opacity: 0.7 }}>
            {selectedGroupId &&
              groups.find((g) => Number(g.id) === Number(selectedGroupId)) &&
              esDiscontinuadosGroup(
                groups.find((g) => Number(g.id) === Number(selectedGroupId))
              )
              ? 'No hay rubros discontinuados.'
              : 'No hay rubros en esta agrupación.'}
          </li>
        )}
      </ul>
    </div>
  );
}

export default React.memo(InsumosSidebar);