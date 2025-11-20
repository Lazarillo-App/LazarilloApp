/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import TablaArticulos from '../componentes/TablaArticulos';
import SidebarCategorias from '../componentes/SidebarCategorias';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
import Buscador from '../componentes/Buscador';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import { ensureActiveBusiness } from '../servicios/ensureBusiness';
import { applyCreateGroup, applyAppend, applyRemove, applyMove } from '@/utils/groupMutations';
import { onGroupsChanged } from "@/utils/groupsBus";
import { obtenerAgrupaciones, actualizarAgrupacion, eliminarAgrupacion } from "@/servicios/apiAgrupaciones";
import { emitGroupsChanged } from "@/utils/groupsBus";
import { buildAgrupacionesIndex, findGroupsForQuery } from '@/servicios/agrupacionesIndex';
import { Snackbar, Alert } from '@mui/material';
import { clearVentasCache } from '@/servicios/apiVentas';
import '../css/global.css';
import '../css/theme-layout.css';

const totalesCache = new Map();
const FAV_KEY = 'favGroupId';

const norm = (s) => String(s || '').trim().toLowerCase();
const isDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

export default function ArticulosMain(props) {
  const { syncVersion: syncVersionProp = 0 } = props;
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
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [activeIds, setActiveIds] = useState(new Set());
  const [activeBizId, setActiveBizId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteGroupId, setFavoriteGroupId] = useState(
    Number(localStorage.getItem(FAV_KEY)) || null
  );

  const VIEW_KEY = 'lazarillo:ventasViewMode';

  // 🔁 Vista compartida Sidebar/Tabla: 'by-subrubro' | 'by-categoria'
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'by-subrubro';
    return localStorage.getItem(VIEW_KEY) || 'by-subrubro';
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, viewMode); } catch { }
  }, [viewMode]);

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


  // --- TODO virtual / info compartida con Tabla ---
  const [todoInfo, setTodoInfo] = useState({ todoGroupId: null, idsSinAgrupCount: 0 });
  const todoIdRef = useRef(null);
  useEffect(() => { todoIdRef.current = todoInfo?.todoGroupId ?? null; }, [todoInfo?.todoGroupId]);

  // Si existe "Discontinuados", apagamos la lista virtual (TODO / Sin Agrupación)
  const discontinuadosExists = useMemo(
    () => (agrupaciones || []).some((g) => isDiscontinuadosGroup(g)),
    [agrupaciones]
  );

  const handleTodoInfo = useCallback((info) => {
    if (discontinuadosExists) {
      // 🔌 Modo maduro: sin agrupación virtual
      setTodoInfo({ todoGroupId: null, idsSinAgrupCount: 0 });
    } else {
      // 🧩 Modo clásico: usar la info que viene de TablaArticulos / backend
      const safe = info || {};
      const rawId = safe.todoGroupId;
      const todoGroupId = Number.isFinite(Number(rawId)) ? Number(rawId) : null;
      const idsSinAgrupCount = Number(safe.idsSinAgrupCount || 0);
      setTodoInfo({ todoGroupId, idsSinAgrupCount });
    }
  }, [discontinuadosExists]);

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

    // negocio activo
  useEffect(() => {
    (async () => {
      try {
        const bid = await ensureActiveBusiness();
        setActiveBizId(String(bid));
      } catch (e) {
        console.error('No se pudo fijar negocio activo', e);
      }
    })();
  }, []);

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

  // 👉 idem para el businessId activo
  const activeBizRef = useRef(localStorage.getItem('activeBusinessId') || '');
  useEffect(() => {
    activeBizRef.current = activeBizId;
  }, [activeBizId]);

  // 🔹 DESPUÉS: eventos del negocio (usa activeBizRef y periodoRef)
  useEffect(() => {
    const onBizSwitched = () =>
      setActiveBizId(localStorage.getItem('activeBusinessId') || '');
    const onBizSynced = () =>
      setReloadKey((k) => k + 1);

    const onVentasUpdated = () => {
      const bid = activeBizRef.current;
      const { from, to } = periodoRef.current || {};
      if (bid && from && to) {
        clearTotalsCacheFor(bid, from, to);
      }
      setSyncVersion((v) => v + 1);
    };

    // inicial
    onBizSwitched();

    // listeners
    window.addEventListener('business:switched', onBizSwitched);
    window.addEventListener('business:synced', onBizSynced);
    window.addEventListener('ventas:updated', onVentasUpdated);

    return () => {
      window.removeEventListener('business:switched', onBizSwitched);
      window.removeEventListener('business:synced', onBizSynced);
      window.removeEventListener('ventas:updated', onVentasUpdated);
    };
  }, []);

  // Forzar reloadKey al loguear o cambiar de local (dispara refetch)
  useEffect(() => {
    const bump = () => setReloadKey(k => k + 1);
    window.addEventListener('auth:login', bump);
    window.addEventListener('business:switched', bump);
    return () => {
      window.removeEventListener('auth:login', bump);
      window.removeEventListener('business:switched', bump);
    };
  }, []);

  // negocio activo
  useEffect(() => {
    (async () => {
      try {
        const bid = await ensureActiveBusiness();
        setActiveBizId(String(bid));
      } catch (e) {
        console.error('No se pudo fijar negocio activo', e);
      }
    })();
  }, []);

  // recibir props.agrupaciones iniciales (si vienen precargadas)
  useEffect(() => {
    setAgrupaciones(props.agrupaciones || []);
  }, [props.agrupaciones]);

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

  // limpiar filtros al cambiar de agrupación
  useEffect(() => {
    setFiltroBusqueda('');
    setCategoriaSeleccionada(null);
    setActiveIds(new Set());
  }, [agrupacionSeleccionada]);

  // sync active biz id (por si algún otro dispara el evento)
  useEffect(() => {
    const sync = () => setActiveBizId(localStorage.getItem('activeBusinessId') || '');
    sync();
    window.addEventListener('business:switched', sync);
    return () => window.removeEventListener('business:switched', sync);
  }, []);

  // Cada vez que cambia el periodo, invalidá cache de totales para ese bid
  useEffect(() => {
    const bid = localStorage.getItem('activeBusinessId');
    if (!bid) return;
    try { clearTotalsCacheFor(bid, periodo.from, periodo.to); } catch { }
    setSyncVersion(v => v + 1);
  }, [periodo.from, periodo.to]);

 

  // ========= NUEVO: índice completo por id para enriquecer agrupaciones =========
  const metaById = useMemo(() => {
    const m = new Map();
    (categorias || []).forEach(sub =>
      (sub.categorias || []).forEach(cat =>
        (cat.articulos || []).forEach(a => {
          const id = Number(a.id ?? a.articulo_id ?? a.codigo);
          if (!Number.isFinite(id)) return;
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
      articulos: (g.articulos || []).map(a => {
        const id = Number(a?.id ?? a?.articuloId);
        const meta = metaById.get(id);
        return meta ? { ...a, ...meta, id } : { ...a, id };
      }),
    }));
  }, [agrupaciones, metaById]);

  // mantener seleccionada la versión enriquecida
  useEffect(() => {
    if (!agrupacionSeleccionada) return;
    const enriched = (agrupacionesRich || []).find(
      g => Number(g.id) === Number(agrupacionSeleccionada.id)
    );
    if (enriched) setAgrupacionSeleccionada(enriched);
  }, [agrupacionesRich]); // eslint-disable-line react-hooks/exhaustive-deps

  // opciones buscador global
  const opcionesGlobales = useMemo(() => {
    const out = [];
    (categorias || []).forEach(sub => {
      const subName = sub?.subrubro || 'Sin subrubro';
      (sub.categorias || []).forEach(cat => {
        const catName = cat?.categoria || 'Sin categoría';
        (cat.articulos || []).forEach(a => {
          const id = Number(a?.id);
          if (!Number.isFinite(id)) return;
          const name = String(a?.nombre || `#${id}`).trim();
          out.push({ id, value: String(id), label: `${subName} › ${catName} · ${name} · ${id}` });
        });
      });
    });
    return out;
  }, [categorias]);

    // ventas
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

  // 👉 Totales de ventas por artículo usando /businesses/:id/sales/summary
  useEffect(() => {
    let canceled = false;
    reqId.current += 1;
    const myId = reqId.current;

    async function fetchTotales() {
      const bid = activeBizId || localStorage.getItem('activeBusinessId');
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

  // Si hay agrupación seleccionada, filtramos el mapa de ventas solo a sus artículos
  const ventasMapFiltrado = useMemo(() => {
    if (!agrupacionSeleccionada?.id) return ventasMap;
    const s = new Set(articuloIds);
    const out = new Map();
    ventasMap.forEach((v, k) => {
      if (s.has(Number(k))) out.set(Number(k), v);
    });
    return out;
  }, [ventasMap, agrupacionSeleccionada, articuloIds]);

  // ------- Jump to row -------
  const [jumpToId, setJumpToId] = useState(null);
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
    ventasMapFiltrado
  ]);

  const todoGroupId = todoInfo?.todoGroupId || null;

  const nameById = useMemo(() => {
    const m = new Map();
    (categorias || []).forEach(sub =>
      (sub.categorias || []).forEach(cat =>
        (cat.articulos || []).forEach(a =>
          m.set(Number(a.id), String(a.nombre || '').trim())
        )
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
        (cat.articulos || []).forEach(a =>
          m.set(Number(a.id), String(a.nombre || '').trim())
        )
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

  // ---------- ids base para “Sin Agrupación” ----------
  const allIds = useMemo(() => {
    const out = [];
    for (const sub of categorias || []) {
      for (const cat of sub.categorias || []) {
        for (const a of cat.articulos || []) {
          const id = Number(a?.id ?? a?.articulo_id ?? a?.codigo);
          if (Number.isFinite(id)) out.push(id);
        }
      }
    }
    return out;
  }, [categorias]);

  const idsAsignados = useMemo(() => {
    const s = new Set();
    (agrupaciones || [])
      .filter(g => Number(g?.id) !== Number(todoInfo?.todoGroupId))
      .forEach(g => (g?.articulos || []).forEach(a => {
        const id = Number(a?.id);
        if (Number.isFinite(id)) s.add(id);
      }));
    return s;
  }, [agrupaciones, todoInfo?.todoGroupId]);

  // ids en “Sin Agrupación”
  const todoIds = useMemo(() => {
    const s = new Set();
    for (const id of allIds) {
      if (!idsAsignados.has(id)) s.add(id);
    }
    return s;
  }, [allIds, idsAsignados]);

  // Set de ids visibles a pasar a la tabla
  const visibleIds = useMemo(() => {
    const sel = agrupacionSeleccionada;
    if (!sel) return null;
    if (Number(sel.id) === Number(todoInfo?.todoGroupId)) return todoIds; // TODO virtual
    const s = new Set((sel.articulos || []).map(a => Number(a?.id)).filter(Number.isFinite));
    return s;
  }, [agrupacionSeleccionada, todoIds, todoInfo?.todoGroupId]);

  // Auto-switch entre TODO y favorita según haya resto o no
  useEffect(() => {
    const todoId = todoInfo?.todoGroupId;
    const todoEmpty = (todoInfo?.idsSinAgrupCount || 0) === 0;
    const isTodoSelected =
      agrupacionSeleccionada &&
      Number(agrupacionSeleccionada.id) === Number(todoId);
    const recentlyPicked = Date.now() - lastManualPickRef.current < 800;
    if (recentlyPicked) return;

    if (todoEmpty) {
      const fav = (agrupaciones || []).find(
        g => Number(g?.id) === Number(favoriteGroupId)
      );
      if (fav) {
        setAgrupacionSeleccionada(fav);
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');
      } else {
        setFavoriteGroupId(null);
      }
    } else {
      if (agrupacionSeleccionada && !isTodoSelected && Number.isFinite(Number(todoId))) {
        setAgrupacionSeleccionada({ id: Number(todoId), nombre: 'TODO', articulos: [] });
        setCategoriaSeleccionada(null);
        setFiltroBusqueda('');
      }
    }
  }, [
    todoInfo?.todoGroupId,
    todoInfo?.idsSinAgrupCount,
    favoriteGroupId,
    agrupaciones,
    agrupacionSeleccionada,
    setAgrupacionSeleccionada,
    setCategoriaSeleccionada,
    setFiltroBusqueda
  ]);

  const handleSetFavorite = useCallback((groupId) => {
    setFavoriteGroupId((prev) => {
      const next = Number(groupId);
      return Number(prev) === next ? null : next;
    });
  }, []);

  const handleEditGroup = useCallback(async (group) => {
    if (!group) return;
    const currentName = String(group.nombre || '');
    const nuevo = window.prompt('Nuevo nombre para la agrupación', currentName);
    if (nuevo == null) return; // cancelado
    const trimmed = nuevo.trim();
    if (!trimmed || trimmed === currentName) return;

    // mutación optimista
    mutateGroups({
      type: 'create',
      id: Number(group.id),
      nombre: trimmed,
      articulos: Array.isArray(group.articulos) ? group.articulos : [],
    });

    try {
      await actualizarAgrupacion(group.id, { nombre: trimmed });
      await refetchAgrupaciones();
    } catch (e) {
      console.error('Error al renombrar agrupación', e);
      // si algo sale mal, nos traemos lo que diga el backend
      await refetchAgrupaciones();
    }
  }, [mutateGroups, refetchAgrupaciones]);

  const handleDeleteGroup = useCallback(async (group) => {
    if (!group || !group.id) return;
    if (Number(group.id) === Number(todoInfo?.todoGroupId)) {
      // grupo automático de sobrantes no se elimina
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


  // ======= ⬇️ Resaltado permanente del artículo seleccionado
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const sidebarListMode = viewMode; // 'by-subrubro' o 'by-categoria'
  const tableHeaderMode = viewMode === 'by-subrubro' ? 'cat-first' : 'sr-first';


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 8px 0 8px' }}>
        <h2 style={{ margin: 0 }}>Gestión de ventas</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SalesPickerIcon value={rango} onChange={setRango} />
          <div style={{ flex: 1, minWidth: 260 }}>
            <Buscador
              value={filtroBusqueda}
              clearOnFocus={true}
              clearOnPick={true}
              autoFocusAfterPick={false}
              opciones={opcionesGlobales}
              placeholder="Buscar por código o nombre…"
              onPick={(opt) => {
                const id = Number(opt?.id ?? opt?.value);
                if (!Number.isFinite(id)) return;
                const isVisibleHere = !visibleIds || visibleIds.has(id);
                if (!isVisibleHere) {
                  const setIds = agIndex.byArticleId.get(id) || new Set();
                  const hereId = Number(agrupacionSeleccionada?.id);
                  const names = Array.from(setIds)
                    .filter(gid => !hereId || Number(gid) !== hereId)
                    .map(gid => agIndex.groupNameById.get(gid) || `Agrupación #${gid}`);

                  if (names.length) {
                    const nombre = labelById.get(id) || `#${id}`;
                    showMiss(`“${nombre}” se encuentra en: ${names.join(', ')}`);
                  } else {
                    const nombre = labelById.get(id) || `#${id}`;
                    showMiss(`“${nombre}” no pertenece a esta agrupación.`);
                  }
                  setFiltroBusqueda('');
                  return;
                }
                setSelectedArticleId(id);
                setJumpToId(id);
                scheduleJump(id);
                setFiltroBusqueda('');
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
            agrupaciones={agrupacionesRich}
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
            onChangeListMode={setViewMode}
            favoriteGroupId={favoriteGroupId}
            onSetFavorite={handleSetFavorite}
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
          />
        </div>

        <div
          id="tabla-scroll"
          style={{ background: '#fff', overflow: 'auto', maxHeight: 'calc(100vh - 0px)' }}>
          <TablaArticulos
            filtroBusqueda={filtroBusqueda}
            agrupaciones={agrupacionesRich}
            agrupacionSeleccionada={agrupacionSeleccionada}
            setAgrupacionSeleccionada={setAgrupacionSeleccionada}
            categoriaSeleccionada={categoriaSeleccionada}
            setCategoriaSeleccionada={setCategoriaSeleccionada}
            refetchAgrupaciones={refetchAgrupaciones}
            fechaDesdeProp={periodo.from}
            fechaHastaProp={periodo.to}
            ventasPorArticulo={ventasMapFiltrado}
            ventasLoading={ventasLoading}
            onCategoriasLoaded={setCategorias}
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
