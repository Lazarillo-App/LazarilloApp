/* eslint-disable no-empty */
import React, { useEffect, useState } from 'react';

export default function NegocioPausado() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('negocio_pausado_info');
      if (raw) setInfo(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F2F4F7', fontFamily: "'Archivo', system-ui, sans-serif", padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px', maxWidth: 420,
        textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏸️</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#15213E' }}>
          Este negocio está pausado
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
          No se puede usar por el momento, pero ningún dato se perdió. Contactá a
          soporte para reactivarlo.
        </p>
        {info?.paused_reason && (
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
            Motivo: {info.paused_reason}
          </p>
        )}
        <button
          onClick={() => { window.location.href = '/login'; }}
          style={{
            marginTop: 20, background: '#2492C8', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Volver al login
        </button>
      </div>
    </div>
  );
}
