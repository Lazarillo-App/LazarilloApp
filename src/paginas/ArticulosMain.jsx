/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import { showAlert } from '../servicios/appAlert';
import { showPrompt } from '../servicios/appPrompt';
import { showConfirm } from '../servicios/appConfirm';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import TablaArticulos from '../componentes/TablaArticulos';
import SidebarCategorias from '../componentes/SidebarCategorias';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';
import { useBusiness } from '../context/BusinessContext';
import { BusinessesAPI, httpBiz } from "../servicios/apiBusinesses";
import { applyCreateGroup, applyAppend, applyRemove, applyMove } from '../utils/groupMutations';
import { obtenerAgrupaciones, actualizarAgrupacion, eliminarAgrupacion } from "../servicios/apiAgrupaciones";
import { emitGroupsChanged } from "../utils/groupsBus";
import { buildAgrupacionesIndex, findGroupsForQuery } from '../servicios/agrupacionesIndex';
import { Snackbar, Alert, Button } from '@mui/material';
import { clearVentasCache } from '../servicios/apiVentas';
import { downloadVentasCSV } from '../servicios/apiVentas';
import VentasActionsMenu from '../componentes/VentasActionsMenu';
import { useSalesData, getVentasFromMap } from '../hooks/useSalesData';
import { useFirstDate } from '../hooks/useFirstDate';
import UploadCSVModal from '../componentes/UploadCSVModal';
import Buscador from '@/componentes/Buscador';
import SubBusinessCreateModal from '../componentes/SubBusinessCreateModal';
import ReactDOM from 'react-dom';
import instructionImage1 from '../assets/brand/maxirest-menu.jpeg';
import instructionImage2 from '../assets/brand/maxirest-config.jpeg';
import {
  notifyGroupRenamed,
  notifyGroupDeleted,
  notifyGroupMovedToDivision,
  notifyGroupFavoriteChanged,
  notifyGroupCreated,
} from '../servicios/notifyGroupActions';
import { usePersistUiActions } from '@/hooks/usePersistUiActions';
import '../css/global.css';
import '../css/theme-layout.css';

// ✅ CAMBIO 1: Favorita ahora es por negocio
const getFavKey = (bizId) => `favGroupId_${bizId || 'default'}`;
const VIEW_KEY = 'lazarillo:ventasViewMode';

const norm = (s) => String(s || '').trim().toLowerCase();

