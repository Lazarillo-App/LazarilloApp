import React, { useMemo, useState, useEffect, useRef } from 'react';
import TablaArticulos from '../componentes/TablaArticulos';
import SidebarCategorias from '../componentes/SidebarCategorias';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
import Buscador from '../componentes/Buscador';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import '../css/global.css';
import '../css/theme-layout.css';

const totalesCache = new Map();

export default function ArticulosMain(props) {
  const { syncVersion = 0 } = props;

  // Estado compartido
  const [categorias, setCategorias] = useState([]); // subrubro → categorias → articulos
  const [agrupaciones] = useState(props.agrupaciones || []);
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [activeIds, setActiveIds] = useState(new Set());
  const [activeBizId, setActiveBizId] = useState(localStorage.getItem('activeBusinessId') || '');

  // Para forzar reload de TablaArticulos tras sync
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const onBizSwitched = () => setActiveBizId(localStorage.getItem('activeBusinessId') || '');
    const onBizSynced = () => setReloadKey((k) => k + 1); // fuerza refetch de la tabla
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
    setRango((r) =>
      r.from && r.to ? r : { ...r, ...lastNDaysUntilYesterday(daysByMode(r.mode || '30')) }
    );
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
    const myId = ++reqId.current;

    async function fetchTotales() {
      const bid = localStorage.getItem('activeBusinessId');
      if (!bid) {
        setVentasMap(new Map());
        return;
      }

      const cacheKey = `${bid}|${periodo.from}|${periodo.to}`;
      if (totalesCache.has(cacheKey) && syncVersion === 0) {
        const mapa = totalesCache.get(cacheKey);
        if (!canceled && myId === reqId.current) setVentasMap(mapa);
        return;
      }

      setVentasLoading(true);
      try {
        const { items } = await BusinessesAPI.salesSummary(bid, {
          from: periodo.from,
          to: periodo.to,
        });
        const totals = new Map(
          (items || []).map((r) => [Number(r.articulo_id), Number(r.qty || 0)])
        );
        totalesCache.set(cacheKey, totals);
        if (!canceled && myId === reqId.current) setVentasMap(totals);
      } catch (e) {
        console.error('ventas summary fetch error', e);
        if (!canceled && myId === reqId.current) setVentasMap(new Map());
      } finally {
        if (!canceled && myId === reqId.current) setVentasLoading(false);
      }
    }

    fetchTotales();
    return () => {
      canceled = true;
    };
  }, [periodo.from, periodo.to, syncVersion]);

  const ventasMapFiltrado = useMemo(() => {
    if (!agrupacionSeleccionada?.id) return ventasMap;
    const s = new Set(articuloIds);
    const out = new Map();
    ventasMap.forEach((v, k) => {
      if (s.has(Number(k))) out.set(Number(k), v);
    });
    return out;
  }, [ventasMap, agrupacionSeleccionada, articuloIds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header: SIN el botón de sincronizar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 8px 0 8px' }}>
        <h2 style={{ margin: 0 }}>Gestión de ventas</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SalesPickerIcon value={rango} onChange={setRango} />
          <div style={{ flex: 1, minWidth: 260 }}>
            <Buscador
              value={filtroBusqueda}
              setFiltroBusqueda={setFiltroBusqueda}
              opciones={Array.from(activeIds)
                .slice(0, 300)
                .map((id) => ({ id, label: String(id), value: String(id) }))}
              placeholder="Buscar por código o nombre…"
            />
          </div>
        </div>
      </div>

      {/* Body: Sidebar + Tabla (igual) */}
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
            key={(activeBizId || 'no-biz') + '|' + reloadKey} // ← re-mount tras sync
            activeBizId={activeBizId}
            reloadKey={reloadKey}
          />
        </div>
      </div>
    </div>
  );
}