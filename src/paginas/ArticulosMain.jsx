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
import StarIcon from '@mui/icons-material/Star';
import '../css/global.css';
import '../css/theme-layout.css';

const totalesCache = new Map();
const FAV_KEY = 'favGroupId';

export default function ArticulosMain(props) {
  const { syncVersion = 0 } = props;

  const [categorias, setCategorias] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState(props.agrupaciones || []);
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [activeIds, setActiveIds] = useState(new Set()); // ids visibles en viewport (para ventas)
  const [activeBizId, setActiveBizId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteGroupId, setFavoriteGroupId] = useState(
    Number(localStorage.getItem(FAV_KEY)) || null
  );
  const lastManualPickRef = useRef(0);
  const markManualPick = useCallback(() => { lastManualPickRef.current = Date.now(); }, []);

  // persistir al cambiar
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
          return applyCreateGroup(prev,
            {
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
          return applyRemove(prev,
            {
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
    try { await props.refetchAgrupaciones?.(); } catch { }
  }, [props.refetchAgrupaciones]);

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

  useEffect(() => {
    setAgrupaciones(props.agrupaciones || []);
  }, [props.agrupaciones]);

  useEffect(() => {
    const onBizSwitched = () => setActiveBizId(localStorage.getItem('activeBusinessId') || '');
    const onBizSynced = () => setReloadKey((k) => k + 1);
    onBizSwitched();
    window.addEventListener('business:switched', onBizSwitched);
    window.addEventListener('business:synced', onBizSynced);
    return () => {
      window.removeEventListener('business:switched', onBizSwitched);
      window.removeEventListener('business:synced', onBizSynced);
    };
  }, []);

  useEffect(() => {
    // limpiar filtros al cambiar de agrupación
    setFiltroBusqueda('');
    setCategoriaSeleccionada(null);
    setActiveIds(new Set());
  }, [agrupacionSeleccionada]);

  useEffect(() => {
    const sync = () => setActiveBizId(localStorage.getItem('activeBusinessId') || '');
    sync();
    window.addEventListener('business:switched', sync);
    return () => window.removeEventListener('business:switched', sync);
  }, []);

  const [rango, setRango] = useState({ mode: '30', from: '', to: '' });
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

  const [ventasMap, setVentasMap] = useState(new Map());
  const [ventasLoading, setVentasLoading] = useState(false);
  const reqId = useRef(0);

  const articuloIds = useMemo(
    () =>
      (agrupacionSeleccionada?.articulos || [])
        .map((a) => Number(a?.id ?? a?.articuloId))
        .filter(Boolean),
    [agrupacionSeleccionada]
  );

  // throttle para ids visibles (desde TablaArticulos → onIdsVisibleChange)
  const [idsTrigger, setIdsTrigger] = useState([]);
  const throttleRef = useRef(null);
  useEffect(() => {
    if (throttleRef.current) clearTimeout(throttleRef.current);
    throttleRef.current = setTimeout(() => {
      setIdsTrigger(Array.from(activeIds || []));
    }, 250);
    return () => clearTimeout(throttleRef.current);
  }, [activeIds]);

  // cargar totales
  useEffect(() => {
    let canceled = false;
    const myId = reqId.current;

    async function fetchTotales() {
      const bid = localStorage.getItem('activeBusinessId');
      if (!bid) {
        setVentasMap(new Map());
        return;
      }

      const idsList = idsTrigger;

      const cacheKey = `${bid}|${periodo.from}|${periodo.to}`;
      if (totalesCache.has(cacheKey) && syncVersion === 0) {
        const mapa = totalesCache.get(cacheKey);
        if (!canceled && myId === reqId.current) setVentasMap(mapa);
        return;
      }

      setVentasLoading(true);
      try {
        const { items = [] } = await BusinessesAPI.topArticulos(bid, { limit: 1000 });
        const totals = new Map(items.map(r => [Number(r.article_id), Number(r.qty || 0)]));
        if (totalesCache.size > 20) {
          const fk = totalesCache.keys().next().value;
          totalesCache.delete(fk);
        }
        totalesCache.set(cacheKey, totals);
        if (!canceled && myId === reqId.current) setVentasMap(totals);
      } catch (e) {
        if (idsList.length === 0) { setVentasLoading(false); return; }
        const { obtenerVentasAgrupacion } = await import('../servicios/apiVentas');
        const idsAgrup = (agrupacionSeleccionada?.articulos || [])
          .map(a => Number(a?.id ?? a?.articuloId)).filter(Boolean);
        const baseIds = idsAgrup.length ? idsAgrup : idsList;
        const resp = await obtenerVentasAgrupacion({
          agrupacionId: agrupacionSeleccionada?.id || 0,
          from: periodo.from,
          to: periodo.to,
          articuloIds: baseIds,
        });
        const totals = resp.items.reduce((m, it) => m.set(Number(it.articuloId), Number(it.cantidad || 0)), new Map());
        if (totalesCache.size > 20) {
          const fk = totalesCache.keys().next().value;
          totalesCache.delete(fk);
        }
        totalesCache.set(cacheKey, totals);
        if (!canceled && myId === reqId.current) setVentasMap(totals);
      } finally {
        if (!canceled && myId === reqId.current) setVentasLoading(false);
      }
    }

    fetchTotales();
    return () => { canceled = true; };
  }, [activeBizId, periodo.from, periodo.to, syncVersion, idsTrigger, agrupacionSeleccionada]);

  const handleTotalResolved = (id, total) => {
    setVentasMap(prev => {
      const m = new Map(prev);
      m.set(Number(id), Number(total || 0));
      return m;
    });
  };

  const ventasMapFiltrado = useMemo(() => {
    if (!agrupacionSeleccionada?.id) return ventasMap;
    const s = new Set(articuloIds);
    const out = new Map();
    ventasMap.forEach((v, k) => {
      if (s.has(Number(k))) out.set(Number(k), v);
    });
    return out;
  }, [ventasMap, agrupacionSeleccionada, articuloIds]);

  const [todoInfo, setTodoInfo] = useState({ todoGroupId: null, idsSinAgrupCount: 0 });
  const todoGroupId = todoInfo?.todoGroupId || null;

  const nameById = useMemo(() => {
    const m = new Map();
    (categorias || []).forEach((sub) =>
      (sub.categorias || []).forEach((cat) =>
        (cat.articulos || []).forEach((a) => {
          const id = Number(a.id ?? a.articulo_id ?? a.codigo);
          if (Number.isFinite(id)) {
            m.set(id, String(a.nombre ?? a.descripcion ?? `#${id}`));
          }
        })
      )
    );
    return m;
  }, [categorias]);

  // Selección por defecto: TODO (virtual)
  useEffect(() => {
    const catsReady = Array.isArray(categorias) && categorias.length > 0;
    if (!agrupacionSeleccionada && todoGroupId && catsReady){
      setAgrupacionSeleccionada({ id: Number(todoGroupId), nombre: 'TODO', articulos: [] });
    setFiltroBusqueda('');
    setCategoriaSeleccionada(null);
  }
  },[todoGroupId, agrupacionSeleccionada, categorias]);

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

// ids en “Sin Agrupación” (si tenés exclusiones, réstalas acá)
const todoIds = useMemo(() => {
  const s = new Set();
  for (const id of allIds) {
    if (!idsAsignados.has(id)) s.add(id);
  }
  return s;
}, [allIds, idsAsignados]);

// ✅ ESTE es el set correcto a pasar a TablaArticulos (NO activeIds)
const visibleIds = useMemo(() => {
  const sel = agrupacionSeleccionada;
  if (!sel) return null; // null = no filtro (todos)
  if (Number(sel.id) === Number(todoInfo?.todoGroupId)) return todoIds; // TODO virtual
  const s = new Set((sel.articulos || []).map(a => Number(a?.id)).filter(Number.isFinite));
  return s;
}, [agrupacionSeleccionada, todoIds, todoInfo?.todoGroupId]);

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
      // si la favorita ya no existe, limpio
      setFavoriteGroupId(null);
    }
  } else {
    // OPCIONAL: si hay “resto” y estás viendo favorita, volvés a TODO
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
    // toggle: si ya es favorita, la limpio
    return Number(prev) === next ? null : next;
  });
}, []);

