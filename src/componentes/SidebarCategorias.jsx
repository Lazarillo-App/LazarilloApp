/* eslint-disable no-empty */
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
import DownloadIcon from '@mui/icons-material/Download';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import '../css/SidebarCategorias.css';

import { assignAgrupacionToDivision as assignAgrupacionToDivisionAPI } from '@/servicios/apiDivisions';
import { BusinessesAPI } from '@/servicios/apiBusinesses';

const norm = (s) => String(s || '').trim().toLowerCase();
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
    a?.article_id ?? a?.articulo_id ?? a?.articuloId ??
    a?.idArticulo ?? a?.id ?? a?.codigo ?? a?.code;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const fmtCurrency = (v) => {
  try {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
    }).format(n);
  } catch { return String(v || ''); }
};

const fmt = (v, decimals = 1) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toFixed(decimals).replace('.', ',');
};

const resolveArticuloMonto = (art, getAmountForId, metaById) => {
  const id = safeId(art);
  if (Number.isFinite(Number(id)) && getAmountForId) {
    const m = Number(getAmountForId(Number(id)) || 0);
    if (Number.isFinite(m)) return m;
  }
  const v = art?.ventas_monto ?? art?.ventasMonto ?? art?.ventas_total ??
    art?.ventasTotal ?? art?.monto ?? art?.amount ?? 0;
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  const qty = Number(art?.qty ?? art?.cantidad ?? art?.ventas_u ?? 0);
  const precio = Number(metaById?.get?.(id)?.precio ?? art?.precio ?? 0);
  if (Number.isFinite(qty) && Number.isFinite(precio)) return qty * precio;
  return 0;
};

