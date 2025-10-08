/* eslint-disable no-unused-vars */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import TablaArticulos from '../componentes/TablaArticulos';
import SidebarCategorias from '../componentes/SidebarCategorias';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
import Buscador from '../componentes/Buscador';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { ensureActiveBusiness } from '../servicios/ensureBusiness';
import '../css/global.css';
import '../css/theme-layout.css';

const totalesCache = new Map();

export default function ArticulosMain(props) {
  const { syncVersion = 0 } = props;

  // Estado compartido
  const [categorias, setCategorias] = useState([]);
  const [agrupaciones, setAgrupaciones] = useState(props.agrupaciones || []); // 👈 ahora reactivo a cambios
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [activeIds, setActiveIds] = useState(new Set());
  const [activeBizId, setActiveBizId] = useState(localStorage.getItem('activeBusinessId') || '');

  // Para forzar reload de TablaArticulos tras sync
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const bid = await ensureActiveBusiness();
        setActiveBizId(String(bid)); // dispara los effects que traen ventas
      } catch (e) {
        console.error('No se pudo fijar negocio activo', e);
      }
    })();
  }, []);

  // ✅ cuando cambian las agrupaciones que vienen del padre, actualizamos estado local
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

  // Reset mínimos al cambiar agrupación
  useEffect(() => {
    setFiltroBusqueda('');
    setCategoriaSeleccionada(null);
    setActiveIds(new Set());
  }, [agrupacionSeleccionada]);

  // Sync de negocio activo desde localStorage / evento app
  useEffect(() => {
    const sync = () => setActiveBizId(localStorage.getItem('activeBusinessId') || '');
    sync();
    window.addEventListener('business:switched', sync);
    return () => window.removeEventListener('business:switched', sync);
  }, []);

  // Rango de fechas
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

  // Ventas (summary)
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

  useEffect(() => {
    let canceled = false;
    const myId = reqId.current;

    async function fetchTotales() {
      const bid = localStorage.getItem('activeBusinessId');
      if (!bid) {
        setVentasMap(new Map());
        return;
      }

      const idsList = Array.from(activeIds || []);

      const cacheKey = `${bid}|${periodo.from}|${periodo.to}`;
      if (totalesCache.has(cacheKey) && syncVersion === 0) {
        const mapa = totalesCache.get(cacheKey);
        if (!canceled && myId === reqId.current) setVentasMap(mapa);
        return;
      }

      setVentasLoading(true);
      try {
        // 1) Intento SIEMPRE de summary (no necesita ids visibles)
        const { peek = [] } = await BusinessesAPI.salesSummary(bid, { from: periodo.from, to: periodo.to });
        const totals = new Map(peek.map(r => [Number(r.articuloId), Number(r.qty || 0)]));
        totalesCache.set(cacheKey, totals);
        if (!canceled && myId === reqId.current) setVentasMap(totals);
      } catch (e) {
        // 2) Fallback por artículos visibles (si todavía no hay ids, esperamos a que la tabla los reporte)
        if (idsList.length === 0) { setVentasLoading(false); return; }
        const { obtenerVentasAgrupacion } = await import('../servicios/apiVentas');
        // si hay agrupación seleccionada, usamos sus ids; si no, usamos los visibles
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
        totalesCache.set(cacheKey, totals);
        if (!canceled && myId === reqId.current) setVentasMap(totals);
      } finally {
        if (!canceled && myId === reqId.current) setVentasLoading(false);
      }
    }

    fetchTotales();
    return () => { canceled = true; };
  }, [activeBizId, periodo.from, periodo.to, syncVersion]);

  const ventasMapFiltrado = useMemo(() => {
    if (!agrupacionSeleccionada?.id) return ventasMap;
    const s = new Set(articuloIds);
    const out = new Map();
    ventasMap.forEach((v, k) => {
      if (s.has(Number(k))) out.set(Number(k), v);
    });
    return out;
  }, [ventasMap, agrupacionSeleccionada, articuloIds]);

  /* ✅ Recibimos info de la Tabla para mostrar contador real en “Sin Agrupación” */
  const [todoInfo, setTodoInfo] = useState({ todoGroupId: null, idsSinAgrupCount: 0 });

  /* ---------- NUEVO: opciones del Buscador por NOMBRE (y código) ---------- */
  // Mapa id -> nombre (desde el árbol `categorias`)
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

  const opcionesBuscador = useMemo(() => {
    const ids = activeIds?.size ? Array.from(activeIds) : Array.from(nameById.keys());
    return ids.slice(0, 300).map((id) => ({
      id,
      label: `${nameById.get(id) || `#${id}`} · ${id}`, // se ve el nombre y también el código
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


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
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

      {/* Body: Sidebar  Tabla */}
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
            // 👇 pasa conteo real de “Sin Agrupación” (si lo conocemos)
            todoCountOverride={
              todoInfo.todoGroupId ? { [todoInfo.todoGroupId]: todoInfo.idsSinAgrupCount } : {}
            }
          />
        </div>

        <div style={{ background: '#fff', overflow: 'auto', maxHeight: 'calc(100vh - 0px)' }}>
          <TablaArticulos
            filtroBusqueda={filtroBusqueda}
            agrupaciones={agrupaciones}
            agrupacionSeleccionada={agrupacionSeleccionada}
            setAgrupacionSeleccionada={setAgrupacionSeleccionada}
            categoriaSeleccionada={categoriaSeleccionada}
            setCategoriaSeleccionada={setCategoriaSeleccionada}
            refetchAgrupaciones={props.refetchAgrupaciones}
            fechaDesdeProp={periodo.from}
            fechaHastaProp={periodo.to}
            ventasPorArticulo={ventasMapFiltrado}
            ventasLoading={ventasLoading}
            onCategoriasLoaded={(tree) => setCategorias(tree)}
            onIdsVisibleChange={setActiveIds}
            key={[activeBizId || 'no-biz', reloadKey].join('|')}
            activeBizId={activeBizId}
            reloadKey={reloadKey}
            onTodoInfo={setTodoInfo}
          />
        </div>
      </div>
    </div>
  );
}