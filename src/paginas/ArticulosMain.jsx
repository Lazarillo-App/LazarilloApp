import React, { useMemo, useState, useEffect, useRef } from 'react';
import TablaArticulos from '../componentes/TablaArticulos';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
import { obtenerVentasAgrupacion } from '../servicios/apiVentas';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';

export default function ArticulosMain(props) {
  const [rango, setRango] = useState({ mode: '30', from: '', to: '' });

  // Congelamos from/to al montar (si no estaban definidos)
  useEffect(() => {
    setRango((r) => {
      if (r.from && r.to) return r;
      const base = lastNDaysUntilYesterday(daysByMode(r.mode || '30'));
      return { ...r, ...base };
    });
  }, []);

  // Rango efectivo: si hay from/to explícitos, usamos eso; si no, fallback (no debería ocurrir tras el mount).
  const efectivo = useMemo(() => {
    if (rango.from && rango.to) return { from: rango.from, to: rango.to };
    return lastNDaysUntilYesterday(daysByMode(rango.mode));
  }, [rango]);

  const [ventasMap, setVentasMap] = useState(new Map());
  const [ventasLoading, setVentasLoading] = useState(false);

  const articuloIds = useMemo(
    () => (props?.agrupacionSeleccionada?.articulos || [])
      .map(a => Number(a?.id ?? a?.articuloId))
      .filter(Boolean),
    [props?.agrupacionSeleccionada]
  );

  const reqId = useRef(0);

  useEffect(() => {
    let canceled = false;
    const myId = ++reqId.current;

    async function run() {
      const agrupacionId = props?.agrupacionSeleccionada?.id;
      if (!agrupacionId) { setVentasMap(new Map()); return; }
      setVentasLoading(true);
      try {
        const { mapa } = await obtenerVentasAgrupacion({
          agrupacionId,
          from: efectivo.from,
          to: efectivo.to,
          articuloIds,
          // el backend ya clampa a AYER e ignora precio 0
        });
        if (!canceled && myId === reqId.current) {
          setVentasMap(mapa || new Map());
        }
      } finally {
        if (!canceled && myId === reqId.current) setVentasLoading(false);
      }
    }
    run();
    return () => { canceled = true; };
  }, [props?.agrupacionSeleccionada, efectivo.from, efectivo.to, articuloIds]);

  return (
    <div>
      <TablaArticulos
        {...props}
        fechaDesdeProp={efectivo.from}
        fechaHastaProp={efectivo.to}
        ventasPorArticulo={ventasMap}
        ventasLoading={ventasLoading}
        calendarSlot={<SalesPickerIcon value={rango} onChange={setRango} />}
      />
    </div>
  );
}