return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 8px 0 8px' }}>
      <h2 style={{ margin: 0 }}>Gestión de ventas</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <SalesPickerIcon value={rango} onChange={setRango} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <Buscador
            value={filtroBusqueda}
            setFiltroBusqueda={setFiltroBusqueda}
            opciones={useMemo(() => {
              const out = [];
              for (const id of activeIds) {
                const code = Number(id);
                const name = labelById.get(code) || '';
                out.push({
                  id: code,
                  value: String(code),
                  label: name ? `${code} · ${name}` : String(code),
                });
              }
              return out.slice(0, 300);
            }, [activeIds, labelById])}
            placeholder="Buscar por código o nombre…"
          />
        </div>
      </div>
    </div>

    <div style={{
      display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, alignItems: 'start',
      minHeight: '60vh', borderRadius: 12, overflow: 'hidden',
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
          agrupaciones={agrupaciones}
          agrupacionSeleccionada={agrupacionSeleccionada}
          setAgrupacionSeleccionada={setAgrupacionSeleccionada}
          setFiltroBusqueda={setFiltroBusqueda}
          setBusqueda={setFiltroBusqueda}
          todoGroupId={todoInfo.todoGroupId}
          todoCountOverride={
            todoInfo.todoGroupId ? { [todoInfo.todoGroupId]: todoInfo.idsSinAgrupCount } : {}
          }
          visibleIds={visibleIds}
          onManualPick={markManualPick}
        />
      </div>

      <div style={{ background: '#fff', overflow: 'auto', maxHeight: 'calc(100vh - 0px)' }}>
        <TablaArticulos
          filtroBusqueda={filtroBusqueda}
          agrupaciones={agrupaciones}
          onActualizar={agrupaciones}
          agrupacionSeleccionada={agrupacionSeleccionada}
          setAgrupacionSeleccionada={setAgrupacionSeleccionada}
          categoriaSeleccionada={categoriaSeleccionada}
          setCategoriaSeleccionada={setCategoriaSeleccionada}
          refetchAgrupaciones={props.refetchAgrupaciones}
          fechaDesdeProp={periodo.from}
          fechaHastaProp={periodo.to}
          ventasPorArticulo={ventasMapFiltrado}
          ventasLoading={ventasLoading}
          onCategoriasLoaded={setCategorias}
          onIdsVisibleChange={setActiveIds}
          activeBizId={activeBizId}
          reloadKey={reloadKey}
          onTodoInfo={setTodoInfo}
          onTotalResolved={handleTotalResolved}
          onGroupCreated={handleGroupCreated}
          onMutateGroups={mutateGroups}
          visibleIds={visibleIds}
          favoriteGroupId={favoriteGroupId}
          onSetFavorite={handleSetFavorite}
        />
      </div>
    </div>
  </div>
);
}
