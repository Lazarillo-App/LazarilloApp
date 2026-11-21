// src/componentes/produccion/BuscarInsumo.jsx — elegir un insumo de la lista del negocio.
import React, { useEffect, useState } from 'react';
import { T, FB } from '@/componentes/ui/temaDiego';
import { ProduccionAPI } from '@/servicios/apiProduccion';
import { Boton, Entrada } from './ui';
import { unidadCorta } from './util';

/** Elegir un insumo de la lista (para cambiar la receta tiene que ser uno real, con su costo). */
export default function BuscarInsumo({ businessId, valor, onElegir, obligatorio }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (valor || q.trim().length < 2) { setRes([]); return undefined; }
    const h = setTimeout(async () => {
      try { const r = await ProduccionAPI.buscarInsumos(businessId, q.trim()); setRes(r.items || []); } catch { setRes([]); }
    }, 250);
    return () => clearTimeout(h);
  }, [q, valor, businessId]);
  if (valor) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${T.border2}`, borderRadius: 10, background: T.head, fontFamily: FB }}>
        <span style={{ flex: 1, fontWeight: 600, color: T.text }}>{valor.nombre}</span>
        <Boton chico onClick={() => { onElegir(null); setQ(''); }}>Cambiar</Boton>
      </div>
    );
  }
  return (
    <div>
      <Entrada autoFocus value={q} onChange={(e) => { setQ(e.target.value); if (!obligatorio) onElegir({ id: null, nombre: e.target.value }); }}
        placeholder={obligatorio ? 'Buscá el insumo…' : 'Buscá el insumo o escribí el nombre'} />
      {res.length > 0 && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
          {res.map((i) => (
            <div key={i.id} onClick={() => { onElegir(i); setRes([]); }}
              style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`, fontFamily: FB, fontSize: 13.5, display: 'flex', gap: 8 }}>
              <span style={{ flex: 1, color: T.text }}>{i.nombre}</span><span style={{ color: T.text3, fontSize: 12 }}>{unidadCorta(i.unidad)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
