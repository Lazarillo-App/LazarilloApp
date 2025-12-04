/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import TablaArticulos from '../componentes/TablaArticulos';
import SidebarCategorias from '../componentes/SidebarCategorias';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
//import Buscador from '../componentes/Buscador';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';
import { BusinessesAPI, httpBiz } from "@/servicios/apiBusinesses";
import { applyCreateGroup, applyAppend, applyRemove, applyMove } from '@/utils/groupMutations';
import { obtenerAgrupaciones, actualizarAgrupacion, eliminarAgrupacion } from "@/servicios/apiAgrupaciones";
import { emitGroupsChanged } from "@/utils/groupsBus";
import { buildAgrupacionesIndex, findGroupsForQuery } from '@/servicios/agrupacionesIndex';
import { Snackbar, Alert, Button } from '@mui/material';
import { clearVentasCache } from '@/servicios/apiVentas';
import { downloadVentasCSV } from '@/servicios/apiVentas';
import Buscador from '../componentes/Buscador';
import '../css/global.css';
import '../css/theme-layout.css';

const totalesCache = new Map();
const FAV_KEY = 'favGroupId'; // lo podés dejar como fallback local si querés

const VIEW_KEY = 'lazarillo:ventasViewMode';

const norm = (s) => String(s || '').trim().toLowerCase();

