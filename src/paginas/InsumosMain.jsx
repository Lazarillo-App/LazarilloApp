/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/paginas/InsumosMain.jsx - CON FILTRADO DE DIVISIONES

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
} from '../servicios/apiInsumos';
import { applyMutation } from '../utils/groupMutations';
import {
  ensureTodoInsumos,
  getExclusionesInsumos,
  ensureDiscontinuadosInsumos,
} from '../servicios/apiInsumosTodo';
import { useActiveBusiness, useBusiness } from '../context/BusinessContext';
import { Snackbar, Alert } from '@mui/material';
import '../css/global.css';
import '../css/theme-layout.css';
import '../css/TablaArticulos.css';

const FAV_KEY = 'favInsumoGroupId';
const VIEW_KEY = 'lazarillo:insumosViewMode';

const norm = (s) => String(s || '').trim().toLowerCase();

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

const isInsumoActivo = (i) => {
  const estado = norm(i?.estado);
  return estado === 'activo' || estado === '' || !estado;
};

const isInsumoDiscontinuado = (i) => {
  const estado = norm(i?.estado);
  return estado === 'discontinuado';
};

const vistaForInsumo = (insumo, rubrosMap) => {
  const rubroCodigo = String(insumo?.rubro_codigo || insumo?.rubro || '');
  const info = rubrosMap?.get(rubroCodigo);
  return info?.es_elaborador === true ? 'elaborados' : 'no-elaborados';
};

const getInsumoId = (i) => {
  const id = Number(i?.id ?? i?.insumo_id ?? i?.codigo);
  return Number.isFinite(id) && id > 0 ? id : null;
};

