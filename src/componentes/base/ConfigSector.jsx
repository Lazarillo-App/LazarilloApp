// src/componentes/base/ConfigSector.jsx
// Configuración del sector (Diego 19/11/2026, regla de la Guía): dentro de un sector, la ⚙ del header
// abre un mini panel con la configuración de ESE sector solamente y, abajo, «Ver todas las
// configuraciones». Las opciones del sector no ocupan lugar en su pantalla.
//
// Uso: la página monta <ConfigSector titulo="Conciliación">…campos…</ConfigSector>. Mientras está
// montado, el Navbar ve [data-config-sector] y la ⚙ abre este panel (evento «lz:config-sector») en
// vez de ir a /configuracion. Sin el componente, la ⚙ sigue yendo a Configuración como siempre.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCelular from './useCelular';

export const EVENTO_CONFIG_SECTOR = 'lz:config-sector';

export default function ConfigSector({ titulo, children, rutaTodas = '/configuracion' }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const celular = useCelular();
  useEffect(() => {
    const abrir = () => setAbierto((v) => !v);
    window.addEventListener(EVENTO_CONFIG_SECTOR, abrir);
    return () => window.removeEventListener(EVENTO_CONFIG_SECTOR, abrir);
  }, []);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('[data-tour="hdr-config"]')) setAbierto(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', esc); };
  }, [abierto]);
  // La ⚙ queda arriba a la derecha: el panel se abre justo debajo del header.
  const top = (() => {
    const h = document.querySelector('header, .MuiAppBar-root');
    return h ? Math.round(h.getBoundingClientRect().bottom) + 8 : 72;
  })();
  return (
    <>
      <span data-config-sector hidden />
      {abierto && (
        <div ref={ref} role="dialog" aria-label={`Configuración de ${titulo}`}
          style={{
            position: 'fixed', zIndex: 1300, top, right: celular ? 8 : 16, left: celular ? 8 : 'auto',
            width: celular ? 'auto' : 380, maxHeight: `calc(100vh - ${top + 16}px)`, overflowY: 'auto',
            background: '#fff', borderRadius: 14, boxShadow: '0 16px 44px rgba(21,33,62,.28)', border: '1px solid rgba(21,33,62,.10)',
            fontFamily: "'Archivo',sans-serif", color: '#15213E',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 10px', borderBottom: '1px solid rgba(21,33,62,.08)' }}>
            <span style={{ fontSize: 16 }} aria-hidden>⚙</span>
            <span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14 }}>Configuración · {titulo}</span>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar"
              style={{ width: 32, height: 32, border: 'none', background: 'transparent', fontSize: 18, color: '#8a93a3', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '12px 16px' }}>{typeof children === 'function' ? children({ cerrar: () => setAbierto(false) }) : children}</div>
          <button type="button" onClick={() => { setAbierto(false); navigate(rutaTodas); }}
            style={{ display: 'block', width: '100%', minHeight: 44, border: 'none', borderTop: '1px solid rgba(21,33,62,.08)', background: '#F7F9FB', color: '#2492C8', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer', borderRadius: '0 0 14px 14px' }}>
            Ver todas las configuraciones →
          </button>
        </div>
      )}
    </>
  );
}