const getArtId = (a) => {
  const raw =
    a?.article_id ??    // 👈 primero el ID del artículo (Maxi / mapping)
    a?.articulo_id ??
    a?.articuloId ??
    a?.idArticulo ??
    a?.id ??            // 👈 después el id interno de la app
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

  // helper: invalidar el cache de totales para el bid y periodo actual
  function clearTotalsCacheFor(bid, from, to) {
    const key = `${bid}|${from}|${to}`;
    if (totalesCache.has(key)) totalesCache.delete(key);
  }

  const [categorias, setCategorias] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState(props.agrupaciones || []);
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);

  // Guarda a qué agrupación pertenecía originalmente cada artículo
  const [discoOrigenById, setDiscoOrigenById] = useState({});

  // 👇 este sigue existiendo como filtro local “interno”
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  const [activeIds, setActiveIds] = useState(new Set());
  const [activeBizId, setActiveBizId] = useState(String(activeBizIdProp || ''));

  // cuando App cambie el negocio, lo reflejamos acá
  useEffect(() => {
    setActiveBizId(String(activeBizIdProp || ''));
  }, [activeBizIdProp]);

  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);

  /* 🔁 Vista GLOBAL fallback (por si no hay agrupación o no hay pref guardada)
     Se guarda como string sencillo: 'by-subrubro' | 'by-categoria'
  */
  const [viewModeGlobal, setViewModeGlobal] = useState(() => {
    if (typeof window === 'undefined') return 'by-subrubro';
    const raw = localStorage.getItem(VIEW_KEY);
    return raw === 'by-categoria' ? 'by-categoria' : 'by-subrubro';
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, viewModeGlobal); } catch { }
  }, [viewModeGlobal]);

  // 🧩 Vista por agrupación en memoria: { [agrupacionId]: 'by-subrubro' | 'by-categoria' }
  const [viewModeByGroup, setViewModeByGroup] = useState({});

  // 🔄 Cargar preferencias de vista (por agrupación) desde backend al tener negocio activo
  useEffect(() => {
    if (!activeBizId) return;

    (async () => {
      try {
        const resp = await BusinessesAPI.getViewPrefs(activeBizId);
        const byGroup = resp?.byGroup || {};
        setViewModeByGroup(byGroup);
      } catch (e) {
        console.error('Error cargando view-prefs', e);
        setViewModeByGroup({});
      }
    })();
  }, [activeBizId]);

  // handler que usará el Sidebar para cambiar la vista Rubro/Subrubro
  const handleChangeListMode = useCallback(
    (mode) => {
      // 1) siempre actualizamos el fallback global
      setViewModeGlobal(mode);
      try { localStorage.setItem(VIEW_KEY, mode); } catch { }

      const g = agrupacionSeleccionada;
      const bid = activeBizId;
      const groupId = Number(g?.id);

      // 2) si hay agrupación seleccionada y negocio activo, guardamos por agrupación
      if (bid && Number.isFinite(groupId)) {
        setViewModeByGroup((prev) => ({
          ...prev,
          [groupId]: mode,
        }));

        // 3) persistimos en backend (no bloquea la UI si falla)
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

  // Devuelve siempre un array de artículos para un grupo, sin importar el campo que use
  const getGroupItemsRaw = (g) => {
    if (!g) return [];
    if (Array.isArray(g.articulos)) return g.articulos;
    if (Array.isArray(g.items)) return g.items;
    if (Array.isArray(g.data)) return g.data;
    return [];
  };

  const agIndex = useMemo(() => buildAgrupacionesIndex(agrupaciones || []), [agrupaciones]);

  // Aviso “el artículo se encuentra en…”
  const [missMsg, setMissMsg] = useState('');
  const [missOpen, setMissOpen] = useState(false);
  const showMiss = useCallback((msg) => { setMissMsg(msg); setMissOpen(true); }, []);

  const lastManualPickRef = useRef(0);
  const markManualPick = useCallback(() => { lastManualPickRef.current = Date.now(); }, []);

  // --- Refetch centralizado de agrupaciones ---
  const refetchAgrupaciones = React.useCallback(async () => {
    try {
      const list = await obtenerAgrupaciones();
      if (Array.isArray(list)) setAgrupaciones(list);
      return list || [];
    } catch {
      setAgrupaciones([]);
      return [];
    }
  }, []);

  // 🔁 Sync inicial de ventas (últimos 7 días) al tener negocio activo
  const didInitialSyncRef = useRef(false);
  useEffect(() => {
    const bid = String(localStorage.getItem('activeBusinessId') || '');
    if (!bid || didInitialSyncRef.current) return;
    (async () => {
      try {
        await BusinessesAPI.syncSalesLast7d(bid);
        // avisamos a la app y forzamos re-render para que VentasCell recalcule
        try { window.dispatchEvent(new CustomEvent('ventas:updated')); } catch { }
        clearVentasCache();
        setSyncVersion(v => v + 1);
        didInitialSyncRef.current = true;
      } catch (e) {
        console.error('Sync inicial (7d) falló:', e?.message || e);
      }
    })();
  }, []);


  const [todoInfo, setTodoInfo] = useState({
    todoGroupId: null,
    idsSinAgrupCount: 0,
    todoIds: new Set(),   // 👈 acá vamos a guardar el Set oficial de “Sin agrupación”
  });

  const todoIdRef = useRef(null);
  useEffect(() => {
    todoIdRef.current = todoInfo?.todoGroupId ?? null;
  }, [todoInfo?.todoGroupId]);

  const handleTodoInfo = useCallback((info) => {
    const safe = info || {};
    const rawId = safe.todoGroupId;
    const todoGroupId = Number.isFinite(Number(rawId)) ? Number(rawId) : null;

    // viene de TablaArticulos
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

  // persistir favorita
  useEffect(() => {
    if (Number.isFinite(Number(favoriteGroupId))) {
      localStorage.setItem(FAV_KEY, String(favoriteGroupId));
    } else {
      localStorage.removeItem(FAV_KEY);
    }
  }, [favoriteGroupId]);

  // Dispatcher optimista de mutaciones de agrupaciones
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

    // opcional: confirmar con backend (no bloquea UI)
    try { await refetchAgrupaciones(); } catch { }
    try { emitGroupsChanged(action.type, { action }); } catch { }
  }, [refetchAgrupaciones]);

  // 🔄 Refetch al montar y cuando cambia el negocio / reloadKey
  useEffect(() => {
    if (!activeBizId) return;
    refetchAgrupaciones();
  }, [activeBizId, reloadKey, refetchAgrupaciones]);

  // 🔁 Cargar agrupación favorita desde el backend al tener negocio activo
  useEffect(() => {
    const bid =
      activeBizId ||
      localStorage.getItem('activeBusinessId') ||
      null;

    if (!bid) return;

    (async () => {
      try {
        const res = await BusinessesAPI.getFavoriteGroup(bid);
        const favIdFromDb = Number(res?.favoriteGroupId);
        if (Number.isFinite(favIdFromDb) && favIdFromDb > 0) {
          setFavoriteGroupId(favIdFromDb);
        } else {
          // opcional: usar fallback del localStorage si había algo
          const localFav = Number(localStorage.getItem(FAV_KEY));
          setFavoriteGroupId(Number.isFinite(localFav) ? localFav : null);
        }
      } catch (e) {
        console.error('Error cargando favorita desde backend', e);
        // si falla, al menos probamos con el local
        const localFav = Number(localStorage.getItem(FAV_KEY));
        setFavoriteGroupId(Number.isFinite(localFav) ? localFav : null);
      }
    })();
  }, [activeBizId]);

  // recibir props.agrupaciones iniciales (si vienen precargadas)
  useEffect(() => {
    setAgrupaciones(props.agrupaciones || []);
  }, [props.agrupaciones]);

  // 🔹 PRIMERO: rango / periodo / refs relacionadas
  const [rango, setRango] = useState({ mode: '7', from: '', to: '' });

  useEffect(() => {
    setRango(r => {
      if (r.from && r.to) return r;
      const def = lastNDaysUntilYesterday(daysByMode(r.mode || '30'));
      return { ...r, ...def };
    });
  }, []);

  const periodo = useMemo(() => {
    if (rango.from && rango.to) return { from: rango.from, to: rango.to };
    return lastNDaysUntilYesterday(daysByMode(rango.mode));
  }, [rango]);

  const periodoRef = useRef(periodo);
  useEffect(() => {
    periodoRef.current = periodo;
  }, [periodo]);

  const handleDownloadVentasCsv = async () => {
    try {
      // 👇 usamos el state correcto
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

      // Crear URL temporal y disparar descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `ventas_${bid}_${from}_a_${to}.csv`; // nombre del archivo
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Limpiar la URL temporal
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar CSV de ventas', err);
      alert(`Error al descargar CSV de ventas: ${err.message || err}`);
    }
  };

  useEffect(() => {
    const onBizSynced = () => setReloadKey((k) => k + 1);

    const onVentasUpdated = () => {
      const bid = activeBizRef.current;
      const { from, to } = periodoRef.current || {};
      if (bid && from && to) {
        clearTotalsCacheFor(bid, from, to);
      }
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


  // Mantener seleccionada en sync cuando cambia la lista local (mutación optimista)
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
  }, [agrupaciones]); // actualizar referencia si cambió

  // limpiar filtros al cambiar de agrupación (esto limpia sólo el local)
  useEffect(() => {
    setFiltroBusqueda('');
    setCategoriaSeleccionada(null);
    setActiveIds(new Set());
  }, [agrupacionSeleccionada]);

  // Cada vez que cambia el periodo, invalidá cache de totales para ese bid
  useEffect(() => {
    const bid = activeBizId;
    if (!bid) return;
    try { clearTotalsCacheFor(bid, periodo.from, periodo.to); } catch { }
    setSyncVersion(v => v + 1);
  }, [periodo.from, periodo.to]);

  // Normalizar artículos que vienen desde TablaArticulos (categorías)
  const handleCategoriasLoaded = useCallback((catsRaw) => {
    const normalizadas = (catsRaw || []).map((sub) => ({
      ...sub,
      categorias: (sub.categorias || []).map((cat) => ({
        ...cat,
        articulos: (cat.articulos || []).map((a) => {
          const idCanonico = getArtId(a); // 👈 usa nuestro helper nuevo
          return {
            ...a,
            article_id: idCanonico,   // nos aseguramos de que exista SIEMPRE
            id: idCanonico ?? a.id,   // opcional: alineamos también id
          };
        }),
      })),
    }));

    setCategorias(normalizadas);

    // DEBUG opcional
    if (normalizadas?.[0]?.categorias?.[0]?.articulos?.[0]) {
    }
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

  // 🔎 Agrupación especial: DISCONTINUADOS
  const discGroup = useMemo(
    () => (agrupacionesRich || []).find(isDiscontinuadosGroup) || null,
    [agrupacionesRich]
  );

  // Set<number> con todos los artículos marcados como discontinuados
  const discIds = useMemo(() => {
    const s = new Set();
    if (!discGroup) return s;

    for (const art of getGroupItemsRaw(discGroup)) {
      const id = getArtId(art);
      if (id != null) s.add(id);
    }
    return s;
  }, [discGroup]);

  // 💰 ventas: estado + helpers
  const [ventasMap, setVentasMap] = useState(new Map());
  const [ventasLoading, setVentasLoading] = useState(false);
  const reqId = useRef(0);

  const articuloIds = useMemo(
    () =>
      (agrupacionSeleccionada?.articulos || [])
        .map((a) => Number(a?.id ?? a?.articuloId))
        .filter(Number.isFinite),
    [agrupacionSeleccionada]
  );

  // Si hay agrupación seleccionada, filtramos el mapa de ventas solo a sus artículos (para la TABLA)
  const ventasMapFiltrado = useMemo(() => {
    if (!agrupacionSeleccionada?.id) return ventasMap;
    const s = new Set(articuloIds);
    const out = new Map();
    ventasMap.forEach((v, k) => {
      if (s.has(Number(k))) out.set(Number(k), v);
    });
    return out;
  }, [ventasMap, agrupacionSeleccionada, articuloIds]);

  // 👉 helper: cantidad vendida para un artículo en el rango actual (para ordenar AGRUPACIONES)
  const getQtyForId = useCallback(
    (id) => {
      const k = Number(id);
      if (!Number.isFinite(k) || k <= 0) return 0;
      // Usamos SIEMPRE el mapa COMPLETO para ordenar agrupaciones
      const row = ventasMap.get(k);
      return Number(row?.qty || 0);
    },
    [ventasMap]
  );

  // 🔢 total de ventas para una agrupación (suma de qty de cada artículo)
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

  // 👉 Agrupaciones enriquecidas + ordenadas por ventas (desc)
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
      // 👇 Discontinuados SIEMPRE al final
      if (discA && !discB) return 1;   // A va después de B
      if (!discA && discB) return -1;  // B va después de A

      const qa = getGroupQty(a);
      const qb = getGroupQty(b);
      if (qb !== qa) return qb - qa;

      return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    });
  }, [agrupacionesRich, todoInfo?.todoGroupId, getGroupQty]);

  // mantener seleccionada la versión enriquecida
  useEffect(() => {
    if (!agrupacionSeleccionada) return;
    const enriched = (agrupacionesRich || []).find(
      g => Number(g.id) === Number(agrupacionSeleccionada.id)
    );
    if (enriched) setAgrupacionSeleccionada(enriched);
  }, [agrupacionesRich]); // eslint-disable-line react-hooks/exhaustive-deps

  // 👉 Totales de ventas por artículo usando /businesses/:id/sales/summary
  useEffect(() => {
    let canceled = false;
    reqId.current += 1;
    const myId = reqId.current;

    async function fetchTotales() {
      const bid = activeBizId;
      if (!bid || !periodo?.from || !periodo?.to) {
        if (!canceled && myId === reqId.current) {
          setVentasMap(new Map());
        }
        return;
      }

      const cacheKey = `${bid}|${periodo.from}|${periodo.to}`;

      // Cache local de totales
      if (totalesCache.has(cacheKey)) {
        const mapa = totalesCache.get(cacheKey);
        if (!canceled && myId === reqId.current) {
          setVentasMap(mapa);
        }
        return;
      }

      setVentasLoading(true);
      try {
        // Usa el helper nuevo que pega a /businesses/:id/sales/summary
        const resp = await BusinessesAPI.getSalesItems(bid, {
          from: periodo.from,
          to: periodo.to,
          limit: 5000,
        });

        const rows = Array.isArray(resp) ? resp : resp?.items || [];

        const totals = new Map();

        for (const r of rows) {
          const id = Number(
            r.article_id ??
            r.articuloId ??
            r.articulo_id ??
            r.idArticulo ??
            r.id
          );
          // ignoramos article_id = 0 (Sin mapping Maxi)
          if (!Number.isFinite(id) || id <= 0) continue;

          const qty = Number(
            r.qty ??
            r.cantidad ??
            r.unidades ??
            r.total_qty ??
            r.total_units ??
            0
          );

          const amount = Number(
            r.amount ??
            r.total ??
            r.importe ??
            r.total_amount ??
            r.monto ??
            0
          );

          const prev = totals.get(id) || { qty: 0, amount: 0 };
          totals.set(id, {
            qty: prev.qty + (Number.isFinite(qty) ? qty : 0),
            amount: prev.amount + (Number.isFinite(amount) ? amount : 0),
          });
        }
        console.log('[VENTAS] resumen rows:', rows.slice(0, 5));
        console.log(
          '[VENTAS] mapa totales sample:',
          Array.from(totals.entries()).slice(0, 5)
        );
        // Cache ring buffer sencillo
        if (totalesCache.size > 20) {
          const fk = totalesCache.keys().next().value;
          totalesCache.delete(fk);
        }
        totalesCache.set(cacheKey, totals);

        if (!canceled && myId === reqId.current) {
          setVentasMap(totals);
        }
      } catch (e) {
        console.error('Error cargando totales de ventas', e);
        if (!canceled && myId === reqId.current) {
          setVentasMap(new Map());
        }
      } finally {
        if (!canceled && myId === reqId.current) {
          setVentasLoading(false);
        }
      }
    }

    fetchTotales();

    return () => {
      canceled = true;
    };
  }, [activeBizId, periodo.from, periodo.to, syncVersion, reloadKey]);

  useEffect(() => {
    console.log('[ArticulosMain] activeBizId (prop/state) =', activeBizId);
  }, [activeBizId]);

  // Cuando cambie el rango, invalidamos cache de ventas (de apiVentas, no el local de totales)
  useEffect(() => {
    if (!periodo?.from || !periodo?.to) return;
    clearVentasCache();
    setSyncVersion((v) => v + 1);
  }, [periodo?.from, periodo?.to]);

  // Permite que celdas individuales ajusten su total (ej: serie recalculada)
  const handleTotalResolved = (id, total) => {
    setVentasMap((prev) => {
      const m = new Map(prev);
      const key = Number(id);
      const cur = m.get(key) || { qty: 0, amount: 0 };
      m.set(key, { ...cur, qty: Number(total || 0) });
      return m;
    });
  };

  // ------- Jump to row & resaltado permanente -------
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

  // ---------- ids base para “Sin Agrupación” ----------
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

  // ids que YA están en alguna agrupación real (no contamos “Sin Agrupación”)
  const idsAsignados = useMemo(() => {
    const s = new Set();

    (agrupaciones || [])
      .filter(g => !isRealTodoGroup(g, todoInfo?.todoGroupId))   // 👈 excluimos solo el TODO real
      .forEach(g => getGroupItemsRaw(g).forEach(a => {
        const id = getArtId(a);
        if (id != null) s.add(id);
      }));

    return s;
  }, [agrupaciones, todoInfo?.todoGroupId]);

  // ids que forman la lista virtual "Sin Agrupación"
  // ids que formarían la lista virtual "Sin Agrupación" calculada localmente (fallback)
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

    // 🛑 Vista "Discontinuados" → mostramos SOLO los discontinuados
    if (isDiscontinuadosGroup(sel)) {
      return discIds;
    }

    const todoId = todoInfo?.todoGroupId;

    // 🟡 Vista "TODO / Sin agrupación" (grupo automático real)
    if (isRealTodoGroup(sel, todoId)) {
      const base =
        (todoInfo?.todoIds && todoInfo.todoIds.size)
          ? todoInfo.todoIds           // versión oficial desde TablaArticulos
          : todoIdsFromTree;           // fallback local

      const out = new Set();
      for (const id of base) {
        const n = Number(id);
        if (!Number.isFinite(n) || n <= 0) continue;
        if (discIds.has(n)) continue;   // ocultamos discontinuados
        out.add(n);
      }
      return out;
    }

    // 🔵 Agrupación normal → sus artículos MENOS los discontinuados
    const s = new Set();
    const items = getGroupItemsRaw(sel);
    for (const a of items) {
      const id = getArtId(a);
      if (id == null) continue;
      if (discIds.has(id)) continue;    // no mostrar discontinuados acá
      s.add(id);
    }
    return s;
  }, [agrupacionSeleccionada, todoInfo, todoIdsFromTree, discIds]);

  const focusArticle = useCallback(
    (rawId, preferGroupId = null) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) return;

      // 1) ¿Ya es visible en la agrupación actual?
      const alreadyVisible = !visibleIds || visibleIds.has(id);

      // 2) ¿En qué agrupaciones está ese artículo?
      const groupsSet = agIndex.byArticleId.get(id) || new Set();
      const allGroups = agrupacionesRich || [];

      let targetGroupId = null;

      // 0️⃣ Si me pasás un grupo preferido y existe, lo usamos primero
      if (preferGroupId != null) {
        const prefNum = Number(preferGroupId);
        if (Number.isFinite(prefNum)) {
          const exists = allGroups.some(g => Number(g.id) === prefNum);
          if (exists) {
            targetGroupId = prefNum;
          }
        }
      }

      // 1️⃣ Si no hay preferido válido, usamos la lógica normal
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

      // 3️⃣ Cambiar agrupación si hace falta
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

      // 4️⃣ Scroll + resaltado
      setSelectedArticleId(id);
      setJumpToId(id);
      scheduleJump(id);
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
    async (rawId, isNowDiscontinuado) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) return;

      const allGroups = agrupacionesRich || [];

      // 🔍 helper: buscar una agrupación "normal" (no TODO, no Discontinuados)
      const findOriginGroup = () => {
        return allGroups.find(g => {
          if (!g || !g.id) return false;
          if (esTodoGroup(g)) return false;
          if (isDiscontinuadosGroup(g)) return false;
          return (g.articulos || []).some(a => getArtId(a) === id);
        }) || null;
      };

      if (isNowDiscontinuado) {
        // 🟥 Se marcó como DISCONTINUADO → recordamos de qué agrupación venía
        setDiscoOrigenById(prev => {
          // si ya teníamos origen guardado, no lo pisamos
          if (prev[id]) return prev;

          const origen = findOriginGroup();
          if (!origen) return prev;

          return {
            ...prev,
            [id]: Number(origen.id),
          };
        });

        // Cambiamos la vista a "Discontinuados" para que el usuario lo vea ahí
        if (discGroup) {
          try { markManualPick(); } catch { }
          setAgrupacionSeleccionada(discGroup);
          setCategoriaSeleccionada(null);
          setFiltroBusqueda('');
          // Lo enfocamos en Discontinuados
          focusArticle(id, discGroup.id);
        } else {
          focusArticle(id);
        }

        return;
      }

      // 🟢 Se REACTIVÓ → debería volver a su agrupación de origen si la conocemos
      let originId = null;

      // Leemos y limpiamos origen en un solo paso
      setDiscoOrigenById(prev => {
        originId = prev[id] ?? null;
        if (!originId) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });

      // Si no teníamos origen guardado, intentamos deducirlo mirando agrupaciones actuales
      if (!originId) {
        const origen = findOriginGroup();
        if (origen) originId = Number(origen.id);
      }

      if (originId) {
        try {
          // 👇 aseguramos en backend que vuelve a su agrupación de origen
          await httpBiz(`/agrupaciones/${originId}/articulos`, {
            method: 'PUT',
            body: { ids: [id] },
          });

          // 👇 actualizamos estado local de agrupaciones de forma optimista
          mutateGroups({
            type: 'append',
            groupId: originId,
            articulos: [{ id }],
            baseById: metaById,
          });
        } catch (e) {
          console.error('REACTIVAR_APPEND_ORIGEN_ERROR', e);
        }

        // Construimos un objeto mínimo para seleccionar esa agrupación
        const originGroup =
          allGroups.find(g => Number(g.id) === Number(originId)) ||
          { id: originId, nombre: 'Agrupación', articulos: [] };

        // Cambiamos la vista a la agrupación de origen
        setAgrupacionSeleccionada(originGroup);
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');

        // Lo enfocamos ahí (no dejamos que caiga en TODO)
        focusArticle(id, originId);

        showMiss(`Artículo reactivado. Ahora lo ves en "${originGroup.nombre}".`);
      } else {
        // No sabemos de dónde venía → solo lo sacamos de Discontinuados
        focusArticle(id);
        showMiss('Artículo reactivado. Ya no está en "Discontinuados".');
      }
    },
    [
      agrupacionesRich,
      discGroup,
      mutateGroups,
      metaById,
      focusArticle,
      showMiss,
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
        // 1) API: agregamos todos los artículos al grupo Discontinuados
        await httpBiz(`/agrupaciones/${discGroup.id}/articulos`, {
          method: 'PUT',
          body: { ids },
        });

        // 2) Estado local: agregamos de forma optimista
        mutateGroups({
          type: 'append',
          groupId: Number(discGroup.id),
          articulos: ids.map(id => ({ id })),
          baseById: metaById,
        });

        // 3) Cambiamos la vista a Discontinuados
        try { markManualPick(); } catch { }
        setAgrupacionSeleccionada(discGroup);
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');

        // 4) (Opcional) foco en el primero del bloque
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
          const id = getArtId(a);      // 👈 usamos el helper
          if (id == null) return;      // si no tiene ID válido, lo ignoramos
          m.set(id, String(a.nombre || '').trim());
        })
      )
    );
    return m;
  }, [categorias]);

  // Selección por defecto: TODO (virtual)
  useEffect(() => {
    const catsReady = Array.isArray(categorias) && categorias.length > 0;
    if (!agrupacionSeleccionada && todoGroupId && catsReady) {
      setAgrupacionSeleccionada({ id: Number(todoGroupId), nombre: 'TODO', articulos: [] });
      setFiltroBusqueda('');
      setCategoriaSeleccionada(null);
    }
  }, [todoGroupId, agrupacionSeleccionada, categorias]);

  const opcionesBuscador = useMemo(() => {
    const ids = activeIds?.size ? Array.from(activeIds) : Array.from(nameById.keys());
    return ids.slice(0, 300).map((id) => ({
      id,
      label: `${nameById.get(id) || `#${id}`} · ${id}`,
      value: nameById.get(id) || String(id),
    }));
  }, [activeIds, nameById]);

  const labelById = useMemo(() => {
    const m = new Map();
    (categorias || []).forEach(sub =>
      (sub.categorias || []).forEach(cat =>
        (cat.articulos || []).forEach(a => {
          const id = getArtId(a);      // 👈 mismo criterio
          if (id == null) return;
          m.set(id, String(a.nombre || '').trim());
        })
      )
    );
    return m;
  }, [categorias]);

  // al crear agrupación (desde tabla/menú)
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

  // Auto-switch entre TODO y favorita según haya resto o no
  // Auto-switch entre TODO y favorita según haya resto o no
  useEffect(() => {
    const todoId = todoInfo?.todoGroupId;
    const todoEmpty = (todoInfo?.idsSinAgrupCount || 0) === 0;

    const recentlyPicked = Date.now() - lastManualPickRef.current < 800;
    if (recentlyPicked) return;

    // necesitamos que catálogo + agrupaciones enriquecidas estén listos
    const catsReady = Array.isArray(categorias) && categorias.length > 0;
    const groupsReady =
      Array.isArray(agrupacionesRich) && agrupacionesRich.length > 0;
    if (!catsReady || !groupsReady) return;

    const isTodoSelected =
      agrupacionSeleccionada &&
      Number(agrupacionSeleccionada.id) === Number(todoId);

    if (todoEmpty) {
      // 👉 elegimos la favorita desde las AGRUPACIONES ENRIQUECIDAS
      const fav = (agrupacionesRich || []).find(
        (g) => Number(g?.id) === Number(favoriteGroupId)
      );

      // si ya está seleccionada, no la tocamos
      if (
        fav &&
        (!agrupacionSeleccionada ||
          Number(agrupacionSeleccionada.id) !== Number(fav.id))
      ) {
        setAgrupacionSeleccionada(fav);
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');
      } else if (!fav) {
        setFavoriteGroupId(null);
      }
    } else {
      // cuando VUELVEN a aparecer artículos sin agrupar,
      // sólo forzamos TODO si hoy no estamos en TODO
      if (
        !isTodoSelected &&
        Number.isFinite(Number(todoId)) &&
        todoId
      ) {
        setAgrupacionSeleccionada({
          id: Number(todoId),
          nombre: 'TODO',
          articulos: [],
        });
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');
      }
    }
  }, [
    todoInfo?.todoGroupId,
    todoInfo?.idsSinAgrupCount,
    favoriteGroupId,
    agrupacionesRich,
    categorias,
    agrupacionSeleccionada,
    setAgrupacionSeleccionada,
    setCategoriaSeleccionada,
    setFiltroBusqueda,
  ]);

  const handleSetFavorite = useCallback((groupId) => {
    setFavoriteGroupId((prev) => {
      const prevNum = Number(prev);
      const nextNum = Number(groupId);

      // si vuelvo a tocar la misma -> quitar favorita
      const final = prevNum === nextNum ? null : nextNum;

      const bid =
        activeBizRef.current ||
        activeBizId ||
        localStorage.getItem('activeBusinessId') ||
        null;

      // 🔥 fire-and-forget al backend
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
      // grupo automático de sobrantes o Discontinuados no se elimina
      return;
    }
    const ok = window.confirm(`Eliminar la agrupación "${group.nombre}"?`);
    if (!ok) return;

    try {
      await eliminarAgrupacion(group.id);
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

    // No permitimos renombrar "Discontinuados"
    if (isDisc) return;

    const promptMsg = isTodo
      ? 'Nombre para la NUEVA agrupación (se llevará lo que hoy está en "Sin Agrupación"):'
      : 'Nuevo nombre para la agrupación';

    const nuevo = window.prompt(promptMsg, isTodo ? '' : currentName);
    if (nuevo == null) return; // cancelado
    const nombre = nuevo.trim();
    if (!nombre) return;
    if (!isTodo && nombre === currentName) return;

    try {
      if (isTodo) {
        // >>> CASO ESPECIAL: crear NUEVA agrupación a partir de "Sin Agrupación"
        const baseSet =
          todoInfo?.todoIds && todoInfo.todoIds.size
            ? todoInfo.todoIds           // ids oficiales que manda TablaArticulos
            : todoIdsFromTree;           // fallback local si aún no llegó onTodoInfo

        const ids = Array.from(baseSet)
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0);

        if (!ids.length) {
          window.alert('No hay artículos en "Sin agrupación" para capturar.');
          return;
        }

        // ✅ Creamos / movemos en backend
        const res = await httpBiz('/agrupaciones/create-or-move', {
          method: 'POST',
          body: {
            nombre,
            ids,
          },
        });

        // Intentamos obtener el id de la agrupación recién creada desde la respuesta
        const createdId = Number(
          res?.id || res?.groupId || res?.agrupacionId || res?.agrupacion?.id
        );

        // 🔄 Refetch de agrupaciones para que queden alineadas con el backend
        const list = await refetchAgrupaciones();

        // 🎯 Seleccionar automáticamente la nueva agrupación
        let nueva = null;
        if (Number.isFinite(createdId) && createdId > 0) {
          nueva = (list || []).find((g) => Number(g.id) === createdId) || null;
        }
        if (!nueva) {
          // fallback: buscar por nombre si el backend no devolvió id
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

        // ❌ IMPORTANTE: ya NO mostramos el segundo alert() “Agrupación creada…”
        // Si querés feedback suave, podés usar showMiss:
        showMiss(`Agrupación "${nombre}" creada a partir de "Sin agrupación".`);

      } else {
        // >>> CASO NORMAL: renombrar agrupación existente
        await actualizarAgrupacion(group.id, { nombre });
        await refetchAgrupaciones();
        showMiss('Nombre de agrupación actualizado.');
      }
    } catch (e) {
      console.error('RENAME_GROUP_ERROR', e);
      window.alert('No se pudo renombrar la agrupación.');
    }
  }, [todoInfo, todoIdsFromTree, refetchAgrupaciones, setAgrupacionSeleccionada, setCategoriaSeleccionada, setFiltroBusqueda, showMiss]);

  // 🎯 Modo efectivo según agrupación seleccionada
  const effectiveViewMode = useMemo(() => {
    const g = agrupacionSeleccionada;
    if (g?.id && viewModeByGroup && viewModeByGroup[g.id]) {
      return viewModeByGroup[g.id]; // vista propia de esa agrupación
    }
    return viewModeGlobal; // fallback global
  }, [agrupacionSeleccionada, viewModeByGroup, viewModeGlobal]);

  const sidebarListMode = effectiveViewMode; // 'by-subrubro' | 'by-categoria'
  const tableHeaderMode =
    effectiveViewMode === 'by-subrubro' ? 'cat-first' : 'sr-first';

  // 👇 NUEVO: modo del árbol SOLO para el modal
  const modalTreeMode = 'cat-first';

  // 🔍 NUEVO: texto efectivo para filtrar la tabla
  const filtroEfectivo = useMemo(
    () => (filtroBusqueda || ''),
    [filtroBusqueda]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 8px 0 8px' }}>
        <h2 style={{ margin: 0 }}>Gestión de Artículos</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SalesPickerIcon value={rango} onChange={setRango} />
          <button onClick={handleDownloadVentasCsv}>
            Descargar ventas (CSV)
          </button>

          {/* 🔍 Buscador local de artículos */}
          <div style={{ minWidth: 260, maxWidth: 360 }}>
            <Buscador
              placeholder="Buscar artículo…"
              opciones={opcionesBuscador}
              clearOnPick={false}
              autoFocusAfterPick
              onPick={(opt) => {
                if (!opt?.id) return;
                const id = Number(opt.id);
                if (!Number.isFinite(id)) return;
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
          />
        </div>

        <div
          id="tabla-scroll"
          style={{ background: '#fff', overflow: 'auto', maxHeight: 'calc(100vh - 0px)' }}>
          <TablaArticulos
            filtroBusqueda={filtroEfectivo}
            agrupaciones={agrupacionesOrdenadas}
            agrupacionSeleccionada={agrupacionSeleccionada}
            setAgrupacionSeleccionada={setAgrupacionSeleccionada}
            categoriaSeleccionada={categoriaSeleccionada}
            setCategoriaSeleccionada={setCategoriaSeleccionada}
            refetchAgrupaciones={refetchAgrupaciones}
            fechaDesdeProp={periodo.from}
            fechaHastaProp={periodo.to}
            ventasPorArticulo={ventasMapFiltrado}
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
    </div>

  );
}
