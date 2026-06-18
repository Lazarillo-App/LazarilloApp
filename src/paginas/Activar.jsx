/* eslint-disable no-empty */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AccessAPI } from '../servicios/apiAccess';
import LOGO from '@/assets/brand/logo-light.png';
import ANTHONY from '@/assets/brand/anthony.png';

const BRAND = {
  azulNoche:       '#12111F',
  tinta:           '#15213E',
  celeste:         '#5BC2EA',
  celesteProfundo: '#2492C8',
  paper:           '#F2F4F7',
};

export default function Activar() {
  const nav = useNavigate();
  const [code,    setCode]    = useState('');
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');
  const [success, setSuccess] = useState(false);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setErr('');
    setBusy(true);
    try {
      const res = await AccessAPI.redeemCode(code.trim().toUpperCase());
      if (res?.ok) {
        // Actualizar account_status en localStorage y refrescar AuthContext
        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          user.account_status = res.account_status || 'trial';
          localStorage.setItem('user', JSON.stringify(user));
          // Limpiar tema cacheado para que use los defaults de Lazarillo
          localStorage.removeItem('bizTheme:current');
          // Notificar al AuthContext para que actualice el estado en memoria
          window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
        } catch {}
        setSuccess(true);
        setTimeout(() => nav('/perfil', { replace: true }), 1800);
      }
    } catch (e2) {
      const msg = e2?.message || '';
      if (msg.includes('invalid') || msg.includes('not_found')) {
        setErr('El código no es válido o ya fue usado.');
      } else if (msg.includes('expired')) {
        setErr('Este código ya venció.');
      } else {
        setErr('Error al validar el código. Intentá de nuevo.');
      }
    }
    setBusy(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: BRAND.azulNoche,
      display: 'flex',
      fontFamily: "'Archivo', system-ui, sans-serif",
    }}>

      {/* ── Panel izquierdo ── */}
      <div style={{
        width: 420, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        padding: '40px 36px',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
        className="activar-aside"
      >
        {/* Logo */}
        <Link to="/">
          <img src={LOGO} alt="Lazarillo" style={{ height: 32, marginBottom: 40 }} />
        </Link>

        {/* Anthony */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <img
            src={ANTHONY}
            alt="Anthony"
            style={{ width: 160, filter: 'drop-shadow(0 16px 40px rgba(0,0,0,0.5))' }}
          />
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              margin: '0 0 10px',
              fontFamily: "'Sora', system-ui, sans-serif",
              fontSize: 24, fontWeight: 700, color: '#fff',
            }}>
              ¡Ya casi estás!
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Activá tu cuenta para empezar a gestionar<br />
              tu restaurante con Lazarillo.
            </p>
          </div>
        </div>

        {/* Contacto */}
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
          ¿Problemas?{' '}
          <a href="mailto:hola@lazarillo.app" style={{ color: BRAND.celeste, textDecoration: 'none' }}>
            hola@lazarillo.app
          </a>
        </p>
      </div>

      {/* ── Panel derecho ── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {success ? (
            /* ── Estado de éxito ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{
                margin: '0 0 10px',
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: 26, fontWeight: 700, color: '#fff',
              }}>
                ¡Cuenta activada!
              </h2>
              <p style={{ margin: '0 0 8px', fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
                Te estamos redirigiendo a tu perfil…
              </p>
              <div style={{
                width: 48, height: 4, background: BRAND.celeste,
                borderRadius: 2, margin: '20px auto 0',
                animation: 'progress 1.8s linear forwards',
              }} />
            </div>
          ) : (
            /* ── Formulario ── */
            <>
              <h1 style={{
                margin: '0 0 6px',
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: 28, fontWeight: 700, color: '#fff',
              }}>
                Activá tu cuenta
              </h1>
              <p style={{ margin: '0 0 36px', fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
                Elegí cómo querés comenzar.
              </p>

              {/* ── Bloque MercadoPago (próximamente) ── */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '24px 22px',
                marginBottom: 24,
                opacity: 0.6,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: -10, right: 16,
                  background: BRAND.celeste, color: BRAND.tinta,
                  fontSize: 10, fontWeight: 700, padding: '3px 10px',
                  borderRadius: 20, letterSpacing: '0.5px',
                }}>
                  PRÓXIMAMENTE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: '#009ee3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 20 }}>💳</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#fff' }}>Suscripción mensual</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Pago seguro con MercadoPago</p>
                  </div>
                </div>
                <button
                  disabled
                  style={{
                    width: '100%', padding: '13px',
                    background: '#009ee3', color: '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: 15, fontWeight: 700,
                    cursor: 'not-allowed', opacity: 0.5,
                    fontFamily: "'Archivo', system-ui, sans-serif",
                  }}
                >
                  Suscribirse con MercadoPago
                </button>
              </div>

              {/* ── Divisor ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                  ¿Tenés un código de acceso?
                </span>
                <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
              </div>

              {/* ── Formulario cupón ── */}
              <form onSubmit={handleRedeem} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase()); setErr(''); }}
                  placeholder="Ej: LAZ-ABCD1234"
                  disabled={busy}
                  style={{
                    width: '100%', padding: '14px 16px',
                    background: 'rgba(255,255,255,0.07)',
                    border: err ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, fontSize: 16,
                    color: '#fff', fontFamily: 'monospace',
                    fontWeight: 700, letterSpacing: '0.1em',
                    outline: 'none', boxSizing: 'border-box',
                    textTransform: 'uppercase',
                  }}
                />

                {err && (
                  <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>{err}</p>
                )}

                <button
                  type="submit"
                  disabled={busy || !code.trim()}
                  style={{
                    width: '100%', padding: '14px',
                    background: code.trim() && !busy ? BRAND.celesteProfundo : 'rgba(255,255,255,0.1)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: 15, fontWeight: 700, cursor: code.trim() ? 'pointer' : 'default',
                    fontFamily: "'Archivo', system-ui, sans-serif",
                    transition: 'background 0.2s',
                  }}
                >
                  {busy ? 'Validando…' : 'Activar con código'}
                </button>
              </form>

              {/* Footer */}
              <p style={{ marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                ¿Querés salir?{' '}
                <button
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.dispatchEvent(new Event('auth:logout'));
                    window.location.href = '/login';
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}
                >
                  Cerrar sesión
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Archivo:wght@300;400;600&display=swap');
        @keyframes progress {
          from { width: 0; }
          to   { width: 100%; }
        }
        @media (max-width: 768px) {
          .activar-aside { display: none !important; }
        }
      `}</style>
    </div>
  );
}