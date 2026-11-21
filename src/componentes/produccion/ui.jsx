// src/componentes/produccion/ui.jsx — piezas chicas con el tema de Diego (temaDiego).
import React, { useEffect } from 'react';
import { T, FT, FB } from '@/componentes/ui/temaDiego';

export function Boton({ children, onClick, activo, primario, peligro, deshabilitado, title, chico, style, type = 'button' }) {
  const fondo = primario ? T.ink : activo ? T.ink : T.band;
  const color = primario || activo ? '#fff' : peligro ? T.bad : T.text;
  return (
    <button type={type} title={title} disabled={deshabilitado} onClick={deshabilitado ? undefined : onClick}
      style={{
        fontFamily: FB, fontWeight: 600, fontSize: chico ? 12 : 13, lineHeight: 1, whiteSpace: 'nowrap',
        padding: chico ? '6px 9px' : '9px 13px', minHeight: chico ? 28 : 36, borderRadius: 10, cursor: deshabilitado ? 'default' : 'pointer',
        background: fondo, color, border: `1px solid ${primario || activo ? T.ink : peligro ? '#F0C9C9' : T.border2}`,
        opacity: deshabilitado ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...style,
      }}>
      {children}
    </button>
  );
}

export function Pastilla({ children, color = T.text2, fondo = T.card, style, title }) {
  return (
    <span title={title} style={{ fontFamily: FB, fontWeight: 600, fontSize: 11, color, background: fondo, borderRadius: 999,
      padding: '3px 8px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>{children}</span>
  );
}

export function Titulo({ children, chico, style }) {
  return <div style={{ fontFamily: FT, fontWeight: 700, fontSize: chico ? 14 : 18, color: T.text, ...style }}>{children}</div>;
}
export function Texto({ children, sutil, style }) {
  return <div style={{ fontFamily: FB, fontSize: 13, color: sutil ? T.text3 : T.text2, ...style }}>{children}</div>;
}

/** Modal centrado; en el celular ocupa toda la pantalla. */
export function Modal({ abierto, onCerrar, titulo, children, pie, ancho = 560, cel }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const f = (e) => { if (e.key === 'Escape') onCerrar?.(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div onMouseDown={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 1300, display: 'flex', alignItems: cel ? 'stretch' : 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{
        width: cel ? '100%' : ancho, maxWidth: cel ? '100%' : '94vw', maxHeight: cel ? '100%' : '90vh', background: T.band,
        borderRadius: cel ? 0 : 16, boxShadow: T.sombra, border: cel ? 'none' : `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>{typeof titulo === 'string' ? <Titulo chico={cel}>{titulo}</Titulo> : titulo}</div>
          <span onClick={onCerrar} role="button" aria-label="Cerrar" style={{ cursor: 'pointer', color: T.text3, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</span>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>{children}</div>
        {pie && <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{pie}</div>}
      </div>
    </div>
  );
}

export function Campo({ label, children, ayuda, style }) {
  return (
    // div y no label: dentro de un label, el navegador reenvía cada clic al primer botón o campo
    // (tocar «2» tandas terminaba en «½», y no se podía elegir de una lista).
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontFamily: FB, ...style }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>{label}</span>
      {children}
      {ayuda && <span style={{ fontSize: 11.5, color: T.text3 }}>{ayuda}</span>}
    </div>
  );
}
const estiloInput = {
  fontFamily: FB, fontSize: 14, color: T.text, background: '#fff', border: `1px solid ${T.border2}`, borderRadius: 10,
  padding: '9px 11px', minHeight: 38, boxSizing: 'border-box', width: '100%', outline: 'none',
};
export function Entrada(props) { return <input {...props} style={{ ...estiloInput, ...props.style }} />; }
export function Selector({ value, onChange, opciones, vacio, style }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ ...estiloInput, ...style }}>
      {vacio != null && <option value="">{vacio}</option>}
      {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Vacio({ emoji = '🍳', titulo, children }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 16px', color: T.text3, fontFamily: FB }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>{emoji}</div>
      {titulo && <div style={{ fontFamily: FT, fontWeight: 700, color: T.text2, fontSize: 15, marginBottom: 4 }}>{titulo}</div>}
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}
