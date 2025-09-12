import React, { useMemo, useState, useEffect, useRef } from 'react';
import TablaArticulos from '../componentes/TablaArticulos';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';
import { BusinessesAPI } from '../servicios/apiBusinesses';

// Cache en memoria por sesión: `${biz}|${from}|${to}` -> Map(articuloId => totalQty)
const totalesCache = new Map();

export default function ArticulosMain(props) {
  const { syncVersion = 0 } = props;

  const [rango, setRango] = useState({ mode: '30', from: '', to: '' });

  // Inicializa rango (si no viene fijo)
  useEffect(() => {
    setRango((r) => {
      if (r.from && r.to) return r;
      const base = lastNDaysUntilYesterday(daysByMode(r.mode || '30'));
      return { ...r, ...base };
    });
  }, []);

  // Rango efectivo a usar
  const efectivo = useMemo(() => {
    if (rango.from && rango.to) return { from: rango.from, to: rango.to };
    return lastNDaysUntilYesterday(daysByMode(rango.mode));
  }, [rango]);

  // Artículos de la agrupación seleccionada (para filtrar totales mostrados)
  const articuloIds = useMemo(
    () => (props?.agrupacionSeleccionada?.articulos || [])
      .map(a => Number(a?.id ?? a?.articuloId))
      .filter(Boolean),
    [props?.agrupacionSeleccionada]
  );

  const [ventasMap, setVentasMap] = useState(new Map());
  const [ventasLoading, setVentasLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    let canceled = false;
    const myId = ++reqId.current;

    async function fetchTotales() {
      const activeBizId = localStorage.getItem('activeBusinessId');
      if (!activeBizId) { setVentasMap(new Map()); return; }

      const cacheKey = `${activeBizId}|${efectivo.from}|${efectivo.to}`;
      if (totalesCache.has(cacheKey) && syncVersion === 0) {
        const mapa = totalesCache.get(cacheKey);
        if (!canceled && myId === reqId.current) setVentasMap(mapa);
        return;
      }

      setVentasLoading(true);
      try {
        // GET /api/businesses/:id/sales/summary?from&to   (totales desde tu DB)
        const { items } = await BusinessesAPI.salesSummary(activeBizId, {
          from: efectivo.from,
          to: efectivo.to,
        });

        // items: [{ articulo_id, qty, amount }]
        const totals = new Map((items || []).map(r => [
          Number(r.articulo_id),
          Number(r.qty || 0),
        ]));

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
    return () => { canceled = true; };
  }, [efectivo.from, efectivo.to, syncVersion]);

  // Filtra a la agrupación (si hay una seleccionada)
  const ventasMapFiltrado = useMemo(() => {
    if (!props?.agrupacionSeleccionada?.id) return ventasMap;
    const s = new Set(articuloIds);
    const out = new Map();
    ventasMap.forEach((v, k) => { if (s.has(Number(k))) out.set(Number(k), v); });
    return out;
  }, [ventasMap, props?.agrupacionSeleccionada, articuloIds]);

  return (
    <div>
      <TablaArticulos
        {...props}
        fechaDesdeProp={efectivo.from}
        fechaHastaProp={efectivo.to}
        ventasPorArticulo={ventasMapFiltrado}
        ventasLoading={ventasLoading}
        calendarSlot={<SalesPickerIcon value={rango} onChange={setRango} />}
      />
    </div>
  );
}
