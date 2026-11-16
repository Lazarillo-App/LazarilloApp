// Menú de columna estilo Excel (ordenar en los dos sentidos y filtrar), para tablas de datos crudos.
// Diego 15/11/2026: «los títulos de la tabla tienen que poder ordenarse en ambos sentidos y filtrarse».
// Mismo diseño que el de Clientes. Tipos de filtro por columna: 'texto' (contiene), 'num' (desde/hasta),
// 'fecha' (desde/hasta) y 'lista' (tildar valores, con cuántos hay de cada uno).
import React, { useMemo, useState } from 'react';
import { filtroActivo } from './filtrosColumna';

const T = { txt: '#15213E', txt3: '#8A93A3', line: '#E3E7EE', rojo: '#C2410C' };

/**
 * El menú, abierto debajo del título (pos = { x, y } ya dividido por el zoom de #root).
 * valores: para 'lista', los [valor, cantidad] posibles (los arma quien llama, sobre las filas sin ese filtro).
 */
export default function MenuColumna({ col, pos, valores = [], filtro, onFiltro, onOrden, onCerrar }) {
  const [busca, setBusca] = useState('');
  const f = filtro || {};
  const campo = { fontFamily: 'inherit', fontSize: 13, height: 32, boxSizing: 'border-box', padding: '0 8px', borderRadius: 6, border: '1px solid rgba(21,33,62,.18)', width: '100%' };
  const fila = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 6, background: 'none', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit', color: T.txt };
  const elegidos = f.valores ? new Set(f.valores) : null;
  const alternar = (v) => {
    const set = new Set(elegidos || valores.map(([x]) => x));
    if (set.has(v)) set.delete(v); else set.add(v);
    onFiltro(set.size === valores.length ? null : { valores: [...set] });
  };
  const visibles = useMemo(() => valores.filter(([v]) => !busca || String(v).toLowerCase().includes(busca.toLowerCase())), [valores, busca]);
  const az = col.f === 'num' || col.f === 'fecha' ? ['Menor a mayor', 'Mayor a menor'] : ['A → Z', 'Z → A'];
  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 1300 }} />
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 1301, width: 260, background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: '0 10px 30px rgba(21,33,62,.18)', padding: 6, fontFamily: "'Archivo', system-ui, sans-serif", color: T.txt, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
        <button type="button" style={fila} onClick={() => onOrden(true)}>↑ {az[0]}</button>
        <button type="button" style={fila} onClick={() => onOrden(false)}>↓ {az[1]}</button>
        <div style={{ height: 1, background: T.line, margin: '6px 4px' }} />
        <div style={{ padding: '2px 10px 6px', fontSize: 11.5, fontWeight: 700, color: T.txt3, textTransform: 'uppercase', letterSpacing: '.4px' }}>Filtrar {col.l}</div>
        <div style={{ padding: '0 10px 8px' }}>
          {col.f === 'texto' && (
            <input autoFocus type="search" value={f.texto || ''} placeholder="Contiene…" style={campo}
              onChange={(e) => onFiltro(e.target.value ? { texto: e.target.value } : null)} />
          )}
          {col.f === 'num' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" value={f.min ?? ''} placeholder="Desde" style={campo} onChange={(e) => onFiltro({ ...f, min: e.target.value })} />
              <span style={{ color: T.txt3 }}>a</span>
              <input type="number" value={f.max ?? ''} placeholder="Hasta" style={campo} onChange={(e) => onFiltro({ ...f, max: e.target.value })} />
            </div>
          )}
          {col.f === 'fecha' && (
            <div style={{ display: 'grid', gap: 6 }}>
              <input type="date" value={f.desde || ''} style={campo} onChange={(e) => onFiltro({ ...f, desde: e.target.value })} />
              <input type="date" value={f.hasta || ''} style={campo} onChange={(e) => onFiltro({ ...f, hasta: e.target.value })} />
            </div>
          )}
          {col.f === 'lista' && (
            <>
              {valores.length > 8 && <input type="search" value={busca} placeholder="Buscar…" style={{ ...campo, marginBottom: 6 }} onChange={(e) => setBusca(e.target.value)} />}
              <label style={{ ...fila, padding: '4px 2px', fontWeight: 700 }}>
                <input type="checkbox" checked={!elegidos} onChange={() => onFiltro(elegidos ? null : { valores: [] })} />
                (Seleccionar todo)
              </label>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {visibles.map(([v, n, etiqueta]) => (
                  <label key={v} style={{ ...fila, padding: '4px 2px' }}>
                    <input type="checkbox" checked={!elegidos || elegidos.has(v)} onChange={() => alternar(v)} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etiqueta || v || '(vacío)'}</span>
                    <span style={{ color: T.txt3, fontSize: 12 }}>{n.toLocaleString('es-AR')}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        {filtroActivo(filtro) && (
          <button type="button" style={{ ...fila, color: T.rojo }} onClick={() => { onFiltro(null); onCerrar(); }}>✕ Quitar filtro de {col.l}</button>
        )}
      </div>
    </>
  );
}
