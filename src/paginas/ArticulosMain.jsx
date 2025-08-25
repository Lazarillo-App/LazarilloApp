// src/paginas/ArticulosMain.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import TablaArticulos from '../componentes/TablaArticulos';
import SalesPickerIcon from '../componentes/SalesPickerIcon';
import { obtenerVentasAgrupacion } from '../servicios/apiVentas';
import { lastNDaysLocal, daysByMode } from '../utils/fechas';

export default function ArticulosMain(props) {
  const [rango, setRango] = useState({ mode: '30', from: '', to: '' });

  const efectivo = useMemo(() => {
    // Si tenemos from/to explícitos (preset o custom), los usamos tal cual
    if (rango.from && rango.to) return { from: rango.from, to: rango.to };
    // Si no, usamos el cálculo local inclusivo
    return lastNDaysLocal(daysByMode(rango.mode));
  }, [rango]);

  const [ventasMap, setVentasMap] = useState(new Map());
  const [ventasLoading, setVentasLoading] = useState(false);

  // ids de artículos de la agrupación seleccionada
  const articuloIds = useMemo(
    () => (props?.agrupacionSeleccionada?.articulos || [])
      .map(a => Number(a?.id ?? a?.articuloId))
      .filter(Boolean),
    [props?.agrupacionSeleccionada] // si cambia la referencia, recomputa
  );

  const reqId = useRef(0);

  useEffect(() => {
    console.debug('[rango]', efectivo.from, '→', efectivo.to, 'mode=', rango.mode);
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
          articuloIds, // fallback
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