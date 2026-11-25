// src/componentes/produccion/BuscarInsumo.jsx — elegir un insumo de la lista del negocio.
import React, { useEffect, useRef, useState } from 'react';
import { T, FB } from '@/componentes/ui/temaDiego';
import { ProduccionAPI } from '@/servicios/apiProduccion';
import { Boton, Entrada } from './ui';
import { unidadCorta } from './util';

/** Elegir un insumo de la lista (para cambiar la receta tiene que ser uno real, con su costo). */
export default function BuscarInsumo({ businessId, valor, onElegir, obligatorio, autoFocus = false }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const boxRef = useRef(null);
  const cel = typeof window !== 'undefined' && window.innerWidth < 760;

  useEffect(() => {
    if (valor || q.trim().length < 2) { setRes([]); return undefined; }
    const h = setTimeout(async () => {
      try { const r = await ProduccionAPI.buscarInsumos(businessId, q.trim()); setRes(r.items || []); } catch { setRes([]); }
    }, 250);
    return () => clearTimeout(h);
  }, [q, valor, businessId]);

  // En el celular, al abrirse la lista de resultados o enfocar el campo, lo lleva arriba de la pantalla
  // para que el teclado virtual no tape las opciones.
  const asegurarVisible = () => {
    if (!cel) return;
    setTimeout(() => {
      boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };
  useEffect(() => {
    if (cel && res.length > 0) asegurarVisible();
  }, [cel, res.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const alto = cel ? 44 : 38;

  if (valor) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: cel ? '6px 10px' : '8px 10px', minHeight: alto,
        boxSizing: 'border-box', border: `1px solid ${T.border2}`, borderRadius: 10, background: T.head, fontFamily: FB, minWidth: 0,
      }}>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: T.text, overflowWrap: 'anywhere' }}>{valor.nombre}</span>
        <Boton chico={!cel} onClick={() => { onElegir(null); setQ(''); }} style={cel ? { minHeight: 38, padding: '6px 12px' } : undefined}>Cambiar</Boton>
      </div>
    );
  }
  return (
    <div ref={boxRef} style={{ position: 'relative', minWidth: 0, scrollMarginTop: 12 }}>
      <Entrada
        autoFocus={autoFocus && !cel}
        value={q}
        onFocus={asegurarVisible}
        onChange={(e) => { setQ(e.target.value); if (!obligatorio) onElegir({ id: null, nombre: e.target.value }); }}
        placeholder={obligatorio ? 'Buscá el insumo…' : 'Buscá el insumo o escribí el nombre'}
        style={{ minHeight: alto }}
      />
      {res.length > 0 && (
        <div style={{
          border: `1px solid ${T.border2}`, borderRadius: 10, marginTop: 4, maxHeight: cel ? 220 : 180,
          overflowY: 'auto', background: '#fff', boxShadow: T.sombraSuave, WebkitOverflowScrolling: 'touch',
        }}>
          {res.map((i) => (
            <div
              key={i.id}
              role="button"
              tabIndex={0}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onElegir(i); setRes([]); }}
              style={{
                padding: cel ? '11px 12px' : '8px 10px', minHeight: cel ? 44 : 36, boxSizing: 'border-box',
                cursor: 'pointer', borderBottom: `1px solid ${T.border}`, fontFamily: FB, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, color: T.text, overflowWrap: 'anywhere' }}>{i.nombre}</span>
              <span style={{ color: T.text3, fontSize: 12, flexShrink: 0 }}>{unidadCorta(i.unidad)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
