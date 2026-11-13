// src/paginas/Conciliacion.jsx
// Módulo de conciliación bancaria (14/11/2026). El módulo (ModuloConciliacion, de Diego) cruza
// las ventas del POS y las cobranzas de cuenta corriente de MaxiRest con Mercado Pago. Esta
// página lo monta para el negocio activo y le da el guardado en el servidor: lo que se sube,
// el trabajo de cada período y la memoria de pagadores. Solo dueño y admin (App.jsx).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { ConciliacionAPI } from '@/servicios/apiConciliacion';
import ModuloConciliacion from '@/componentes/conciliacion/ModuloConciliacion';

const iniciales = (nombre) => String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function Conciliacion() {
  const { activeBusinessId, active } = useBusiness() || {};
  const bid = Number(activeBusinessId) || null;
  const [inicial, setInicial] = useState(null);   // { fuentes, pagadores } del servidor
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');         // "Guardado" / errores de guardado
  const avisoT = useRef(null);
  const pagT = useRef(null);

  const avisar = useCallback((t, ms = 2500) => {
    setAviso(t);
    clearTimeout(avisoT.current);
    if (ms) avisoT.current = setTimeout(() => setAviso(''), ms);
  }, []);

  useEffect(() => {
    if (!bid) return;
    let vivo = true;
    setInicial(null); setError('');
    ConciliacionAPI.cargar(bid)
      .then((r) => {
        if (!vivo) return;
        const f = r?.fuentes || {};
        setInicial({
          fuentes: {
            ventas: f.ventas?.filas || null,
            pagos: f.pagos?.filas || null,
            banco: f.banco?.filas || null,
            facturas_cc: f.facturas_cc?.filas || [],
          },
          pagadores: r?.pagadores || {},
        });
      })
      .catch(() => { if (vivo) setError('No pude cargar la conciliación de este negocio. Probá de nuevo en un rato.'); });
    return () => { vivo = false; clearTimeout(pagT.current); };
  }, [bid]);

  const persist = useMemo(() => (bid && inicial ? {
    fuentes: inicial.fuentes,
    onFuente: (tipo, filas, archivo) => {
      avisar('Guardando el archivo…', 0);
      ConciliacionAPI.guardarFuente(bid, tipo, filas, archivo)
        .then(() => avisar('Archivo guardado'))
        .catch(() => avisar('No se pudo guardar el archivo en el servidor: si cerrás, se pierde.', 8000));
    },
    cargarEstado: (periodo) => ConciliacionAPI.leerEstado(bid, periodo).then((r) => r?.estado || null),
    guardarEstado: (periodo, estado) => {
      ConciliacionAPI.guardarEstado(bid, periodo, estado)
        .then(() => avisar('Cambios guardados', 1500))
        .catch(() => avisar('No se pudieron guardar los últimos cambios. Revisá la conexión.', 8000));
    },
  } : null), [bid, inicial, avisar]);

  // La memoria de pagadores cambia seguido (cada conciliación de cuenta corriente): se manda
  // con una pausa corta.
  const onPagadorMap = useCallback((mapa) => {
    if (!bid) return;
    clearTimeout(pagT.current);
    pagT.current = setTimeout(() => { ConciliacionAPI.guardarPagadores(bid, mapa).catch(() => {}); }, 1500);
  }, [bid]);

  if (!bid) return <div style={{ padding: 32 }}>Elegí un negocio para conciliar.</div>;
  if (error) return <div style={{ padding: 32, color: '#991b1b' }}>{error}</div>;
  if (!inicial) return <div style={{ padding: 32, color: '#64748b' }}>Cargando la conciliación…</div>;

  const business = {
    group: active?.organization_name || active?.org_name || '',
    name: active?.name || 'Negocio',
    initials: iniciales(active?.name),
    color: 'var(--color-primary, #5BC2EA)',
  };

  return (
    <div style={{ position: 'relative' }}>
      {aviso && (
        <div style={{
          position: 'fixed', left: 20, bottom: 20, zIndex: 1300, background: '#15213E', color: '#fff',
          borderRadius: 10, padding: '8px 14px', fontSize: 13, boxShadow: '0 6px 20px rgba(0,0,0,.25)',
        }}>{aviso}</div>
      )}
      {/* key: al cambiar de negocio se arma de cero con lo de ese negocio */}
      <ModuloConciliacion key={bid} business={business} embedded persist={persist}
        pagadorMap={inicial.pagadores} onPagadorMap={onPagadorMap} />
    </div>
  );
}
