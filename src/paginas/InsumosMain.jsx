/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/paginas/InsumosMain.jsx

import { showAlert } from '../servicios/appAlert';
import { showPrompt } from '../servicios/appPrompt';
import { showConfirm } from '../servicios/appConfirm';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import InsumosSidebar from '../componentes/InsumosSidebar.jsx';
import InsumosTable from '../componentes/InsumosTable.jsx';
import InsumoGroupModal from '../componentes/InsumoGroupModal.jsx';
import Buscador from '../componentes/Buscador.jsx';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import {
  insumosList,
  insumoGroupsList,
  insumoGroupUpdate,
  insumoGroupDelete,
  insumosRubrosList,
  insumoGroupAddMultipleItems,
  insumoGroupRemoveItem,
  insumoGroupCreateOrMove,
} from '../servicios/apiInsumos';
import { applyMutation } from '../utils/groupMutations';
import {
  ensureTodoInsumos,
  getExclusionesInsumos,
  ensureDiscontinuadosInsumos,
} from '../servicios/apiInsumosTodo';
import {
  notifyGroupRenamed,
  notifyGroupDeleted,
  notifyGroupMovedToDivision,
  notifyGroupFavoriteChanged,
} from '../servicios/notifyGroupActions';
import { useActiveBusiness, useBusiness } from '../context/BusinessContext';
import { useOrganization } from '../context/OrganizationContext';
import { Snackbar, Alert, Button, CircularProgress, Tooltip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { usePersistUiActions } from '@/hooks/usePersistUiActions';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
import { useFirstDate } from '../hooks/useFirstDate';
import { purchasesSync, purchasesList, purchasesDownloadCsv, buildComprasMap } from '../servicios/apiPurchases';
import ComprasActionsMenu from '../componentes/ComprasActionsMenu.jsx';
import UploadComprasModal from '../componentes/UploadComprasModal.jsx';
import '../css/global.css';
import '../css/theme-layout.css';
import '../css/TablaArticulos.css';

const getFavKey = (bizId) => `favInsumoGroupId_${bizId || 'default'}`;
const VIEW_KEY = 'lazarillo:insumosViewMode';
const DEFAULT_VISTA = 'no-elaborados';

const norm = (s) => String(s || '').trim().toLowerCase();

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (s) => normalize(s).split(' ').filter(Boolean);

function scoreMatch(nombre, query) {
  const q = normalize(query);
  if (!q) return { tier: 999, pos: 999, len: 999 };
  const qTokens = tokenize(q);
  const tokens = tokenize(nombre);
  let bestExactPos = 999;
  for (const qt of qTokens) {
    const pos = tokens.findIndex((t) => t === qt);
    if (pos !== -1) bestExactPos = Math.min(bestExactPos, pos);
  }
  if (bestExactPos !== 999) return { tier: 0, pos: bestExactPos, len: tokens[bestExactPos]?.length ?? 999 };
  let bestPrefixPos = 999;
  for (const qt of qTokens) {
    const pos = tokens.findIndex((t) => t.startsWith(qt));
    if (pos !== -1) bestPrefixPos = Math.min(bestPrefixPos, pos);
  }
  if (bestPrefixPos !== 999) return { tier: 1, pos: bestPrefixPos, len: tokens[bestPrefixPos]?.length ?? 999 };
  const hay = normalize(nombre);
  const idx = hay.indexOf(q);
  if (idx !== -1) return { tier: 2, pos: idx, len: q.length };
  return { tier: 999, pos: 999, len: 999 };
}

const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'todo' || n === 'sin agrupacion' || n === 'sin agrupación' || n === 'sin agrupar' || n === 'sin grupo';
};

const esDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

const vistaForInsumo = (insumo, rubrosMap) => {
  const rubroCodigo = String(insumo?.rubro_codigo || insumo?.rubro || '');
  const info = rubrosMap?.get(rubroCodigo);
  return info?.es_elaborador === true ? 'elaborados' : 'no-elaborados';
};

