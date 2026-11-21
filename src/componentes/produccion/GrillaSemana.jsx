// src/componentes/produccion/GrillaSemana.jsx
// La semana de producción: columnas = días (lun → dom), filas = turnos, personas o plazas según la
// vista. Cada celda tiene sus tareas; se arrastran a otra celda para reorganizar (cambia día y
// turno/persona/plaza) y el «+» programa ahí mismo. En el celular, un día por vez.
import React, { useMemo, useState } from 'react';
import { T, FT, FB } from '@/componentes/ui/temaDiego';
import { ESTADOS, fmtTandas, unidadCorta, iniciales, fmtMin, diaLargo, isoHoy } from './util';

export function TarjetaTarea({ t, onAbrir, arrastrable, mostrar = 'responsable', compacta }) {
  const e = ESTADOS[t.estado] || ESTADOS.pendiente;
  const secundario = mostrar === 'responsable' ? (t.responsable || 'Sin asignar') : mostrar === 'turno' ? (t.turno || 'Sin turno') : (t.plaza || '');
  return (
    <div draggable={arrastrable} onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', String(t.id)); ev.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => onAbrir(t)} title={t.titulo}
      style={{
        background: '#fff', border: `1px solid ${T.border}`, borderLeft: `4px solid ${e.color}`, borderRadius: 10,
        padding: compacta ? '6px 8px' : '8px 10px', cursor: 'pointer', boxShadow: T.sombraSuave, fontFamily: FB,
        opacity: t.estado === 'cancelada' ? 0.55 : 1,
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 12.5, color: T.text, lineHeight: 1.25,
          textDecoration: t.estado === 'cancelada' ? 'line-through' : 'none', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {t.titulo}
        </div>
        {t.tipo === 'produccion' && (
          <span style={{ fontFamily: FT, fontWeight: 800, fontSize: 13, color: T.ink }} title={`${t.tandas} tandas`}>×{fmtTandas(t.tandas)}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
        {mostrar === 'responsable' ? (
          <span title={secundario} style={{ width: 20, height: 20, borderRadius: 10, background: t.responsable ? T.card : '#fff', border: `1px ${t.responsable ? 'solid' : 'dashed'} ${T.border2}`,
            color: T.text2, fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {t.responsable ? iniciales(t.responsable) : '?'}
          </span>
        ) : secundario ? <span style={{ fontSize: 11, color: T.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{secundario}</span> : null}
        {t.estado !== 'pendiente' && <span style={{ fontSize: 10.5, fontWeight: 700, color: e.color }}>{t.corriendo ? '● ' : ''}{e.label}</span>}
        {t.rinde_esperado != null && t.estado === 'pendiente' && !compacta && (
          <span style={{ fontSize: 10.5, color: T.text3 }}>{Number(t.rinde_esperado).toLocaleString('es-AR', { maximumFractionDigits: 1 })} {unidadCorta(t.unidad)}</span>
        )}
        {t.minutos_estimados != null && t.estado === 'pendiente' && !compacta && <span style={{ fontSize: 10.5, color: T.text3 }}>⏱ {fmtMin(t.minutos_estimados)}</span>}
        <span style={{ flex: 1 }} />
        {t.cambios === 'pendiente' && <span title="Cambio de ingrediente esperando aprobación" style={{ fontSize: 11 }}>🔁</span>}
        {t.notas > 0 && <span title={`${t.notas} observaciones`} style={{ fontSize: 10.5, color: T.text3 }}>💬{t.notas}</span>}
      </div>
    </div>
  );
}

/**
 * filas: [{ key, label, sub? }]; claveDe(t) → key de fila; onMover(t, key, fecha); onNueva(key, fecha).
 */
export default function GrillaSemana({ dias, filas, tareas, claveDe, onAbrir, onMover, onNueva, puedeEditar, mostrar, cel }) {
  const hoy = isoHoy();
  const [diaCel, setDiaCel] = useState(() => (dias.includes(hoy) ? hoy : dias[0]));
  const [sobre, setSobre] = useState(null);
  const porCelda = useMemo(() => {
    const m = new Map();
    for (const t of tareas) {
      const k = `${claveDe(t)}|${t.fecha}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    return m;
  }, [tareas, claveDe]);

  const soltar = (ev, key, fecha) => {
    ev.preventDefault(); setSobre(null);
    const id = Number(ev.dataTransfer.getData('text/plain'));
    const t = tareas.find((x) => x.id === id);
    if (t && (claveDe(t) !== key || t.fecha !== fecha)) onMover(t, key, fecha);
  };

  const celda = (f, fecha) => {
    const lista = porCelda.get(`${f.key}|${fecha}`) || [];
    const k = `${f.key}|${fecha}`;
    return (
      <div key={k}
        onDragOver={puedeEditar ? (ev) => { ev.preventDefault(); if (sobre !== k) setSobre(k); } : undefined}
        onDragLeave={puedeEditar ? () => setSobre((s) => (s === k ? null : s)) : undefined}
        onDrop={puedeEditar ? (ev) => soltar(ev, f.key, fecha) : undefined}
        style={{ minHeight: 64, padding: 5, display: 'flex', flexDirection: 'column', gap: 5, borderRadius: 10,
          background: sobre === k ? '#DDF1FA' : fecha === hoy ? '#F5FBFE' : 'transparent', outline: sobre === k ? `2px dashed ${T.accent}` : 'none' }}>
        {lista.map((t) => <TarjetaTarea key={t.id} t={t} onAbrir={onAbrir} arrastrable={puedeEditar && t.estado !== 'hecha'} mostrar={mostrar} compacta={!cel} />)}
        {puedeEditar && (
          <button type="button" onClick={() => onNueva(f.key, fecha)} title="Programar acá"
            style={{ border: `1px dashed ${T.border2}`, background: 'transparent', color: T.text3, borderRadius: 8, minHeight: 26, cursor: 'pointer', fontSize: 14, fontFamily: FB }}>+</button>
        )}
      </div>
    );
  };

  if (cel) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6, marginBottom: 6 }}>
          {dias.map((d) => {
            const n = tareas.filter((t) => t.fecha === d && t.estado !== 'cancelada').length;
            return (
              <button key={d} type="button" onClick={() => setDiaCel(d)}
                style={{ flex: '1 1 0', minWidth: 0, padding: '6px 2px', borderRadius: 10, cursor: 'pointer', fontFamily: FB, fontSize: 11.5, fontWeight: 600,
                  background: d === diaCel ? T.ink : T.band, color: d === diaCel ? '#fff' : d === hoy ? T.accentTxt : T.text2, border: `1px solid ${d === diaCel ? T.ink : T.border}` }}>
                <div>{diaLargo(d).split(' ')[0]}</div>
                <div style={{ fontFamily: FT, fontSize: 14 }}>{Number(d.slice(8))}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{n || '·'}</div>
              </button>
            );
          })}
        </div>
        {filas.map((f) => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 13, color: T.text2, margin: '4px 2px' }}>{f.label}{f.sub && <span style={{ fontFamily: FB, fontWeight: 400, color: T.text3, fontSize: 11.5 }}> · {f.sub}</span>}</div>
            {celda(f, diaCel)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `130px repeat(7, minmax(128px, 1fr))`, minWidth: 130 + 7 * 128, gap: 0 }}>
        <div />
        {dias.map((d) => (
          <div key={d} style={{ padding: '6px 6px 8px', fontFamily: FT, fontWeight: 700, fontSize: 12.5, color: d === hoy ? T.accentTxt : T.text2, textAlign: 'center' }}>
            {diaLargo(d)}{d === hoy && <span style={{ fontFamily: FB, fontWeight: 600, fontSize: 10.5 }}> · hoy</span>}
          </div>
        ))}
        {filas.map((f) => (
          <React.Fragment key={f.key}>
            <div style={{ padding: '10px 8px', borderTop: `1px solid ${T.border}`, fontFamily: FT, fontWeight: 700, fontSize: 12.5, color: T.text }}>
              {f.label}
              {f.sub && <div style={{ fontFamily: FB, fontWeight: 400, fontSize: 11, color: T.text3, marginTop: 2 }}>{f.sub}</div>}
            </div>
            {dias.map((d) => <div key={d} style={{ borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>{celda(f, d)}</div>)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
