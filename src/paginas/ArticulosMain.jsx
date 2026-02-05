/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { clearVentasCache } from '../servicios/apiVentas';
import { downloadVentasCSV } from '../servicios/apiVentas';
import { useSalesData, getVentasFromMap } from '../hooks/useSalesData';
import UploadCSVModal from '../componentes/UploadCSVModal';
import Buscador from '../componentes/Buscador';
import instructionImage1 from '../assets/brand/maxirest-menu.jpeg';
import instructionImage2 from '../assets/brand/maxirest-config.jpeg';
import '../css/global.css';
import '../css/theme-layout.css';

const FAV_KEY = 'favGroupId';
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

export default function ArticulosMain(props) {
  const {
    syncVersion: syncVersionProp = 0,
    activeBizId: activeBizIdProp = '',
  } = props;

  const [syncVersion, setSyncVersion] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [discoOrigenById, setDiscoOrigenById] = useState({});
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [activeIds, setActiveIds] = useState(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteByDivision, setFavoriteByDivision] = useState({}); // { [divisionKey]: groupId|null }
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [ventasOverrides, setVentasOverrides] = useState(() => new Map());

  const bizCtx = useBusiness();

  const {
    activeBusinessId,
    activeId,
    activeDivisionId,
    isMainDivision,
    activeDivisionName,
    activeDivisionAgrupacionIds,
    assignedAgrupacionIds,
    refetchAssignedAgrupaciones,
    refetchAssignedGroups,
  } = bizCtx;

  const activeBizId = Number(activeBusinessId || activeId) || null;

  useEffect(() => {
    console.log('[ArticulosMain] ctx activeBusinessId:', activeBusinessId);
    console.log('[ArticulosMain] computed activeBizId:', activeBizId);
  }, [activeBusinessId, activeBizId]);

  const [searchText, setSearchText] = useState('');



  const divisionKey = activeDivisionId == null ? 0 : Number(activeDivisionId);
  const favoriteGroupId = favoriteByDivision[divisionKey] ?? null;

  // 🔹 Inicializar rango con valores reales desde el inicio
  const [rango, setRango] = useState(() => {
    const def = lastNDaysUntilYesterday(daysByMode('7'));
    return { mode: '7', from: def.from, to: def.to };
  });

  const periodo = useMemo(() => {
    // Siempre debe haber from/to porque lo inicializamos arriba
    if (rango.from && rango.to) {
      return { from: rango.from, to: rango.to };
    }
    // Fallback por si acaso
    return lastNDaysUntilYesterday(daysByMode(rango.mode || '7'));
  }, [rango]);

  const periodoRef = useRef(periodo);
  useEffect(() => {
    periodoRef.current = periodo;
  }, [periodo]);

  // ✅ AHORA SÍ: useSalesData (después de declarar periodo)
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

    const divisionId = activeDivisionId ?? null;
    const dk = divisionId == null ? 0 : Number(divisionId);

    (async () => {
      try {
        const res = await BusinessesAPI.getFavoriteGroup(activeBizId, {
          scope: 'articulo',
          divisionId,
        });

        const favId = Number(res?.favoriteGroupId);
        setFavoriteByDivision((prev) => ({
          ...prev,
          [dk]: Number.isFinite(favId) && favId > 0 ? favId : null,
        }));
      } catch (e) {
        console.error('[ArticulosMain] getFavoriteGroup failed', e);
        setFavoriteByDivision((prev) => ({ ...prev, [dk]: null }));
      }
    })();
  }, [activeBizId, activeDivisionId]);


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
          divisionId: Number(activeDivisionId) > 0 ? Number(activeDivisionId) : null,
        }).catch((e) => {
          console.error('saveViewPref error', e);
        });
      }
    },
    [agrupacionSeleccionada, activeBizId]
  );

  const getGroupItemsRaw = (g) => {
    if (!g) return [];
    if (Array.isArray(g.articulos)) return g.articulos;
    if (Array.isArray(g.items)) return g.items;
    if (Array.isArray(g.data)) return g.data;
    return [];
  };

  const agIndex = useMemo(() => buildAgrupacionesIndex(agrupaciones || []), [agrupaciones]);

  const [missMsg, setMissMsg] = useState('');
  const [missOpen, setMissOpen] = useState(false);
  const showMiss = useCallback((msg) => { setMissMsg(msg); setMissOpen(true); }, []);

  const lastManualPickRef = useRef(0);
  const markManualPick = useCallback(() => { lastManualPickRef.current = Date.now(); }, []);

  const refetchAgrupaciones = React.useCallback(async () => {
    if (!activeBizId) {
      console.log('[ArticulosMain] ⚠️ No hay businessId activo');
      setAgrupaciones([]);
      return [];
    }

    try {
      console.log('[ArticulosMain] 🔄 Recargando agrupaciones:', {
        businessId: activeBizId,
        divisionName: activeDivisionName || 'Principal',
      });

      // ✅ Siempre trae TODAS las agrupaciones (el filtrado es en frontend)
      const list = await obtenerAgrupaciones(activeBizId);
      console.log('AGRUPACIONES FROM API', list?.[0]);
      console.log('[ArticulosMain] ✅ Agrupaciones cargadas:', list.length);

      if (Array.isArray(list)) setAgrupaciones(list);
      return list || [];
    } catch (e) {
      console.error('[ArticulosMain] ❌ Error cargando agrupaciones:', e);
      setAgrupaciones([]);
      return [];
    }
  }, [activeBizId, activeDivisionName]);

  // ✅ RESETEAR SELECCIÓN al cambiar división
  useEffect(() => {
    console.log('[ArticulosMain] 🔄 División cambió:', {
      divisionId: activeDivisionId,
      divisionName: activeDivisionName,
      gruposDisponibles: agrupacionesScoped.length,
    });

    // Limpiar selección actual
    setAgrupacionSeleccionada(null);
    setCategoriaSeleccionada(null);
    setFiltroBusqueda('');

    // El autopilot se encargará de seleccionar algo apropiado
  }, [activeDivisionId, activeDivisionName]);

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

    const idsSinAgrupCount = Number.isFinite(Number(safe.idsSinAgrupCount))
      ? Number(safe.idsSinAgrupCount)
      : 0;

    setTodoInfo({
      todoGroupId,
      idsSinAgrupCount,
      todoIds: new Set(), // ✅ ya no lo usamos
    });
  }, []);

  useEffect(() => {
    window.__DEBUG_VENTAS_MAP = ventasMap;

    if (ventasMap && ventasMap.size > 0) {
      console.log('📦 [ArticulosMain] ventasMap:', {
        size: ventasMap.size,
        sample: Array.from(ventasMap.entries()).slice(0, 3)
      });
    }
  }, [ventasMap]);

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

    try { await refetchAgrupaciones(); } catch { }
    try { emitGroupsChanged(action.type, { action }); } catch { }
  }, [refetchAgrupaciones]);

  useEffect(() => {
    if (!activeBizId) return;
    refetchAgrupaciones();
  }, [activeBizId, reloadKey, refetchAgrupaciones]);

  useEffect(() => {
    const bid = activeBizId || localStorage.getItem('activeBusinessId') || null;
    if (!bid) return;

    const div = Number(activeDivisionId) > 0 ? Number(activeDivisionId) : null;
    const key = div ?? 0;

    (async () => {
      try {
        const res = await BusinessesAPI.getFavoriteGroup(bid, {
          scope: 'articulo',
          divisionId: div,
        });

        const favId = Number(res?.favoriteGroupId);
        const nextFav = Number.isFinite(favId) && favId > 0 ? favId : null;

        setFavoriteByDivision((prev) => ({ ...prev, [key]: nextFav }));
      } catch (e) {
        console.error('Error cargando favorita desde backend', e);
        setFavoriteByDivision((prev) => ({ ...prev, [key]: null }));
      }
    })();
  }, [activeBizId, activeDivisionId]);

  const handleDownloadVentasCsv = async () => {
    try {
      const bid =
        activeBizId ||
        localStorage.getItem('activeBusinessId') ||
        0;

      const { from, to } = periodo || {};

      if (!bid || !from || !to) {
        console.warn('[handleDownloadVentasCsv] faltan datos', { bid, from, to });
        alert('Falta negocio activo o rango de fechas para descargar el CSV.');
        return;
      }

      console.log('[handleDownloadVentasCsv] solicitando CSV...', { bid, from, to });

      const blob = await downloadVentasCSV(bid, { from, to });
      console.log('[handleDownloadVentasCsv] blob size', blob.size);

      if (!blob || blob.size === 0) {
        alert('El CSV vino vacío.');
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
      alert(`Error al descargar CSV de ventas: ${err.message || err}`);
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

  useEffect(() => {
    setFiltroBusqueda('');
    setCategoriaSeleccionada(null);
    setActiveIds(new Set());
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

  // ✅ FILTRADO ESTRICTO: TODO y Discontinuados solo en Principal
  const agrupacionesScoped = useMemo(() => {
    console.log('[ArticulosMain] 🔍 Filtrado de división:', {
      isMainDivision,
      activeDivisionName,
      totalGroups: (agrupacionesRich || []).length,
      activeDivisionAgrupacionIds: Array.from(activeDivisionAgrupacionIds || []),
      assignedAgrupacionIds: Array.from(assignedAgrupacionIds || []),
    });

    const list = Array.isArray(agrupacionesRich) ? agrupacionesRich : [];

    // ✅ PRINCIPAL: TODO + Discontinuados + grupos NO asignados a ninguna división
    if (isMainDivision) {
      const assignedSet = new Set((assignedAgrupacionIds || []).map(Number));

      const filtered = list.filter((g) => {
        const gid = Number(g?.id);
        if (!Number.isFinite(gid) || gid <= 0) return false;

        // ✅ Siempre incluir TODO y Discontinuados en Principal
        if (esTodoGroup(g) || isDiscontinuadosGroup(g)) return true;

        // ✅ Solo los que NO están asignados a ninguna división
        return !assignedSet.has(gid);
      });

      console.log('[ArticulosMain] ✅ Principal:', {
        totalFiltered: filtered.length,
        grupos: filtered.map((g) => ({ id: g.id, nombre: g.nombre })),
      });

      return filtered;
    }

    // ✅ DIVISIÓN ESPECÍFICA: SOLO los asignados a esa división (sin TODO/Discontinuados)
    const activeSet = new Set((activeDivisionAgrupacionIds || []).map(Number));

    const filtered = list.filter((g) => {
      const gid = Number(g?.id);
      if (!Number.isFinite(gid) || gid <= 0) return false;

      // ❌ Nunca incluir TODO ni Discontinuados en secundarias
      if (esTodoGroup(g) || isDiscontinuadosGroup(g)) return false;

      // ✅ Solo los asignados a esta división
      return activeSet.has(gid);
    });

    console.log('[ArticulosMain] ✅ División específica:', {
      divisionName: activeDivisionName,
      totalFiltered: filtered.length,
      grupos: filtered.map((g) => ({ id: g.id, nombre: g.nombre })),
    });

    return filtered;
  }, [
    agrupacionesRich,
    isMainDivision,
    activeDivisionAgrupacionIds,
    assignedAgrupacionIds,
    activeDivisionName,
  ]);

  const discGroup = useMemo(
    () => (agrupacionesScoped || []).find(isDiscontinuadosGroup) || null,
    [agrupacionesScoped]
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

  // =========================
  // NUEVO: obtener monto fiable por artículo
  // =========================
  const getAmountForId = useCallback((id) => {
    const k = Number(id);
    if (!Number.isFinite(k) || k <= 0) return 0;

    // use helper available in hooks
    try {
      const { qty, amount } = getVentasFromMap(ventasMap, k);
      // si la fuente trae monto, lo usamos
      if (Number.isFinite(Number(amount)) && Number(amount) !== 0) {
        return Number(amount);
      }
      // fallback: si no hay monto, usamos qty * precio desde metaById
      const precio = metaById.get(k)?.precio ?? 0;
      return Number(qty || 0) * Number(precio || 0);
    } catch (e) {
      // en error, devolvemos 0 por seguridad
      return 0;
    }
  }, [ventasMap, metaById]);

  // ✅ HELPER ACTUALIZADO: usa getVentasFromMap
  const getQtyForId = useCallback(
    (id) => {
      const k = Number(id);
      if (!Number.isFinite(k) || k <= 0) return 0;
      const { qty } = getVentasFromMap(ventasMap, k);
      return Number(qty || 0);
    },
    [ventasMap]
  );

  // Mantengo getGroupQty por compatibilidad (cantidad)
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

  // =========================
  // NUEVO: sumar monto ($) por agrupación
  // =========================
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
    const list = Array.isArray(agrupacionesScoped) ? [...agrupacionesScoped] : [];

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

      // Ordenar por monto descendente
      const ma = getGroupAmount(a);
      const mb = getGroupAmount(b);
      if (mb !== ma) return mb - ma;

      // Fallback alfabético
      return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    });
  }, [agrupacionesScoped, todoInfo?.todoGroupId, getGroupAmount]);

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

    // Si vino todo 0, no ensuciamos el override
    if (qtyOk === 0 && amountOk === 0) return;

    setVentasOverrides(prev => {
      const next = new Map(prev);
      const prevVal = next.get(key) || {};

      // Evita rerenders inútiles si no cambió
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

    (agrupacionesRich || [])
      .filter(g => g && !esTodoGroup(g) && !isDiscontinuadosGroup(g))
      .forEach(g => {
        getGroupItemsRaw(g).forEach(a => {
          const id = getArtId(a);
          if (id != null) s.add(id);
        });
      });

    return s;
  }, [agrupacionesRich]);

  const todoIdsFromTree = useMemo(() => {
    const s = new Set();
    for (const id of allIds) {
      if (!idsAsignados.has(id)) {
        s.add(id);
      }
    }
    return s;
  }, [allIds, idsAsignados]);

  const todoCountGlobal = useMemo(() => {
    // ya excluye asignados globales; ahora excluimos discontinuados por coherencia visual
    let c = 0;
    for (const id of todoIdsFromTree) {
      const n = Number(id);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (discIds.has(n)) continue;
      c++;
    }
    return c;
  }, [todoIdsFromTree, discIds]);

  const visibleIds = useMemo(() => {
    const sel = agrupacionSeleccionada;
    if (!sel) return null;

    if (isDiscontinuadosGroup(sel)) {
      return discIds;
    }

    const todoId = todoInfo?.todoGroupId;

    if (isRealTodoGroup(sel, todoId)) {
      // ✅ SIEMPRE usar el cálculo global (no el que viene de TablaArticulos)
      const base = todoIdsFromTree;

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
      const allGroups = agrupacionesScoped || [];

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

      if (!targetGroupId) {
        if (alreadyVisible) {
          targetGroupId = agrupacionSeleccionada?.id ?? null;
        } else if (groupsSet.size > 0) {
          for (const gid of groupsSet) {
            const n = Number(gid);
            if (Number.isFinite(n)) {
              targetGroupId = n;
              break;
            }
          }
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

      // 🆕 LIMPIAR después de 2 segundos para evitar re-scrolls
      setTimeout(() => {
        setJumpToId(null);
      }, 800);
    },
    [
      visibleIds,
      agIndex,
      todoInfo?.todoGroupId,
      agrupacionSeleccionada,
      agrupacionesScoped,
      markManualPick,
      setAgrupacionSeleccionada,
      setCategoriaSeleccionada,
      setFiltroBusqueda,
      scheduleJump,
    ]
  );

  const handleDiscontinuadoChange = useCallback(
    async (rawId, isNowDiscontinuado) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) return;

      const allGroups = agrupacionesScoped || [];

      const findOriginGroup = () => {
        return (
          allGroups.find((g) => {
            if (!g || !g.id) return false;
            if (esTodoGroup(g)) return false;
            if (isDiscontinuadosGroup(g)) return false;
            return (g.articulos || []).some((a) => getArtId(a) === id);
          }) || null
        );
      };

      // ===========================
      // ✅ DISCONTINUAR
      // ===========================
      if (isNowDiscontinuado) {
        // ✅ IMPORTANTÍSIMO: primero bloquear autopiloto
        try { markManualPick(); } catch { }

        setDiscoOrigenById((prev) => {
          if (prev[id]) return prev;

          const origen = findOriginGroup();
          if (!origen) return prev;

          return { ...prev, [id]: Number(origen.id) };
        });

        if (discGroup) {
          setAgrupacionSeleccionada(discGroup);
          setCategoriaSeleccionada(null);
          setFiltroBusqueda('');
          focusArticle(id, discGroup.id);
        } else {
          focusArticle(id);
        }

        return;
      }

      // ===========================
      // ✅ REACTIVAR
      // ===========================
      // (Opcional pero recomendado: también bloquear autopiloto al volver)
      try { markManualPick(); } catch { }

      let originId = null;

      setDiscoOrigenById((prev) => {
        originId = prev[id] ?? null;
        if (!originId) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });

      if (!originId) {
        const origen = findOriginGroup();
        if (origen) originId = Number(origen.id);
      }

      if (originId) {
        try {
          await httpBiz(`/agrupaciones/${originId}/articulos`, {
            method: 'PUT',
            body: { ids: [id] },
          });

          mutateGroups({
            type: 'append',
            groupId: originId,
            articulos: [{ id }],
            baseById: metaById,
          });
        } catch (e) {
          console.error('REACTIVAR_APPEND_ORIGEN_ERROR', e);
        }

        const originGroup =
          allGroups.find((g) => Number(g.id) === Number(originId)) || {
            id: originId,
            nombre: 'Agrupación',
            articulos: [],
          };

        setAgrupacionSeleccionada(originGroup);
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');

        focusArticle(id, originId);

        showMiss(`Artículo reactivado. Ahora lo ves en "${originGroup.nombre}".`);
      } else {
        focusArticle(id);
        showMiss('Artículo reactivado. Ya no está en "Discontinuados".');
      }
    },
    [
      agrupacionesScoped,
      discGroup,
      mutateGroups,
      metaById,
      focusArticle,
      showMiss,
      markManualPick,
      setAgrupacionSeleccionada,
      setCategoriaSeleccionada,
      setFiltroBusqueda,
    ]
  );

  const handleDiscontinuarBloque = useCallback(
    async (idsRaw = []) => {
      const ids = (idsRaw || [])
        .map(Number)
        .filter(n => Number.isFinite(n) && n > 0);

      if (!ids.length) return;

      if (!discGroup || !discGroup.id) {
        window.alert('No existe la agrupación "Discontinuados". Creala primero.');
        return;
      }

      const ok = window.confirm(
        `¿Marcar como DISCONTINUADOS ${ids.length} artículo(s) de este bloque?`
      );
      if (!ok) return;

      try {
        await httpBiz(`/agrupaciones/${discGroup.id}/articulos`, {
          method: 'PUT',
          body: { ids },
        });

        mutateGroups({
          type: 'append',
          groupId: Number(discGroup.id),
          articulos: ids.map(id => ({ id })),
          baseById: metaById,
        });

        try { markManualPick(); } catch { }
        setAgrupacionSeleccionada(discGroup);
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');

        if (ids.length > 0) {
          focusArticle(ids[0], discGroup.id);
        }

        showMiss(`Bloque discontinuado (${ids.length} artículo/s).`);
      } catch (e) {
        console.error('DISCONTINUAR_BLOQUE_ERROR', e);
        window.alert('No se pudo discontinuar el bloque.');
      }
    },
    [
      discGroup,
      mutateGroups,
      metaById,
      markManualPick,
      focusArticle,
      setAgrupacionSeleccionada,
      setCategoriaSeleccionada,
      setFiltroBusqueda,
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
    if (!catsReady) return;

    // ✅ En divisiones secundarias NO existe el concepto de TODO
    if (!isMainDivision) return;

    if (!agrupacionSeleccionada && todoGroupId) {
      setAgrupacionSeleccionada({ id: Number(todoGroupId), nombre: 'TODO', articulos: [] });
      setFiltroBusqueda('');
      setCategoriaSeleccionada(null);
    }
  }, [todoGroupId, agrupacionSeleccionada, categorias, isMainDivision]);

  const opcionesBuscador = useMemo(() => {
    return Array.from(nameById.entries()).map(([id, nombre]) => ({
      id,
      nombre,
      _search: normalize(nombre), // 👈 CLAVE
    }));
  }, [nameById]);

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

  useEffect(() => {
    const todoId = todoInfo?.todoGroupId;
    const todoEmpty = (todoInfo?.idsSinAgrupCount || 0) === 0;

    const recentlyPicked = Date.now() - lastManualPickRef.current < 2500;
    if (recentlyPicked) return;

    const catsReady = Array.isArray(categorias) && categorias.length > 0;
    const groupsOk = Array.isArray(agrupacionesScoped);
    if (!catsReady || !groupsOk) return;

    // ✅ no tocar si el usuario está en discontinuados
    if (agrupacionSeleccionada && isDiscontinuadosGroup(agrupacionSeleccionada)) return;

    // ✅ si la selección actual no está en scope => limpiar y salir (no reasignar en este mismo tick)
    const selectedId = agrupacionSeleccionada ? Number(agrupacionSeleccionada.id) : null;
    const inScope =
      selectedId != null &&
      agrupacionesScoped.some(g => Number(g.id) === selectedId);

    if (agrupacionSeleccionada && !inScope) {
      console.log('[ArticulosMain] ⚠️ Agrupación fuera de scope, limpiando selección');
      setAgrupacionSeleccionada(null);
      setCategoriaSeleccionada(null);
      setFiltroBusqueda('');
      return; // ✅ CLAVE anti-loop
    }

    // si ya hay una selección válida en scope, no “autopilotear”
    // (solo autopilot si no hay selección)
    if (agrupacionSeleccionada) return;

    // ==========================
    // Elegir "target" una sola vez
    // ==========================
    let target = null;

    const favInScope = (agrupacionesScoped || []).find(
      g => Number(g?.id) === Number(favoriteGroupId)
    );

    if (isMainDivision) {
      // ✅ PRINCIPAL: favorita > (si no hay fav) TODO > primera con items
      if (favInScope) {
        target = favInScope;
      } else if (!todoEmpty && Number.isFinite(Number(todoId)) && todoId) {
        target = { id: Number(todoId), nombre: 'TODO', articulos: [] };
      } else {
        target =
          agrupacionesScoped.find(g => {
            const gid = Number(g.id);
            if (gid === Number(todoId)) return false;
            if (isDiscontinuadosGroup(g)) return false;
            const items = g.articulos || g.items || [];
            return items.length > 0;
          }) || null;
      }
    } else {
      // ✅ DIVISIÓN: favorita (si está asignada a esa división) > primera con items
      if (favInScope) {
        target = favInScope;
      } else {
        target =
          agrupacionesScoped.find(g => {
            if (isDiscontinuadosGroup(g)) return false;
            const items = g.articulos || g.items || [];
            return items.length > 0;
          }) || null;
      }
    }

    if (!target) return;

    console.log('[ArticulosMain] 🧭 Autoselección:', {
      division: isMainDivision ? 'Principal' : 'División',
      target: target?.nombre || target?.name || target?.id,
    });

    setAgrupacionSeleccionada(target);
    setCategoriaSeleccionada(null);
    setFiltroBusqueda('');
  }, [
    todoInfo?.todoGroupId,
    todoInfo?.idsSinAgrupCount,
    favoriteGroupId,
    agrupacionesScoped,
    categorias,
    agrupacionSeleccionada,
    isMainDivision,
  ]);

  const handleSetFavorite = useCallback((groupId) => {
    const bid = activeBizId;
    if (!bid) return;

    const divisionId = activeDivisionId ?? null;
    const dk = divisionId == null ? 0 : Number(divisionId);

    setFavoriteByDivision((prev) => {
      const prevFav = Number(prev[dk] ?? null);
      const nextFav = prevFav === Number(groupId) ? null : Number(groupId);

      BusinessesAPI.saveFavoriteGroup(bid, nextFav, {
        scope: 'articulo',
        divisionId,
      }).catch((e) => console.error('saveFavoriteGroup failed', e));

      return { ...prev, [dk]: nextFav };
    });
  }, [activeBizId, activeDivisionId]);

  const handleDeleteGroup = useCallback(async (group) => {
    if (!group || !group.id) return;
    if (
      Number(group.id) === Number(todoInfo?.todoGroupId) ||
      isDiscontinuadosGroup(group)
    ) {
      return;
    }
    const ok = window.confirm(`Eliminar la agrupación "${group.nombre}"?`);
    if (!ok) return;

    try {
      await eliminarAgrupacion(group);
      await refetchAgrupaciones();
      if (Number(agrupacionSeleccionada?.id) === Number(group.id)) {
        setAgrupacionSeleccionada(null);
      }
    } catch (e) {
      console.error('Error al eliminar agrupación', e);
    }
  }, [todoInfo?.todoGroupId, refetchAgrupaciones, agrupacionSeleccionada]);

  const handleRenameGroup = useCallback(async (group) => {
    if (!group) return;

    const currentName = String(group.nombre || '');
    const isTodo = esTodoGroup(group);
    const isDisc = isDiscontinuadosGroup(group);

    if (isDisc) return;

    // ✅ UN SOLO PROMPT para ambos casos
    const promptMsg = isTodo
      ? 'Nombre para la nueva agrupación (los artículos de "Sin Agrupación" se moverán aquí):'
      : 'Nuevo nombre para la agrupación:';

    const nuevo = window.prompt(promptMsg, isTodo ? '' : currentName);
    if (nuevo == null) return;
    const nombre = nuevo.trim();
    if (!nombre) return;
    if (!isTodo && nombre === currentName) return;

    try {
      if (isTodo) {
        // Crear nueva agrupación con artículos de "Sin agrupación"
        const baseSet =
          todoInfo?.todoIds && todoInfo.todoIds.size
            ? todoInfo.todoIds
            : todoIdsFromTree;

        const ids = Array.from(baseSet)
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0);

        if (!ids.length) {
          window.alert('No hay artículos en "Sin agrupación" para capturar.');
          return;
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
          nueva = (list || []).find((g) => String(g.nombre || '').toLowerCase() === wanted) || null;
        }

        if (nueva) {
          try { markManualPick(); } catch { }
          setAgrupacionSeleccionada(nueva);
          setCategoriaSeleccionada(null);
          setFiltroBusqueda('');
        }

        showMiss(`Agrupación "${nombre}" creada a partir de "Sin agrupación".`);
      } else {
        // Renombrar agrupación existente
        await actualizarAgrupacion(activeBizId, group.id, { nombre });
        await refetchAgrupaciones();
        showMiss('Nombre de agrupación actualizado.');
      }
    } catch (e) {
      console.error('RENAME_GROUP_ERROR', e);
      window.alert('No se pudo renombrar la agrupación.');
    }
  }, [activeBizId, todoInfo, todoIdsFromTree, refetchAgrupaciones, setAgrupacionSeleccionada, setCategoriaSeleccionada, setFiltroBusqueda, showMiss, markManualPick]);

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
    const base = ventasMap || new Map();  // ✅ Usar ventasMap
    if (!ventasOverrides || ventasOverrides.size === 0) return base;

    const merged = new Map(base);
    for (const [id, ov] of ventasOverrides.entries()) {
      const prev = merged.get(id) || merged.get(String(id)) || {};
      merged.set(id, { ...prev, ...ov });
    }
    return merged;
  }, [ventasMap, ventasOverrides]);

  const titulo = useMemo(() => {
    const base = 'Gestión de Artículos';
    if (!isMainDivision && activeDivisionName) {
      return `${base} › ${activeDivisionName}`;
    }
    return base;
  }, [isMainDivision, activeDivisionName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 8px 0 8px' }}>
        <h2 style={{ margin: 0 }}>{titulo}</h2>

        {/* ⚠️ MOSTRAR ERROR SI LO HAY */}
        {ventasError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Error al cargar ventas: {ventasError}
          </Alert>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SalesPickerIcon value={rango} onChange={setRango} />
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => setUploadModalOpen(true)}
            sx={{ textTransform: 'none' }}
          >
            Importar CSV
          </Button>

          <button onClick={handleDownloadVentasCsv}>
            Descargar ventas (CSV)
          </button>
          <div style={{ minWidth: 260, maxWidth: 360 }}>
            <Buscador
              placeholder="Buscar artículo…"
              opciones={opcionesBuscador}
              value={searchText}
              onChange={(v) => setSearchText(v || '')}
              clearOnPick={false}
              autoFocusAfterPick
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
        <div style={{
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
            setBusqueda={setSearchText}
            todoGroupId={todoInfo.todoGroupId}
            todoCountOverride={
              todoInfo.todoGroupId ? { [todoInfo.todoGroupId]: todoCountGlobal } : {}
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
            businessId={activeBizId}
            activeDivisionId={activeDivisionId}
            activeDivisionAgrupacionIds={activeDivisionAgrupacionIds}
            assignedAgrupacionIds={assignedAgrupacionIds}
            refetchAssignedAgrupaciones={refetchAssignedAgrupaciones}
          />
        </div>

        <div
          id="tabla-scroll"
          style={{ background: '#fff', overflow: 'auto', maxHeight: 'calc(100vh - 0px)' }}>
          <TablaArticulos
            filtroBusqueda={''}
            agrupaciones={agrupacionesOrdenadas}
            agrupacionesAll={agrupacionesRich}
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
    </div>
  );
}