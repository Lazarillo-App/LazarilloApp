// src/paginas/CuentaInactiva.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AccessAPI } from '../servicios/apiAccess';

const STATUS_LABELS = {
  pending:   { title: '¡Bienvenido a Lazarillo!',     icon: '👋', color: '#3b82f6' },
  expired:   { title: 'Tu período de prueba venció',   icon: '⏰', color: '#f59e0b' },
  suspended: { title: 'Cuenta suspendida',             icon: '🔒', color: '#ef4444' },
};

const STATUS_MSG = {
  pending:   'Tu cuenta está lista pero necesita activación. Ingresá el código que recibiste para comenzar tu período de prueba.',
  expired:   'Tu período de acceso llegó a su fin. Ingresá un código de renovación o contactanos para continuar.',
  suspended: 'Tu cuenta fue suspendida. Contactanos para más información.',
};

export default function CuentaInactiva() {
  const { user, logout } = useAuth();
  const status = user?.account_status || 'pending';
  const info   = STATUS_LABELS[status] || STATUS_LABELS.pending;

  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await AccessAPI.redeemCode(code.trim());
      if (res?.ok) {
        setSuccess(true);
        // Actualizar user en localStorage y recargar
        const prev = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
          ...prev,
          account_status: res.account_status,
          trial_ends_at: res.granted_until,
        }));
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setError(friendlyError(res?.error));
      }
    } catch (e) {
      setError(friendlyError(e?.message));
    } finally {
      setLoading(false);
    }
  };

  function friendlyError(err) {
    if (!err) return 'Ocurrió un error. Intentá de nuevo.';
    if (err.includes('invalid_or_expired')) return 'El código no es válido o ya expiró.';
    if (err.includes('already_used'))       return 'Este código ya fue utilizado.';
    return 'Ocurrió un error. Verificá el código e intentá de nuevo.';
  }

  const tc = info.color;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: '#fff', borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${tc}15 0%, ${tc}08 100%)`,
          borderBottom: `3px solid ${tc}30`,
          padding: '32px 32px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{info.icon}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', borderRadius: 20, padding: '4px 12px',
            marginBottom: 12,
            border: `1px solid ${tc}30`,
          }}>
            <img src="/logo.png" alt="Lazarillo" style={{ height: 20 }} onError={e => e.target.style.display='none'} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: tc, letterSpacing: '0.05em' }}>
              LAZARILLO
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.3 }}>
            {info.title}
          </h1>
          {user?.name && (
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Hola, <strong>{user.name}</strong> 👋
            </p>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px 32px' }}>
          <p style={{ margin: '0 0 24px', color: '#475569', fontSize: '0.92rem', lineHeight: 1.6, textAlign: 'center' }}>
            {STATUS_MSG[status]}
          </p>

          {/* Formulario de cupón — solo si no es suspended */}
          {status !== 'suspended' && !success && (
            <form onSubmit={handleRedeem}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Código de acceso
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="LAZ-XXXXXXXX"
                  disabled={loading}
                  style={{
                    flex: 1, padding: '12px 14px', fontSize: '1rem',
                    fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'monospace',
                    border: `2px solid ${error ? '#ef4444' : '#e2e8f0'}`,
                    borderRadius: 10, outline: 'none',
                    transition: 'border-color 0.15s',
                    background: loading ? '#f8fafc' : '#fff',
                  }}
                  onFocus={e => { e.target.style.borderColor = tc; setError(''); }}
                  onBlur={e => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
                />
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  style={{
                    padding: '12px 20px', borderRadius: 10, border: 'none',
                    background: loading || !code.trim() ? '#e2e8f0' : tc,
                    color: loading || !code.trim() ? '#94a3b8' : '#fff',
                    fontWeight: 700, fontSize: '0.9rem', cursor: loading || !code.trim() ? 'default' : 'pointer',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}>
                  {loading ? '...' : 'Activar'}
                </button>
              </div>

              {error && (
                <p style={{ margin: '8px 0 0', color: '#ef4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ⚠️ {error}
                </p>
              )}
            </form>
          )}

          {/* Éxito */}
          {success && (
            <div style={{
              background: '#f0fdf4', border: '2px solid #86efac',
              borderRadius: 12, padding: '16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <p style={{ margin: 0, fontWeight: 700, color: '#166534' }}>
                ¡Código activado! Redirigiendo…
              </p>
            </div>
          )}

          {/* Divider */}
          <div style={{ margin: '24px 0', borderTop: '1px solid #f1f5f9' }} />

          {/* Contacto y logout */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.82rem', color: '#94a3b8' }}>
              ¿No tenés código?
            </p>
            <a
              href="mailto:hola@lazarillo.app"
              style={{ color: tc, fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none' }}>
              Contactanos para obtener acceso →
            </a>
          </div>

          <button
            onClick={logout}
            style={{
              width: '100%', marginTop: 16, padding: '10px', border: '1px solid #e2e8f0',
              borderRadius: 10, background: 'transparent', color: '#94a3b8',
              fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.background = '#f8fafc'; e.target.style.color = '#64748b'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#94a3b8'; }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}