export default function InsumosMain() {
  /* ================== BUSINESS CONTEXT ================== */
  const biz = useBusiness() || {};
  const { businessId } = useActiveBusiness();

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
    if (activeSubnegocio?.nombre) {
      return `${activeBusiness?.nombre || 'Negocio'} › ${activeSubnegocio.nombre}`;
    }
    return activeBusiness?.nombre || null;
  }, [activeBusiness, activeSubnegocio]);

  useEffect(() => {
    if (!businessId) return;
    try {
      localStorage.setItem('activeBusinessId', String(businessId));
    } catch { }
  }, [businessId]);

  /* ================== ESTADO BÁSICO ================== */
  const [rubroSeleccionado, setRubroSeleccionado] = useState(null);
  const [vista, setVista] = useState('no-elaborados');
  const [reloadKey, setReloadKey] = useState(0);

  const [allInsumos, setAllInsumos] = useState([]);
  const [rubrosMap, setRubrosMap] = useState(new Map());

  /* ================== AGRUPACIONES ================== */
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);
  const [todoGroupId, setTodoGroupId] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalInitialGroupId, setGroupModalInitialGroupId] = useState(null);
  const [groupModalInsumo, setGroupModalInsumo] = useState(null);
  const [groupModalRubroLabel, setGroupModalRubroLabel] = useState(null);

  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });

  /* ================== VIEW MODE ================== */
  const [viewModeGlobal, setViewModeGlobal] = useState(() => {
    if (typeof window === 'undefined') return 'elaborados-first';
    const raw = localStorage.getItem(VIEW_KEY);
    return raw === 'no-elaborados-first' ? 'no-elaborados-first' : 'elaborados-first';
  });

  const [viewModeByGroup, setViewModeByGroup] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewModeGlobal);
    } catch { }
  }, [viewModeGlobal]);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const resp = await BusinessesAPI.getViewPrefs(businessId);
        const byGroup = resp?.byGroup || {};
        setViewModeByGroup(byGroup);
      } catch {
        setViewModeByGroup({});
      }
    })();
  }, [businessId]);

  const handleChangeListMode = useCallback(
    (mode) => {
      setViewModeGlobal(mode);
      try {
        localStorage.setItem(VIEW_KEY, mode);
      } catch { }

      const g = groups.find((x) => Number(x?.id) === Number(selectedGroupId));
      const groupId = Number(g?.id);

      if (businessId && Number.isFinite(groupId)) {
        setViewModeByGroup((prev) => ({
          ...prev,
          [groupId]: mode,
        }));

        BusinessesAPI.saveViewPref(businessId, {
          agrupacionId: groupId,
          viewMode: mode,
        }).catch((e) => {
          console.error('saveViewPref error', e);
        });
      }
    },
    [selectedGroupId, businessId, groups]
  );

  /* ================== CALLBACKS ================== */
  const notify = useCallback((msg, type = 'success') => {
    setSnack({ open: true, msg, type });
  }, []);

  const forceRefresh = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const onMutateGroups = useCallback((action) => {
    setGroups((prev) => applyMutation(prev, action));
  }, []);

  const lastManualPickRef = useRef(0);
  const markManualPick = useCallback(() => {
    lastManualPickRef.current = Date.now();
  }, []);

  /* ================== DERIVADOS IMPORTANTES ================== */
  const baseAll = useMemo(() => allInsumos || [], [allInsumos]);
  const baseActivos = useMemo(() => baseAll.filter((i) => isInsumoActivo(i)), [baseAll]);
  const baseInactivos = useMemo(() => baseAll.filter((i) => isInsumoDiscontinuado(i)), [baseAll]);

  const discontinuadosGroupId = useMemo(() => {
    const g = (groups || []).find(esDiscontinuadosGroup);
    return g ? Number(g.id) : null;
  }, [groups]);

  const discontinuadosIds = useMemo(() => {
    const disc = (groups || []).find(esDiscontinuadosGroup);
    if (!disc) return new Set();

    const items = disc?.items || disc?.insumos || [];

    return new Set(
      items
        .map((it) => Number(it.insumo_id ?? it.id))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
  }, [groups]);

  /* ================== ✅ NUEVO: FILTRADO DE GRUPOS POR DIVISIÓN ================== */
  const groupsScoped = useMemo(() => {
    console.log('[InsumosMain] 🔍 Filtrado de división:', {
      isMainDivision,
      activeDivisionName,
      totalGroups: groups.length,
      activeDivisionInsumoGroupIds: Array.from(activeDivisionInsumoGroupIds || []),
      assignedInsumoGroupIds: Array.from(assignedInsumoGroupIds || []),
    });

    if (isMainDivision) {
      const assignedSet = new Set(assignedInsumoGroupIds || []);

      return (groups || []).filter((g) => {
        const gid = Number(g?.id);
        if (esTodoGroup(g) || esDiscontinuadosGroup(g)) return true;
        return !assignedSet.has(gid);
      });
    }

    const activeSet = new Set(activeDivisionInsumoGroupIds || []);

    return (groups || []).filter((g) => {
      const gid = Number(g?.id);
      if (esTodoGroup(g) || esDiscontinuadosGroup(g)) return true;
      return activeSet.has(gid);
    });
  }, [
    groups,
    isMainDivision,
    activeDivisionName,
    activeDivisionInsumoGroupIds,
    assignedInsumoGroupIds,
  ]);


  /* ================== RECARGA PRINCIPAL AL CAMBIAR BUSINESS O DIVISIÓN ================== */
  const hadBusinessOnceRef = useRef(false);
  const reloadRunRef = useRef(0);

  useEffect(() => {
    if (!businessId) {
      if (!hadBusinessOnceRef.current) return;

      setAllInsumos([]);
      setGroups([]);
      setRubrosMap(new Map());
      setSelectedGroupId(null);
      setRubroSeleccionado(null);
      setTodoGroupId(null);
      setExcludedIds(new Set());
      return;
    }

    hadBusinessOnceRef.current = true;

    const runId = ++reloadRunRef.current;
    let isCancelled = false;

    const safe = (fn) => {
      if (isCancelled) return false;
      if (reloadRunRef.current !== runId) return false;
      fn();
      return true;
    };

    const recargarTodo = async () => {
      safe(() => {
        setAllInsumos([]);
        setGroups([]);
        setRubrosMap(new Map());
        setSelectedGroupId(null);
        setRubroSeleccionado(null);
        setTodoGroupId(null);
        setExcludedIds(new Set());
      });

      await new Promise((r) => setTimeout(r, 50));
      if (isCancelled || reloadRunRef.current !== runId) return;

      try {
        const resRubros = await insumosRubrosList(businessId);
        if (isCancelled || reloadRunRef.current !== runId) return;

        const items = resRubros?.items || resRubros?.data || [];
        const map = new Map();
        items.forEach((rubro) => {
          const codigo = String(rubro.codigo);
          map.set(codigo, {
            codigo: rubro.codigo,
            nombre: rubro.nombre || `Rubro ${codigo}`,
            es_elaborador: rubro.es_elaborador === true,
          });
        });
        safe(() => setRubrosMap(map));

        const resInsumos = await insumosList(businessId, {
          page: 1,
          limit: 999999,
          search: '',
        });
        if (isCancelled || reloadRunRef.current !== runId) return;

        const dataAll = Array.isArray(resInsumos?.data) ? resInsumos.data : [];
        safe(() => setAllInsumos(dataAll));

        const todoGroup = await ensureTodoInsumos(businessId);
        if (isCancelled || reloadRunRef.current !== runId) return;

        safe(() => setTodoGroupId(todoGroup?.id || null));

        if (todoGroup?.id) {
          const exclusiones = await getExclusionesInsumos(businessId, todoGroup.id);
          if (isCancelled || reloadRunRef.current !== runId) return;

          const ids = (exclusiones || [])
            .filter((e) => e.scope === 'insumo')
            .map((e) => Number(e.ref_id))
            .filter(Boolean);

          safe(() => setExcludedIds(new Set(ids)));
        }

        try {
          await ensureDiscontinuadosInsumos(businessId);
        } catch { }

        const resGroups = await insumoGroupsList(businessId);
        if (isCancelled || reloadRunRef.current !== runId) return;

        const list = Array.isArray(resGroups?.data)
          ? resGroups.data
          : Array.isArray(resGroups)
            ? resGroups
            : [];

        safe(() => setGroups(list));

        console.log('[InsumosMain] 📦 Grupos cargados:', list.length);
      } catch (e) {
        if (isCancelled || reloadRunRef.current !== runId) return;
        console.error('❌ [recargarTodo] Error:', e);
      }
    };

    recargarTodo();

    return () => {
      isCancelled = true;
    };
  }, [businessId, reloadKey, activeDivisionId]); // ✅ Recargar al cambiar división

  /* ================== IDS "SIN AGRUPACIÓN" ================== */
  const activeIdSet = useMemo(
    () => new Set(baseActivos.map((i) => Number(i.id)).filter(Number.isFinite)),
    [baseActivos]
  );

  const inactiveIdSet = useMemo(
    () => new Set(baseInactivos.map((i) => Number(i.id)).filter(Number.isFinite)),
    [baseInactivos]
  );

  const idsEnOtras = useMemo(
    () =>
      new Set(
        (groupsScoped || []) // ✅ USAR groupsScoped en lugar de groups
          .filter((g) => !esTodoGroup(g))
          .flatMap((g) => (g.items || g.insumos || []).map((i) => Number(i.insumo_id ?? i.id)))
          .filter(Number.isFinite)
      ),
    [groupsScoped]
  );

  const idsSinAgrupActivos = useMemo(() => {
    const res = new Set();
    activeIdSet.forEach((id) => {
      if (!excludedIds.has(id) && !idsEnOtras.has(id)) res.add(id);
    });
    return res;
  }, [activeIdSet, excludedIds, idsEnOtras]);

  const idsSinAgrupInactivos = useMemo(() => {
    const res = new Set();
    inactiveIdSet.forEach((id) => {
      if (!excludedIds.has(id) && !idsEnOtras.has(id)) res.add(id);
    });
    return res;
  }, [inactiveIdSet, excludedIds, idsEnOtras]);

  /* ================== BASE SEGÚN VISTA ================== */
  const selectedGroup = useMemo(() => {
    const id = Number(selectedGroupId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return (groupsScoped || []).find((g) => Number(g.id) === id) || null; // ✅ USAR groupsScoped
  }, [selectedGroupId, groupsScoped]);

  const isDiscView = useMemo(() => {
    return selectedGroup ? esDiscontinuadosGroup(selectedGroup) : false;
  }, [selectedGroup]);

  const sidebarBase = useMemo(() => {
    if (isDiscView) {
      return (baseAll || []).filter((i) => discontinuadosIds.has(Number(i.id)));
    }
    return baseActivos;
  }, [isDiscView, baseAll, baseActivos, discontinuadosIds]);

  const visibleIds = useMemo(() => {
    if (!selectedGroupId) return null;

    const gId = Number(selectedGroupId);
    const g = groupsScoped.find((x) => Number(x.id) === gId); // ✅ USAR groupsScoped
    if (!g) return null;

    if (esDiscontinuadosGroup(g)) return discontinuadosIds;

    if (todoGroupId && gId === Number(todoGroupId)) {
      return isDiscView ? idsSinAgrupInactivos : idsSinAgrupActivos;
    }

    const baseSet = isDiscView ? inactiveIdSet : activeIdSet;

    const s = new Set();
    (g.items || g.insumos || []).forEach((it) => {
      const id = Number(it.insumo_id ?? it.id);
      if (Number.isFinite(id) && baseSet.has(id)) s.add(id);
    });

    return s;
  }, [
    selectedGroupId,
    groupsScoped, // ✅ USAR groupsScoped
    todoGroupId,
    isDiscView,
    activeIdSet,
    inactiveIdSet,
    idsSinAgrupActivos,
    idsSinAgrupInactivos,
    discontinuadosIds,
  ]);

  const filteredBase = useMemo(() => {
    if (!visibleIds) return sidebarBase;

    return (sidebarBase || []).filter((ins) => {
      const id = Number(ins?.id);
      return Number.isFinite(id) && visibleIds.has(id);
    });
  }, [sidebarBase, visibleIds]);

  const rubrosTree = useMemo(() => {
    if (!filteredBase.length) return [];
    if (rubrosMap.size === 0) return [];

    const map = new Map();

    filteredBase.forEach((insumo) => {
      const rubroCodigo = String(insumo.rubro_codigo || insumo.rubro || '');
      const rubroInfo = rubrosMap.get(rubroCodigo) || {
        codigo: rubroCodigo,
        nombre: rubroCodigo || 'Sin rubro',
        es_elaborador: false,
      };

      const rubroNombre = rubroInfo.nombre;

      if (!map.has(rubroNombre)) {
        map.set(rubroNombre, {
          nombre: rubroNombre,
          codigo: rubroInfo.codigo,
          es_elaborador: rubroInfo.es_elaborador,
          insumos: [],
        });
      }

      map.get(rubroNombre).insumos.push(insumo);
    });

    return Array.from(map.values());
  }, [filteredBase, rubrosMap]);

  const tableRows = useMemo(() => {
    let base = filteredBase || [];

    const codigoSel = rubroSeleccionado?.codigo;
    if (codigoSel == null) return base;

    const codigoStr = String(codigoSel);

    return base.filter((insumo) => {
      const codigo = String(insumo?.rubro_codigo || insumo?.rubro || '');
      return codigo === codigoStr;
    });
  }, [filteredBase, rubroSeleccionado]);

  useEffect(() => {
    if (!rubroSeleccionado) return;

    const exists = (rubrosTree || []).some(
      (r) => String(r.codigo) === String(rubroSeleccionado.codigo)
    );

    if (!exists) setRubroSeleccionado(null);
  }, [rubrosTree, rubroSeleccionado]);

  const insumosGroupIndex = useMemo(() => {
    const byInsumoId = new Map();

    (groupsScoped || []).forEach((g) => { // ✅ USAR groupsScoped
      if (esTodoGroup(g) || esDiscontinuadosGroup(g)) return;

      const items = g.items || g.insumos || [];
      items.forEach((item) => {
        const id = Number(item.insumo_id ?? item.id);
        if (!Number.isFinite(id)) return;

        if (!byInsumoId.has(id)) byInsumoId.set(id, new Set());
        byInsumoId.get(id).add(Number(g.id));
      });
    });

    return { byInsumoId };
  }, [groupsScoped]);

  /* ================== SELECCIÓN INTELIGENTE TODO vs FAVORITA ================== */
  useEffect(() => {
    const todoId = todoGroupId;
    const todoEmpty = idsSinAgrupActivos.size === 0;

    const recentlyPicked = Date.now() - lastManualPickRef.current < 800;
    if (recentlyPicked) return;

    const groupsReady = Array.isArray(groupsScoped) && groupsScoped.length > 0;
    if (!groupsReady) return;

    if (selectedGroup && esDiscontinuadosGroup(selectedGroup)) return;

    const isTodoSelected =
      selectedGroupId && Number(selectedGroupId) === Number(todoId);

    if (todoEmpty) {
      const fav = (groupsScoped || []).find((g) => Number(g?.id) === Number(favoriteGroupId));
      if (fav) {
        if (!selectedGroupId || Number(selectedGroupId) !== Number(fav.id)) {
          setSelectedGroupId(fav.id);
          setRubroSeleccionado(null);
        }
      } else {
        const firstWithItems = groupsScoped.find((g) => {
          const gId = Number(g.id);
          if (gId === todoId) return false;
          const items = g.items || g.insumos || [];
          return items.length > 0;
        });

        if (firstWithItems && (!selectedGroupId || Number(selectedGroupId) === Number(todoId))) {
          setSelectedGroupId(firstWithItems.id);
          setRubroSeleccionado(null);
        }
      }
    } else {
      if (!isTodoSelected && Number.isFinite(Number(todoId)) && todoId) {
        setSelectedGroupId(Number(todoId));
        setRubroSeleccionado(null);
      }
    }
  }, [todoGroupId, idsSinAgrupActivos, favoriteGroupId, groupsScoped, selectedGroupId, selectedGroup]);

  useEffect(() => {
    if (!rubroSeleccionado) return;

    const exists = (rubrosTree || []).some((r) => r.nombre === rubroSeleccionado.nombre);
    if (!exists) setRubroSeleccionado(null);
  }, [rubrosTree, rubroSeleccionado, setRubroSeleccionado]);

  /* ================== BUSCADOR ================== */
  const insumosSearchOptions = useMemo(() => {
    if (!baseAll.length) return [];

    return baseAll
      .map((ins) => {
        const id = Number(ins.id);
        if (!Number.isFinite(id)) return null;

        const nombre = (ins.nombre || '').trim() || `INS-${id}`;
        return {
          id,
          nombre,
          _search: normalize(nombre),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [baseAll]);

  const [jumpToInsumoId, setJumpToInsumoId] = useState(null);
  const [selectedInsumoId, setSelectedInsumoId] = useState(null);
  const [searchText, setSearchText] = useState('');

  const focusInsumo = useCallback(
    (rawId, preferGroupId = null) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) return;

      const insumo = (baseAll || []).find((x) => Number(x?.id) === id) || null;

      const groupsSet = insumosGroupIndex.byInsumoId.get(id) || new Set();
      const allGroups = groupsScoped || []; // ✅ USAR groupsScoped

      let targetGroupId = null;

      if (preferGroupId != null) {
        const prefNum = Number(preferGroupId);
        if (Number.isFinite(prefNum) && allGroups.some((g) => Number(g.id) === prefNum)) {
          targetGroupId = prefNum;
        }
      }

      if (!targetGroupId && discontinuadosIds.has(id) && Number.isFinite(Number(discontinuadosGroupId))) {
        targetGroupId = Number(discontinuadosGroupId);
      }

      if (!targetGroupId && groupsSet.size > 0) {
        for (const gid of groupsSet) {
          const n = Number(gid);
          if (Number.isFinite(n) && n > 0) {
            targetGroupId = n;
            break;
          }
        }
      }

      if (
        !targetGroupId &&
        Number.isFinite(Number(todoGroupId)) &&
        Number(todoGroupId) > 0
      ) {
        targetGroupId = Number(todoGroupId);
      }

      if (insumo && rubrosMap?.size) {
        const nextVista = vistaForInsumo(insumo, rubrosMap);
        if (nextVista && nextVista !== vista) {
          setVista(nextVista);
        }
      }

      const shouldChangeGroup =
        targetGroupId && (!selectedGroupId || Number(selectedGroupId) !== Number(targetGroupId));

      if (shouldChangeGroup) {
        markManualPick();
        setSelectedGroupId(targetGroupId);
        setRubroSeleccionado(null);
      } else {
        setRubroSeleccionado(null);
      }

      setSelectedInsumoId(id);
      setJumpToInsumoId(id);

      setTimeout(() => {
        setJumpToInsumoId(null);
      }, 1400);
    },
    [
      baseAll,
      groupsScoped, // ✅ USAR groupsScoped
      insumosGroupIndex,
      todoGroupId,
      discontinuadosGroupId,
      discontinuadosIds,
      selectedGroupId,
      rubrosMap,
      vista,
      markManualPick,
    ]
  );

  const handleSelectGroupId = useCallback(
    (rawId) => {
      const n = Number(rawId);
      const id = Number.isFinite(n) && n > 0 ? n : null;

      markManualPick();
      setSelectedGroupId(id);
      setRubroSeleccionado(null);
    },
    [markManualPick]
  );

  const handleToggleFavorite = useCallback(
    async (groupId) => {
      try {
        const newFav = favoriteGroupId === groupId ? null : groupId;
        await BusinessesAPI.saveFavoriteGroup(businessId, newFav, 'insumo');
        setFavoriteGroupId(newFav);
        notify(newFav ? 'Agrupación marcada como favorita' : 'Favorita removida', 'success');
      } catch (e) {
        console.error('Error saving favorite group', e);
        notify('Error al guardar favorita', 'error');
      }
    },
    [businessId, favoriteGroupId, notify]
  );

  const handleEditGroup = useCallback(
    async (group) => {
      if (!businessId) {
        notify('Seleccioná un negocio antes de editar agrupaciones', 'warning');
        return;
      }
      const actual = String(group?.nombre || '');
      const nuevo = window.prompt('Nuevo nombre de la agrupación:', actual);
      if (nuevo == null) return;
      const trimmed = nuevo.trim();
      if (!trimmed) return;

      try {
        await insumoGroupUpdate(group.id, { nombre: trimmed });
        const res = await insumoGroupsList(businessId);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setGroups(list);
        notify('Agrupación renombrada', 'success');
      } catch (e) {
        console.error('[InsumosMain] Error editGroup:', e);
        notify(e.message || 'Error al renombrar agrupación', 'error');
      }
    },
    [businessId, notify]
  );

  const handleDeleteGroup = useCallback(
    async (group) => {
      if (!businessId) {
        notify('Seleccioná un negocio antes de eliminar agrupaciones', 'warning');
        return;
      }

      if (
        !window.confirm(
          `¿Eliminar la agrupación "${group.nombre}"? Esta acción no se puede deshacer.`
        )
      ) {
        return;
      }

      try {
        await insumoGroupDelete(group.id);

        if (selectedGroupId && Number(selectedGroupId) === Number(group.id)) {
          setSelectedGroupId(null);
        }
        if (favoriteGroupId && Number(favoriteGroupId) === Number(group.id)) {
          setFavoriteGroupId(null);
        }

        const res = await insumoGroupsList(businessId);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setGroups(list);

        notify('Agrupación eliminada', 'success');
      } catch (e) {
        console.error('[InsumosMain] Error deleteGroup:', e);
        notify(e.message || 'Error al eliminar agrupación', 'error');
      }
    },
    [businessId, favoriteGroupId, notify, selectedGroupId]
  );

  const handleRenameGroup = useCallback(
    async (group) => {
      notify('Función de renombrar implementada', 'info');
    },
    [notify]
  );

  const handleOpenGroupModalForInsumo = useCallback((insumo) => {
    setGroupModalInsumo(insumo || null);
    setGroupModalRubroLabel(null);
    setGroupModalInitialGroupId(null);
    setGroupModalOpen(true);
  }, []);

  const handleOpenGroupModalForRubro = useCallback((rubroLabel) => {
    setGroupModalInsumo(null);
    setGroupModalRubroLabel(rubroLabel || null);
    setGroupModalInitialGroupId(null);
    setGroupModalOpen(true);
  }, []);

  const loadGroups = useCallback(async () => {
    if (!businessId) return;
    setGroupsLoading(true);
    try {
      const res = await insumoGroupsList(businessId);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setGroups(list);
    } catch (e) {
      console.error('[InsumosMain] Error al cargar grupos:', e);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, [businessId]);

  const handleCloseGroupModal = useCallback(
    async (didSave = false) => {
      setGroupModalOpen(false);
      setGroupModalInsumo(null);
      setGroupModalRubroLabel(null);
      setGroupModalInitialGroupId(null);

      if (didSave) {
        await loadGroups();
        forceRefresh();
      }
    },
    [loadGroups, forceRefresh]
  );

  const effectiveViewMode = useMemo(() => {
    const g = selectedGroup;
    if (g?.id && viewModeByGroup && viewModeByGroup[g.id]) {
      return viewModeByGroup[g.id];
    }
    return viewModeGlobal;
  }, [selectedGroup, viewModeByGroup, viewModeGlobal]);

  const sidebarListMode = effectiveViewMode;

  // ✅ NUEVO: Mostrar nombre de división en el título
  const titulo = useMemo(() => {
    const base = businessName ? `Insumos — ${businessName}` : 'Insumos';
    if (!isMainDivision && activeDivisionName) {
      return `${base} › ${activeDivisionName}`;
    }
    return base;
  }, [businessName, isMainDivision, activeDivisionName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '12px 8px 0 8px',
        }}
      >
        <h2 style={{ margin: 0 }}>{titulo}</h2>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 360, maxWidth: 360 }}>
            <Buscador
              placeholder="Buscar insumo…"
              opciones={insumosSearchOptions}
              value={searchText}
              onChange={(v) => setSearchText(v || '')}
              clearOnPick={false}
              autoFocusAfterPick
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 0,
          alignItems: 'start',
          borderRadius: 12,
          overflow: 'hidden',
          height: '75vh',
          boxShadow: '0 1px 4px rgba(0,0,0,.08)',
        }}
      >
        <div
          style={{
            borderRight: '1px solid #eee',
            background: '#fafafa',
            position: 'sticky',
            top: 0,
            alignSelf: 'start',
            height: 'calc(100vh - 0px)',
            overflowY: 'auto',
          }}
        >
          <InsumosSidebar
            rubros={rubrosTree}
            rubroSeleccionado={rubroSeleccionado}
            setRubroSeleccionado={setRubroSeleccionado}
            businessId={businessId}
            vista={vista}
            onVistaChange={setVista}
            groups={groupsScoped} // ✅ PASAR groupsScoped
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
            listMode={sidebarListMode}
            onChangeListMode={handleChangeListMode}
            onManualPick={markManualPick}
            activeDivisionId={activeDivisionId}
            activeDivisionGroupIds={activeDivisionInsumoGroupIds}
            assignedGroupIds={assignedInsumoGroupIds}
            refetchAssignedGroups={refetchAssignedInsumoGroups}
          />
        </div>

        <div
          id="insumos-scroll"
          style={{
            background: '#fff',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 0px)',
          }}
        >
          <InsumosTable
            rows={tableRows}
            loading={false}
            onEdit={() => { }}
            onDelete={() => { }}
            noBusiness={!businessId}
            vista={vista}
            businessId={businessId}
            groups={groupsScoped} // ✅ PASAR groupsScoped
            selectedGroupId={selectedGroupId}
            discontinuadosGroupId={discontinuadosGroupId}
            onOpenGroupModalForInsumo={handleOpenGroupModalForInsumo}
            onCreateGroupFromRubro={handleOpenGroupModalForRubro}
            rubrosMap={rubrosMap}
            onRefetch={() => setReloadKey((k) => k + 1)}
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
          />
        </div>
      </div>

      <InsumoGroupModal
        open={groupModalOpen}
        originRubroLabel={groupModalRubroLabel}
        onClose={handleCloseGroupModal}
        insumo={groupModalInsumo}
        businessId={businessId}
        groups={groupsScoped} // ✅ PASAR groupsScoped
        initialGroupId={groupModalInitialGroupId}
        onGroupsReload={loadGroups}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.type}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}