export default function InsumosMain() {
  const biz = useBusiness() || {};
  const { businessId } = useActiveBusiness();

  // Primera fecha histórica de compras — específica por negocio
  const { firstDate: firstDateCompras, loadingFirst: loadingFirstCompras } = useFirstDate(businessId, 'purchases');

  // Si el rango activo es "Histórico" y cambia el negocio/firstDate, actualizar el from automáticamente
  useEffect(() => {
    if (rangoCompras?.mode === 'all' && firstDateCompras) {
      setRangoCompras(prev => ({ ...prev, from: firstDateCompras }));
    }
  }, [firstDateCompras]); // eslint-disable-line react-hooks/exhaustive-deps
  const { rootBusiness, organization } = useOrganization();
  // resolvedBizId: usar el principal de la org solo si el negocio activo pertenece a ella
  // Si es un negocio independiente (fuera de la org), usar su propio ID
  const activeInOrg = (organization?.businesses || []).some(
    b => String(b.id) === String(businessId)
  );
  const resolvedBizId = (rootBusiness?.id && activeInOrg)
    ? String(rootBusiness.id)
    : businessId;
  console.log('[InsumosMain] businessId:', businessId, '| activeInOrg:', activeInOrg, '| resolvedBizId:', resolvedBizId, '| orgBizIds:', (organization?.businesses||[]).map(b=>b.id));

  const {
    activeDivisionId,
    activeDivisionInsumoGroupIds,
    assignedInsumoGroupIds,
    isMainDivision,
    activeDivisionName,
    refetchAssignedInsumoGroups,
  } = biz;

  const { activeBusiness, activeSubnegocio } = biz;

  const businessName = useMemo(() => {
    if (activeSubnegocio?.nombre) return `${activeBusiness?.nombre || 'Negocio'} › ${activeSubnegocio.nombre}`;
    return activeBusiness?.nombre || null;
  }, [activeBusiness, activeSubnegocio]);

  useEffect(() => {
    if (!businessId) return;
    try { localStorage.setItem('activeBusinessId', String(businessId)); } catch { }
  }, [businessId]);

  /* ── Estado básico ── */
  const [rubroSeleccionado, setRubroSeleccionado] = useState(null);
  // vista: 'elaborados' | 'no-elaborados' — se actualiza al cambiar de agrupación
  const [vista, setVista] = useState(DEFAULT_VISTA);
  const [reloadKey, setReloadKey] = useState(0);
  const [allInsumos, setAllInsumos] = useState([]);
  const [rubrosMap, setRubrosMap] = useState(new Map());

  /* ── Agrupaciones ── */
  const [groups, setGroups] = useState([]);
  const [groupsActiveBiz, setGroupsActiveBiz] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalInitialGroupId, setGroupModalInitialGroupId] = useState(null);
  const [groupModalInsumo, setGroupModalInsumo] = useState(null);
  const [groupModalRubroLabel, setGroupModalRubroLabel] = useState(null);

  const [jumpToInsumoId, setJumpToInsumoId] = useState(null);
  const [selectedInsumoId, setSelectedInsumoId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });
  const [uploadComprasOpen, setUploadComprasOpen] = useState(false);

  usePersistUiActions(businessId);

  /* ── View mode por agrupación ── */
  // viewModeByGroup: { [insumoGroupId]: 'elaborados' | 'no-elaborados' }
  const [viewModeByGroup, setViewModeByGroup] = useState({});

  // Cargar preferencias al montar o cambiar negocio — limpiar antes para no mostrar prefs viejas
  useEffect(() => {
    setViewModeByGroup({}); // limpiar inmediatamente al cambiar negocio
    if (!resolvedBizId) return;
    (async () => {
      try {
        // ✅ scope:'insumo' para no mezclar con prefs de artículos
        const resp = await BusinessesAPI.getViewPrefs(resolvedBizId, { scope: 'insumo' });
        setViewModeByGroup(resp?.byInsumoGroup || resp?.byGroup || {});
      } catch { setViewModeByGroup({}); }
    })();
  }, [resolvedBizId]);

  // Cuando cambia la agrupación seleccionada → aplicar la vista guardada
  useEffect(() => {
    if (!selectedGroupId) return;
    const saved = viewModeByGroup[Number(selectedGroupId)];
    if (saved === 'elaborados' || saved === 'no-elaborados') {
      setVista(saved);
    } else {
      // Sin preferencia guardada → default
      setVista(DEFAULT_VISTA);
    }
  }, [selectedGroupId]); // Solo cuando cambia selectedGroupId, no viewModeByGroup para evitar loops

  // Handler del toggle: actualiza vista + persiste en backend
  const handleChangeListMode = useCallback(
    (mode) => {
      if (mode !== 'elaborados' && mode !== 'no-elaborados') return;
      setVista(mode);
      const groupId = Number(selectedGroupId);
      if (resolvedBizId && Number.isFinite(groupId) && groupId > 0) {
        setViewModeByGroup((prev) => ({ ...prev, [groupId]: mode }));
        BusinessesAPI.saveViewPref(resolvedBizId, {
          scope: 'insumo',
          agrupacionId: groupId,
          viewMode: mode,
        }).catch(() => { });
      }
    },
    [selectedGroupId, resolvedBizId]
  );

  /* ── Compras ── */
  const [rangoCompras, setRangoCompras] = useState(() => {
    const def = lastNDaysUntilYesterday(daysByMode('30'));
    return { mode: '30', from: def.from, to: def.to };
  });
  const [comprasMap, setComprasMap] = useState(new Map());
  const [comprasLoading, setComprasLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!businessId || !rangoCompras?.from || !rangoCompras?.to) return;
    let cancelled = false;
    setComprasLoading(true);
    purchasesList(businessId, { from: rangoCompras.from, to: rangoCompras.to, limit: 10000 })
      .then((res) => {
        if (cancelled) return;
        setComprasMap(buildComprasMap(res?.data ?? []));
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn('[InsumosMain] compras load error:', e.message);
        setComprasMap(new Map());
      })
      .finally(() => { if (!cancelled) setComprasLoading(false); });
    return () => { cancelled = true; };
  }, [businessId, rangoCompras]);

  /* ── Callbacks ── */
  const notify = useCallback((msg, type = 'success') => setSnack({ open: true, msg, type }), []);
  const forceRefresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const onMutateGroups = useCallback((action) => setGroups((prev) => applyMutation(prev, action)), []);
  const lastManualPickRef = useRef(0);
  const markManualPick = () => { lastManualPickRef.current = Date.now(); };

  const handleSyncCompras = useCallback(async () => {
    if (!businessId || !rangoCompras?.from || !rangoCompras?.to) return;
    setSyncing(true);
    try {
      const res = await purchasesSync(businessId, { from: rangoCompras.from, to: rangoCompras.to });
      notify('Compras sincronizadas: ' + (res.inserted ?? 0) + ' nuevas, ' + (res.updated ?? 0) + ' actualizadas', 'success');
      const list = await purchasesList(businessId, { from: rangoCompras.from, to: rangoCompras.to, limit: 10000 });
      setComprasMap(buildComprasMap(list?.data ?? []));
    } catch (e) {
      notify('Error al sincronizar: ' + e.message, 'error');
    } finally { setSyncing(false); }
  }, [businessId, rangoCompras, notify]);

  const handleDownloadCompras = useCallback(async () => {
    if (!businessId || !rangoCompras?.from || !rangoCompras?.to) return;
    setDownloading(true);
    try {
      await purchasesDownloadCsv(businessId, { from: rangoCompras.from, to: rangoCompras.to });
    } catch (e) {
      notify('Error al descargar: ' + e.message, 'error');
    } finally { setDownloading(false); }
  }, [businessId, rangoCompras, notify]);

  /* ── Favorita ── */
  useEffect(() => {
    const key = getFavKey(resolvedBizId);
    if (Number.isFinite(Number(favoriteGroupId))) localStorage.setItem(key, String(favoriteGroupId));
    else localStorage.removeItem(key);
  }, [favoriteGroupId, resolvedBizId]);

  useEffect(() => {
    const bid = resolvedBizId;
    setFavoriteGroupId(null);
    if (!bid) return;
    (async () => {
      try {
        const res = await BusinessesAPI.getFavoriteGroup(bid, { scope: 'insumo' });
        const favIdFromDb = Number(res?.favoriteGroupId);
        if (Number.isFinite(favIdFromDb) && favIdFromDb > 0) {
          setFavoriteGroupId(favIdFromDb);
        } else {
          const localFav = Number(localStorage.getItem(getFavKey(bid)));
          setFavoriteGroupId(Number.isFinite(localFav) && localFav > 0 ? localFav : null);
        }
      } catch {
        const localFav = Number(localStorage.getItem(getFavKey(bid)));
        setFavoriteGroupId(Number.isFinite(localFav) ? localFav : null);
      }
    })();
  }, [resolvedBizId]);

  /* ── Discontinuados POR NEGOCIO ── */
  const discontinuadosGroupId = useMemo(() => {
    const g = (groupsActiveBiz || []).find(esDiscontinuadosGroup);
    return g ? Number(g.id) : null;
  }, [groupsActiveBiz]);

  const discontinuadosIds = useMemo(() => {
    const disc = (groupsActiveBiz || []).find(esDiscontinuadosGroup);
    if (!disc) return new Set();
    const items = disc?.items || disc?.insumos || [];
    return new Set(items.map((it) => Number(it.insumo_id ?? it.id)).filter((n) => Number.isFinite(n) && n > 0));
  }, [groupsActiveBiz]);

  /* ── Base de insumos ── */
  const baseAll = useMemo(() => allInsumos || [], [allInsumos]);
  const baseActivos = useMemo(() => baseAll.filter((i) => !discontinuadosIds.has(Number(i.id))), [baseAll, discontinuadosIds]);
  const baseInactivos = useMemo(() => baseAll.filter((i) => discontinuadosIds.has(Number(i.id))), [baseAll, discontinuadosIds]);

  /* ── Grupos filtrados por división ── */
  const isSubnegocio = useMemo(
    () => resolvedBizId && businessId && String(resolvedBizId) !== String(businessId),
    [resolvedBizId, businessId]
  );

  const groupsScoped = useMemo(() => {
    if (isSubnegocio) return groups || [];
    if (isMainDivision) {
      const assignedSet = new Set(assignedInsumoGroupIds || []);
      return (groups || []).filter((g) => {
        if (esTodoGroup(g) || esDiscontinuadosGroup(g)) return true;
        return !assignedSet.has(Number(g?.id));
      });
    }
    const activeSet = new Set(activeDivisionInsumoGroupIds || []);
    return (groups || []).filter((g) => {
      if (esTodoGroup(g) || esDiscontinuadosGroup(g)) return true;
      return activeSet.has(Number(g?.id));
    });
  }, [groups, isSubnegocio, isMainDivision, activeDivisionInsumoGroupIds, assignedInsumoGroupIds]);

  /* ── Recarga principal ── */
  const hadBusinessOnceRef = useRef(false);
  const reloadRunRef = useRef(0);
  const lastCtxRef = useRef({ businessId: null, activeDivisionId: null });

  useEffect(() => {
    if (!businessId) {
      if (!hadBusinessOnceRef.current) return;
      setAllInsumos([]); setGroups([]); setGroupsActiveBiz([]); setRubrosMap(new Map());
      setSelectedGroupId(null); setRubroSeleccionado(null); setTodoGroupId(null); setExcludedIds(new Set());
      return;
    }
    hadBusinessOnceRef.current = true;
    const runId = ++reloadRunRef.current;
    let isCancelled = false;
    const safe = (fn) => { if (isCancelled || reloadRunRef.current !== runId) return false; fn(); return true; };
    const prevCtx = lastCtxRef.current;
    const hardReset = Number(prevCtx.businessId) !== Number(businessId) || Number(prevCtx.activeDivisionId) !== Number(activeDivisionId);
    lastCtxRef.current = { businessId, activeDivisionId };

    const recargarTodo = async () => {
      if (hardReset) {
        safe(() => {
          setAllInsumos([]); setGroups([]); setGroupsActiveBiz([]); setRubrosMap(new Map());
          setSelectedGroupId(null); setRubroSeleccionado(null); setTodoGroupId(null); setExcludedIds(new Set());
        });
        await new Promise((r) => setTimeout(r, 50));
        if (isCancelled || reloadRunRef.current !== runId) return;
      }
      try {
        try { await ensureDiscontinuadosInsumos(resolvedBizId); } catch { }
        if (businessId && String(businessId) !== String(resolvedBizId)) {
          try { await ensureDiscontinuadosInsumos(businessId); } catch { }
        }

        const isSubneg = businessId && String(businessId) !== String(resolvedBizId);
        const [resRubros, resInsumos, todoGroup, resGroups, resGroupsActiveBiz] = await Promise.all([
          insumosRubrosList(resolvedBizId),
          insumosList(resolvedBizId, { page: 1, limit: 999999, search: '' }),
          ensureTodoInsumos(resolvedBizId),
          insumoGroupsList(resolvedBizId),
          isSubneg ? insumoGroupsList(businessId) : Promise.resolve(null),
        ]);
        if (isCancelled || reloadRunRef.current !== runId) return;

        const items = resRubros?.items || resRubros?.data || [];
        const map = new Map();
        items.forEach((rubro) => {
          const codigo = String(rubro.codigo);
          map.set(codigo, { codigo: rubro.codigo, nombre: rubro.nombre || `Rubro ${codigo}`, es_elaborador: rubro.es_elaborador === true });
        });
        safe(() => setRubrosMap(map));

        const list = Array.isArray(resGroups?.data) ? resGroups.data : Array.isArray(resGroups) ? resGroups : [];
        safe(() => setGroups(list));

        const listActiveBiz = resGroupsActiveBiz
          ? (Array.isArray(resGroupsActiveBiz?.data) ? resGroupsActiveBiz.data : Array.isArray(resGroupsActiveBiz) ? resGroupsActiveBiz : [])
          : list;
        safe(() => setGroupsActiveBiz(listActiveBiz));

        const dataAll = Array.isArray(resInsumos?.data) ? resInsumos.data : [];
        safe(() => setAllInsumos(dataAll));
        safe(() => setTodoGroupId(todoGroup?.id || null));

        if (todoGroup?.id) {
          const exclusiones = await getExclusionesInsumos(resolvedBizId, todoGroup.id);
          if (isCancelled || reloadRunRef.current !== runId) return;
          const ids = (exclusiones || []).filter((e) => e.scope === 'insumo').map((e) => Number(e.ref_id)).filter(Boolean);
          safe(() => setExcludedIds(new Set(ids)));
        }

        safe(() => {
          if (selectedGroupId && !list.some((g) => Number(g.id) === Number(selectedGroupId))) {
            setSelectedGroupId(null); setRubroSeleccionado(null);
          }
        });
      } catch (e) {
        if (isCancelled || reloadRunRef.current !== runId) return;
        console.error('[recargarTodo] Error:', e);
      }
    };
    recargarTodo();
    return () => { isCancelled = true; };
  }, [businessId, reloadKey, activeDivisionId, selectedGroupId]);

  /* ── IDs sin agrupación ── */
  const activeIdSet = useMemo(() => new Set(baseActivos.map((i) => Number(i.id)).filter(Number.isFinite)), [baseActivos]);
  const inactiveIdSet = useMemo(() => new Set(baseInactivos.map((i) => Number(i.id)).filter(Number.isFinite)), [baseInactivos]);
  const idsEnOtras = useMemo(() => new Set(
    (groups || []).filter((g) => !esTodoGroup(g) && !esDiscontinuadosGroup(g))
      .flatMap((g) => (g.items || g.insumos || []).map((i) => Number(i.insumo_id ?? i.id)))
      .filter((n) => Number.isFinite(n) && n > 0)
  ), [groups]);

  const idsSinAgrupActivos = useMemo(() => {
    const res = new Set();
    activeIdSet.forEach((id) => { if (!excludedIds.has(id) && !idsEnOtras.has(id)) res.add(id); });
    return res;
  }, [activeIdSet, excludedIds, idsEnOtras]);

  const idsSinAgrupInactivos = useMemo(() => {
    const res = new Set();
    inactiveIdSet.forEach((id) => { if (!excludedIds.has(id) && !idsEnOtras.has(id)) res.add(id); });
    return res;
  }, [inactiveIdSet, excludedIds, idsEnOtras]);

  /* ── Vista y tabla ── */
  const selectedGroup = useMemo(() => {
    const id = Number(selectedGroupId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return (groupsScoped || []).find((g) => Number(g.id) === id) || null;
  }, [selectedGroupId, groupsScoped]);

  const isDiscView = useMemo(() => selectedGroup ? esDiscontinuadosGroup(selectedGroup) : false, [selectedGroup]);

  const sidebarBase = useMemo(() => {
    if (isDiscView) return (baseAll || []).filter((i) => discontinuadosIds.has(Number(i.id)));
    return baseActivos;
  }, [isDiscView, baseAll, baseActivos, discontinuadosIds]);

  const visibleIds = useMemo(() => {
    if (!selectedGroupId) return null;
    const gId = Number(selectedGroupId);
    const g = groupsScoped.find((x) => Number(x.id) === gId);
    if (!g) return null;
    if (esDiscontinuadosGroup(g)) return discontinuadosIds;
    if (todoGroupId && gId === Number(todoGroupId)) return isDiscView ? idsSinAgrupInactivos : idsSinAgrupActivos;
    const baseSet = isDiscView ? inactiveIdSet : activeIdSet;
    const s = new Set();
    (g.items || g.insumos || []).forEach((it) => {
      const id = Number(it.insumo_id ?? it.id);
      if (Number.isFinite(id) && baseSet.has(id)) s.add(id);
    });
    return s;
  }, [selectedGroupId, groupsScoped, todoGroupId, isDiscView, activeIdSet, inactiveIdSet, idsSinAgrupActivos, idsSinAgrupInactivos, discontinuadosIds]);

  const filteredBase = useMemo(() => {
    let base = !visibleIds ? sidebarBase : (sidebarBase || []).filter((ins) => {
      const id = Number(ins?.id);
      if (!Number.isFinite(id) || !visibleIds.has(id)) return false;
      if (!isDiscView && discontinuadosIds.has(id)) return false;
      return true;
    });

    // Filtrar por vista (elaborados / no-elaborados)
    if (!isDiscView && rubrosMap.size > 0) {
      base = base.filter((ins) => {
        const rubroCodigo = String(ins?.rubro_codigo || ins?.rubro || '');
        const info = rubrosMap.get(rubroCodigo);
        if (vista === 'elaborados') return info?.es_elaborador === true;
        if (vista === 'no-elaborados') return info?.es_elaborador !== true;
        return true;
      });
    }

    return base;
  }, [sidebarBase, visibleIds, isDiscView, discontinuadosIds, vista, rubrosMap]);

  const rubrosTree = useMemo(() => {
    if (!filteredBase.length || rubrosMap.size === 0) return [];
    const map = new Map();
    filteredBase.forEach((insumo) => {
      const rubroCodigo = String(insumo.rubro_codigo || insumo.rubro || '');
      const rubroInfo = rubrosMap.get(rubroCodigo) || { codigo: rubroCodigo, nombre: rubroCodigo || 'Sin rubro', es_elaborador: false };
      const rubroNombre = rubroInfo.nombre;
      if (!map.has(rubroNombre)) map.set(rubroNombre, { nombre: rubroNombre, codigo: rubroInfo.codigo, es_elaborador: rubroInfo.es_elaborador, insumos: [] });
      map.get(rubroNombre).insumos.push(insumo);
    });
    return Array.from(map.values());
  }, [filteredBase, rubrosMap]);

  const tableRows = useMemo(() => {
    const base = filteredBase || [];
    const codigoSel = rubroSeleccionado?.codigo;
    if (codigoSel == null) return base;
    return base.filter((i) => String(i?.rubro_codigo || i?.rubro || '') === String(codigoSel));
  }, [filteredBase, rubroSeleccionado]);

  useEffect(() => {
    if (!rubroSeleccionado) return;
    if (!(rubrosTree || []).some((r) => String(r.codigo) === String(rubroSeleccionado.codigo))) setRubroSeleccionado(null);
  }, [rubrosTree, rubroSeleccionado]);

  const insumosGroupIndex = useMemo(() => {
    const byInsumoId = new Map();
    (groupsScoped || []).forEach((g) => {
      if (esTodoGroup(g) || esDiscontinuadosGroup(g)) return;
      (g.items || g.insumos || []).forEach((item) => {
        const id = Number(item.insumo_id ?? item.id);
        if (!Number.isFinite(id)) return;
        if (!byInsumoId.has(id)) byInsumoId.set(id, new Set());
        byInsumoId.get(id).add(Number(g.id));
      });
    });
    return { byInsumoId };
  }, [groupsScoped]);

  /* ── Autoselección ── */
  const selectedGroupIdRef = useRef(selectedGroupId);
  useEffect(() => { selectedGroupIdRef.current = selectedGroupId; }, [selectedGroupId]);
  const selectedGroupRef = useRef(selectedGroup);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);
  const groupsScopedRef = useRef(groupsScoped);
  useEffect(() => { groupsScopedRef.current = groupsScoped; }, [groupsScoped]);

  useEffect(() => {
    const todoId = todoGroupId;
    const todoEmpty = idsSinAgrupActivos.size === 0;

    const currentGroups = groupsScopedRef.current || [];
    if (!currentGroups.length) return;
    const currentSelId = selectedGroupIdRef.current;
    const currentSel = selectedGroupRef.current;
    if (currentSel && esDiscontinuadosGroup(currentSel)) return;

    // ── Sin Agrupación tiene insumos ──
    if (!todoEmpty && todoId) {
      // Guard: no interferir si el usuario eligió manualmente otro grupo
      if (Date.now() - lastManualPickRef.current < 5000) return;
      // No interferir si ya hay un grupo válido seleccionado que no es TODO
      if (currentSel && !esTodoGroup(currentSel)) return;
      if (!currentSelId || Number(currentSelId) !== Number(todoId)) {
        setSelectedGroupId(Number(todoId));
        setRubroSeleccionado(null);
      }
      return;
    }

    // ── Sin Agrupación vacío: ir a favorita o primera agrupación ──
    // Acá NO aplicamos el guard de tiempo — el vaciado es un evento concreto
    // y queremos navegar inmediatamente a la favorita
    if (currentSel && !esTodoGroup(currentSel)) return; // ya está en otra agrupación, no tocar

    if (favoriteGroupId) {
      const fav = currentGroups.find((g) => Number(g?.id) === Number(favoriteGroupId));
      if (fav) {
        if (!currentSelId || Number(currentSelId) !== Number(favoriteGroupId)) {
          setSelectedGroupId(fav.id);
          setRubroSeleccionado(null);
        }
      } else {
        setFavoriteGroupId(null);
      }
      return;
    }

    if (currentGroups.length > 0) {
      const firstGroup = currentGroups[0];
      if (!currentSelId || Number(currentSelId) !== Number(firstGroup.id)) {
        setSelectedGroupId(firstGroup.id);
        setRubroSeleccionado(null);
      }
    }
  }, [businessId, todoGroupId, idsSinAgrupActivos.size, favoriteGroupId]);

  useEffect(() => {
    if (!rubroSeleccionado) return;
    if (!(rubrosTree || []).some((r) => r.nombre === rubroSeleccionado.nombre)) setRubroSeleccionado(null);
  }, [rubrosTree, rubroSeleccionado]);

  /* ── Buscador ── */
  const insumosSearchOptions = useMemo(() => {
    if (!baseAll.length) return [];
    const options = baseAll.map((ins) => {
      const id = Number(ins.id);
      if (!Number.isFinite(id)) return null;
      const nombre = (ins.nombre || '').trim() || `INS-${id}`;
      // ✅ Incluir código Maxirest para búsqueda por código
      const codigoMaxi = ins.codigo_maxi || ins.codigo_mostrar || ins.codigo || '';
      return {
        id,
        nombre,
        codigo: String(codigoMaxi).trim(), // campo que Buscador.jsx indexa como _codigo
        _search: normalize(nombre),
        rubro_codigo: ins.rubro_codigo || ins.rubro || '',
      };
    }).filter(Boolean);
    const q = searchText || '';
    if (!q.trim()) return options.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    return options.sort((a, b) => {
      const sa = scoreMatch(a.nombre, q); const sb = scoreMatch(b.nombre, q);
      if (sa.tier !== sb.tier) return sa.tier - sb.tier;
      if (sa.pos !== sb.pos) return sa.pos - sb.pos;
      if (sa.len !== sb.len) return sa.len - sb.len;
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });
  }, [baseAll, searchText]);

  const focusInsumo = useCallback((rawId, preferGroupId = null, opts = {}) => {
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) return;
    const insumo = (baseAll || []).find((x) => Number(x?.id) === id) || null;
    const groupsSet = insumosGroupIndex.byInsumoId.get(id) || new Set();
    const allGroups = groupsScoped || [];
    let targetGroupId = null;
    if (preferGroupId != null) { const prefNum = Number(preferGroupId); if (Number.isFinite(prefNum) && allGroups.some((g) => Number(g.id) === prefNum)) targetGroupId = prefNum; }
    if (!targetGroupId && groupsSet.size > 0) { for (const gid of groupsSet) { const n = Number(gid); if (Number.isFinite(n) && n > 0) { targetGroupId = n; break; } } }
    if (!targetGroupId && Number.isFinite(Number(todoGroupId)) && Number(todoGroupId) > 0) targetGroupId = Number(todoGroupId);
    if (insumo && rubrosMap?.size) {
      const nextVista = vistaForInsumo(insumo, rubrosMap);
      if (nextVista && nextVista !== vista) {
        setVista(nextVista);
        // Actualizar viewModeByGroup para que el useEffect de selectedGroupId no lo pise
        if (targetGroupId && Number.isFinite(Number(targetGroupId))) {
          setViewModeByGroup((prev) => ({ ...prev, [Number(targetGroupId)]: nextVista }));
        }
      }
    }
    const shouldChangeGroup = !opts.stay && targetGroupId && (!selectedGroupId || Number(selectedGroupId) !== Number(targetGroupId));
    if (shouldChangeGroup) { markManualPick(); setSelectedGroupId(targetGroupId); setRubroSeleccionado(null); } else { setRubroSeleccionado(null); }
    setSelectedInsumoId(id); setJumpToInsumoId(id);
    setTimeout(() => setJumpToInsumoId(null), 1400);
  }, [baseAll, groupsScoped, insumosGroupIndex, todoGroupId, selectedGroupId, rubrosMap, vista]);

  const handleSelectGroupId = useCallback((rawId) => {
    const n = Number(rawId);
    markManualPick();
    setSelectedGroupId(Number.isFinite(n) && n > 0 ? n : null);
    setRubroSeleccionado(null);
  }, []);

  /* ── Favorita ── */
  const handleToggleFavorite = useCallback(async (groupId) => {
    try {
      const newFav = favoriteGroupId === groupId ? null : groupId;
      const group = (groupsScoped || []).find((g) => Number(g.id) === Number(groupId));
      await BusinessesAPI.saveFavoriteGroup(resolvedBizId, newFav, { scope: 'insumo', divisionId: activeDivisionId });
      setFavoriteGroupId(newFav);
      notifyGroupFavoriteChanged({ businessId: resolvedBizId, groupId: Number(groupId), groupName: group?.nombre || '', isFavorite: !!newFav, divisionId: activeDivisionId, scope: 'insumo' });
      notify(newFav ? 'Agrupación marcada como favorita' : 'Favorita removida', 'success');
    } catch { notify('Error al guardar favorita', 'error'); }
  }, [resolvedBizId, favoriteGroupId, groupsScoped, activeDivisionId, notify]);

  /* ── CRUD grupos ── */
  const handleEditGroup = useCallback(async (group) => {
    const actual = String(group?.nombre || '');
    const nuevo = await showPrompt('Nuevo nombre de la agrupación:', actual);
    if (nuevo == null) return;
    const trimmed = nuevo.trim();
    if (!trimmed || trimmed === actual) return;
    try {
      await insumoGroupUpdate(resolvedBizId, group.id, { nombre: trimmed });
      notifyGroupRenamed({ businessId: resolvedBizId, groupId: Number(group.id), oldName: actual, newName: trimmed, scope: 'insumo' });
      const res = await insumoGroupsList(resolvedBizId);
      setGroups(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
      notify('Agrupación renombrada', 'success');
    } catch (e) { notify(e.message || 'Error al renombrar agrupación', 'error'); }
  }, [resolvedBizId, notify]);

  const handleDeleteGroup = useCallback(async (group) => {
    if (!await showConfirm(`¿Eliminar la agrupación "${group.nombre}"? Esta acción no se puede deshacer.`, { danger: true })) return;
    try {
      await insumoGroupDelete(resolvedBizId, group.id);
      notifyGroupDeleted({ businessId: resolvedBizId, groupId: Number(group.id), groupName: group.nombre, itemCount: (group.items || group.insumos || []).length, scope: 'insumo' });
      if (selectedGroupId && Number(selectedGroupId) === Number(group.id)) setSelectedGroupId(null);
      if (favoriteGroupId && Number(favoriteGroupId) === Number(group.id)) setFavoriteGroupId(null);
      const res = await insumoGroupsList(resolvedBizId);
      setGroups(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
      notify('Agrupación eliminada', 'success');
    } catch (e) { notify(e.message || 'Error al eliminar agrupación', 'error'); }
  }, [resolvedBizId, favoriteGroupId, notify, selectedGroupId]);

  const handleRenameGroup = useCallback(async (group) => {
    if (!group || esDiscontinuadosGroup(group)) return null;
    const currentName = String(group.nombre || '');
    const isTodo = esTodoGroup(group);
    const nuevo = await showPrompt(
      isTodo ? 'Nombre para la nueva agrupación (los insumos sin agrupación se moverán aquí):' : 'Nuevo nombre para la agrupación:',
      isTodo ? '' : currentName
    );
    if (nuevo == null) return null;
    const nombre = nuevo.trim();
    if (!nombre || (!isTodo && nombre === currentName)) return null;

    try {
      if (isTodo) {
        // ── Calcular IDs frescos desde el estado actual, no del closure ──
        const idsActivos = Array.from(activeIdSet).filter((id) => !excludedIds.has(id) && !idsEnOtras.has(id));
        const ids = idsActivos.map(Number).filter((n) => Number.isFinite(n) && n > 0);

        if (!ids.length) { showAlert('No hay insumos en "Sin agrupación" para capturar.', 'warning'); return null; }

        const res = await insumoGroupCreateOrMove(nombre, ids, resolvedBizId);
        const createdId = Number(res?.id || res?.groupId || res?.insumoGroupId || res?.insumo_group?.id);

        // Refetch y esperar lista actualizada
        const resGroups = await insumoGroupsList(resolvedBizId);
        const list = Array.isArray(resGroups?.data) ? resGroups.data : Array.isArray(resGroups) ? resGroups : [];
        setGroups(list);

        // Encontrar el grupo recién creado
        const nuevoGroup =
          (Number.isFinite(createdId) && createdId > 0 ? list.find((g) => Number(g.id) === createdId) : null) ||
          list.find((g) => String(g.nombre || '').toLowerCase() === nombre.toLowerCase()) ||
          null;

        if (nuevoGroup) {
          markManualPick();
          setSelectedGroupId(Number(nuevoGroup.id));
          setRubroSeleccionado(null);
        }

        notify(`Agrupación "${nombre}" creada a partir de "Sin agrupación".`, 'success');
        return null;

      } else {
        await insumoGroupUpdate(resolvedBizId, group.id, { nombre });
        const resGroups = await insumoGroupsList(resolvedBizId);
        setGroups(Array.isArray(resGroups?.data) ? resGroups.data : Array.isArray(resGroups) ? resGroups : []);
        notify('Nombre de agrupación actualizado.', 'success');
        return { newName: nombre };
      }
    } catch (e) { notify(e.message || 'Error al renombrar agrupación', 'error'); return null; }
  }, [notify, activeIdSet, excludedIds, idsEnOtras, resolvedBizId]);

  const handleOpenGroupModalForInsumo = useCallback((insumo) => {
    setGroupModalInsumo(insumo || null); setGroupModalRubroLabel(null); setGroupModalInitialGroupId(null); setGroupModalOpen(true);
  }, []);

  const handleOpenGroupModalForRubro = useCallback((rubroLabel) => {
    setGroupModalInsumo(null); setGroupModalRubroLabel(rubroLabel || null); setGroupModalInitialGroupId(null); setGroupModalOpen(true);
  }, []);

  const loadGroups = useCallback(async () => {
    if (!resolvedBizId) return;
    setGroupsLoading(true);
    try {
      const isSubneg = businessId && String(businessId) !== String(resolvedBizId);
      const [res, resActiveBiz] = await Promise.all([
        insumoGroupsList(resolvedBizId),
        isSubneg ? insumoGroupsList(businessId) : Promise.resolve(null),
      ]);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setGroups(list);
      const listActiveBiz = resActiveBiz ? (Array.isArray(resActiveBiz?.data) ? resActiveBiz.data : Array.isArray(resActiveBiz) ? resActiveBiz : []) : list;
      setGroupsActiveBiz(listActiveBiz);
    } catch { setGroups([]); setGroupsActiveBiz([]); } finally { setGroupsLoading(false); }
  }, [resolvedBizId, businessId]);

  const handleCloseGroupModal = useCallback(async (didSave = false) => {
    setGroupModalOpen(false); setGroupModalInsumo(null); setGroupModalRubroLabel(null); setGroupModalInitialGroupId(null);
    if (didSave) { await loadGroups(); forceRefresh(); }
  }, [loadGroups, forceRefresh]);

  /* ── Undo ── */
  useEffect(() => {
    const onUndo = async (e) => {
      const ui = e?.detail;
      if (!ui || ui.scope !== 'insumo') return;
      if (businessId && ui.businessId && Number(ui.businessId) !== Number(businessId)) return;
      const kind = ui.kind;
      const payload = ui.payload || {};
      const ids = (payload?.ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
      if (kind === 'discontinue') {
        const prev = payload?.undo?.payload?.prev || payload?.prev || {};
        const discId = Number(prev.discontinuadosGroupId ?? discontinuadosGroupId);
        if (!ids.length || !Number.isFinite(discId) || discId <= 0) return;
        try {
          if (prev.wasInDiscontinuados) await insumoGroupAddMultipleItems(discId, ids, businessId);
          else await Promise.allSettled(ids.map((id) => insumoGroupRemoveItem(discId, id, businessId)));
          await loadGroups(); forceRefresh(); notify('✅ Deshacer aplicado', 'info');
        } catch { notify('❌ No se pudo deshacer', 'error'); }
        return;
      }
      if (kind === 'move') {
        const prev = payload?.undo?.payload?.prev || payload?.prev || {};
        const fromGroupId = Number(prev.fromGroupId); const toGroupId = Number(prev.toGroupId);
        if (!ids.length || !Number.isFinite(fromGroupId) || !Number.isFinite(toGroupId)) return;
        try {
          for (const id of ids) {
            await insumoGroupRemoveItem(toGroupId, id, resolvedBizId);
            await insumoGroupAddMultipleItems(fromGroupId, [id], resolvedBizId);
          }
          await loadGroups(); forceRefresh(); notify('✅ Insumo(s) movido(s) de vuelta', 'info');
        } catch { notify('❌ Error al deshacer movimiento', 'error'); }
      }
    };
    window.addEventListener('ui:undo', onUndo);
    return () => window.removeEventListener('ui:undo', onUndo);
  }, [businessId, discontinuadosGroupId, loadGroups, forceRefresh, notify, resolvedBizId]);

  const titulo = useMemo(() => {
    const base = businessName ? `Insumos — ${businessName}` : 'Insumos';
    if (!isMainDivision && activeDivisionName) return `${base} › ${activeDivisionName}`;
    return base;
  }, [businessName, isMainDivision, activeDivisionName]);

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 8px 0 8px' }}>
        <h2 style={{ margin: 0 }}>{titulo}</h2>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SalesPickerIcon
            value={rangoCompras}
            onChange={setRangoCompras}
            firstDate={firstDateCompras}
            loadingFirst={loadingFirstCompras}
            disableFuture
            disableToday
          />

          <ComprasActionsMenu
            rango={rangoCompras}
            onImport={() => setUploadComprasOpen(true)}
            onExport={handleDownloadCompras}
            disabled={!businessId || comprasLoading}
          />

          <div style={{ minWidth: 260, maxWidth: 260 }}>
            <Buscador
              placeholder="Buscar insumo…"
              opciones={insumosSearchOptions}
              value={searchText}
              onChange={(v) => setSearchText(v || '')}
              clearOnPick={false}
              autoFocusAfterPick
              noResultsText="No se encontró ningún insumo"
              onPick={(opt) => {
                const id = Number(opt?.id);
                if (!Number.isFinite(id)) return;
                setSearchText('');
                focusInsumo(id);
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, alignItems: 'start', borderRadius: 12, overflow: 'hidden', height: '75vh', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <div style={{ borderRight: '1px solid #eee', background: '#fafafa', position: 'sticky', top: 0, alignSelf: 'start', height: 'calc(100vh - 0px)', overflowY: 'auto' }}>
          <InsumosSidebar
            rubros={rubrosTree}
            rubroSeleccionado={rubroSeleccionado}
            setRubroSeleccionado={setRubroSeleccionado}
            businessId={resolvedBizId}
            originalBusinessId={businessId}
            vista={vista}
            onVistaChange={handleChangeListMode}
            groups={groupsScoped}
            groupsLoading={groupsLoading}
            selectedGroupId={selectedGroupId}
            onSelectGroupId={handleSelectGroupId}
            favoriteGroupId={favoriteGroupId}
            onSetFavorite={handleToggleFavorite}
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
            onRenameGroup={handleRenameGroup}
            todoGroupId={todoGroupId}
            idsSinAgrupCount={idsSinAgrupActivos.size}
            onMutateGroups={onMutateGroups}
            onRefetch={loadGroups}
            notify={notify}
            visibleIds={visibleIds}
            rubrosMap={rubrosMap}
            onReloadCatalogo={() => setReloadKey((k) => k + 1)}
            forceRefresh={forceRefresh}
            onCreateGroupFromRubro={handleOpenGroupModalForRubro}
            discontinuadosGroupId={discontinuadosGroupId}
            onManualPick={markManualPick}
            activeDivisionId={activeDivisionId}
            activeDivisionGroupIds={activeDivisionInsumoGroupIds}
            assignedGroupIds={assignedInsumoGroupIds}
            refetchAssignedGroups={refetchAssignedInsumoGroups}
          />
        </div>

        <div id="insumos-scroll" style={{ background: '#fff', overflow: 'auto', maxHeight: 'calc(100vh - 0px)' }}>
          <InsumosTable
            rows={tableRows}
            loading={false}
            onEdit={() => { }}
            onDelete={() => { }}
            noBusiness={!businessId}
            vista={vista}
            businessId={resolvedBizId}
            originalBusinessId={businessId}
            groups={groupsScoped}
            selectedGroupId={selectedGroupId}
            discontinuadosGroupId={discontinuadosGroupId}
            onOpenGroupModalForInsumo={handleOpenGroupModalForInsumo}
            onCreateGroupFromRubro={handleOpenGroupModalForRubro}
            rubrosMap={rubrosMap}
            onRefetch={loadGroups}
            onMutateGroups={onMutateGroups}
            notify={notify}
            todoGroupId={todoGroupId}
            idsSinAgrup={Array.from(idsSinAgrupActivos)}
            onReloadCatalogo={() => setReloadKey((k) => k + 1)}
            forceRefresh={forceRefresh}
            jumpToInsumoId={jumpToInsumoId}
            selectedInsumoId={selectedInsumoId}
            visibleIds={visibleIds}
            rubroSeleccionado={rubroSeleccionado}
            comprasMap={comprasMap}
            comprasLoading={comprasLoading}
            rangoCompras={rangoCompras}
            businesses={organization?.businesses || []}
          />
        </div>
      </div>

      <InsumoGroupModal
        open={groupModalOpen}
        originRubroLabel={groupModalRubroLabel}
        onClose={handleCloseGroupModal}
        insumo={groupModalInsumo}
        businessId={resolvedBizId}
        groups={groupsScoped}
        initialGroupId={groupModalInitialGroupId}
        onGroupsReload={loadGroups}
        rubrosMap={rubrosMap}
        allInsumos={allInsumos}
      />
      <UploadComprasModal
        open={uploadComprasOpen}
        onClose={() => setUploadComprasOpen(false)}
        businessId={businessId}
        onSuccess={() => {
          setUploadComprasOpen(false);
          if (!businessId || !rangoCompras?.from || !rangoCompras?.to) return;
          setComprasLoading(true);
          purchasesList(businessId, { from: rangoCompras.from, to: rangoCompras.to, limit: 10000 })
            .then((res) => setComprasMap(buildComprasMap(res?.data ?? [])))
            .catch(() => setComprasMap(new Map()))
            .finally(() => setComprasLoading(false));
        }}
      />

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.type} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}