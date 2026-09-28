// src/componentes/AnthonyWidget.jsx
// Botón flotante de Anthony para páginas públicas (antes de ingresar) —
// mismo lugar/rol que suele ocupar un botón de WhatsApp. Por ahora solo
// deriva a soporte real por WhatsApp; más adelante esto se convierte en el
// chatbot de Anthony con preguntas/autorespuestas predefinidas.
import React, { useState } from 'react';
import { ANT } from '@/componentes/asistente/anthonyAssets';

// Número de soporte temporal — se reemplaza por el definitivo más adelante.
const SOPORTE_WHATSAPP = '541130211649';

export default function AnthonyWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1400, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      {open && (
        <div style={{
          width: 280, background: '#fff', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,.28)',
          border: '1px solid #e5e7eb', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#15213E' }}>
            <img src={ANT.saluda} alt="Anthony" style={{ height: 42, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ color: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Anthony</div>
              <div style={{ fontSize: 11, opacity: .75 }}>Asistente de Lazarillo</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>
              ¡Hola! 👋 Soy Anthony. Si tenés dudas antes de registrarte o necesitás ayuda urgente, escribinos por WhatsApp.
            </p>
            <a
              href={`https://wa.me/${SOPORTE_WHATSAPP}`}
              target="_blank"
              rel="noreferrer"
              style={{
                marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13.5,
                borderRadius: 10, padding: '10px 14px',
              }}
            >
              💬 Hablar por WhatsApp
            </a>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar chat de ayuda' : 'Abrir chat de ayuda'}
        style={{
          width: 64, height: 64, borderRadius: 20, border: 'none', cursor: 'pointer',
          background: '#15213E', boxShadow: '0 6px 20px rgba(0,0,0,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, overflow: 'hidden',
        }}
      >
        <img src={ANT.saluda} alt="" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
      </button>
    </div>
  );
}
