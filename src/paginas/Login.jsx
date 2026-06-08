// src/paginas/Login.jsx

import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { syncAllBusinesses } from '@/servicios/syncAllBusinesses';
import { setCssVarsFromPalette } from '../tema/paletteBoot';
import '../css/Auth.css';

import DOG from '@/assets/brand/anthony.png';
import LOGO from '@/assets/brand/logo.png';

const WA = 'https://wa.me/5491163989934';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

// ── Mensajes rotantes ────────────────────────────────────────────────────────
const MESSAGES = [
  { emoji: '📊', text: 'Controlá costos y márgenes de cada plato en tiempo real.' },
  { emoji: '💡', text: 'Tomá decisiones con datos, no con intuición.' },
  { emoji: '🗂️', text: 'Organizá tu menú por rubros y subnegocios fácilmente.' },
  { emoji: '🚀', text: 'Sincronizá artículos automáticamente desde tu POS.' },
  { emoji: '📈', text: 'Tus KPIs y ventas siempre a mano, al instante.' },
  { emoji: '🤝', text: 'Todo tu equipo con la misma información, siempre.' },
];

function RotatingMessages() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % MESSAGES.length);
        setVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const msg = MESSAGES[current];

  return (
    <div
      style={{
        transition: 'opacity .35s ease, transform .35s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(91,194,234,.25)',
        borderRadius: '14px',
        padding: '16px 18px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0 }}>{msg.emoji}</span>
      <p
        style={{
          fontFamily: "'Archivo', system-ui, sans-serif",
          fontSize: '14px',
          color: 'rgba(255,255,255,.75)',
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {msg.text}
      </p>
    </div>
  );
}

// ── Modal de demo ────────────────────────────────────────────────────────────
function ContactModal({ onClose }) {
  const [form, setForm] = useState({ nombre: '', restaurante: '', mensaje: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 1200)); // reemplazar con llamada real
    setSending(false);
    setSent(true);
  };

  const valid = form.nombre.trim().length >= 2 && form.restaurante.trim().length >= 2;

  const S = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    },
    box: {
      background: '#1B1A2E', border: '1px solid rgba(255,255,255,.12)',
      borderRadius: '20px', padding: '36px 32px',
      maxWidth: '460px', width: '100%', position: 'relative',
    },
    close: {
      position: 'absolute', top: '14px', right: '18px',
      background: 'none', border: 'none', fontSize: '22px',
      cursor: 'pointer', color: 'rgba(255,255,255,.5)', lineHeight: 1,
    },
    h3: { fontFamily: "'Sora', system-ui, sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '6px' },
    sub: { fontSize: '14px', color: 'rgba(255,255,255,.5)', marginBottom: '22px' },
    lbl: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,.55)', marginBottom: '5px', marginTop: '14px' },
    inp: {
      width: '100%', background: 'rgba(255,255,255,.06)',
      border: '1px solid rgba(255,255,255,.12)', borderRadius: '10px',
      padding: '10px 14px', fontSize: '14px', color: '#fff',
      fontFamily: "'Archivo', system-ui, sans-serif", outline: 'none',
    },
    textarea: {
      width: '100%', background: 'rgba(255,255,255,.06)',
      border: '1px solid rgba(255,255,255,.12)', borderRadius: '10px',
      padding: '10px 14px', fontSize: '14px', color: '#fff',
      fontFamily: "'Archivo', system-ui, sans-serif", outline: 'none',
      resize: 'vertical', minHeight: '80px',
    },
    okTitle: { fontFamily: "'Sora', system-ui, sans-serif", fontSize: '19px', fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: '6px' },
    okSub: { fontSize: '14px', color: 'rgba(255,255,255,.5)', textAlign: 'center' },
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.box}>
        <button style={S.close} onClick={onClose} aria-label="Cerrar">×</button>

        {sent ? (
          <>
            <div style={{ fontSize: '44px', textAlign: 'center', marginBottom: '10px' }}>✅</div>
            <p style={S.okTitle}>¡Listo! Te contactamos pronto.</p>
            <p style={S.okSub}>
              Nos pondremos en contacto en menos de 24 h para mostrarte Lazarillo
              funcionando en tu restaurante.
            </p>
          </>
        ) : (
          <>
            <h3 style={S.h3}>Pedí tu demo</h3>
            <p style={S.sub}>
              Contanos de tu negocio y te mostramos Lazarillo funcionando sobre tu carta.
            </p>
            <form onSubmit={handleSubmit}>
              <label style={S.lbl} htmlFor="dm-nombre">Tu nombre</label>
              <input id="dm-nombre" name="nombre" style={S.inp}
                value={form.nombre} onChange={handleChange}
                placeholder="Ej: Ana López" required />

              <label style={S.lbl} htmlFor="dm-rest">Nombre del restaurante</label>
              <input id="dm-rest" name="restaurante" style={S.inp}
                value={form.restaurante} onChange={handleChange}
                placeholder="Ej: La Parrilla del Centro" required />

              <label style={S.lbl} htmlFor="dm-msg">¿Qué querés mejorar? (opcional)</label>
              <textarea id="dm-msg" name="mensaje" style={S.textarea}
                value={form.mensaje} onChange={handleChange}
                placeholder="Ej: quiero controlar mejor mis costos y precios." />

              <button
                type="submit"
                className="btn btn-sky w-full"
                style={{ marginTop: '18px' }}
                disabled={!valid || sending}
              >
                {sending ? 'Enviando…' : 'Quiero mi demo gratuita'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [showModal, setShowModal] = useState(false);

  const valid = useMemo(
    () => emailOk(email) && String(password).length >= 1,
    [email, password],
  );

  const brandingToPalette = (br = {}) => ({
    'color-primary': br.primary || '#111111',
    'color-secondary': br.secondary || '#6366f1',
    'color-bg': br.background || '#ffffff',
    'color-surface': '#ffffff',
    'color-border': '#e5e7eb',
    'color-fg': br.fg || br.primary || '#1f2937',
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!valid) { setTouched({ email: true, password: true }); return; }
    setBusy(true);
    try {
      const data = await AuthAPI.login(email.trim(), password);
      const user = data?.user ?? (JSON.parse(localStorage.getItem('user') || 'null') || {});
      let activeBizId = null;
      try {
        const list = await BusinessesAPI.listMine();
        activeBizId = localStorage.getItem('activeBusinessId') || list?.[0]?.id || null;
        if (activeBizId) {
          localStorage.setItem('activeBusinessId', String(activeBizId));
          const full = await BusinessesAPI.get?.(activeBizId);
          const branding = full?.branding || {};
          const pal = brandingToPalette(branding);
          setCssVarsFromPalette(pal);
          localStorage.setItem('bizTheme', JSON.stringify(pal));
          if (user?.id) localStorage.setItem(`bizTheme:${user.id}`, JSON.stringify(pal));
          window.dispatchEvent(new Event('palette:changed'));
        }
      } catch { /* no rompemos login por errores de branding */ }

      if (activeBizId) {
        window.dispatchEvent(new CustomEvent('business:switched', { detail: { bizId: activeBizId } }));
      }
      syncAllBusinesses({ scope: 'articles', alsoSalesDays: 14, concurrency: 2 }).catch(() => { });

      const role = user?.role ?? (JSON.parse(localStorage.getItem('user') || 'null') || {}).role;
      const to = role === 'app_admin' ? '/admin' : (loc.state?.from || '/app');
      nav(to, { replace: true });
    } catch (e2) {
      console.error('LOGIN ERROR >>>', e2);
      setErr(e2.message || 'Error de inicio de sesión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      {showModal && <ContactModal onClose={() => setShowModal(false)} />}

      {/* ── ASIDE IZQUIERDO ─────────────────────────────────────────── */}
      <aside className="auth-aside">
        <div className="auth-aside-inner">

          {/* Brand — mismo tamaño que el nav de la landing */}
          <Link to="/" className="auth-brand">
            {LOGO
              ? <img src={LOGO} alt="Lazarillo" style={{ height: '40px' }} />
              : <><span className="brand-dot" /> Lazarillo</>
            }
          </Link>

          <div className="auth-aside-kick">Gestión gastronómica</div>

          {/* Mascota */}
          {DOG && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', flexShrink: 0 }}>
              <img
                src={DOG}
                alt="Anthony, la mascota de Lazarillo"
                style={{
                  width: '175px',
                  filter: 'drop-shadow(0 16px 32px rgba(0,0,0,.4))',
                }}
              />
            </div>
          )}

          <h2 className="auth-aside-title" style={{ marginTop: DOG ? '12px' : '0' }}>
            ¡Hola! Soy Anthony 👋
          </h2>
          <p style={{
            fontFamily: "'Archivo', system-ui, sans-serif",
            fontSize: '14px',
            color: 'rgba(255,255,255,.5)',
            textAlign: 'center',
            marginTop: '4px',
            flexShrink: 0,
          }}>
            Tu guía para gestionar mejor tu restaurante.
          </p>

          {/* Mensaje rotante — ocupa el espacio libre */}
          <div className="auth-aside-msg">
            <RotatingMessages />
          </div>

          {/* CTAs — pegados al fondo */}
          <div className="auth-aside-actions">
            <button className="btn btn-sky" onClick={() => setShowModal(true)}>
              Pedí una demo gratuita
            </button>
            <a className="wa-float"
              href={WA}
              target="_blank"
              rel="noopener"
              aria-label="WhatsApp"
            >
              <svg viewBox="0 0 32 32" fill="#fff" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 .4C7.4.4.4 7.4.4 16c0 2.8.7 5.5 2.1 7.9L.3 31.7l8-2.1c2.3 1.3 4.9 1.9 7.6 1.9h.1c8.6 0 15.6-7 15.6-15.6 0-4.2-1.6-8.1-4.6-11C24.1 2 20.2.4 16 .4zm0 28.5h-.1c-2.4 0-4.7-.6-6.7-1.9l-.5-.3-5 1.3 1.3-4.9-.3-.5C3.3 21 2.7 18.5 2.7 16 2.7 8.7 8.7 2.8 16 2.8c3.5 0 6.8 1.4 9.3 3.9 2.5 2.5 3.9 5.8 3.9 9.3 0 7.3-6 13.2-13.2 13.2zm7.2-9.9c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.7.2-.2.2-.4.4-.6.1-.3.1-.5 0-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1 .5-.4.4-1.3 1.3-1.3 3.2s1.4 3.7 1.5 3.9c.2.3 2.7 4.2 6.6 5.9.9.4 1.6.6 2.2.8.9.3 1.8.2 2.4.2.7-.1 2.3-.9 2.6-1.9.3-.9.3-1.7.2-1.9-.1-.1-.3-.2-.7-.4z" />
              </svg>
            </a>

            <span className="auth-aside-wa-hint">
              Respondemos en menos de 24 h
            </span>
          </div>

        </div>
      </aside >

      {/* ── MAIN DERECHO ────────────────────────────────────────────── */}
      < main className="auth-main" >
        <form className="auth-card compact" onSubmit={onSubmit} noValidate>

          <header className="auth-head">
            <h2 className="auth-title">Bienvenido 👋</h2>
            <p className="auth-sub">Ingresá para gestionar tus locales.</p>
          </header>

          {err && <div className="auth-error">{err}</div>}

          <label className="auth-label" htmlFor="email">Email</label>
          <input
            id="email"
            className={`input ${touched.email && !emailOk(email) ? 'input-error' : ''}`}
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, email: true }))}
            placeholder="tu@email.com"
            inputMode="email"
          />
          {touched.email && !emailOk(email) && (
            <div className="field-hint error">Ingresá un correo válido.</div>
          )}

          <label className="auth-label" htmlFor="password">Contraseña</label>
          <div className={`input input-with-action ${touched.password && !password ? 'input-error' : ''}`}>
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPass(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              placeholder="Tu contraseña"
              style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent' }}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPw ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {touched.password && !password && (
            <div className="field-hint error">Ingresá tu contraseña.</div>
          )}

          <button className="btn btn-sky w-full" disabled={busy || !valid}>
            {busy ? 'Entrando…' : 'Iniciar sesión'}
          </button>

          <div className="auth-cta-row">
            <Link to="/forgot-password" className="auth-link">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <footer className="auth-foot compact-foot">
            ¿No tenés cuenta?{' '}
            <Link to="/register" className="auth-link">
              Crear cuenta
            </Link>
          </footer>

        </form>
      </main >

      <style>{`
        @keyframes anthonyFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>
    </div >
  );
}