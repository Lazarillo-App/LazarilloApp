// src/componentes/AnthonyWidget.jsx
// Botón flotante de Anthony para páginas públicas (antes de ingresar) —
// mismo lugar/rol que suele ocupar un botón de WhatsApp. Por ahora solo
// deriva a soporte real por WhatsApp; más adelante esto se convierte en el
// chatbot de Anthony con preguntas/autorespuestas predefinidas.
//
// Se puede minimizar (el "–" sobre el botón): queda una pestañita pegada al borde derecho que no
// tapa datos, y al tocarla vuelve. Se recuerda por navegador (solo comodidad: sin storage,
// arranca visible).
import React, { useState } from 'react';
import { ANT } from '@/componentes/asistente/anthonyAssets';

// Número de soporte temporal — se reemplaza por el definitivo más adelante.
const SOPORTE_WHATSAPP = '541130211649';
const CLAVE_MINIMIZADO = 'lazarillo:anthony:minimizado';

function leerMinimizado() {
  try { return localStorage.getItem(CLAVE_MINIMIZADO) === '1'; } catch { return false; }
}
function guardarMinimizado(v) {
  try { if (v) localStorage.setItem(CLAVE_MINIMIZADO, '1'); else localStorage.removeItem(CLAVE_MINIMIZADO); } catch { /* sin storage: no se recuerda */ }
}

export default function AnthonyWidget() {
  const [open, setOpen] = useState(false);
  const [minimizado, setMinimizado] = useState(leerMinimizado);
  const minimizar = (v) => { setMinimizado(v); setOpen(false); guardarMinimizado(v); };
  // Logueado: ofrece volver al asistente de alta (Diego, 08/11), salvo si ya está en él.
  const logueado = (() => { try { return !!localStorage.getItem('token'); } catch { return false; } })();
  const enAsistente = typeof window !== 'undefined' && /^\/(alta|perfil)/.test(window.location.pathname);

  if (minimizado) {
    // Pestañita en el borde derecho: asoma la cabeza de Anthony.
    return (
      <button
        onClick={() => minimizar(false)}
        aria-label="Mostrar a Anthony"
        title="Mostrar a Anthony"
        style={{
          position: 'fixed', right: 0, bottom: 96, zIndex: 1400, width: 26, height: 52, padding: 0,
          border: 'none', borderRadius: '12px 0 0 12px', cursor: 'pointer', background: '#15213E',
          boxShadow: '-2px 4px 12px rgba(0,0,0,.25)', overflow: 'hidden', opacity: 0.85,
        }}
      >
        <img src={ANT.saluda} alt="" style={{ height: 40, width: 'auto', objectFit: 'cover', objectPosition: 'left', marginLeft: 2 }} />
      </button>
    );
  }

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
              {logueado
                ? '¡Hola! 👋 Soy Anthony. Si querés seguir cargando tu negocio, volvé al asistente. Si necesitás ayuda, escribinos por WhatsApp.'
                : '¡Hola! 👋 Soy Anthony. Si tenés dudas antes de registrarte o necesitás ayuda urgente, escribinos por WhatsApp.'}
            </p>
            {logueado && !enAsistente && (
              <a
                href="/alta"
                style={{
                  marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#15213E', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13.5,
                  borderRadius: 10, padding: '10px 14px',
                }}
              >
                ↩ Volver al asistente de alta
              </a>
            )}
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
      <div style={{ position: 'relative' }}>
      <button
        onClick={() => minimizar(true)}
        aria-label="Minimizar a Anthony"
        title="Minimizar"
        style={{
          position: 'absolute', top: -8, left: -8, zIndex: 1, width: 22, height: 22, borderRadius: '50%',
          border: '1px solid #e5e7eb', background: '#fff', color: '#475569', cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        –
      </button>
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
    </div>
  );
}