const getArtId = (a) => {
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

const isDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

const isRealTodoGroup = (g, todoId) => {
  if (!g) return false;
  if (!Number.isFinite(Number(todoId))) return false;
  return Number(g.id) === Number(todoId);
};

// Fallback por nombre para cuando todoGroupId aún no está seteado
const esTodoGroupByName = (g) => {
  if (!g) return false;
  const n = String(g.nombre || g.name || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return n === 'todo' || n === 'sin agrupacion' || n === 'sin agrupar' || n === 'sin grupo';
};

export default function ArticulosMain(props) {
  const {
    syncVersion: syncVersionProp = 0,
    activeBizId: activeBizIdProp = '',
  } = props;

  const {
    activeDivisionId,
    activeDivisionAgrupacionIds,
    assignedAgrupacionIds,
    refetchAssignedAgrupaciones,
  } = useBusiness();

  const [syncVersion, setSyncVersion] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [discoOrigenById, setDiscoOrigenById] = useState({});
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [activeIds, setActiveIds] = useState(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [subBizModalOpen, setSubBizModalOpen] = useState(false);
  const [groupForSubBiz, setGroupForSubBiz] = useState(null);
  const [orgNameModalOpen, setOrgNameModalOpen] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [orgNameSaving, setOrgNameSaving] = useState(false);
  const [ventasOverrides, setVentasOverrides] = useState(() => new Map());
  const [searchText, setSearchText] = useState('');

  const { activeBusinessId, selectBusiness, setActiveBusiness } = useBusiness();
  const activeBizId = String(activeBusinessId || '');

  // Limpiar overrides al cambiar de negocio para evitar que
  // los valores del negocio anterior se sumen al nuevo
  useEffect(() => {
    setVentasOverrides(new Map());
  }, [activeBizId]);
  const { rootBusiness, allBusinesses, updateOrg, organization } = useOrganization();

  usePersistUiActions(activeBizId);

  // Inicializar rango con valores reales desde el inicio
  const [rango, setRango] = useState(() => {
    const def = lastNDaysUntilYesterday(daysByMode('7'));
    return { mode: '7', from: def.from, to: def.to };
  });

  const periodo = useMemo(() => {
    if (rango.from && rango.to) {
      return { from: rango.from, to: rango.to };
    }
    return lastNDaysUntilYesterday(daysByMode(rango.mode || '7'));
  }, [rango]);

  const periodoRef = useRef(periodo);
  const sidebarScrollRef = useRef(null);   // para preservar scroll del sidebar
  useEffect(() => {
    periodoRef.current = periodo;
  }, [periodo]);

  const {
    ventasMap,
    ventasPorArticulo,
    isLoading: ventasLoading,
    error: ventasError,
    refetch: refetchVentas,
  } = useSalesData({
    businessId: activeBizId,
    from: periodo.from,
    to: periodo.to,
    enabled: !!activeBizId && !!periodo.from && !!periodo.to,
    syncVersion,
  });

  const [viewModeGlobal, setViewModeGlobal] = useState(() => {
    if (typeof window === 'undefined') return 'by-subrubro';
    const raw = localStorage.getItem(VIEW_KEY);
    return raw === 'by-categoria' ? 'by-categoria' : 'by-subrubro';
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, viewModeGlobal); } catch { }
  }, [viewModeGlobal]);

  const [viewModeByGroup, setViewModeByGroup] = useState({});

  useEffect(() => {
    if (!activeBizId) return;

    (async () => {
      try {
        const resp = await BusinessesAPI.getViewPrefs(activeBizId);
        const byGroup = resp?.byGroup || {};
        setViewModeByGroup(byGroup);
      } catch (e) {
        setViewModeByGroup({});
      }
    })();
  }, [activeBizId]);

  const handleChangeListMode = useCallback(
    (mode) => {
      setViewModeGlobal(mode);
      try { localStorage.setItem(VIEW_KEY, mode); } catch { }

      const g = agrupacionSeleccionada;
      const bid = activeBizId;
      const groupId = Number(g?.id);

      if (bid && Number.isFinite(groupId)) {
        setViewModeByGroup((prev) => ({
          ...prev,
          [groupId]: mode,
        }));

        BusinessesAPI.saveViewPref(bid, {
          agrupacionId: groupId,
          viewMode: mode,
        }).catch((e) => {
          console.error('saveViewPref error', e);
        });
      }
    },
    [agrupacionSeleccionada, activeBizId]
  );

  const getGroupItemsRaw = (g) => {
    if (!g) return [];
    // Combinar articulos JSONB (objetos) + app_articles_ids (array de IDs numericos)
    const fromJsonb = Array.isArray(g.articulos) ? g.articulos
      : Array.isArray(g.items) ? g.items
      : Array.isArray(g.data) ? g.data
      : [];
    const fromAppIds = Array.isArray(g.app_articles_ids)
      ? g.app_articles_ids.map(id => ({ id: Number(id) })).filter(a => a.id > 0)
      : [];
    if (!fromAppIds.length) return fromJsonb;
    // Combinar sin duplicar: app_articles_ids tiene precedencia (tiene IDs reales)
    const seenIds = new Set(fromAppIds.map(a => a.id));
    const extra = fromJsonb.filter(a => {
      const id = Number(a?.id ?? a?.articulo_id);
      return id > 0 && !seenIds.has(id);
    });
    return [...fromAppIds, ...extra];
  };

  const agIndex = useMemo(() => buildAgrupacionesIndex(agrupaciones || []), [agrupaciones]);

  const [missMsg, setMissMsg] = useState('');
  const [missOpen, setMissOpen] = useState(false);
  const showMiss = useCallback((msg) => { setMissMsg(msg); setMissOpen(true); }, []);

  const lastManualPickRef = useRef(0);
  const markManualPick = useCallback(() => { lastManualPickRef.current = Date.now(); }, []);

  const [orgAssignedIds, setOrgAssignedIds] = React.useState(null);

  // Primera fecha histórica de ventas — específica por negocio
  const { firstDate: firstDateVentas, loadingFirst: loadingFirstVentas } = useFirstDate(activeBizId, 'sales');

  // Si el rango activo es "Histórico" y cambia el negocio/firstDate, actualizar el from automáticamente
  useEffect(() => {
    if (rango.mode === 'all' && firstDateVentas) {
      setRango(prev => ({ ...prev, from: firstDateVentas }));
    }
  }, [firstDateVentas]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetchAgrupaciones = React.useCallback(async () => {
    // Guardar scroll del sidebar antes del refetch y restaurarlo después
    const scrollEl = sidebarScrollRef.current;
    const savedScroll = scrollEl ? scrollEl.scrollTop : 0;

    if (!activeBizId) {
      setAgrupaciones([]);
      setOrgAssignedIds(null);
      return [];
    }

    try {
      const { list, orgAssignedIds: assigned } = await obtenerAgrupaciones(activeBizId, activeDivisionId ?? null);

      // Filtrar agrupaciones movidas a otro negocio
      const filtered = (list || []).filter(ag => !ag.moved_to_business_id);

      if (Array.isArray(filtered)) setAgrupaciones(filtered);
      setOrgAssignedIds(assigned);

      // Restaurar scroll después de que React aplique los cambios al DOM
      if (scrollEl && savedScroll > 0) {
        requestAnimationFrame(() => {
          if (sidebarScrollRef.current) sidebarScrollRef.current.scrollTop = savedScroll;
        });
      }

      return filtered || [];
    } catch (e) {
      console.error('[ArticulosMain] ❌ Error cargando agrupaciones:', e);
      setAgrupaciones([]);
      setOrgAssignedIds(null);
      return [];
    }
  }, [activeBizId, activeDivisionId]);

  useEffect(() => {
    setAgrupacionSeleccionada(null);
    setCategoriaSeleccionada(null);
    setFiltroBusqueda('');
    setSearchText('');
    setCategorias([]); // limpiar artículos del negocio anterior del buscador
  }, [activeBizId]);

  useEffect(() => {
    if (!activeBizId) {
      console.log('[ArticulosMain] Sin businessId, limpiando agrupaciones');
      setAgrupaciones([]);
      return;
    }

    console.log('[ArticulosMain] Cargando agrupaciones inicial...');
    refetchAgrupaciones();
  }, [activeBizId, activeDivisionId, reloadKey, refetchAgrupaciones]);

  const [todoInfo, setTodoInfo] = useState({
    todoGroupId: null,
    idsSinAgrupCount: 0,
    todoIds: new Set(),
  });

  const todoIdRef = useRef(null);
  useEffect(() => {
    todoIdRef.current = todoInfo?.todoGroupId ?? null;
  }, [todoInfo?.todoGroupId]);

  const handleTodoInfo = useCallback((info) => {
    const safe = info || {};
    const rawId = safe.todoGroupId;
    const todoGroupId = Number.isFinite(Number(rawId)) ? Number(rawId) : null;

    const idsSinAgrupArray = Array.isArray(safe.idsSinAgrup)
      ? safe.idsSinAgrup
      : [];

    const todoIdsSet = new Set(
      idsSinAgrupArray
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0)
    );

    const idsSinAgrupCount = Number.isFinite(Number(safe.idsSinAgrupCount))
      ? Number(safe.idsSinAgrupCount)
      : todoIdsSet.size;

    setTodoInfo({
      todoGroupId,
      idsSinAgrupCount,
      todoIds: todoIdsSet,
    });
  }, []);

  useEffect(() => {
    window.__DEBUG_VENTAS_MAP = ventasMap;

    if (ventasMap && ventasMap.size > 0) {
      console.log('[ArticulosMain] ventasMap:', {
        size: ventasMap.size,
        sample: Array.from(ventasMap.entries()).slice(0, 3)
      });
    }
  }, [ventasMap]);

  // ✅ CAMBIO 2: Guardar/cargar favorita por negocio
  useEffect(() => {
    const key = getFavKey(activeBizId);
    if (Number.isFinite(Number(favoriteGroupId))) {
      localStorage.setItem(key, String(favoriteGroupId));
    } else {
      localStorage.removeItem(key);
    }
  }, [favoriteGroupId, activeBizId]);

  const mutateGroups = useCallback(async (action) => {
    setAgrupaciones(prev => {
      switch (action.type) {
        case 'create':
          return applyCreateGroup(prev, {
            id: action.id,
            nombre: action.nombre,
            articulos: action.articulos
          });
        case 'append':
          return applyAppend(prev, {
            groupId: action.groupId,
            articulos: action.articulos,
            baseById: action.baseById
          });
        case 'remove':
          return applyRemove(prev, {
            groupId: action.groupId,
            ids: action.ids
          });
        case 'move':
          return applyMove(prev, {
            fromId: action.fromId,
            toId: action.toId,
            ids: action.ids,
            baseById: action.baseById
          });
        default:
          return prev;
      }
    });

    // ✅ NO refetch automático — la mutación optimista ya actualizó el estado local.
    // El caller (ArticuloAccionesMenu, SubrubroAccionesMenu) llama onRefetch si lo necesita.
    // Refetch automático causa que artículos discontinuados reaparezcan.
    try { emitGroupsChanged(action.type, { action }); } catch { }
  }, []);

  useEffect(() => {
    if (!activeBizId) return;
    refetchAgrupaciones();
  }, [activeBizId, reloadKey, refetchAgrupaciones]);

  // Cargar favorita por negocio desde backend o localStorage
  useEffect(() => {
    const bid = activeBizId;
    if (!bid) {
      setFavoriteGroupId(null);
      return;
    }

    // ✅ Resetear inmediatamente al cambiar de negocio para evitar selección cruzada
    setFavoriteGroupId(null);

    (async () => {
      try {
        const res = await BusinessesAPI.getFavoriteGroup(bid);
        const favIdFromDb = Number(res?.favoriteGroupId);
        if (Number.isFinite(favIdFromDb) && favIdFromDb > 0) {
          setFavoriteGroupId(favIdFromDb);
        } else {
          const key = getFavKey(bid);
          const localFav = Number(localStorage.getItem(key));
          setFavoriteGroupId(Number.isFinite(localFav) ? localFav : null);
        }
      } catch (e) {
        console.error('Error cargando favorita desde backend', e);
        const key = getFavKey(bid);
        const localFav = Number(localStorage.getItem(key));
        setFavoriteGroupId(Number.isFinite(localFav) ? localFav : null);
      }
    })();
  }, [activeBizId]);

  const handleDownloadVentasCsv = async () => {
    try {
      const bid = activeBizId;
      const { from, to } = periodo || {};

      if (!bid || !from || !to) {
        console.warn('[handleDownloadVentasCsv] faltan datos', { bid, from, to });
        showAlert('Falta negocio activo o rango de fechas para descargar el CSV.', 'warning');
        return;
      }

      console.log('[handleDownloadVentasCsv] solicitando CSV...', { bid, from, to });

      const blob = await downloadVentasCSV(bid, { from, to });
      console.log('[handleDownloadVentasCsv] blob size', blob.size);

      if (!blob || blob.size === 0) {
        showAlert('El CSV vino vacío.', 'warning');
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `ventas_${bid}_${from}_a_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar CSV de ventas', err);
      showAlert(`Error al descargar CSV de ventas: ${err.message || err}`, 'error');
    }
  };

  useEffect(() => {
    const onBizSynced = () => setReloadKey((k) => k + 1);

    const onVentasUpdated = () => {
      setSyncVersion((v) => v + 1);
    };

    window.addEventListener('business:synced', onBizSynced);
    window.addEventListener('ventas:updated', onVentasUpdated);

    return () => {
      window.removeEventListener('business:synced', onBizSynced);
      window.removeEventListener('ventas:updated', onVentasUpdated);
    };
  }, []);

  const activeBizRef = useRef(localStorage.getItem('activeBusinessId') || '');
  useEffect(() => {
    activeBizRef.current = activeBizId;
  }, [activeBizId]);

  useEffect(() => {
    if (!agrupacionSeleccionada) return;
    const gActual = (agrupaciones || []).find(g => Number(g.id) === Number(agrupacionSeleccionada.id));
    if (gActual && (
      gActual.nombre !== agrupacionSeleccionada.nombre ||
      (Array.isArray(gActual.articulos) ? gActual.articulos.length : 0) !==
      (Array.isArray(agrupacionSeleccionada.articulos) ? agrupacionSeleccionada.articulos.length : 0)
    )) {
      setAgrupacionSeleccionada(gActual);
    }
  }, [agrupaciones]);

  // Ref para saber el ID de la agrupación anterior y no resetear la categoría
  // cuando el cambio es solo una actualización de datos (mismo ID)
  const prevAgrupacionIdRef = useRef(null);
  useEffect(() => {
    const newId = agrupacionSeleccionada?.id ?? null;
    const prevId = prevAgrupacionIdRef.current;
    prevAgrupacionIdRef.current = newId;

    // Solo resetear si cambió la agrupación seleccionada (no si es actualización del mismo objeto)
    console.log('[reset?] newId:', newId, '| prevId:', prevId, '| reset:', newId !== prevId);
    if (newId !== prevId) {
      setFiltroBusqueda('');
      setCategoriaSeleccionada(null);
      setActiveIds(new Set());
    }
  }, [agrupacionSeleccionada]);

  useEffect(() => {
    const bid = activeBizId;
    if (!bid) return;
    setSyncVersion(v => v + 1);
  }, [periodo.from, periodo.to, activeBizId]);

  const handleCategoriasLoaded = useCallback((catsRaw) => {
    const normalizadas = (catsRaw || []).map((sub) => ({
      ...sub,
      categorias: (sub.categorias || []).map((cat) => ({
        ...cat,
        articulos: (cat.articulos || []).map((a) => {
          const idCanonico = getArtId(a);
          return {
            ...a,
            article_id: idCanonico,
            id: idCanonico ?? a.id,
          };
        }),
      })),
    }));

    setCategorias(normalizadas);
  }, []);

  const metaById = useMemo(() => {
    const m = new Map();
    (categorias || []).forEach(sub =>
      (sub.categorias || []).forEach(cat =>
        (cat.articulos || []).forEach(a => {
          const id = getArtId(a);
          if (id == null) return;
          m.set(id, {
            id,
            nombre: String(a.nombre ?? a.descripcion ?? `#${id}`),
            categoria: String(a.categoria ?? cat.categoria ?? 'Sin categoría'),
            subrubro: String(a.subrubro ?? sub.subrubro ?? 'Sin subrubro'),
            precio: Number(a.precio ?? 0),
          });
        })
      )
    );
    return m;
  }, [categorias]);

  const agrupacionesRich = useMemo(() => {
    return (agrupaciones || []).map(g => ({
      ...g,
      articulos: getGroupItemsRaw(g).map(a => {
        const id = getArtId(a);
        if (id == null) return null;
        const meta = metaById.get(id);
        return meta ? { ...a, ...meta, id } : { ...a, id };
      }).filter(Boolean),
    }));
  }, [agrupaciones, metaById]);

  const discGroup = useMemo(
    () => (agrupacionesRich || []).find(isDiscontinuadosGroup) || null,
    [agrupacionesRich]
  );

  const discIds = useMemo(() => {
    const s = new Set();
    if (!discGroup) return s;
    for (const art of getGroupItemsRaw(discGroup)) {
      const id = getArtId(art);
      if (id != null) s.add(id);
    }
    return s;
  }, [discGroup]);

  const [localDiscIds, setLocalDiscIds] = useState(() => new Set());
  const effectiveDiscIds = useMemo(() => {
    if (discIds.size > 0) return discIds;
    return localDiscIds;
  }, [discIds, localDiscIds]);

  // Modo organización: el principal solo tiene Sin Agrupacion/Discontinuados
  // y hay subnegocios creados (created_from === 'from_group')


  const articuloIds = useMemo(
    () =>
      (agrupacionSeleccionada?.articulos || [])
        .map((a) => Number(a?.id ?? a?.articuloId))
        .filter(Number.isFinite),
    [agrupacionSeleccionada]
  );

  const ventasMapFiltrado = useMemo(() => {
    if (!agrupacionSeleccionada?.id) return ventasMap;
    const s = new Set(articuloIds);
    const out = new Map();
    ventasMap.forEach((v, k) => {
      if (s.has(Number(k))) out.set(Number(k), v);
    });
    return out;
  }, [ventasMap, agrupacionSeleccionada, articuloIds]);

  const getAmountForId = useCallback((id) => {
    const k = Number(id);
    if (!Number.isFinite(k) || k <= 0) return 0;

    try {
      const { qty, amount } = getVentasFromMap(ventasMap, k);
      if (Number.isFinite(Number(amount)) && Number(amount) !== 0) {
        return Number(amount);
      }
      const precio = metaById.get(k)?.precio ?? 0;
      return Number(qty || 0) * Number(precio || 0);
    } catch (e) {
      return 0;
    }
  }, [ventasMap, metaById]);

  const getQtyForId = useCallback(
    (id) => {
      const k = Number(id);
      if (!Number.isFinite(k) || k <= 0) return 0;
      const { qty } = getVentasFromMap(ventasMap, k);
      return Number(qty || 0);
    },
    [ventasMap]
  );

  const getGroupQty = useCallback(
    (g) => {
      const items = getGroupItemsRaw(g);
      if (!items.length) return 0;
      let total = 0;
      for (const a of items) {
        const id = Number(a?.id ?? a?.articuloId);
        total += getQtyForId(id);
      }
      return total;
    },
    [getQtyForId]
  );

  const getGroupAmount = useCallback(
    (g) => {
      const items = getGroupItemsRaw(g);
      if (!items.length) return 0;
      let total = 0;
      for (const a of items) {
        const id = Number(a?.id ?? a?.articuloId);
        total += getAmountForId(id);
      }
      return Number(total || 0);
    },
    [getAmountForId]
  );

  const agrupacionesOrdenadas = useMemo(() => {
    const list = Array.isArray(agrupacionesRich) ? [...agrupacionesRich] : [];

    const todoId = todoInfo?.todoGroupId ? Number(todoInfo.todoGroupId) : null;

    return list.sort((a, b) => {
      const ida = Number(a.id);
      const idb = Number(b.id);

      const isTodoA = todoId && ida === todoId;
      const isTodoB = todoId && idb === todoId;
      if (isTodoA && !isTodoB) return -1;
      if (!isTodoA && isTodoB) return 1;

      const discA = isDiscontinuadosGroup(a);
      const discB = isDiscontinuadosGroup(b);
      if (discA && !discB) return 1;
      if (!discA && discB) return -1;

      const ma = getGroupAmount(a);
      const mb = getGroupAmount(b);
      if (mb !== ma) return mb - ma;

      return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    });
  }, [agrupacionesRich, todoInfo?.todoGroupId, getGroupAmount]);

  useEffect(() => {
    if (!agrupacionSeleccionada) return;
    const enriched = (agrupacionesRich || []).find(
      g => Number(g.id) === Number(agrupacionSeleccionada.id)
    );
    if (enriched) setAgrupacionSeleccionada(enriched);
  }, [agrupacionesRich]);

  useEffect(() => {
    if (!periodo?.from || !periodo?.to) return;
    clearVentasCache();
    setSyncVersion((v) => v + 1);
  }, [periodo?.from, periodo?.to]);


  const handleTotalResolved = useCallback((id, total) => {
    const key = Number(id);
    if (!Number.isFinite(key) || key <= 0) return;

    const qty = Number(total?.qty ?? total?.total ?? 0);
    const amount = Number(
      total?.amount ??
      total?.calcAmount ??
      total?.total_amount ??
      total?.totalAmount ??
      0
    );

    const qtyOk = Number.isFinite(qty) ? qty : 0;
    const amountOk = Number.isFinite(amount) ? amount : 0;

    if (qtyOk === 0 && amountOk === 0) return;

    setVentasOverrides(prev => {
      const next = new Map(prev);
      const prevVal = next.get(key) || {};

      if ((prevVal.qty ?? 0) === qtyOk && (prevVal.amount ?? 0) === amountOk) return prev;

      next.set(key, { ...prevVal, qty: qtyOk, amount: amountOk });
      return next;
    });
  }, []);


  const [jumpToId, setJumpToId] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const pendingJumpRef = useRef(null);
  const jumpTriesRef = useRef(0);

  const tryJumpNow = useCallback((id) => {
    const container = document.getElementById('tabla-scroll');
    const row = document.querySelector(`[data-article-id="${id}"]`);
    if (!container || !row) return false;
    const top = row.offsetTop - container.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    row.classList.add('highlight-jump');
    setTimeout(() => row.classList.remove('highlight-jump'), 1400);
    return true;
  }, []);

  const scheduleJump = useCallback((id) => {
    pendingJumpRef.current = Number(id);
    jumpTriesRef.current = 0;
  }, []);

  const allIds = useMemo(() => {
    const out = [];
    for (const sub of categorias || []) {
      for (const cat of sub.categorias || []) {
        for (const a of cat.articulos || []) {
          const id = getArtId(a);
          if (id != null) out.push(id);
        }
      }
    }
    return out;
  }, [categorias]);

  const idsAsignados = useMemo(() => {
    const s = new Set();

    (agrupaciones || [])
      .filter(g => !isRealTodoGroup(g, todoInfo?.todoGroupId))
      .forEach(g => getGroupItemsRaw(g).forEach(a => {
        const id = getArtId(a);
        if (id != null) s.add(id);
      }));

    return s;
  }, [agrupaciones, todoInfo?.todoGroupId]);

  const todoIdsFromTree = useMemo(() => {
    const s = new Set();
    for (const id of allIds) {
      if (!idsAsignados.has(id)) {
        s.add(id);
      }
    }
    return s;
  }, [allIds, idsAsignados]);

  const visibleIds = useMemo(() => {
    const sel = agrupacionSeleccionada;
    if (!sel) return null;

    if (isDiscontinuadosGroup(sel)) {
      return discIds;
    }

    const todoId = todoInfo?.todoGroupId;

    if (isRealTodoGroup(sel, todoId) || esTodoGroupByName(sel)) {
      // Si el backend confirma que no hay artículos sin agrupar → retornar vacío
      // sin pasar por todoIdsFromTree que puede estar desactualizado respecto a agrupaciones
      const countFromBackend = todoInfo?.idsSinAgrupCount ?? -1;
      if (countFromBackend === 0) return new Set();

      const base =
        (todoInfo?.todoIds && todoInfo.todoIds.size)
          ? todoInfo.todoIds
          : todoIdsFromTree;

      const out = new Set();
      for (const id of base) {
        const n = Number(id);
        if (!Number.isFinite(n) || n <= 0) continue;
        if (discIds.has(n)) continue;
        out.add(n);
      }
      return out;
    }

    const s = new Set();
    const items = getGroupItemsRaw(sel);
    for (const a of items) {
      const id = getArtId(a);
      if (id == null) continue;
      if (discIds.has(id)) continue;
      s.add(id);
    }
    return s;
  }, [agrupacionSeleccionada, todoInfo, todoIdsFromTree, discIds]);

  const focusArticle = useCallback(
    (rawId, preferGroupId = null) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) return;

      const alreadyVisible = !visibleIds || visibleIds.has(id);

      const groupsSet = agIndex.byArticleId.get(id) || new Set();
      const allGroups = agrupacionesRich || [];

      let targetGroupId = null;

      if (preferGroupId != null) {
        const prefNum = Number(preferGroupId);
        if (Number.isFinite(prefNum)) {
          const exists = allGroups.some(g => Number(g.id) === prefNum);
          if (exists) {
            targetGroupId = prefNum;
          }
        }
      }

      const normN = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const esGlobalGroup = (gid) => {
        const g = allGroups.find(x => Number(x.id) === Number(gid));
        const n = normN(g?.nombre);
        return n === 'sin agrupacion' || n === 'discontinuados' || n === 'descontinuados';
      };

      if (!targetGroupId) {
        if (groupsSet.size > 0) {
          // Preferir un grupo real (no Sin Agrupacion ni Discontinuados)
          for (const gid of groupsSet) {
            const n = Number(gid);
            if (Number.isFinite(n) && !esGlobalGroup(n)) {
              targetGroupId = n;
              break;
            }
          }
          // Si solo esta en grupos globales, usar el primero
          if (!targetGroupId) {
            const first = Number([...groupsSet][0]);
            if (Number.isFinite(first)) targetGroupId = first;
          }
        } else if (alreadyVisible) {
          targetGroupId = agrupacionSeleccionada?.id ?? null;
        } else if (Number.isFinite(Number(todoInfo?.todoGroupId))) {
          targetGroupId = Number(todoInfo.todoGroupId);
        }
      }

      if (
        targetGroupId &&
        (!agrupacionSeleccionada || Number(agrupacionSeleccionada.id) !== Number(targetGroupId))
      ) {
        const targetGroup =
          allGroups.find(g => Number(g.id) === Number(targetGroupId)) ||
          { id: targetGroupId, nombre: 'TODO', articulos: [] };

        try { markManualPick(); } catch { }

        setAgrupacionSeleccionada(targetGroup);
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');
      }

      setSelectedArticleId(id);
      setJumpToId(id);
      scheduleJump(id);

      setTimeout(() => {
        setJumpToId(null);
      }, 800);
    },
    [
      visibleIds,
      agIndex,
      todoInfo?.todoGroupId,
      agrupacionSeleccionada,
      agrupacionesRich,
      markManualPick,
      setAgrupacionSeleccionada,
      setCategoriaSeleccionada,
      setFiltroBusqueda,
      scheduleJump,
    ]
  );

  const handleDiscontinuadoChange = useCallback(
    async (rawId, isNowDiscontinuado, opts = {}) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) return;

      try {
        await refetchAgrupaciones();
      } catch (e) {
        console.error('Error refrescando agrupaciones:', e);
      }

      if (isNowDiscontinuado) {
        showMiss(`Artículo discontinuado correctamente`);
      } else {
        showMiss(`Artículo reactivado correctamente`);
      }
    },
    [refetchAgrupaciones, showMiss]
  );

  useEffect(() => {
    const onUndo = async (ui) => {
      const kind = ui.detail.kind;
      const scope = ui.detail.scope;
      const payload = ui.detail.payload || {};

      if (kind !== 'discontinue' || scope !== 'articulo') return;

      const ids = payload?.ids || [];
      const prev = payload?.undo?.payload?.prev || {};
      const wasInDiscontinuados = prev.wasInDiscontinuados === true;
      const discontinuadosGroupId = Number(prev.discontinuadosGroupId);
      const fromGroupId = Number(prev.fromGroupId);

      // ✅ Los grupos de Discontinuados y los originales viven en el principal
      // Usar el rootBusinessId para las llamadas HTTP del UNDO
      const rootBizId = rootBusiness?.id ? Number(rootBusiness.id) : null;

      console.log('🔄 [UNDO discontinue]', {
        ids,
        wasInDiscontinuados,
        discontinuadosGroupId,
        fromGroupId,
      });

      if (!ids.length) {
        showMiss('No hay artículos para deshacer');
        return;
      }

      try {
        if (wasInDiscontinuados) {
          if (!Number.isFinite(discontinuadosGroupId) || discontinuadosGroupId <= 0) {
            showMiss('No se encontró el grupo Discontinuados');
            return;
          }

          await httpBiz(`/agrupaciones/${discontinuadosGroupId}/articulos`, {
            method: 'PUT',
            body: { ids },
          }, rootBizId);

          mutateGroups({
            type: 'append',
            groupId: discontinuadosGroupId,
            articulos: ids.map(id => ({ id })),
            baseById: metaById,
          });

          const label = ids.length === 1 ? 'Artículo devuelto' : `${ids.length} artículos devueltos`;
          showMiss(`${label} a Discontinuados`);

        } else {
          if (!Number.isFinite(fromGroupId) || fromGroupId <= 0) {
            for (const id of ids) {
              try {
                await httpBiz(`/agrupaciones/${discontinuadosGroupId}/articulos/${id}`, {
                  method: 'DELETE',
                }, rootBizId);
              } catch (e) {
                console.error(`Error quitando ${id} de Discontinuados:`, e);
              }
            }

            mutateGroups({
              type: 'remove',
              groupId: discontinuadosGroupId,
              ids,
            });

            const label = ids.length === 1 ? 'Artículo reactivado' : `${ids.length} artículos reactivados`;
            showMiss(label);

          } else {
            await httpBiz(`/agrupaciones/${fromGroupId}/articulos`, {
              method: 'PUT',
              body: { ids },
            }, rootBizId);

            for (const id of ids) {
              try {
                await httpBiz(`/agrupaciones/${discontinuadosGroupId}/articulos/${id}`, {
                  method: 'DELETE',
                }, rootBizId);
              } catch { }
            }

            mutateGroups({
              type: 'move',
              fromId: discontinuadosGroupId,
              toId: fromGroupId,
              ids,
              baseById: metaById,
            });

            const label = ids.length === 1 ? 'Artículo devuelto' : `${ids.length} artículos devueltos`;
            showMiss(`${label} a su grupo original`);
          }
        }

        // ✅ Refetch diferido: dar tiempo a la escritura en backend antes de recargar
        // El estado ya se actualizó optimistamente con mutateGroups arriba
        setTimeout(() => { refetchAgrupaciones().catch(() => { }); }, 1200);

      } catch (error) {
        console.error('[UNDO discontinue] Error:', error);
        showMiss('Error al deshacer: ' + error.message);
      }
    };

    window.addEventListener('ui:undo', onUndo);
    return () => window.removeEventListener('ui:undo', onUndo);
  }, [
    activeBizId,
    showMiss,
    refetchAgrupaciones,
    mutateGroups,
    metaById,
    rootBusiness,
  ]);

  const handleDiscontinuarBloque = useCallback(
    async (idsRaw = []) => {
      const ids = (idsRaw || [])
        .map(Number)
        .filter(n => Number.isFinite(n) && n > 0);

      if (!ids.length) return;

      if (!discGroup || !discGroup.id) {
        showAlert('No existe la agrupación "Discontinuados". Creala primero.', 'warning');
        return;
      }

      const ok = await showConfirm(
        `¿Marcar como DISCONTINUADOS ${ids.length} artículo(s) de este bloque?`
      );
      if (!ok) return;

      try {
        // Si discGroup es global (vive en el principal), usar su businessId
        const discBizId = discGroup.principal_business_id
          ? Number(discGroup.principal_business_id)
          : null;

        await httpBiz(`/agrupaciones/${discGroup.id}/articulos`, {
          method: 'PUT',
          body: { ids },
        }, discBizId);

        mutateGroups({
          type: 'append',
          groupId: Number(discGroup.id),
          articulos: ids.map(id => ({ id })),
          baseById: metaById,
        });

        showMiss(`Bloque discontinuado (${ids.length} artículo/s).`);
      } catch (e) {
        console.error('DISCONTINUAR_BLOQUE_ERROR', e);
        showAlert('No se pudo discontinuar el bloque.', 'error');
      }
    },
    [
      discGroup,
      mutateGroups,
      metaById,
      showMiss,
    ]
  );

  useEffect(() => {
    const id = Number(pendingJumpRef.current);
    if (!Number.isFinite(id) || id <= 0) return;

    const tick = () => {
      if (tryJumpNow(id)) {
        pendingJumpRef.current = null;
        return;
      }
      jumpTriesRef.current = 1;
      if (jumpTriesRef.current > 25) {
        pendingJumpRef.current = null;
        return;
      }
      setTimeout(tick, 80);
    };

    const t0 = setTimeout(tick, 40);
    return () => clearTimeout(t0);
  }, [
    categorias,
    agrupacionSeleccionada,
    reloadKey,
    ventasMapFiltrado,
    tryJumpNow
  ]);

  const todoGroupId = todoInfo?.todoGroupId || null;

  const nameById = useMemo(() => {
    const m = new Map();
    (categorias || []).forEach(sub =>
      (sub.categorias || []).forEach(cat =>
        (cat.articulos || []).forEach(a => {
          const id = getArtId(a);
          if (id == null) return;
          m.set(id, String(a.nombre || '').trim());
        })
      )
    );
    return m;
  }, [categorias]);

  useEffect(() => {
    const catsReady = Array.isArray(categorias) && categorias.length > 0;
    if (!agrupacionSeleccionada && todoGroupId && catsReady) {
      setAgrupacionSeleccionada({ id: Number(todoGroupId), nombre: 'TODO', articulos: [] });
      setFiltroBusqueda('');
      setCategoriaSeleccionada(null);
    }
  }, [todoGroupId, agrupacionSeleccionada, categorias]);

  // IDs que pertenecen al negocio activo.
  // orgAssignedIds = artículos asignados en agrupaciones de TODA la org (incluye otros subnegocios).
  // idsEnAgrupacionesLocales = artículos en las agrupaciones del negocio activo.
  // Un artículo pertenece a este negocio si:
  //   - está en sus agrupaciones locales, O
  //   - NO está asignado a ningún subnegocio (está en sin agrupar del principal)
  const idsNegocioActivo = useMemo(() => {
    const normNombre = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const esGlobal = (g) => {
      const n = normNombre(g?.nombre);
      return n === 'sin agrupacion' || n === 'discontinuados' || n === 'descontinuados';
    };

    const rootBizId = rootBusiness?.id ? Number(rootBusiness.id) : null;
    const isFromGroup = rootBizId && Number(activeBizId) !== rootBizId;

    const s = new Set();

    if (isFromGroup) {
      // SUBNEGOCIO: solo articulos de sus agrupaciones propias (excluye globales inyectados)
      // Lee tanto articulos JSONB como app_articles_ids
      for (const g of agrupaciones || []) {
        if (esGlobal(g)) continue;
        for (const a of getGroupItemsRaw(g)) {
          const id = getArtId(a);
          if (id != null) s.add(id);
        }
        const appIds = Array.isArray(g.app_articles_ids) ? g.app_articles_ids : [];
        for (const raw of appIds) { const n = Number(raw); if (n > 0) s.add(n); }
      }
      // Tambien incluir los de Sin Agrupacion y Discontinuados globales
      for (const g of agrupaciones || []) {
        if (!esGlobal(g)) continue;
        for (const a of getGroupItemsRaw(g)) {
          const id = getArtId(a);
          if (id != null) s.add(id);
        }
        const appIds = Array.isArray(g.app_articles_ids) ? g.app_articles_ids : [];
        for (const raw of appIds) { const n = Number(raw); if (n > 0) s.add(n); }
      }
      if (todoInfo?.todoIds?.size) {
        for (const id of todoInfo.todoIds) { const n = Number(id); if (n > 0) s.add(n); }
      }
    } else {
      // PRINCIPAL: todos los articulos del arbol (nameById)
      // Filtrar los asignados a subnegocios si hay orgAssignedIds
      if (Array.isArray(orgAssignedIds) && orgAssignedIds.length > 0) {
        const asignadosSubnegocios = new Set(orgAssignedIds.map(Number).filter(n => n > 0));
        for (const [id] of nameById.entries()) {
          if (!asignadosSubnegocios.has(id)) s.add(id);
        }
      } else {
        // Sin org o sin datos: todos los articulos
        for (const [id] of nameById.entries()) s.add(id);
      }
    }

    return s;
  }, [agrupaciones, orgAssignedIds, todoInfo?.todoIds, nameById, activeBizId, rootBusiness]);

  // Opciones del buscador: todos los articulos de todas las agrupaciones del negocio activo
  const opcionesBuscador = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const g of agrupacionesRich || []) {
      for (const a of (g.articulos || [])) {
        const id = Number(a?.id);
        if (!id || id <= 0 || seen.has(id)) continue;
        seen.add(id);
        const nombre = a?.nombre && !String(a.nombre).startsWith('#')
          ? String(a.nombre)
          : (metaById.get(id)?.nombre || nameById.get(id) || `#${id}`);
        result.push({ id, nombre });
      }
    }
    return result;
  }, [agrupacionesRich, nameById, metaById]);

  const labelById = useMemo(() => {
    const m = new Map();
    (categorias || []).forEach(sub =>
      (sub.categorias || []).forEach(cat =>
        (cat.articulos || []).forEach(a => {
          const id = getArtId(a);
          if (id == null) return;
          m.set(id, String(a.nombre || '').trim());
        })
      )
    );
    return m;
  }, [categorias]);

  // Callbacks estables para SubBusinessCreateModal
  // Definidos con useCallback para evitar re-renders del modal que bloqueen los inputs
  const handleSubBizClose = useCallback(() => {
    setSubBizModalOpen(false);
    setGroupForSubBiz(null);
  }, []);

  const handleSubBizCreated = useCallback((newBiz) => {
    showMiss(`Sub-negocio "${newBiz.name}" creado`);
    setSubBizModalOpen(false);
    setGroupForSubBiz(prev => {
      if (prev?.id) {
        mutateGroups({ type: 'remove_group', groupId: Number(prev.id) });
      }
      return null;
    });
    refetchAgrupaciones();
  }, [showMiss, mutateGroups, refetchAgrupaciones]);

  const handleNeedOrgName = useCallback(() => {
    setOrgNameInput('');
    setOrgNameModalOpen(true);
  }, []);

  const handleGroupCreated = useCallback((nombre, id, articulos) => {
    mutateGroups({
      type: 'create',
      id: Number(id),
      nombre,
      articulos: Array.isArray(articulos) ? articulos : [],
    });
    setFiltroBusqueda('');
    setCategoriaSeleccionada(null);
  }, [mutateGroups]);

  // Ref para leer agrupacionSeleccionada sin que sea una dep del efecto
  const agrupSelRef = useRef(agrupacionSeleccionada);
  useEffect(() => { agrupSelRef.current = agrupacionSeleccionada; }, [agrupacionSeleccionada]);

  // Selección inteligente: Sin Agrupación tiene prioridad, luego favorita al cargar negocio
  useEffect(() => {
    const todoId = todoInfo?.todoGroupId;
    const todoCount = todoInfo?.idsSinAgrupCount || 0;
    const todoEmpty = todoCount === 0;

    const catsReady = Array.isArray(categorias) && categorias.length > 0;
    const groupsReady = Array.isArray(agrupacionesRich) && agrupacionesRich.length > 0;
    if (!catsReady || !groupsReady) return;

    const currentSel = agrupSelRef.current;

    if (currentSel && isDiscontinuadosGroup(currentSel)) return;
    if (currentSel && todoId && Number(currentSel.id) === Number(todoId)) return;

    // ── Sin Agrupación tiene artículos ──
    if (!todoEmpty && todoId) {
      // Guard solo acá: no interferir con picks manuales recientes
      const recentlyPicked = Date.now() - lastManualPickRef.current < 2500;
      if (recentlyPicked) return;

      const isTodoSelected = currentSel && Number(currentSel.id) === Number(todoId);
      if (!isTodoSelected) {
        setAgrupacionSeleccionada({ id: Number(todoId), nombre: 'TODO', articulos: [] });
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');
      }
      return;
    }

    // ── Sin Agrupación vacío → favorita o primera ──
    // Sin guard de tiempo: el vaciado es un evento concreto, navegar inmediatamente
    if (todoEmpty && favoriteGroupId) {
      const fav = (agrupacionesRich || []).find(
        (g) => Number(g?.id) === Number(favoriteGroupId)
      );

      if (fav) {
        const selExistsInList = currentSel &&
          (agrupacionesRich || []).some(g => Number(g.id) === Number(currentSel.id));

        if (!selExistsInList) {
          setAgrupacionSeleccionada(fav);
          setCategoriaSeleccionada(null);
          setFiltroBusqueda('');
        }
      } else {
        setFavoriteGroupId(null);
      }
    }
  }, [
    activeBizId,
    todoInfo?.todoGroupId,
    todoInfo?.idsSinAgrupCount,
    favoriteGroupId,
    agrupacionesRich,
    categorias,
    setAgrupacionSeleccionada,
    setCategoriaSeleccionada,
    setFiltroBusqueda,
  ]);
  
  const handleSetFavorite = useCallback((groupId) => {
    setFavoriteGroupId((prev) => {
      const prevNum = Number(prev);
      const nextNum = Number(groupId);

      const final = prevNum === nextNum ? null : nextNum;

      const bid =
        activeBizRef.current ||
        activeBizId ||
        localStorage.getItem('activeBusinessId') ||
        null;

      if (bid) {
        (async () => {
          try {
            await BusinessesAPI.saveFavoriteGroup(bid, final);
          } catch (e) {
            console.error('Error guardando favorita en backend', e);
          }
        })();
      }
      return final;
    });
  }, [activeBizId]);

  const handleDeleteGroup = useCallback(async (group) => {
    if (!group || !group.id) return;
    if (
      Number(group.id) === Number(todoInfo?.todoGroupId) ||
      isDiscontinuadosGroup(group)
    ) {
      return;
    }
    const ok = await showConfirm(`¿Eliminar la agrupación "${group.nombre}"? Esta acción no se puede deshacer.`, { danger: true });
    if (!ok) return;

    try {
      await eliminarAgrupacion(group);

      // ✅ NO emitir aquí, SidebarCategorias ya lo hace

      await refetchAgrupaciones();
      if (Number(agrupacionSeleccionada?.id) === Number(group.id)) {
        setAgrupacionSeleccionada(null);
      }
    } catch (e) {
      console.error('Error al eliminar agrupación', e);
    }
  }, [todoInfo?.todoGroupId, refetchAgrupaciones, agrupacionSeleccionada]);

  const handleRenameGroup = useCallback(async (group) => {
    if (!group) return null;

    const currentName = String(group.nombre || '');
    const isTodo = esTodoGroup(group);
    const isDisc = isDiscontinuadosGroup(group);

    if (isDisc) return null;

    const promptMsg = isTodo
      ? 'Nombre para la nueva agrupación (los artículos de "Sin Agrupación" se moverán aquí):'
      : 'Nuevo nombre para la agrupación:';

    const nuevo = await showPrompt(promptMsg, isTodo ? '' : currentName);
    if (nuevo == null) return null;
    const nombre = nuevo.trim();
    if (!nombre) return null;
    if (!isTodo && nombre === currentName) return null;

    try {
      if (isTodo) {
        const baseSet =
          todoInfo?.todoIds && todoInfo.todoIds.size
            ? todoInfo.todoIds
            : todoIdsFromTree;

        const ids = Array.from(baseSet)
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0);

        if (!ids.length) {
          showAlert('No hay artículos en "Sin agrupación" para capturar.', 'warning');
          return null;
        }

        const res = await httpBiz('/agrupaciones/create-or-move', {
          method: 'POST',
          body: {
            nombre,
            ids,
          },
        });

        const createdId = Number(
          res?.id || res?.groupId || res?.agrupacionId || res?.agrupacion?.id
        );

        const list = await refetchAgrupaciones();

        let nueva = null;
        if (Number.isFinite(createdId) && createdId > 0) {
          nueva = (list || []).find((g) => Number(g.id) === createdId) || null;
        }
        if (!nueva) {
          const wanted = nombre.toLowerCase();
          nueva =
            (list || []).find(
              (g) => String(g.nombre || '').toLowerCase() === wanted
            ) || null;
        }

        if (nueva) {
          try { markManualPick(); } catch { }
          setAgrupacionSeleccionada(nueva);
          setCategoriaSeleccionada(null);
          setFiltroBusqueda('');
        }

        // ✅ NO emitir aquí, SidebarCategorias ya lo hace
        showMiss(`Agrupación "${nombre}" creada a partir de "Sin agrupación".`);

        return null;

      } else {
        await actualizarAgrupacion(activeBizId, group.id, { nombre });
        await refetchAgrupaciones();
        showMiss('Nombre de agrupación actualizado.');

        // ✅ Devolver objeto para que SidebarCategorias emita
        return { newName: nombre };
      }
    } catch (e) {
      console.error('RENAME_GROUP_ERROR', e);
      showAlert('No se pudo renombrar la agrupación.', 'error');
      return null;
    }
  }, [
    activeBizId,
    todoInfo,
    todoIdsFromTree,
    refetchAgrupaciones,
    setAgrupacionSeleccionada,
    setCategoriaSeleccionada,
    setFiltroBusqueda,
    showMiss,
    markManualPick
  ]);

  const effectiveViewMode = useMemo(() => {
    const g = agrupacionSeleccionada;
    if (g?.id && viewModeByGroup && viewModeByGroup[g.id]) {
      return viewModeByGroup[g.id];
    }
    return viewModeGlobal;
  }, [agrupacionSeleccionada, viewModeByGroup, viewModeGlobal]);

  const sidebarListMode = effectiveViewMode;
  const tableHeaderMode =
    effectiveViewMode === 'by-subrubro' ? 'cat-first' : 'sr-first';

  const modalTreeMode = 'cat-first';

  const filtroEfectivo = useMemo(
    () => (filtroBusqueda || ''),
    [filtroBusqueda]
  );

  const ventasPorArticuloMerged = useMemo(() => {
    const base = ventasMap || new Map();
    if (!ventasOverrides || ventasOverrides.size === 0) return base;

    const merged = new Map(base);
    for (const [id, ov] of ventasOverrides.entries()) {
      const prev = merged.get(id) || merged.get(String(id)) || {};
      merged.set(id, { ...prev, ...ov });
    }
    return merged;
  }, [ventasMap, ventasOverrides]);

  const bizCtx = useBusiness();
  useEffect(() => {
    console.log('[ArticulosMain] ctx activeBusinessId:', bizCtx?.activeBusinessId);
    console.log('[ArticulosMain] state activeBizId:', activeBizId);
  }, [bizCtx?.activeBusinessId, activeBizId]);

  useEffect(() => {
    window.__CAT_SEL = categoriaSeleccionada;
    console.log('[ArticulosMain] categoriaSeleccionada:', categoriaSeleccionada?.subrubro, '| cats:', categoriaSeleccionada?.categorias?.length);
  }, [categoriaSeleccionada]);

  // Vista de organización: early return cuando el principal está vacío y hay subnegocios
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 8px 0 8px' }}>
        <h2 style={{ margin: 0 }}>Gestión de Artículos</h2>

        {ventasError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Error al cargar ventas: {ventasError}
          </Alert>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SalesPickerIcon
            value={rango}
            onChange={setRango}
            firstDate={firstDateVentas}
            loadingFirst={loadingFirstVentas}
          />
          <VentasActionsMenu
            rango={rango}
            onImport={() => setUploadModalOpen(true)}
            onExport={handleDownloadVentasCsv}
            disabled={!activeBizId || ventasLoading}
          />
          <div style={{ minWidth: 260, maxWidth: 360 }}>
            <Buscador
              placeholder="Buscar artículos..."
              opciones={opcionesBuscador}
              value={searchText}
              onChange={(v) => setSearchText(v || '')}
              clearOnPick={false}
              autoFocusAfterPick
              noResultsText="No se encontró ningún artículo"
              onPick={(opt) => {
                const id = Number(opt?.id);
                if (!Number.isFinite(id)) return;
                setFiltroBusqueda('');
                setSearchText('');
                focusArticle(id);
              }}
            />
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, alignItems: 'start',
        borderRadius: 12, overflow: 'hidden', height: '75vh',
        boxShadow: '0 1px 4px rgba(0,0,0,.08)'
      }}>
        <div
          ref={sidebarScrollRef}
          style={{
            borderRight: '1px solid #eee', background: '#fafafa',
            position: 'sticky', top: 0, alignSelf: 'start',
            height: 'calc(100vh - 0px)', overflowY: 'auto'
          }}>
          <SidebarCategorias
            categorias={categorias}
            categoriaSeleccionada={categoriaSeleccionada}
            setCategoriaSeleccionada={setCategoriaSeleccionada}
            agrupaciones={agrupacionesOrdenadas}
            agrupacionSeleccionada={agrupacionSeleccionada}
            setAgrupacionSeleccionada={setAgrupacionSeleccionada}
            setFiltroBusqueda={setFiltroBusqueda}
            setBusqueda={setFiltroBusqueda}
            todoGroupId={todoInfo.todoGroupId}
            todoCountOverride={
              todoInfo.todoGroupId ? { [todoInfo.todoGroupId]: todoInfo.idsSinAgrupCount } : {}
            }
            listMode={sidebarListMode}
            visibleIds={visibleIds}
            onManualPick={markManualPick}
            onChangeListMode={handleChangeListMode}
            favoriteGroupId={favoriteGroupId}
            onSetFavorite={handleSetFavorite}
            onEditGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
            onRenameGroup={handleRenameGroup}
            ventasMap={ventasMap}
            metaById={metaById}
            getAmountForId={getAmountForId}
            onMutateGroups={mutateGroups}
            onRefetch={refetchAgrupaciones}
            notify={showMiss}
            onCreateSubBusiness={(agrupacion) => {
              setGroupForSubBiz(agrupacion);
              setSubBizModalOpen(true);
            }}
            activeDivisionId={activeDivisionId}
            firstDate={firstDateVentas}
            loadingFirst={loadingFirstVentas}
            activeDivisionAgrupacionIds={activeDivisionAgrupacionIds}
            assignedAgrupacionIds={assignedAgrupacionIds}
            refetchAssignedAgrupaciones={refetchAssignedAgrupaciones}
          />
        </div>

        <div
          id="tabla-scroll"
          style={{ background: '#fff', overflow: 'visible', maxHeight: 'calc(100vh - 0px)' }}>
          <TablaArticulos
            filtroBusqueda={''}
            agrupaciones={agrupacionesOrdenadas}
            orgAssignedIds={orgAssignedIds}
            agrupacionSeleccionada={agrupacionSeleccionada}
            setAgrupacionSeleccionada={setAgrupacionSeleccionada}
            categoriaSeleccionada={categoriaSeleccionada}
            setCategoriaSeleccionada={setCategoriaSeleccionada}
            refetchAgrupaciones={refetchAgrupaciones}
            fechaDesdeProp={periodo.from}
            fechaHastaProp={periodo.to}
            ventasPorArticulo={ventasPorArticuloMerged}
            ventasLoading={ventasLoading}
            onCategoriasLoaded={handleCategoriasLoaded}
            onIdsVisibleChange={setActiveIds}
            activeBizId={activeBizId}
            rootBizId={rootBusiness?.id ? Number(rootBusiness.id) : null}
            reloadKey={reloadKey}
            syncVersion={syncVersion}
            onTodoInfo={handleTodoInfo}
            onTotalResolved={handleTotalResolved}
            onGroupCreated={handleGroupCreated}
            onMutateGroups={mutateGroups}
            visibleIds={visibleIds}
            favoriteGroupId={favoriteGroupId}
            onSetFavorite={handleSetFavorite}
            jumpToArticleId={jumpToId}
            selectedArticleId={selectedArticleId}
            onActualizar={() => setReloadKey(k => k + 1)}
            tableHeaderMode={tableHeaderMode}
            onDiscontinuadoChange={handleDiscontinuadoChange}
            modalTreeMode={modalTreeMode}
            onDiscontinuarBloque={handleDiscontinuarBloque}
            getAmountForId={getAmountForId}
            discIds={effectiveDiscIds}
          />
        </div>
      </div>
      <Snackbar
        open={missOpen}
        autoHideDuration={3500}
        onClose={() => setMissOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setMissOpen(false)} severity="info" sx={{ width: '100%' }}>
          {missMsg}
        </Alert>
      </Snackbar>
      <UploadCSVModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        businessId={activeBizId}
        onSuccess={() => {
          clearVentasCache();
          setSyncVersion(v => v + 1);
          showMiss('✅ Ventas importadas correctamente');
        }}
        instructionImage1={instructionImage1}
        instructionImage2={instructionImage2}
      />

      {/* Modal de creación de sub-negocio — aquí para evitar re-renders de SidebarCategorias */}
      <SubBusinessCreateModal
        open={subBizModalOpen}
        agrupacion={groupForSubBiz}
        onClose={handleSubBizClose}
        onCreated={handleSubBizCreated}
        onNeedOrgName={handleNeedOrgName}
      />

      {/* Modal para nombrar la organización — portal para escapar cualquier overflow/stacking */}
      {orgNameModalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,12,16,.72)',
          backdropFilter: 'blur(6px)',
          display: 'grid', placeItems: 'center',
          zIndex: 100001,
        }}>
          <div style={{
            width: 'min(460px, 94vw)',
            background: '#fff',
            borderRadius: 18,
            padding: '32px 28px 24px',
            boxShadow: '0 8px 40px rgba(0,0,0,.22)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🏢</div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                ¿Cómo se llama tu organización?
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '.88rem', color: '#666', lineHeight: 1.5 }}>
                Tu organización agrupa a todos tus negocios. Podés cambiar este nombre cuando quieras desde Perfil.
              </p>
            </div>
            <input
              type="text"
              value={orgNameInput}
              onChange={e => setOrgNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && orgNameInput.trim() && !orgNameSaving) {
                  (async () => {
                    setOrgNameSaving(true);
                    try { await updateOrg(orgNameInput.trim()); } catch { }
                    setOrgNameSaving(false);
                    setOrgNameModalOpen(false);
                  })();
                }
              }}
              placeholder={`Ej: ${organization?.name || 'Mi Grupo'}`}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '11px 14px', fontSize: '.95rem', fontWeight: 600,
                border: '2px solid #e0e0e5', borderRadius: 10, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setOrgNameModalOpen(false)}
                disabled={orgNameSaving}
                style={{ border: 'none', background: 'none', color: '#999', fontSize: '.85rem', cursor: 'pointer', padding: '8px 12px' }}>
                Omitir por ahora
              </button>
              <button
                disabled={orgNameSaving || !orgNameInput.trim()}
                onClick={async () => {
                  setOrgNameSaving(true);
                  try { await updateOrg(orgNameInput.trim()); } catch { }
                  setOrgNameSaving(false);
                  setOrgNameModalOpen(false);
                }}
                style={{
                  border: 'none', borderRadius: 10, padding: '11px 24px',
                  fontSize: '.88rem', fontWeight: 800, cursor: 'pointer',
                  background: '#1a1a2e', color: '#fff',
                  opacity: (orgNameSaving || !orgNameInput.trim()) ? .5 : 1,
                }}>
                {orgNameSaving ? 'Guardando…' : 'Guardar nombre'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}