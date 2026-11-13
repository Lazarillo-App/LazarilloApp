// src/componentes/soporte/AvisoAjuste.jsx
// Ajuste a medida "aviso_cliente" (13/11/2026): un mensaje del equipo para este cliente, negocio u
// organización (o para todos). Se muestra como un cartel arriba al centro que no corre la pantalla;
// al cerrarlo no vuelve a aparecer hasta que cambie el texto (se recuerda en el navegador).
import React, { useState } from 'react';
import { useAjuste } from '@/hooks/useAjustes';
import { ANT } from '@/componentes/asistente/anthonyAssets';

const CLAVE = 'lazarillo:aviso-cerrado';
const leido = () => { try { return localStorage.getItem(CLAVE) || ''; } catch { return ''; } };

export default function AvisoAjuste() {
  const texto = useAjuste('aviso_cliente', '');
  const [cerrado, setCerrado] = useState(leido);
  const t = typeof texto === 'string' ? texto.trim() : '';
  if (!t || cerrado === t) return null;
  const cerrar = () => { setCerrado(t); try { localStorage.setItem(CLAVE, t); } catch { /* sin storage */ } };
  return (
    <div role="status" style={{
      position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 1300,
      width: 'min(640px, calc(100vw - 32px))', display: 'flex', alignItems: 'center', gap: 10,
      background: '#15213E', color: '#fff', borderRadius: 12, padding: '8px 10px 8px 8px',
      boxShadow: '0 8px 28px rgba(0,0,0,.25)', fontFamily: "'Archivo', system-ui, sans-serif",
    }}>
      <img src={ANT.saluda} alt="" style={{ height: 34, width: 'auto', flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{t}</div>
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso"
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
    </div>
  );
}
