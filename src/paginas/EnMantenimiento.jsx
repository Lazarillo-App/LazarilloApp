/* eslint-disable no-empty */
import React, { useEffect, useState } from 'react';

export default function EnMantenimiento() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('mantenimiento_info');
      if (raw) setMessage(JSON.parse(raw)?.message || null);
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
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛠️</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#15213E' }}>
          Lazarillo está en mantenimiento
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
          {message || 'Estamos haciendo algunos ajustes. Volvé a intentarlo en unos minutos.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 20, background: '#2492C8', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