// ── Modo sidebar: 'agrupaciones' | 'listas'
const SIDEBAR_MODE_KEY = 'lazarillo:sidebarMode';

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
  priceConfig = { byAgrupacion: {} },
  globalCostoIdeal = 30,
  onPriceConfigSave,
  agrupacionArticuloIds = [],
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
  activeDivisionAgrupacionIds = [],
  assignedAgrupacionIds = [],
  refetchAssignedAgrupaciones,
  // ── NUEVO: listas ──
  lists = [],
  activeListId = null,
  onSelectList,        // (listId) => void
  onDeleteList,        // (listId) => void
  onDownloadList,      // (listId, listName) => void
  totalBizAmount = 0,
  visibleSubrubro = null,
}) {
  const categoriasSafe = Array.isArray(categorias) ? categorias : [];
  const loading = categoriasSafe.length === 0;

  const [divisionModalOpen, setDivisionModalOpen] = useState(false);
  const [groupToMove, setGroupToMove] = useState(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [localListMode, setLocalListMode] = useState(listMode);
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  // ── NUEVO: modo sidebar (agrupaciones / listas)
  const [sidebarMode, setSidebarMode] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_MODE_KEY) || 'agrupaciones'; } catch { return 'agrupaciones'; }
  });

  const handleSidebarMode = useCallback((mode) => {
    if (!mode) return;
    setSidebarMode(mode);
    try { localStorage.setItem(SIDEBAR_MODE_KEY, mode); } catch { }
    // Al cambiar a agrupaciones, deseleccionar lista activa
    if (mode === 'agrupaciones') onSelectList?.(null);
  }, [onSelectList]);

  const divisionNum =
    activeDivisionId === null || activeDivisionId === undefined || activeDivisionId === ''
      ? null : Number(activeDivisionId);
  const isMainDivision =
    divisionNum === null || !Number.isFinite(divisionNum) || divisionNum <= 0;

  /* ===================== Opciones select agrupaciones ===================== */
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
      if (isMainDivision) return !assignedSet.has(idNum);
      return activeSet.has(idNum);
    });
    const todoCount = todo ? (todoCountOverride[todo.id] ?? todo.articulos?.length ?? 0) : 0;
    const ordered = [];
    if (isMainDivision && todo && todoCount > 0) ordered.push(todo);
    ordered.push(...middle);
    if (isMainDivision && todo && todoCount === 0) ordered.push(todo);
    if (isMainDivision) ordered.push(...discontinuados);
    return ordered;
  }, [agrupaciones, todoGroupId, todoCountOverride, assignedAgrupacionIds, activeDivisionAgrupacionIds, isMainDivision]);

  const selectedAgrupValue = useMemo(() => {
    const idsOpciones = opcionesSelect.map((g) => Number(g.id));
    const actualId = agrupacionSeleccionada ? Number(agrupacionSeleccionada.id) : null;
    if (actualId != null && idsOpciones.includes(actualId)) return actualId;
    const todoIdNum = Number(todoGroupId);
    if (Number.isFinite(todoIdNum) && idsOpciones.includes(todoIdNum)) return todoIdNum;
    return '';
  }, [opcionesSelect, agrupacionSeleccionada, todoGroupId]);

  useEffect(() => {
    const opts = Array.isArray(opcionesSelect) ? opcionesSelect : [];
    const currentId = agrupacionSeleccionada ? Number(agrupacionSeleccionada.id) : null;
    const existsInRaw = currentId != null &&
      (agrupaciones || []).some(g => Number(g.id) === currentId);
    if (existsInRaw) return;
    if (!opts.length) {
      if (agrupacionSeleccionada) {
        setAgrupacionSeleccionada?.(null);
        setCategoriaSeleccionada?.(null);
        setFiltroBusqueda?.('');
        setBusqueda?.('');
        onManualPick?.();
      }
      return;
    }
    const exists = currentId != null && opts.some(o => Number(o.id) === currentId);
    if (exists) return;
    const todoIdNum = Number(todoGroupId);
    const todoOpt = Number.isFinite(todoIdNum) ? opts.find(o => Number(o.id) === todoIdNum) : null;
    const favOpt = favoriteGroupId
      ? opts.find(o => Number(o.id) === Number(favoriteGroupId)) : null;
    const todoCount = todoOpt
      ? (todoCountOverride?.[todoOpt.id] ?? todoOpt.articulos?.length ?? 0) : 0;
    const next = (isMainDivision && todoOpt && todoCount > 0)
      ? todoOpt : (favOpt || opts[0] || null);
    setAgrupacionSeleccionada?.(next);
    setCategoriaSeleccionada?.(null);
    setFiltroBusqueda?.('');
    setBusqueda?.('');
    onManualPick?.();
  }, [opcionesSelect, agrupaciones, agrupacionSeleccionada, setAgrupacionSeleccionada,
    isMainDivision, todoGroupId, favoriteGroupId, setCategoriaSeleccionada,
    setFiltroBusqueda, setBusqueda, onManualPick]);

  useEffect(() => { setCategoriaSeleccionada?.(null); }, [divisionNum]);

  const activeIds = useMemo(() => {
    const g = agrupacionSeleccionada;
    if (g && esTodoGroup(g)) {
      return visibleIds instanceof Set ? visibleIds : new Set();
    }
    if (!g) return null;
    const gActual = (agrupaciones || []).find((x) => Number(x?.id) === Number(g?.id));
    const arr = Array.isArray(gActual?.articulos) ? gActual.articulos : [];
    const appIds = Array.isArray(gActual?.app_articles_ids) ? gActual.app_articles_ids : [];
    const s = new Set();
    arr.forEach((a) => { const id = safeId(a); if (id != null) s.add(id); });
    appIds.forEach(id => { const n = Number(id); if (n > 0) s.add(n); });
    if (s.size === 0 && visibleIds instanceof Set && visibleIds.size > 0) return visibleIds;
    return s;
  }, [agrupaciones, agrupacionSeleccionada, visibleIds]);

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

  useEffect(() => { setLocalListMode(listMode); }, [listMode]);

  const handleListModeChange = useCallback((newMode) => {
    if (!newMode) return;
    setLocalListMode(newMode);
    onChangeListMode?.(newMode);
  }, [onChangeListMode]);

  /* ========================== Árbol según modo ========================== */
  // Si activeIds no intersecta con el árbol (árbol aún cargando), no filtrar
  const activeIdsIntersectsTree = useMemo(() => {
    if (!activeIds || activeIds.size === 0) return false;
    for (const sub of categoriasSafe) {
      for (const c of (sub.categorias || [])) {
        for (const a of (c.articulos || [])) {
          if (activeIds.has(safeId(a))) return true;
        }
      }
    }
    return false;
  }, [activeIds, categoriasSafe]);

  const treeBySubrubro = useMemo(() => {
    if (!activeIds) return categoriasSafe;
    if (!activeIdsIntersectsTree) return categoriasSafe;
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
      for (const c of sub?.categorias || [])
        for (const art of c?.articulos || [])
          ventasMonto += resolveArticuloMonto(art, getAmountForId, metaById);
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
      const filtered = !activeIds || !activeIdsIntersectsTree ? arts : arts.filter((a) => {
        const id = safeId(a);
        return id != null && activeIds.has(id);
      });
      if (filtered.length > 0) {
        let ventasMonto = 0;
        for (const art of filtered) ventasMonto += resolveArticuloMonto(art, getAmountForId, metaById);
        out.push({ subrubro: catName, categorias: [{ categoria: catName, articulos: filtered }], __ventasMonto: ventasMonto });
      }
    }
    out.sort((a, b) => {
      if (b.__ventasMonto !== a.__ventasMonto) return b.__ventasMonto - a.__ventasMonto;
      return String(a.subrubro).localeCompare(String(b.subrubro), 'es', { sensitivity: 'base', numeric: true });
    });
    return out;
  }, [categoriasSafe, activeIds, getAmountForId, metaById]);

  const todoVacio = agrupacionSeleccionada && esTodoGroup(agrupacionSeleccionada) &&
    !(activeIds instanceof Set && activeIds.size > 0);
  const listaParaMostrar = todoVacio ? [] :
    (localListMode === 'by-categoria' ? treeByCategoria : treeBySubrubro);

  const agrupMonto = useMemo(
    () => (listaParaMostrar || []).reduce((acc, sub) => acc + (sub.__ventasMonto || 0), 0),
    [listaParaMostrar]
  );

  // Total de ventas solo de agrupaciones reales (excluye Sin Agrupación y Discontinuados)
  // Es el denominador correcto para que cada agrupación muestre su % dentro del negocio activo
  const totalAgrupacionesAmount = useMemo(() => {
    if (!getAmountForId) return totalBizAmount;
    let total = 0;
    for (const g of opcionesSelect || []) {
      if (esTodoGroup(g) || esDiscontinuadosGroup(g)) continue;
      for (const a of (g.articulos || [])) {
        const id = Number(a?.id ?? a?.articulo_id);
        if (Number.isFinite(id)) total += getAmountForId(id) || 0;
      }
    }
    return total > 0 ? total : totalBizAmount;
  }, [opcionesSelect, getAmountForId, totalBizAmount]);

  useEffect(() => {
    if (!categoriaSeleccionada) return;
    const stillVisible = listaParaMostrar.some(
      (sub) => sub?.subrubro === categoriaSeleccionada?.subrubro &&
        (sub?.categorias || []).some((c) => (c?.articulos?.length || 0) > 0)
    );
    if (!stillVisible) setCategoriaSeleccionada?.(null);
  }, [listaParaMostrar, categoriaSeleccionada, setCategoriaSeleccionada]);

  const handleAgrupacionChange = useCallback((event) => {
    const idSel = Number(event.target.value);
    const seleccionada = (agrupaciones || []).find((g) => Number(g?.id) === idSel) || null;
    setAgrupacionSeleccionada?.(seleccionada);
    setFiltroBusqueda?.('');
    setCategoriaSeleccionada?.(null);
    setBusqueda?.('');
    onManualPick?.();
  }, [agrupaciones, setAgrupacionSeleccionada, setFiltroBusqueda, setCategoriaSeleccionada, setBusqueda, onManualPick]);

  const handleCategoriaClick = useCallback((subItem) => {
    setCategoriaSeleccionada?.(categoriaSeleccionada?.subrubro === subItem?.subrubro ? null : subItem);
    setFiltroBusqueda?.('');
    setBusqueda?.('');
  }, [categoriaSeleccionada, setCategoriaSeleccionada, setFiltroBusqueda, setBusqueda]);

  const countArticulosSub = (sub) => {
    let total = 0;
    for (const c of sub?.categorias || []) total += c?.articulos?.length || 0;
    return total;
  };

  const montoArticulosSub = (sub) => {
    let total = 0;
    for (const c of sub?.categorias || [])
      for (const art of c?.articulos || [])
        total += resolveArticuloMonto(art, getAmountForId, metaById);
    return total;
  };

  const handleCreateSubBusiness = useCallback((agrupacion) => {
    onCreateSubBusiness?.(agrupacion);
  }, [onCreateSubBusiness]);

  const handleDivisionAssign = useCallback(async (divisionId) => {
    if (!groupToMove) return;
    try {
      await assignAgrupacionToDivisionAPI({
        businessId, agrupacionId: Number(groupToMove.id),
        divisionId: divisionId === 'principal' ? null : Number(divisionId),
      });
      const divisionName = divisionId === 'principal' ? 'División Principal' : `División ${divisionId}`;
      try {
        window.dispatchEvent(new CustomEvent('ui:action', {
          detail: {
            businessId, kind: 'group_move_division', scope: 'articulo',
            title: 'Agrupación movida a división',
            message: `"${labelAgrup(groupToMove)}" → ${divisionName}`,
            createdAt: new Date().toISOString(),
            payload: { groupId: Number(groupToMove.id), groupName: labelAgrup(groupToMove), divisionId: divisionId === 'principal' ? null : Number(divisionId), divisionName },
          },
        }));
      } catch { }
      notify?.(`Agrupación "${labelAgrup(groupToMove)}" movida correctamente`, 'success');
      await refetchAssignedAgrupaciones?.();
      await onRefetch?.();
      setDivisionModalOpen(false);
      setGroupToMove(null);
    } catch (err) {
      notify?.(err?.message || 'Error al asignar agrupación', 'error');
    }
  }, [groupToMove, businessId, notify, refetchAssignedAgrupaciones, onRefetch]);

  return (
    <div className="sidebar">
      {/* ── Controles fijos ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#fafafa', paddingBottom: 4,
        borderBottom: '1px solid #eee', marginBottom: 4,
      }}>
        {/* ── Toggle Agrupaciones / Listas ── */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 6, marginTop: 6 }}>
          <button
            onClick={() => handleSidebarMode('agrupaciones')}
            style={{
              flex: 1, padding: '4px 0', fontSize: '0.72rem', fontWeight: 600,
              border: '1px solid #e2e8f0', borderRight: 'none',
              borderRadius: '6px 0 0 6px', cursor: 'pointer',
              background: sidebarMode === 'agrupaciones' ? '#1e293b' : 'transparent',
              color: sidebarMode === 'agrupaciones' ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            Agrupaciones
          </button>
          <button
            onClick={() => handleSidebarMode('listas')}
            style={{
              flex: 1, padding: '4px 0', fontSize: '0.72rem', fontWeight: 600,
              border: '1px solid #e2e8f0',
              borderRadius: '0 6px 6px 0', cursor: 'pointer',
              background: sidebarMode === 'listas' ? '#1e293b' : 'transparent',
              color: sidebarMode === 'listas' ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            Listas {lists.length > 0 && <span style={{ opacity: 0.7 }}>({lists.length})</span>}
          </button>
        </div>

        {/* ── Select de agrupaciones (solo en modo agrupaciones) ── */}
        {sidebarMode === 'agrupaciones' && (
          <FormControl size="small" fullWidth sx={{ mb: 1 }}>
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
              {opcionesSelect.map((g) => {
                const gArts = (g.articulos || []);
                const gMonto = getAmountForId
                  ? gArts.reduce((acc, a) => {
                    const id = Number(a?.id ?? a?.articulo_id);
                    return acc + (Number.isFinite(id) ? (getAmountForId(id) || 0) : 0);
                  }, 0)
                  : 0;
                const gPct = totalAgrupacionesAmount > 0 && gMonto > 0 && !esTodoGroup(g) && !esDiscontinuadosGroup(g)
                  ? (gMonto / totalAgrupacionesAmount * 100).toFixed(1).replace('.', ',')
                  : null;
                return (
                  <MenuItem key={g.id} value={Number(g.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                      <span style={{ fontStyle: esDiscontinuadosGroup(g) ? 'italic' : 'normal', color: esDiscontinuadosGroup(g) ? '#555' : 'inherit' }}>
                        {labelAgrup(g)}
                        {gMonto > 0 && !esDiscontinuadosGroup(g) && !esTodoGroup(g) && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', marginLeft: 6, fontWeight: 600 }}>
                            {fmtCurrency(gMonto)}
                            {gPct && <span style={{ color: 'var(--color-text-secondary, #6b7280)', fontWeight: 500 }}> ({gPct}%)</span>}
                          </span>
                        )}
                      </span>
                      <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {(() => {
                          const isTodo = esTodoGroup(g);
                          const isDisc = esDiscontinuadosGroup(g);
                          if (isDisc) return null;
                          if (isTodo) {
                            return onRenameGroup && (
                              <Tooltip title='Convertir "Sin agrupación" en una nueva agrupación'>
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRenameGroup(g); }}>
                                  <EditIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            );
                          }
                          return (
                            <>
                              {onSetFavorite && (
                                <Tooltip title={Number(favoriteGroupId) === Number(g.id) ? 'Quitar como favorita' : 'Marcar como favorita'}>
                                  <IconButton size="small" onClick={(e) => {
                                    e.stopPropagation();
                                    const isFavorite = Number(favoriteGroupId) !== Number(g.id);
                                    try {
                                      window.dispatchEvent(new CustomEvent('ui:action', {
                                        detail: {
                                          businessId, kind: isFavorite ? 'group_favorite_set' : 'group_favorite_unset',
                                          scope: 'articulo', title: isFavorite ? 'Marcada como favorita' : 'Desmarcada como favorita',
                                          message: `"${labelAgrup(g)}"`, createdAt: new Date().toISOString(),
                                          payload: { groupId: Number(g.id), groupName: labelAgrup(g), isFavorite },
                                        },
                                      }));
                                    } catch { }
                                    onSetFavorite(g.id);
                                  }}>
                                    {Number(favoriteGroupId) === Number(g.id) ? <StarIcon fontSize="inherit" color="warning" /> : <StarBorderIcon fontSize="inherit" />}
                                  </IconButton>
                                </Tooltip>
                              )}
                              {onEditGroup && (
                                <Tooltip title="Renombrar agrupación">
                                  <IconButton size="small" onClick={(e) => {
                                    e.stopPropagation();
                                    const oldName = labelAgrup(g);
                                    const handleRename = async () => {
                                      const result = await onEditGroup(g);
                                      if (result?.newName && result.newName !== oldName) {
                                        try {
                                          window.dispatchEvent(new CustomEvent('ui:action', {
                                            detail: {
                                              businessId, kind: 'group_rename', scope: 'articulo',
                                              title: 'Agrupación renombrada', message: `"${oldName}" → "${result.newName}"`,
                                              createdAt: new Date().toISOString(),
                                              payload: { groupId: Number(g.id), oldName, newName: result.newName },
                                            },
                                          }));
                                        } catch { }
                                      }
                                    };
                                    handleRename();
                                  }}>
                                    <EditIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {onDeleteGroup && (
                                <Tooltip title="Eliminar agrupación">
                                  <span>
                                    <IconButton size="small" onClick={(e) => {
                                      e.stopPropagation();
                                      try {
                                        window.dispatchEvent(new CustomEvent('ui:action', {
                                          detail: {
                                            businessId, kind: 'group_delete', scope: 'articulo',
                                            title: 'Agrupación eliminada', message: `"${labelAgrup(g)}" fue eliminada.`,
                                            createdAt: new Date().toISOString(),
                                            payload: { groupId: Number(g.id), groupName: labelAgrup(g) },
                                          },
                                        }));
                                      } catch { }
                                      onDeleteGroup(g);
                                    }}>
                                      <DeleteIcon fontSize="inherit" color="error" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                              {!isTodo && !isDisc && (
                                <Tooltip title="Crear sub-negocio con esta agrupación">
                                  <IconButton size="small" onClick={(e) => {
                                    setSelectOpen(false);
                                    e.stopPropagation();
                                    handleCreateSubBusiness(g);
                                  }}>
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
                );
              })}
            </Select>
          </FormControl>
        )}

        {/* ── Select de listas (solo en modo listas) ── */}
        {sidebarMode === 'listas' && (
          <div style={{ marginBottom: 8 }}>
            {lists.length === 0 ? (
              <div style={{
                padding: '10px 12px', fontSize: '0.78rem', color: '#94a3b8',
                background: '#f8fafc', borderRadius: 8, border: '1px dashed #e2e8f0',
                textAlign: 'center', lineHeight: 1.5,
              }}>
                No hay listas guardadas.<br />
                <span style={{ fontSize: '0.72rem' }}>Seleccioná artículos y usá el botón "Lista".</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {lists.map(list => {
                  const isActive = activeListId === list.id;
                  return (
                    <div
                      key={list.id}
                      onClick={() => onSelectList?.(isActive ? null : list.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                        background: isActive ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
                        border: isActive ? '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' : '1px solid transparent',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: list.color || 'var(--color-primary)',
                        }} />
                        <span style={{
                          fontSize: '0.82rem', fontWeight: isActive ? 600 : 500,
                          color: isActive ? 'var(--color-primary)' : '#374151',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {list.name}
                        </span>
                        {list.item_count > 0 && (
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', flexShrink: 0 }}>
                            ({list.item_count})
                          </span>
                        )}
                      </div>
                      {onDownloadList && (
                        <Tooltip title="Descargar ventas de esta lista">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onDownloadList(list.id, list.name); }}
                            sx={{ opacity: 0.4, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                          >
                            <DownloadIcon fontSize="inherit" color="primary" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onDeleteList && (
                        <Tooltip title="Eliminar lista">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }}
                            sx={{ opacity: 0.4, '&:hover': { opacity: 1 }, flexShrink: 0 }}
                          >
                            <DeleteIcon fontSize="inherit" color="error" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Toggle Rubro/SubRubro (solo en modo agrupaciones) ── */}
        {sidebarMode === 'agrupaciones' && (
          <div style={{ padding: '2px 0 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ToggleButtonGroup
              size="small" exclusive value={localListMode}
              onChange={(_, val) => handleListModeChange(val)}
              disabled={loadingPrefs}
            >
              <ToggleButton value="by-subrubro">Rubro</ToggleButton>
              <ToggleButton value="by-categoria">SubRubro</ToggleButton>
            </ToggleButtonGroup>
          </div>
        )}
      </div>

      {/* ── Lista de rubros/subrubros (solo en modo agrupaciones) ── */}
      {sidebarMode === 'agrupaciones' && (
        <ul className="sidebar-draggable-list">
          {loading && <li style={{ opacity: 0.7 }}>Cargando {localListMode === 'by-categoria' ? 'categorías' : 'subrubros'}…</li>}
          {!loading && listaParaMostrar.map((sub) => {
            const keyStr = String(sub?.subrubro || (localListMode === 'by-categoria' ? 'Sin categoría' : 'Sin subrubro'));
            const active = categoriaSeleccionada?.subrubro === sub?.subrubro;
            const monto = montoArticulosSub(sub);
            const isScrollVisible = !active && visibleSubrubro &&
              norm(sub?.subrubro || '') === norm(visibleSubrubro || '');
            const articuloIdsRaw = (sub?.categorias || []).flatMap((c) => c?.articulos || []).map((a) => safeId(a)).filter(Boolean);
            const articuloIds = (activeIds instanceof Set && activeIds.size > 0)
              ? articuloIdsRaw.filter(id => activeIds.has(id)) : articuloIdsRaw;
            const subNormMenu = String(sub?.subrubro || '').trim().toLowerCase();
            const isTodoActual = esTodoGroup(agrupacionSeleccionada);
            const todosArticulosParaMenu = isTodoActual ? categoriasSafe
              : localListMode === 'by-categoria'
                ? categoriasSafe.map((node) => {
                  const cats = (node?.categorias || []).filter(c => String(c?.categoria || '').trim().toLowerCase() === subNormMenu);
                  if (!cats.length) return null;
                  return { ...node, categorias: cats };
                }).filter(Boolean)
                : [sub];

            return (
              <li key={keyStr}
                className={[active ? 'categoria-activa' : ''].join(' ').trim()}
                title={keyStr}
                style={{
                  userSelect: 'none',
                  borderLeft: isScrollVisible ? '3px solid var(--color-primary)' : '3px solid transparent',
                  background: isScrollVisible ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : undefined,
                  transition: 'background 0.2s, border-left 0.2s',
                }}
              >
                {/* Fila principal — toda clickeable */}
                <div
                  onClick={() => handleCategoriaClick(sub)}
                  style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: 8, cursor: 'pointer',
                    flex: 1, width: '100%',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span className="icono" />
                    <span style={{ wordBreak: 'break-word', lineHeight: 1.3 }}>
                      {keyStr}
                    </span>
                  </span>

                  {/* Monto + % apilados verticalmente */}
                  {typeof monto === 'number' && monto > 0 && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                      opacity: 0.75, flexShrink: 0,
                    }}>
                      <small style={{ fontSize: '0.72 rem', fontWeight: 600 }}>
                        {fmtCurrency(monto)}
                      </small>
                      {agrupMonto > 0 && (
                        <span style={{
                          color: 'black',
                          fontSize: '0.65rem', fontWeight: 600,
                        }}>
                          {fmt(monto / agrupMonto * 100)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones siempre en su propia fila */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                  <SubrubroAccionesMenu
                    subrubro={sub?.subrubro}
                    articuloIds={articuloIds}
                    businessId={businessId}
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
                    allowedIds={!esTodoGroup(agrupacionSeleccionada) && activeIds instanceof Set && activeIds.size > 0 ? activeIds : null}
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
      )}

      {/* ── En modo listas: mensaje de ayuda cuando hay lista activa ── */}
      {sidebarMode === 'listas' && activeListId && (
        <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
          Mostrando artículos de la lista seleccionada.
          <br />
          <span
            onClick={() => onSelectList?.(null)}
            style={{ color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Ver todos
          </span>
        </div>
      )}
    </div>
  );
}

export default React.memo(SidebarCategorias);