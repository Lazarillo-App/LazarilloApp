/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
// src/componentes/InsumosSidebar.jsx - CON PERSISTENCIA DE VISTA + ASIGNACIÓN A DIVISIONES

import React, { useMemo, useCallback, useState, useEffect } from 'react';
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
import AssignGroupToDivisionModal from './AssignGroupToDivisionModal';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

import { assignInsumoGroupToDivision as assignInsumoGroupToDivisionAPI } from '@/servicios/apiDivisions';
import { BusinessesAPI } from '@/servicios/apiBusinesses'; // ✅ IMPORTAR

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

const resolveInsumoMonto = (insumo, metaById) => {
  if (!insumo) return 0;

  const monto = Number(
    insumo?.total_gastos_periodo ??
    insumo?.total_gastos ??
    insumo?.importe_total ??
    insumo?.monto ??
    0
  );
  if (Number.isFinite(monto) && monto !== 0) return monto;

  const qty = Number(insumo?.unidades_compradas ?? insumo?.total_unidades ?? 0);
  const precio = Number(insumo?.precio_ref ?? insumo?.precio ?? 0);
  if (Number.isFinite(qty) && Number.isFinite(precio)) return qty * precio;

  if (metaById && typeof metaById.get === 'function') {
    const id = safeId(insumo);
    if (Number.isFinite(id)) {
      const meta = metaById.get(id);
      if (meta) {
        const metaMonto = Number(meta.total_gastos_periodo ?? meta.total_gastos ?? meta.importe_total ?? 0);
        if (Number.isFinite(metaMonto) && metaMonto !== 0) return metaMonto;

        const metaQty = Number(meta.unidades_compradas ?? meta.total_unidades ?? 0);
        const metaPrecio = Number(meta.precio ?? 0);
        if (Number.isFinite(metaQty) && Number.isFinite(metaPrecio)) return metaQty * metaPrecio;
      }
    }
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
  onReloadCatalogo,
  forceRefresh,
  onCreateGroupFromRubro,

  discontinuadosGroupId = null,

  onManualPick,
  metaById,

  // ✅ División-aware
  activeDivisionId,
  activeDivisionGroupIds = [],
  assignedGroupIds = [],
  refetchAssignedGroups,
}) {
  const rubrosSafe = Array.isArray(rubros) ? rubros : [];
  const loading = groupsLoading;

  // ✅ Modal para asignar a división
  const [divisionModalOpen, setDivisionModalOpen] = useState(false);
  const [groupToMove, setGroupToMove] = useState(null);

  // ✅ NUEVO: Estado local de vista mientras carga la preferencia
  const [localVista, setLocalVista] = useState(vista);
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  const divisionNum =
    activeDivisionId === null || activeDivisionId === undefined || activeDivisionId === ''
      ? null
      : Number(activeDivisionId);

  const isMainDivision =
    divisionNum === null || !Number.isFinite(divisionNum) || divisionNum <= 0;

  /* ===================== Select de grupos (FILTRADO POR DIVISIÓN) ===================== */
  const opcionesSelect = useMemo(() => {
    const arr = (Array.isArray(groups) ? groups : []).filter(Boolean);
    if (!arr.length) return [];

    const todoIdNum = Number(todoGroupId);
    const todo = Number.isFinite(todoIdNum) ? arr.find((g) => Number(g.id) === todoIdNum) : null;

    const discontinuados = arr.filter(esDiscontinuadosGroup);
    const discIds = new Set(discontinuados.map((g) => Number(g.id)));

    const assignedSet = new Set((assignedGroupIds || []).map(Number));
    const activeSet = new Set((activeDivisionGroupIds || []).map(Number));

    const middle = arr.filter((g) => {
      const idNum = Number(g?.id);
      if (!Number.isFinite(idNum) || idNum <= 0) return false;
      if (todo && idNum === Number(todo.id)) return false;
      if (discIds.has(idNum)) return false;

      if (isMainDivision) return !assignedSet.has(idNum);
      return activeSet.has(idNum);
    });

    const ordered = [];
    if (isMainDivision && todo) ordered.push(todo);
    ordered.push(...middle);
    if (isMainDivision) ordered.push(...discontinuados);
    return ordered;
  }, [groups, todoGroupId, assignedGroupIds, activeDivisionGroupIds, isMainDivision]);

  const selectedGroupValue = useMemo(() => {
    const idsOpciones = opcionesSelect.map((g) => Number(g.id));
    const actualId = selectedGroupId ? Number(selectedGroupId) : null;

    if (actualId != null && idsOpciones.includes(actualId)) return actualId;

    const todoIdNum = Number(todoGroupId);
    if (Number.isFinite(todoIdNum) && idsOpciones.includes(todoIdNum)) return todoIdNum;

    return '';
  }, [opcionesSelect, selectedGroupId, todoGroupId]);

  // ✅ Auto-fix: si cambian las opciones (por división) y el grupo actual ya no es válido,
  // elegir uno válido y resetear rubro, etc. como si el usuario lo hubiera cambiado.
  useEffect(() => {
    const opts = Array.isArray(opcionesSelect) ? opcionesSelect : [];

    if (!opts.length) {
      if (selectedGroupId) {
        onSelectGroupId?.(null);
        setRubroSeleccionado?.(null);
        onManualPick?.();
      }
      return;
    }

    const currentId = selectedGroupId != null ? Number(selectedGroupId) : null;
    const exists = currentId != null && opts.some(o => Number(o.id) === currentId);

    if (exists) return;

    // elegir default: Principal -> TODO si existe, sino primera opción
    const todoIdNum = Number(todoGroupId);
    const todoOpt =
      Number.isFinite(todoIdNum) ? opts.find(o => Number(o.id) === todoIdNum) : null;

    const next = (isMainDivision && todoOpt) ? todoOpt : (opts[0] || null);

    onSelectGroupId?.(next ? Number(next.id) : null);
    setRubroSeleccionado?.(null);
    onManualPick?.();
  }, [
    opcionesSelect,
    selectedGroupId,
    onSelectGroupId,
    setRubroSeleccionado,
    onManualPick,
    isMainDivision,
    todoGroupId
  ]);

  /* ===================== ActiveIds ===================== */
  const activeIds = useMemo(() => {
    if (visibleIds && visibleIds.size) return visibleIds;

    if (!selectedGroupId) return null;

    const grupoSeleccionado = (groups || []).find((g) => Number(g.id) === Number(selectedGroupId));
    if (!grupoSeleccionado) return null;

    if (esTodoGroup(grupoSeleccionado)) return null;

    const items = grupoSeleccionado?.items || grupoSeleccionado?.insumos || [];
    if (!items.length) return new Set();

    return new Set(
      items
        .map((item) => Number(item.insumo_id ?? item.id))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
  }, [visibleIds, selectedGroupId, groups]);

  /* ===================== ✅ NUEVO: CARGAR PREFERENCIA DE VISTA AL CAMBIAR GRUPO ===================== */

  useEffect(() => {
    if (!businessId || !selectedGroupId) return;

    const loadViewPref = async () => {
      try {
        setLoadingPrefs(true);

        const result = await BusinessesAPI.getViewPrefs(businessId, {
          divisionId: divisionNum,
        });

        const groupId = Number(selectedGroupId);
        const savedVista = result?.byInsumoGroup?.[String(groupId)];

        // ✅ Para insumos, la preferencia se guarda como 'elaborados' o 'no-elaborados'
        if (savedVista === 'elaborados' || savedVista === 'no-elaborados') {
          setLocalVista(savedVista);
          onVistaChange?.(savedVista);
        } else {
          // Si no hay preferencia guardada, usar el valor por defecto
          setLocalVista(vista);
        }
      } catch (error) {
        console.error('[InsumosSidebar] Error cargando preferencia de vista:', error);
        setLocalVista(vista);
      } finally {
        setLoadingPrefs(false);
      }
    };

    loadViewPref();
  }, [businessId, selectedGroupId, divisionNum]);

  /* ===================== ✅ NUEVO: GUARDAR PREFERENCIA AL CAMBIAR TOGGLE ===================== */

  const handleVistaChange = useCallback(
    async (newVista) => {
      if (!newVista || !businessId || !selectedGroupId) return;

      // Actualizar inmediatamente la UI
      setLocalVista(newVista);
      onVistaChange?.(newVista);

      // Guardar en backend
      try {
        await BusinessesAPI.saveViewPref(businessId, {
          scope: 'insumo',
          agrupacionId: Number(selectedGroupId),
          viewMode: newVista,
          divisionId: divisionNum,
        });
      } catch (error) {
        console.error('[InsumosSidebar] Error guardando preferencia de vista:', error);
        notify?.('Error al guardar preferencia de vista', 'error');
      }
    },
    [businessId, selectedGroupId, divisionNum, onVistaChange, notify]
  );

  /* ===================== Catálogo rubros ===================== */
  const catalogRubros = useMemo(() => {
    if (!rubrosMap || typeof rubrosMap.get !== 'function') return [];

    const arr = [];
    for (const [codigo, info] of rubrosMap.entries()) {
      const codigoNum = Number(codigo);
      if (!Number.isFinite(codigoNum)) continue;

      arr.push({
        codigo: codigoNum,
        nombre: info?.nombre || String(codigoNum),
        insumos: [],
      });
    }

    arr.sort((a, b) =>
      String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base', numeric: true })
    );

    return arr;
  }, [rubrosMap]);

  const treeByRubro = useMemo(() => {
    const keepEmpty = !activeIds;

    let baseRubros = keepEmpty ? catalogRubros : rubrosSafe;

    if (keepEmpty && rubrosSafe.length) {
      const byCodigo = new Map(rubrosSafe.map((r) => [Number(r.codigo), r]));
      baseRubros = catalogRubros.map((r) => {
        const real = byCodigo.get(Number(r.codigo));
        return real
          ? { ...r, ...real, insumos: Array.isArray(real.insumos) ? real.insumos : [] }
          : { ...r, insumos: [] };
      });
    } else {
      baseRubros = (baseRubros || []).map((r) => ({
        ...r,
        insumos: Array.isArray(r?.insumos) ? r.insumos : [],
      }));
    }

    let rubrosFiltrados = baseRubros;

    // ✅ Usar localVista en lugar de vista
    if (localVista === 'elaborados') {
      rubrosFiltrados = rubrosFiltrados.filter((rubro) => {
        const codigo = String(rubro.codigo || '');
        const info = rubrosMap?.get(codigo);
        return info?.es_elaborador === true;
      });
    } else if (localVista === 'no-elaborados') {
      rubrosFiltrados = rubrosFiltrados.filter((rubro) => {
        const codigo = String(rubro.codigo || '');
        const info = rubrosMap?.get(codigo);
        return info?.es_elaborador !== true;
      });
    }

    const pruned = rubrosFiltrados.map((rubro) => {
      const insumos = Array.isArray(rubro?.insumos) ? rubro.insumos : [];
      if (!activeIds) return rubro;

      const filtered = insumos.filter((insumo) => {
        const id = safeId(insumo);
        return id != null && activeIds.has(id);
      });

      return { ...rubro, insumos: filtered };
    });

    const finalRubros = pruned.filter((rubro) => {
      if (keepEmpty) return true;
      return (rubro?.insumos?.length || 0) > 0;
    });

    const withMonto = finalRubros.map((rubro) => {
      let ventasMonto = 0;
      (rubro.insumos || []).forEach((insumo) => {
        ventasMonto += resolveInsumoMonto(insumo, metaById);
      });
      return { ...rubro, __ventasMonto: ventasMonto };
    });

    withMonto.sort((a, b) => {
      if ((b.__ventasMonto || 0) !== (a.__ventasMonto || 0)) return (b.__ventasMonto || 0) - (a.__ventasMonto || 0);
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base', numeric: true });
    });

    return withMonto;
  }, [catalogRubros, rubrosSafe, localVista, rubrosMap, activeIds, metaById]);

  const handleGroupChange = useCallback(
    (event) => {
      const idSel = Number(event.target.value);
      onSelectGroupId?.(idSel);
      setRubroSeleccionado?.(null);
      onManualPick?.();
    },
    [onSelectGroupId, setRubroSeleccionado, onManualPick]
  );

  const handleRubroClick = useCallback(
    (rubro) => {
      const isActive = rubroSeleccionado?.codigo === rubro?.codigo;
      setRubroSeleccionado?.(isActive ? null : rubro);
    },
    [rubroSeleccionado, setRubroSeleccionado]
  );

  const countInsumosRubro = (rubro) => (Array.isArray(rubro?.insumos) ? rubro.insumos.length : 0);
  const montoInsumosRubro = (rubro) => rubro?.__ventasMonto ?? 0;

  const isTodoView =
    todoGroupId && selectedGroupId && Number(selectedGroupId) === Number(todoGroupId);

  /* ===================== Modal asignación división ===================== */
  const handleMoveGroupToDivision = useCallback((group) => {
    setGroupToMove(group);
    setDivisionModalOpen(true);
  }, []);

  const handleDivisionAssign = useCallback(
    async (divisionId) => {
      if (!groupToMove) return;

      try {
        await assignInsumoGroupToDivisionAPI({
          businessId,
          insumoGroupId: Number(groupToMove.id),
          divisionId: divisionId === 'principal' ? null : Number(divisionId),
        });

        // ✅ Nombre de la división destino
        const divisionName = divisionId === 'principal'
          ? 'División Principal'
          : `División ${divisionId}`;

        // ✅ Emitir notificación
        try {
          window.dispatchEvent(
            new CustomEvent('ui:action', {
              detail: {
                businessId,
                kind: 'group_move_division',
                scope: 'insumo',
                title: 'Agrupación movida a división',
                message: `"${groupToMove.nombre}" → ${divisionName}`,
                createdAt: new Date().toISOString(),
                payload: {
                  groupId: Number(groupToMove.id),
                  groupName: groupToMove.nombre,
                  divisionId: divisionId === 'principal' ? null : Number(divisionId),
                  divisionName,
                },
              },
            })
          );
        } catch (err) {
          console.warn('[InsumosSidebar] Error emitiendo notificación:', err);
        }

        notify?.(`Agrupación "${groupToMove.nombre}" movida correctamente`, 'success');

        await refetchAssignedGroups?.();
        await onRefetch?.();

        setDivisionModalOpen(false);
        setGroupToMove(null);
      } catch (err) {
        console.error('[InsumosSidebar] ❌ Error asignando insumo_group:', err);
        notify?.(err?.message || 'Error al asignar agrupación', 'error');
      }
    },
    [groupToMove, businessId, notify, refetchAssignedGroups, onRefetch]
  );

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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                <span style={{ fontStyle: esDiscontinuadosGroup(g) ? 'italic' : 'normal', color: esDiscontinuadosGroup(g) ? '#555' : 'inherit' }}>
                  {g.nombre}
                  {esTodoGroup(g) && isMainDivision && idsSinAgrupCount > 0 && (
                    <span style={{ opacity: 0.6, fontSize: '0.85em' }}> ({idsSinAgrupCount})</span>
                  )}
                </span>

                <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {(() => {
                    const isTodo = esTodoGroup(g);
                    const isDisc = esDiscontinuadosGroup(g);

                    if (isDisc) return null;

                    if (isTodo) {
                      return (
                        isMainDivision &&
                        onRenameGroup && (
                          <Tooltip title='Convertir "Sin agrupación" en nueva agrupación'>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRenameGroup(g); }}>
                              <EditIcon fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        )
                      );
                    }

                    return (
                      <>
                        {onSetFavorite && (
                          <Tooltip title={Number(favoriteGroupId) === Number(g.id) ? 'Quitar como favorita' : 'Marcar como favorita'}>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onSetFavorite(g.id); }}>
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

                                // ✅ Guardar nombre anterior
                                const oldName = g.nombre;

                                // ✅ Función wrapper para emitir después de renombrar
                                const handleRename = async () => {
                                  const result = await onEditGroup(g);

                                  // Si onEditGroup devuelve el nuevo nombre, emitimos
                                  if (result && result.newName && result.newName !== oldName) {
                                    try {
                                      window.dispatchEvent(
                                        new CustomEvent('ui:action', {
                                          detail: {
                                            businessId,
                                            kind: 'group_rename',
                                            scope: 'insumo',
                                            title: 'Agrupación renombrada',
                                            message: `"${oldName}" → "${result.newName}"`,
                                            createdAt: new Date().toISOString(),
                                            payload: {
                                              groupId: Number(g.id),
                                              oldName,
                                              newName: result.newName,
                                            },
                                          },
                                        })
                                      );
                                    } catch (err) {
                                      console.warn('[InsumosSidebar] Error emitiendo notificación:', err);
                                    }
                                  }
                                };

                                handleRename();
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

                                // ✅ Emitir notificación ANTES de eliminar
                                try {
                                  window.dispatchEvent(
                                    new CustomEvent('ui:action', {
                                      detail: {
                                        businessId,
                                        kind: 'group_delete',
                                        scope: 'insumo',
                                        title: 'Agrupación eliminada',
                                        message: `"${g.nombre}" fue eliminada.`,
                                        createdAt: new Date().toISOString(),
                                        payload: {
                                          groupId: Number(g.id),
                                          groupName: g.nombre,
                                        },
                                      },
                                    })
                                  );
                                } catch (err) {
                                  console.warn('[InsumosSidebar] Error emitiendo notificación:', err);
                                }

                                onDeleteGroup(g);
                              }}
                            >
                              <DeleteIcon fontSize="inherit" color="error" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* ✅ asignar a división (solo en Principal y no para TODO/DISC) */}
                        {isMainDivision && !isTodo && !isDisc && (
                          <Tooltip title="Asignar a división">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleMoveGroupToDivision(g); }}>
                              <ViewModuleIcon fontSize="inherit" />
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

      {/* ✅ ACTUALIZADO: usar localVista y handleVistaChange con disabled */}
      <div style={{ padding: '2px 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={localVista}
          onChange={(_, val) => {
            if (!val) return;
            handleVistaChange(val);
          }}
          disabled={loadingPrefs}
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
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              >
                <span onClick={() => handleRubroClick(rubro)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <span className="icono" />
                  {rubro.nombre}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <small style={{ opacity: 0.65 }}>
                    {count}
                    {typeof monto === 'number' && monto > 0 ? ` · ${fmtCurrency(monto)}` : ''}
                  </small>

                  <InsumoRubroAccionesMenu
                    rubroLabel={rubro.nombre}
                    insumoIds={(rubro.insumos || []).map((i) => safeId(i)).filter(Boolean)}
                    groups={groups}
                    selectedGroupId={selectedGroupId}
                    discontinuadosGroupId={discontinuadosGroupId}
                    onRefetch={onRefetch}
                    notify={notify}
                    onMutateGroups={onMutateGroups}
                    onCreateGroupFromRubro={onCreateGroupFromRubro}
                    todoGroupId={todoGroupId}
                    isTodoView={isTodoView}
                    onReloadCatalogo={onReloadCatalogo}
                  />
                </div>
              </li>
            );
          })}

        {!loading && treeByRubro.length === 0 && (
          <li style={{ opacity: 0.7 }}>
            {selectedGroupId &&
              (groups || []).find((g) => Number(g.id) === Number(selectedGroupId)) &&
              esDiscontinuadosGroup((groups || []).find((g) => Number(g.id) === Number(selectedGroupId)))
              ? 'No hay rubros discontinuados.'
              : 'No hay rubros en esta agrupación.'}
          </li>
        )}
      </ul>

      {/* ✅ Modal de asignación a división */}
      {divisionModalOpen && (
        <AssignGroupToDivisionModal
          open={divisionModalOpen}
          group={groupToMove}
          businessId={businessId}
          currentDivisionId={activeDivisionId ?? null}
          onClose={() => {
            setDivisionModalOpen(false);
            setGroupToMove(null);
          }}
          onAssign={handleDivisionAssign}
        />
      )}
    </div>
  );
}

export default React.memo(InsumosSidebar);