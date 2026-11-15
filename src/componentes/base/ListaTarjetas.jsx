// src/componentes/base/ListaTarjetas.jsx
// Tabla ancha → tarjetas en el celular (regla «Vista celular» de la Guía, Diego 15/11/2026).
// Cada página decide QUÉ muestra cada tarjeta; esto decide CÓMO se acomoda:
//   · arriba: título (y debajo un subtítulo chico) y, a la derecha, una marca (chip, estado);
//   · una fila de hasta 3 datos principales, del mismo ancho;
//   · el resto de los datos aparece al tocar la tarjeta (el detalle al tocar), en dos columnas.
// Props:
//   filas, clave(f) → id único
//   titulo(f), subtitulo(f)?, marca(f)?
//   datos: [{ l: 'Compras', v: (f) => …, color?: (f) => css }]  → los 3 primeros van siempre a la vista
//   pie?: nodo al final de la lista (ej. «Ver 500 más»)
//   vacio?: texto cuando no hay filas
import React, { useState } from 'react';

const C = { txt: '#15213E', txt2: '#5b6577', txt3: '#8a93a3', line: 'rgba(21,33,62,.12)', line2: 'rgba(21,33,62,.07)', celeste: '#5BC2EA' };

export default function ListaTarjetas({ filas, clave, titulo, subtitulo, marca, datos = [], pie, vacio = 'No hay nada para mostrar.' }) {
  const [abierta, setAbierta] = useState(null);
  const principales = datos.slice(0, 3);
  const resto = datos.slice(3);
  if (!filas.length) return <div style={{ padding: 16, fontSize: 13, color: C.txt3, textAlign: 'center' }}>{vacio}</div>;
  return (
    <div style={{ display: 'grid', gap: 8, padding: 8 }}>
      {filas.map((f) => {
        const id = clave(f);
        const abierto = abierta === id;
        return (
          <div key={id} role="button" tabIndex={0} aria-expanded={resto.length ? abierto : undefined}
            onClick={() => resto.length && setAbierta(abierto ? null : id)}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && resto.length) { e.preventDefault(); setAbierta(abierto ? null : id); } }}
            style={{
              background: '#fff', border: `1px solid ${abierto ? C.celeste : C.line}`, borderRadius: 12, padding: '12px 14px',
              cursor: resto.length ? 'pointer' : 'default', minWidth: 0, outline: 'none',
            }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: C.txt, overflowWrap: 'anywhere' }}>{titulo(f)}</div>
                {subtitulo && subtitulo(f) && (
                  <div style={{ fontSize: 12.5, color: C.txt3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitulo(f)}</div>
                )}
              </div>
              {marca && <div style={{ flexShrink: 0 }}>{marca(f)}</div>}
            </div>
            {principales.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${principales.length}, minmax(0, 1fr))`, gap: 8, marginTop: 10 }}>
                {principales.map((d) => (
                  <div key={d.l} style={{ minWidth: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: C.txt3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.l}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2, color: d.color ? d.color(f) : C.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.v(f)}</div>
                  </div>
                ))}
              </div>
            )}
            {abierto && resto.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line2}` }}>
                {resto.map((d) => (
                  <div key={d.l} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.txt3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{d.l}</div>
                    <div style={{ fontSize: 13.5, marginTop: 1, color: d.color ? d.color(f) : C.txt2, overflowWrap: 'anywhere' }}>{d.v(f)}</div>
                  </div>
                ))}
              </div>
            )}
            {resto.length > 0 && !abierto && (
              <div style={{ fontSize: 11.5, color: C.txt3, textAlign: 'center', marginTop: 8 }}>Tocá para ver más</div>
            )}
          </div>
        );
      })}
      {pie}
    </div>
  );
}
