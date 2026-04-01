/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
// src/componentes/InsumosSidebar.jsx

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
import { notifyGroupMovedToDivision } from '../servicios/notifyGroupActions';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

import { assignInsumoGroupToDivision as assignInsumoGroupToDivisionAPI } from '@/servicios/apiDivisions';

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

const nombreSugieraElaborado = (nombre) => {
  const n = norm(nombre || '');
  return n.includes('elaborado') || n.includes('elaborados');
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
  originalBusinessId,
  // vista viene de InsumosMain y refleja la preferencia guardada para la agrupación actual
  vista,
  onVistaChange,  // = handleChangeListMode en InsumosMain (persiste + actualiza estado)

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

  activeDivisionId,
  activeDivisionGroupIds = [],
  assignedGroupIds = [],
  refetchAssignedGroups,
}) {
  const rubrosSafe = Array.isArray(rubros) ? rubros : [];
  const loading = groupsLoading;

  const [divisionModalOpen, setDivisionModalOpen] = useState(false);
  const [groupToMove, setGroupToMove] = useState(null);

  const divisionNum =
    activeDivisionId === null || activeDivisionId === undefined || activeDivisionId === ''
      ? null
      : Number(activeDivisionId);

  const isMainDivision =
    divisionNum === null || !Number.isFinite(divisionNum) || divisionNum <= 0;

  /* ── Select de grupos ── */
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

    const todoCount = idsSinAgrupCount ?? 0;

    const ordered = [];
    if (isMainDivision && todo && todoCount > 0) ordered.push(todo);   // primero si tiene insumos
    ordered.push(...middle);
    if (isMainDivision && todo && todoCount === 0) ordered.push(todo); // al final si está vacío
    if (isMainDivision) ordered.push(...discontinuados);
    return ordered;
  }, [groups, todoGroupId, assignedGroupIds, activeDivisionGroupIds, isMainDivision, idsSinAgrupCount]);

  const selectedGroupValue = useMemo(() => {
    const idsOpciones = opcionesSelect.map((g) => Number(g.id));
    const actualId = selectedGroupId ? Number(selectedGroupId) : null;
    if (actualId != null && idsOpciones.includes(actualId)) return actualId;
    const todoIdNum = Number(todoGroupId);
    if (Number.isFinite(todoIdNum) && idsOpciones.includes(todoIdNum)) return todoIdNum;
    return '';
  }, [opcionesSelect, selectedGroupId, todoGroupId]);

  useEffect(() => {
    const opts = Array.isArray(opcionesSelect) ? opcionesSelect : [];

    if (!opts.length) {
      if (selectedGroupId) {
        onSelectGroupId?.(null);
        setRubroSeleccionado?.(null);
      }
      return;
    }

    const currentId = selectedGroupId != null ? Number(selectedGroupId) : null;

    if (currentId === null) {
      const todoIdNum = Number(todoGroupId);
      const todoOpt = Number.isFinite(todoIdNum) ? opts.find(o => Number(o.id) === todoIdNum) : null;
      const next = (isMainDivision && todoOpt) ? todoOpt : (opts[0] || null);
      if (next) {
        onSelectGroupId?.(Number(next.id));
        setRubroSeleccionado?.(null);
      }
      return;
    }

    const exists = opts.some(o => Number(o.id) === currentId);
    if (exists) return;

    const todoIdNum = Number(todoGroupId);
    const todoOpt = Number.isFinite(todoIdNum) ? opts.find(o => Number(o.id) === todoIdNum) : null;
    const next = (isMainDivision && todoOpt) ? todoOpt : (opts[0] || null);
    if (next) {
      onSelectGroupId?.(Number(next.id));
      setRubroSeleccionado?.(null);
      onManualPick?.();
    }
  }, [opcionesSelect, selectedGroupId, onSelectGroupId, setRubroSeleccionado, onManualPick, isMainDivision, todoGroupId]);

  /* ── ActiveIds ── */
  const activeIds = useMemo(() => {
    const isTodoSelected = todoGroupId && Number(selectedGroupId) === Number(todoGroupId);

    if (isTodoSelected) {
      return visibleIds instanceof Set ? visibleIds : new Set();
    }

    if (visibleIds && visibleIds.size) return visibleIds;

    if (!selectedGroupId) return null;

    const grupoSeleccionado = (groups || []).find((g) => Number(g.id) === Number(selectedGroupId));
    if (!grupoSeleccionado) return null;

    const items = grupoSeleccionado?.items || grupoSeleccionado?.insumos || [];
    if (!items.length) return new Set();

    return new Set(
      items
        .map((item) => Number(item.insumo_id ?? item.id))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
  }, [visibleIds, selectedGroupId, groups, todoGroupId]);

  /* ── Catálogo rubros ── */
  const catalogRubros = useMemo(() => {
    if (!rubrosMap || typeof rubrosMap.get !== 'function') return [];
    const arr = [];
    for (const [codigo, info] of rubrosMap.entries()) {
      const codigoNum = Number(codigo);
      if (!Number.isFinite(codigoNum)) continue;
      arr.push({ codigo: codigoNum, nombre: info?.nombre || String(codigoNum), insumos: [] });
    }
    arr.sort((a, b) =>
      String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base', numeric: true })
    );
    return arr;
  }, [rubrosMap]);

  /* ── Tree por rubro — usa `vista` (prop de InsumosMain, ya filtrada) ── */
  const treeByRubro = useMemo(() => {
    const isTodoSelected = todoGroupId && Number(selectedGroupId) === Number(todoGroupId);
    const keepEmpty = activeIds === null && !isTodoSelected;

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

    // El filtro por elaborados/no-elaborados ya lo aplica InsumosMain en filteredBase
    // que es lo que llega como `rubros` prop. Solo necesitamos filtrar el catálogo
    // cuando keepEmpty=true (sin grupo seleccionado)
    let rubrosFiltrados = baseRubros;
    if (keepEmpty) {
      if (vista === 'elaborados') {
        rubrosFiltrados = rubrosFiltrados.map((rubro) => {
          // Filtrar insumos por es_elaborado primero, luego por es_elaborador del rubro
          const insumosElaborados = (rubro.insumos || []).filter((ins) => {
            if (ins?.es_elaborado === true) return true;
            if (ins?.es_elaborado === false) return false;
            const info = rubrosMap?.get(String(rubro.codigo || ''));
            return info?.es_elaborador === true || nombreSugieraElaborado(rubro.nombre);
          });
          return { ...rubro, insumos: insumosElaborados };
        }).filter((rubro) => {
          const insumosFiltrados = rubro.insumos || [];
          const info = rubrosMap?.get(String(rubro.codigo || ''));
          // Mantener el rubro si tiene insumos elaborados O si el rubro entero es elaborador
          return insumosFiltrados.length > 0 || info?.es_elaborador === true || nombreSugieraElaborado(rubro.nombre);
        });
      } else if (vista === 'no-elaborados') {
        rubrosFiltrados = rubrosFiltrados.map((rubro) => {
          // Filtrar insumos no elaborados
          const insumosNoElab = (rubro.insumos || []).filter((ins) => {
            if (ins?.es_elaborado === true) return false;
            if (ins?.es_elaborado === false) return true;
            const info = rubrosMap?.get(String(rubro.codigo || ''));
            return info?.es_elaborador !== true && !nombreSugieraElaborado(rubro.nombre);
          });
          return { ...rubro, insumos: insumosNoElab };
        }).filter((rubro) => {
          const insumosFiltrados = rubro.insumos || [];
          const info = rubrosMap?.get(String(rubro.codigo || ''));
          // Mantener el rubro si tiene insumos no elaborados O si el rubro no es elaborador
          return insumosFiltrados.length > 0 || (info?.es_elaborador !== true && !nombreSugieraElaborado(rubro.nombre));
        });
      }
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
  }, [catalogRubros, rubrosSafe, vista, rubrosMap, activeIds, metaById, todoGroupId, selectedGroupId]);

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

  /* ── Modal asignación división ── */
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

        const divisionName = divisionId === 'principal' ? 'División Principal' : `División ${divisionId}`;
        notifyGroupMovedToDivision({
          businessId,
          groupId: Number(groupToMove.id),
          groupName: groupToMove.nombre,
          divisionId: divisionId === 'principal' ? null : Number(divisionId),
          divisionName,
          scope: 'insumo',
        });

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

  const rubroNombreToCodigoMaxi = useMemo(() => {
    const m = new Map();
    if (rubrosMap && typeof rubrosMap.get === 'function') {
      for (const [codigo, info] of rubrosMap.entries()) {
        if (info?.nombre) m.set(String(info.nombre), String(codigo));
      }
    }
    return m;
  }, [rubrosMap]);

  return (
    <div className="sidebar">
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#fafafa',
        paddingBottom: 4,
        borderBottom: '1px solid #eee',
        marginBottom: 4,
      }}>
        <FormControl size="small" fullWidth sx={{ mb: 1, mt: 1 }}>
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
                          isMainDivision && onRenameGroup && (
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
                                  const oldName = g.nombre;
                                  const handleRename = async () => {
                                    const result = await onEditGroup(g);
                                    if (result && result.newName && result.newName !== oldName) {
                                      try {
                                        window.dispatchEvent(new CustomEvent('ui:action', {
                                          detail: {
                                            businessId, kind: 'group_rename', scope: 'insumo',
                                            title: 'Agrupación renombrada',
                                            message: `"${oldName}" → "${result.newName}"`,
                                            createdAt: new Date().toISOString(),
                                            payload: { groupId: Number(g.id), oldName, newName: result.newName },
                                          },
                                        }));
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
                                  try {
                                    window.dispatchEvent(new CustomEvent('ui:action', {
                                      detail: {
                                        businessId, kind: 'group_delete', scope: 'insumo',
                                        title: 'Agrupación eliminada',
                                        message: `"${g.nombre}" fue eliminada.`,
                                        createdAt: new Date().toISOString(),
                                        payload: { groupId: Number(g.id), groupName: g.nombre },
                                      },
                                    }));
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
                        </>
                      );
                    })()}
                  </span>
                </div>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Toggle elaborados / no-elaborados */}
        <div style={{ padding: '2px 0 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                    rubroCodigo={(() => {
                      // Intentar resolver el código Maxi desde rubrosMap usando el nombre
                      if (rubrosMap && typeof rubrosMap.get === 'function') {
                        // rubrosMap tiene codigo → info, necesitamos buscar por nombre
                        for (const [codigo, info] of rubrosMap.entries()) {
                          if (info?.nombre === rubro.nombre) return String(codigo);
                        }
                      }
                      return String(rubro.codigo || '');
                    })()}
                    isElaborado={rubro.es_elaborador === true}
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
                    onAfterRubroUpdate={onRefetch}
                    fromSidebar
                    businessId={originalBusinessId || businessId}
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

      {divisionModalOpen && (
        <AssignGroupToDivisionModal
          open={divisionModalOpen}
          group={groupToMove}
          businessId={businessId}
          currentDivisionId={activeDivisionId ?? null}
          onClose={() => { setDivisionModalOpen(false); setGroupToMove(null); }}
          onAssign={handleDivisionAssign}
        />
      )}
    </div>
  );
}

export default React.memo(InsumosSidebar);