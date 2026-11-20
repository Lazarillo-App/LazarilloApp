// src/componentes/base/ListaCelular.jsx
// Lista de 3 columnas para el celular (Diego 20/11/2026: «más simple, 3 columnas con nombre, costo y %,
// y un selector que cambie a precio»). La usan Artículos e Insumos; cada página decide qué va en cada
// columna, esto decide cómo se ve:
//   · selector (segmentado) que elige qué muestra la columna del medio;
//   · encabezado: NOMBRE · <columna del medio> · <columna %>;
//   · filas de 56px: nombre (2 renglones como mucho, con un subtítulo gris), valor y % con una
//     línea chica debajo (objetivo, «del rubro»…). Tocar la fila abre el detalle (onClick de la fila).
// Props:
//   modos: [{ id, label }], modo, onModo
//   columnas: { medio: 'COSTO', pct: 'COSTO %' }
//   filas: [{ key, nombre, sub?, medio, pct, pctSub?, pctColor?, onClick? }]
//   arriba?: nodo encima del selector (filtros)   ·   pie?: nodo al final   ·   vacio?: texto
import React from 'react';

const C = { txt: '#15213E', txt2: '#5b6577', txt3: '#8a93a3', line: 'rgba(21,33,62,.08)', celeste: '#2492C8' };

export default function ListaCelular({ modos = [], modo, onModo, columnas = {}, filas = [], arriba, pie, vacio = 'No hay nada para mostrar.' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 10px 88px', minWidth: 0 }}>
      {arriba}
      {modos.length > 1 && (
        <div role="tablist" style={{ display: 'flex', background: '#e8eef1', borderRadius: 12, padding: 3 }}>
          {modos.map((m) => {
            const on = m.id === modo;
            return (
              <button key={m.id} type="button" role="tab" aria-selected={on} onClick={() => onModo?.(m.id)}
                style={{
                  flex: 1, height: 38, border: 0, borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: on ? '#fff' : 'transparent', color: on ? C.celeste : C.txt2,
                  boxShadow: on ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
                }}>
                {m.label}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.line}` }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px 68px', alignItems: 'center', padding: '0 12px',
          height: 32, fontSize: 10, fontWeight: 800, letterSpacing: '.05em', color: C.txt3, background: '#fafcfd',
          borderBottom: `1px solid ${C.line}`,
        }}>
          <div>NOMBRE</div>
          <div style={{ textAlign: 'right' }}>{columnas.medio}</div>
          <div style={{ textAlign: 'right' }}>{columnas.pct}</div>
        </div>
        {filas.length === 0 && <div style={{ padding: 16, fontSize: 13, color: C.txt3, textAlign: 'center' }}>{vacio}</div>}
        {filas.map((f) => (
          <div key={f.key} role={f.onClick ? 'button' : undefined} tabIndex={f.onClick ? 0 : undefined}
            onClick={f.onClick}
            onKeyDown={(e) => { if (f.onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); f.onClick(); } }}
            style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px 68px', alignItems: 'center', padding: '0 12px',
              minHeight: 56, borderBottom: `1px solid ${C.line}`, cursor: f.onClick ? 'pointer' : 'default',
            }}>
            <div style={{ minWidth: 0, paddingRight: 6 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, lineHeight: 1.2, color: C.txt, overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere',
              }}>{f.nombre}</div>
              {f.sub && <div style={{ fontSize: 11, color: C.txt3, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.sub}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, color: C.txt, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{f.medio}</div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: f.pctColor || C.txt, fontVariantNumeric: 'tabular-nums' }}>{f.pct}</div>
              {f.pctSub && <div style={{ fontSize: 10, fontWeight: 600, color: C.txt3 }}>{f.pctSub}</div>}
            </div>
          </div>
        ))}
      </div>
      {pie}
    </div>
  );
}
