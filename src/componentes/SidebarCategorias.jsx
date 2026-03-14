/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useCallback, useState } from 'react';
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

import SubrubroAccionesMenu from './SubrubroAccionesMenu';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import '../css/SidebarCategorias.css';

import { assignAgrupacionToDivision as assignAgrupacionToDivisionAPI } from '@/servicios/apiDivisions';
import { BusinessesAPI } from '@/servicios/apiBusinesses';

const norm = (s) => String(s || '').trim().toLowerCase();

// ✅ unifico nombre visible para grupos viejos/nuevos
const groupLabel = (g) => String(g?.name ?? g?.nombre ?? '').trim();

const esTodoGroup = (g) => {
  const n = norm(groupLabel(g));
  return (
    n === 'todo' ||
    n === 'sin agrupacion' ||
    n === 'sin agrupación' ||
    n === 'sin agrupar' ||
    n === 'sin grupo'
  );
};

const esDiscontinuadosGroup = (g) => {
  const n = norm(groupLabel(g));
  return n === 'discontinuados' || n === 'descontinuados';
};

const labelAgrup = (g) => groupLabel(g);

const safeId = (a) => {
  const raw =
    a?.article_id ??
    a?.articulo_id ??
    a?.articuloId ??
    a?.idArticulo ??
    a?.id ??
    a?.codigo ??
    a?.code;

  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
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

const resolveArticuloMonto = (art, getAmountForId, metaById) => {
  const id = safeId(art);

  if (Number.isFinite(Number(id)) && getAmountForId) {
    const m = Number(getAmountForId(Number(id)) || 0);
    if (Number.isFinite(m)) return m;
  }

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

  const qty = Number(art?.qty ?? art?.cantidad ?? art?.ventas_u ?? 0);
  const precio = Number(metaById?.get?.(id)?.precio ?? art?.precio ?? 0);

  if (Number.isFinite(qty) && Number.isFinite(precio)) return qty * precio;
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
  todoCountOverride = {},
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
  onCreateSubBusiness,

  businessId,
  activeDivisionId,

  // ✅ NUEVO (AGRUPACIONES POR DIVISIÓN)
  activeDivisionAgrupacionIds = [],
  assignedAgrupacionIds = [],
  refetchAssignedAgrupaciones,
}) {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];
  const loading = categoriasSafe.length === 0;

  const [divisionModalOpen, setDivisionModalOpen] = useState(false);
  const [groupToMove, setGroupToMove] = useState(null);
  const [selectOpen, setSelectOpen] = useState(false);

  // ✅ NUEVO: Estado local del listMode mientras carga la preferencia
  const [localListMode, setLocalListMode] = useState(listMode);
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  // subBizModal movido a ArticulosMain para evitar re-renders que bloquean inputs

  const divisionNum =
    activeDivisionId === null || activeDivisionId === undefined || activeDivisionId === ''
      ? null
      : Number(activeDivisionId);

  const isMainDivision =
    divisionNum === null || !Number.isFinite(divisionNum) || divisionNum <= 0;

  /* ===================== Select de agrupaciones (FILTRADO POR DIVISIÓN) ===================== */

  const opcionesSelect = useMemo(() => {
    const arr = (Array.isArray(agrupaciones) ? agrupaciones : []).filter(Boolean);
    if (!arr.length) return [];

    const todoIdNum = Number(todoGroupId);
    const todo = Number.isFinite(todoIdNum) ? arr.find((g) => Number(g.id) === todoIdNum) : null;

    const discontinuados = arr.filter(esDiscontinuadosGroup);
    const discIds = new Set(discontinuados.map((g) => Number(g.id)));

    const assignedSet = new Set((assignedAgrupacionIds || []).map(Number));
    const activeSet = new Set((activeDivisionAgrupacionIds || []).map(Number));

    const middle = arr.filter((g) => {
      const idNum = Number(g?.id);
      if (!Number.isFinite(idNum) || idNum <= 0) return false;
      if (todo && idNum === Number(todo.id)) return false;
      if (discIds.has(idNum)) return false;

      // ✅ Principal: mostrar NO asignadas
      if (isMainDivision) return !assignedSet.has(idNum);

      // ✅ División X: mostrar solo asignadas a esa división
      return activeSet.has(idNum);
    });

    const todoCount = todo
      ? (todoCountOverride[todo.id] ?? todo.articulos?.length ?? 0)
      : 0;

    const ordered = [];
    if (isMainDivision && todo && todoCount > 0) ordered.push(todo); // primero si tiene artículos
    ordered.push(...middle);
    if (isMainDivision && todo && todoCount === 0) ordered.push(todo); // al final si está vacío
    if (isMainDivision) ordered.push(...discontinuados);
    return ordered;
  }, [agrupaciones, todoGroupId, todoCountOverride, assignedAgrupacionIds, activeDivisionAgrupacionIds, isMainDivision]);

  const selectedAgrupValue = useMemo(() => {
    const idsOpciones = opcionesSelect.map((g) => Number(g.id));
    const actualId = agrupacionSeleccionada ? Number(agrupacionSeleccionada.id) : null;

    if (actualId != null && idsOpciones.includes(actualId)) return actualId;

    // fallback: si existe TODO en opciones, default a TODO
    const todoIdNum = Number(todoGroupId);
    if (Number.isFinite(todoIdNum) && idsOpciones.includes(todoIdNum)) return todoIdNum;

    return '';
  }, [opcionesSelect, agrupacionSeleccionada, todoGroupId]);

  // ✅ Auto-fix: si cambian las opciones (por división) y la agrupación actual ya no es válida,
  // elegir una válida y resetear filtros como si el usuario lo hubiera cambiado.
  useEffect(() => {
    const opts = Array.isArray(opcionesSelect) ? opcionesSelect : [];
    if (!opts.length) {
      // si no hay opciones, limpiar selección para no quedar pegada a una vieja
      if (agrupacionSeleccionada) {
        setAgrupacionSeleccionada?.(null);
        setCategoriaSeleccionada?.(null);
        setFiltroBusqueda?.('');
        setBusqueda?.('');
        onManualPick?.();
      }
      return;
    }

    const currentId = agrupacionSeleccionada ? Number(agrupacionSeleccionada.id) : null;
    const exists = currentId != null && opts.some(o => Number(o.id) === currentId);

    if (exists) return;

    // elegir default
    const todoIdNum = Number(todoGroupId);
    const todoOpt =
      Number.isFinite(todoIdNum) ? opts.find(o => Number(o.id) === todoIdNum) : null;

    // Intentar usar la favorita antes de caer a opts[0]
    const favOpt = favoriteGroupId
      ? opts.find(o => Number(o.id) === Number(favoriteGroupId))
      : null;

    // Si todo está vacío no usarlo como default — ir a favorita u opts[0]
    const todoCount = todoOpt
      ? (todoCountOverride?.[todoOpt.id] ?? todoOpt.articulos?.length ?? 0)
      : 0;

    const next = (isMainDivision && todoOpt && todoCount > 0)
      ? todoOpt
      : (favOpt || opts[0] || null);

    // aplicar selección y resetear estado igual que en handleAgrupacionChange
    setAgrupacionSeleccionada?.(next);
    setCategoriaSeleccionada?.(null);
    setFiltroBusqueda?.('');
    setBusqueda?.('');
    onManualPick?.();
  }, [
    opcionesSelect,
    agrupacionSeleccionada,
    setAgrupacionSeleccionada,
    isMainDivision,
    todoGroupId,
    favoriteGroupId,
    setCategoriaSeleccionada,
    setFiltroBusqueda,
    setBusqueda,
    onManualPick
  ]);

  useEffect(() => {
    // cada vez que cambia la división, limpiamos la selección de categoría
    setCategoriaSeleccionada?.(null);
  }, [divisionNum]);

  /* ===================== VisibleIds / activeIds ===================== */

  const activeIds = useMemo(() => {
    const g = agrupacionSeleccionada;

    // Sin Agrupación: siempre usar visibleIds si existe (puede ser Set vacío),
    // nunca null — así el árbol queda vacío cuando no hay artículos sin agrupar
    if (g && esTodoGroup(g)) {
      return visibleIds instanceof Set ? visibleIds : new Set();
    }

    // Para el resto: si viene visibleIds con contenido, manda
    if (visibleIds && visibleIds.size) return visibleIds;

    if (!g) return null;

    const gActual = (agrupaciones || []).find((x) => Number(x?.id) === Number(g?.id));
    const arr = Array.isArray(gActual?.articulos) ? gActual.articulos : [];
    const appIds = Array.isArray(gActual?.app_articles_ids) ? gActual.app_articles_ids : [];

    if (!arr.length && !appIds.length) return new Set();

    const s = new Set(arr.map((a) => safeId(a)).filter((id) => id != null));
    appIds.forEach(id => { const n = Number(id); if (n > 0) s.add(n); });
    return s;
  }, [visibleIds, agrupacionSeleccionada, agrupaciones]);


  // Mantener referencia actualizada si cambia el objeto en "agrupaciones"
  useEffect(() => {
    if (!agrupacionSeleccionada) return;

    const g = (agrupaciones || []).find((x) => Number(x?.id) === Number(agrupacionSeleccionada.id));
    if (!g) return;

    const changed =
      groupLabel(g) !== groupLabel(agrupacionSeleccionada) ||
      (Array.isArray(g.articulos) ? g.articulos.length : 0) !==
      (Array.isArray(agrupacionSeleccionada.articulos) ? agrupacionSeleccionada.articulos.length : 0);

    if (changed) setAgrupacionSeleccionada?.(g);
  }, [agrupaciones, agrupacionSeleccionada, setAgrupacionSeleccionada]);

  /* ===================== ✅ CARGAR PREFERENCIA DE VISTA AL CAMBIAR AGRUPACIÓN ===================== */

  useEffect(() => {
    // Sincronizar localListMode cuando cambia el prop listMode desde el padre
    setLocalListMode(listMode);
  }, [listMode]);

  /* ===================== ✅ GUARDAR PREFERENCIA AL CAMBIAR TOGGLE ===================== */

  const handleListModeChange = useCallback(
    (newMode) => {
      if (!newMode) return;
      setLocalListMode(newMode);
      onChangeListMode?.(newMode);
    },
    [onChangeListMode]
  );

  /* ========================== Árbol según modo + ORDEN POR VENTAS ========================== */

  const treeBySubrubro = useMemo(() => {
    if (!activeIds) return categoriasSafe;

    const pruned = categoriasSafe
      .map((sub) => {
        const cats = Array.isArray(sub?.categorias) ? sub.categorias : [];
        const keepCategorias = cats
          .map((c) => {
            const arts = (Array.isArray(c?.articulos) ? c.articulos : []).filter((a) => {
              const id = safeId(a);
              return id != null && activeIds.has(id);
            });
            return { ...c, articulos: arts };
          })
          .filter((c) => (Array.isArray(c.articulos) ? c.articulos.length : 0) > 0);

        return { ...sub, categorias: keepCategorias };
      })
      .filter((sub) => {
        let total = 0;
        for (const c of sub?.categorias || []) total += c?.articulos?.length || 0;
        return total > 0;
      });

    const withVentas = pruned.map((sub) => {
      let ventasMonto = 0;
      for (const c of sub?.categorias || []) {
        for (const art of c?.articulos || []) {
          ventasMonto += resolveArticuloMonto(art, getAmountForId, metaById);
        }
      }
      return { ...sub, __ventasMonto: ventasMonto };
    });

    withVentas.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) return b.__ventasMonto - a.__ventasMonto;
      return String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true });
    });

    return withVentas;
  }, [categoriasSafe, activeIds, getAmountForId, metaById]);

  const treeByCategoria = useMemo(() => {
    const catMap = new Map();

    for (const sub of categoriasSafe) {
      for (const c of sub?.categorias || []) {
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
        : arts.filter((a) => {
          const id = safeId(a);
          return id != null && activeIds.has(id);
        });

      if (filtered.length > 0) {
        let ventasMonto = 0;
        for (const art of filtered) ventasMonto += resolveArticuloMonto(art, getAmountForId, metaById);

        out.push({
          subrubro: catName,
          categorias: [{ categoria: catName, articulos: filtered }],
          __ventasMonto: ventasMonto,
        });
      }
    }

    out.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) return b.__ventasMonto - a.__ventasMonto;
      return String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true });
    });

    return out;
  }, [categoriasSafe, activeIds, getAmountForId, metaById]);

  // Si está seleccionado "Sin Agrupación" y no tiene artículos, el árbol va vacío directo
  // sin depender de que activeIds filtre correctamente (evita mostrar rubros/subrubros fantasma)
  const todoVacio = agrupacionSeleccionada && esTodoGroup(agrupacionSeleccionada) &&
    !(activeIds instanceof Set && activeIds.size > 0);

  const listaParaMostrar = todoVacio
    ? []
    : (localListMode === 'by-categoria' ? treeByCategoria : treeBySubrubro);

  /* ========================== UX: selección & contadores ========================== */

  useEffect(() => {
    if (!categoriaSeleccionada) return;

    const stillVisible = listaParaMostrar.some(
      (sub) =>
        sub?.subrubro === categoriaSeleccionada?.subrubro &&
        (sub?.categorias || []).some((c) => (c?.articulos?.length || 0) > 0)
    );

    if (!stillVisible) setCategoriaSeleccionada?.(null);
  }, [listaParaMostrar, categoriaSeleccionada, setCategoriaSeleccionada]);

  const handleAgrupacionChange = useCallback(
    (event) => {
      const idSel = Number(event.target.value);
      const seleccionada = (agrupaciones || []).find((g) => Number(g?.id) === idSel) || null;

      setAgrupacionSeleccionada?.(seleccionada);
      setFiltroBusqueda?.('');
      setCategoriaSeleccionada?.(null);
      setBusqueda?.('');
      onManualPick?.();
    },
    [agrupaciones, setAgrupacionSeleccionada, setFiltroBusqueda, setCategoriaSeleccionada, setBusqueda, onManualPick]
  );

  const handleCategoriaClick = useCallback(
    (subItem) => {
      console.log('[Sidebar] click:', subItem?.subrubro, '| setCat fn:', typeof setCategoriaSeleccionada);
      window.__LAST_CLICK = subItem;
      setCategoriaSeleccionada?.(categoriaSeleccionada?.subrubro === subItem?.subrubro ? null : subItem);
      setFiltroBusqueda?.('');
      setBusqueda?.('');
    },
    [categoriaSeleccionada, setCategoriaSeleccionada, setFiltroBusqueda, setBusqueda]
  );

  const countArticulosSub = (sub) => {
    let total = 0;
    for (const c of sub?.categorias || []) total += c?.articulos?.length || 0;
    return total;
  };

  const montoArticulosSub = (sub) => {
    let total = 0;
    for (const c of sub?.categorias || []) {
      for (const art of c?.articulos || []) total += resolveArticuloMonto(art, getAmountForId, metaById);
    }
    return total;
  };

  /* ========================== Modal asignación división ========================== */

  const handleMoveGroupToDivision = useCallback((agrupacion) => {
    setGroupToMove(agrupacion);
    setDivisionModalOpen(true);
  }, []);

  const handleCreateSubBusiness = useCallback((agrupacion) => {
    onCreateSubBusiness?.(agrupacion);
  }, [onCreateSubBusiness]);

  const handleDivisionAssign = useCallback(
    async (divisionId) => {
      if (!groupToMove) return;

      try {
        await assignAgrupacionToDivisionAPI({
          businessId,
          agrupacionId: Number(groupToMove.id),
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
                scope: 'articulo',
                title: 'Agrupación movida a división',
                message: `"${labelAgrup(groupToMove)}" → ${divisionName}`,
                createdAt: new Date().toISOString(),
                payload: {
                  groupId: Number(groupToMove.id),
                  groupName: labelAgrup(groupToMove),
                  divisionId: divisionId === 'principal' ? null : Number(divisionId),
                  divisionName,
                },
              },
            })
          );
        } catch (err) {
          console.warn('[SidebarCategorias] Error emitiendo notificación:', err);
        }

        notify?.(`Agrupación "${labelAgrup(groupToMove)}" movida correctamente`, 'success');

        // ✅ refrescar "quién está asignada a qué"
        await refetchAssignedAgrupaciones?.();

        // ✅ refrescar lista de agrupaciones (para que se re-scopee y/o se actualicen articulos)
        await onRefetch?.();

        setDivisionModalOpen(false);
        setGroupToMove(null);
      } catch (err) {
        console.error('[SidebarCategorias] ❌ Error asignando agrupación:', err);
        notify?.(err?.message || 'Error al asignar agrupación', 'error');
      }
    },
    [groupToMove, businessId, notify, refetchAssignedAgrupaciones, onRefetch]
  );

  return (
    <div className="sidebar">
      {/* ── Controles fijos: Select de agrupación + Toggle rubro/subrubro ── */}
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
            open={selectOpen}
            onOpen={() => setSelectOpen(true)}
            onClose={() => setSelectOpen(false)}
            value={selectedAgrupValue}
            onChange={handleAgrupacionChange}
            renderValue={(value) => {
              const g = opcionesSelect.find((x) => Number(x.id) === Number(value));
              return g ? labelAgrup(g) : 'Sin agrupación';
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

                                  // ✅ Emitir notificación ANTES de cambiar favorita
                                  const isFavorite = Number(favoriteGroupId) !== Number(g.id);
                                  try {
                                    window.dispatchEvent(
                                      new CustomEvent('ui:action', {
                                        detail: {
                                          businessId,
                                          kind: isFavorite ? 'group_favorite_set' : 'group_favorite_unset',
                                          scope: 'articulo',
                                          title: isFavorite ? 'Marcada como favorita' : 'Desmarcada como favorita',
                                          message: `"${labelAgrup(g)}"`,
                                          createdAt: new Date().toISOString(),
                                          payload: {
                                            groupId: Number(g.id),
                                            groupName: labelAgrup(g),
                                            isFavorite,
                                          },
                                        },
                                      })
                                    );
                                  } catch (err) {
                                    console.warn('[SidebarCategorias] Error emitiendo notificación:', err);
                                  }

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

                                  // ✅ Guardar nombre anterior
                                  const oldName = labelAgrup(g);

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
                                              scope: 'articulo',
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
                                        console.warn('[SidebarCategorias] Error emitiendo notificación:', err);
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
                              <span>
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
                                            scope: 'articulo',
                                            title: 'Agrupación eliminada',
                                            message: `"${labelAgrup(g)}" fue eliminada.`,
                                            createdAt: new Date().toISOString(),
                                            payload: {
                                              groupId: Number(g.id),
                                              groupName: labelAgrup(g),
                                            },
                                          },
                                        })
                                      );
                                    } catch (err) {
                                      console.warn('[SidebarCategorias] Error emitiendo notificación:', err);
                                    }

                                    onDeleteGroup(g);
                                  }}
                                >
                                  <DeleteIcon fontSize="inherit" color="error" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}

                          {/* ✅ asignar a división: solo en Principal y no para TODO/DISC */}
                          {!isTodo && !isDisc && (
                            <Tooltip title="Crear sub-negocio con esta agrupación">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  setSelectOpen(false);
                                  e.stopPropagation();
                                  handleCreateSubBusiness(g);
                                }}
                              >
                                <AddBusinessIcon fontSize="inherit" />
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

        <div style={{ padding: '2px 0 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={localListMode}
            onChange={(_, val) => {
              handleListModeChange(val);
            }}
            disabled={loadingPrefs}
          >
            <ToggleButton value="by-subrubro">Rubro</ToggleButton>
            <ToggleButton value="by-categoria">SubRubro</ToggleButton>
          </ToggleButtonGroup>
        </div>
      </div>{/* fin sticky */}

      <ul className="sidebar-draggable-list">
        {loading && (
          <li style={{ opacity: 0.7 }}>
            Cargando {localListMode === 'by-categoria' ? 'categorías' : 'subrubros'}…
          </li>
        )}

        {!loading &&
          listaParaMostrar.map((sub) => {
            const keyStr = String(
              sub?.subrubro || (localListMode === 'by-categoria' ? 'Sin categoría' : 'Sin subrubro')
            );
            const active = categoriaSeleccionada?.subrubro === sub?.subrubro;

            const count = countArticulosSub(sub);
            const monto = montoArticulosSub(sub);

            // articuloIds: los ids del nodo visible (siempre desde sub.categorias)
            const articuloIds = (sub?.categorias || [])
              .flatMap((c) => c?.articulos || [])
              .map((a) => safeId(a))
              .filter(Boolean);

            const subNormMenu = String(sub?.subrubro || '').trim().toLowerCase();

            const todosArticulosParaMenu = localListMode === 'by-categoria'
              // Vista by-categoria: sub.subrubro es el nombre de la categoria/rubro
              // Filtramos en categoriasSafe solo esa categoria especifica
              ? categoriasSafe
                .map((node) => {
                  const cats = (node?.categorias || []).filter(
                    (c) => String(c?.categoria || '').trim().toLowerCase() === subNormMenu
                  );
                  if (!cats.length) return null;
                  return { ...node, categorias: cats };
                })
                .filter(Boolean)
              // Vista by-subrubro: pasamos el nodo actual ya filtrado
              : [sub];

            return (
              <li
                key={keyStr}
                className={[active ? 'categoria-activa' : ''].join(' ').trim()}
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
                    {typeof monto === 'number' && monto > 0 ? `  ${fmtCurrency(monto)}` : ''}
                  </small>

                  <SubrubroAccionesMenu
                    subrubro={sub?.subrubro}
                    articuloIds={articuloIds}
                    todosArticulos={todosArticulosParaMenu}
                    agrupaciones={agrupaciones}
                    agrupacionSeleccionada={agrupacionSeleccionada}
                    todoGroupId={todoGroupId}
                    isTodo={esTodoGroup(agrupacionSeleccionada)}
                    onMutateGroups={onMutateGroups}
                    onRefetch={onRefetch}
                    notify={notify}
                    baseById={metaById}
                    treeMode={localListMode === 'by-categoria' ? 'cat-first' : 'sr-first'}
                    allowedIds={activeIds instanceof Set && activeIds.size > 0 ? activeIds : null}
                  />
                </div>
              </li>
            );
          })}

        {!loading && listaParaMostrar.length === 0 && (
          <li style={{ opacity: 0.7 }}>
            {agrupacionSeleccionada && /discontinuad/i.test(groupLabel(agrupacionSeleccionada) || '')
              ? 'No hay Rubros/Subrubros discontinuados.'
              : 'No hay Rubros/Subrubros en esta agrupación.'}
          </li>
        )}
      </ul>
    </div>
  );
}

export default React.memo(SidebarCategorias);