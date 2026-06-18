// src/paginas/Register.jsx

import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import '../css/Auth.css';

import DOG from '@/assets/brand/anthony.png';
import LOGO from '@/assets/brand/logo.png';

const WA = 'https://wa.me/5491163989934';

// ── Helpers ──────────────────────────────────────────────────────────────────
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

function scorePassword(pw = '') {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(3, Math.max(0, s - 1)); // 0..3
}

function strengthLabel(score) {
  if (score >= 3) return 'Fuerte';
  if (score === 2) return 'Media';
  if (score === 1) return 'Débil';
  return 'Muy débil';
}

// ── Mensajes rotantes (enfocados en "empezar") ───────────────────────────────
const MESSAGES = [
  { emoji: '🚀', text: 'Empezá en minutos. Sin instalaciones, sin complicaciones.' },
  { emoji: '📊', text: 'Controlá costos y márgenes de cada plato en tiempo real.' },
  { emoji: '🗂️', text: 'Organizá tu menú por rubros y subnegocios fácilmente.' },
  { emoji: '💡', text: 'Tomá decisiones con datos, no con intuición.' },
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
      <p style={{
        fontFamily: "'Archivo', system-ui, sans-serif",
        fontSize: '14px',
        color: 'rgba(255,255,255,.75)',
        lineHeight: 1.55,
        margin: 0,
      }}>
        {msg.text}
      </p>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Register() {
  const nav = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  const pwScore = useMemo(() => scorePassword(password), [password]);
  const valid = useMemo(
    () => String(name).trim().length >= 2 && emailOk(email) && password.length >= 8,
    [name, email, password],
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setOk(false);
    if (!valid) return;
    setBusy(true);
    try {
      await AuthAPI.register({ name: name.trim(), email: email.trim(), password });
      setOk(true);
      setTimeout(() => nav('/activar', { replace: true }), 500);
    } catch (e2) {
      setErr(e2.message || 'No se pudo registrar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">

      {/* ── ASIDE IZQUIERDO ─────────────────────────────────────────── */}
      <aside className="auth-aside">
        <div className="auth-aside-inner">

          {/* Brand */}
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
            ¡Bienvenido a Lazarillo! 🎉
          </h2>
          <p style={{
            fontFamily: "'Archivo', system-ui, sans-serif",
            fontSize: '14px',
            color: 'rgba(255,255,255,.5)',
            textAlign: 'center',
            marginTop: '4px',
            flexShrink: 0,
          }}>
            Todo tu negocio, en un solo lugar.
          </p>

          {/* Mensaje rotante — ocupa el espacio libre */}
          <div className="auth-aside-msg">
            <RotatingMessages />
          </div>

          {/* CTAs — pegados al fondo */}
          <div className="auth-aside-actions">
            <a
              className="wa-float"
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
            <h2 className="auth-title">Crear cuenta ✨</h2>
            <p className="auth-sub">Empezá en minutos. Sin instalaciones.</p>
          </header>

          {ok && <div className="auth-ok">¡Listo! Redirigiendo…</div>}
          {err && <div className="auth-error">{err}</div>}

          <label className="auth-label" htmlFor="name">Nombre</label>
          <input
            id="name"
            className={`input ${touched.name && String(name).trim().length < 2 ? 'input-error' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, name: true }))}
            placeholder="Ej: Ana López"
            autoFocus
          />
          {touched.name && String(name).trim().length < 2 && (
            <div className="field-hint error">Ingresá al menos 2 caracteres.</div>
          )}

          <label className="auth-label" htmlFor="email">Email</label>
          <input
            id="email"
            className={`input ${touched.email && !emailOk(email) ? 'input-error' : ''}`}
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
          <div className={`input input-with-action ${touched.password && password.length < 8 ? 'input-error' : ''}`}>
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPass(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              placeholder="Mínimo 8 caracteres"
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
          {touched.password && password.length < 8 && (
            <div className="field-hint error">La contraseña debe tener al menos 8 caracteres.</div>
          )}

          {/* Medidor de fuerza */}
          <div className="pw-meter">
            <div className={`pw-bar ${pwScore >= 0 ? 'on' : ''}`} />
            <div className={`pw-bar ${pwScore >= 1 ? 'on' : ''}`} />
            <div className={`pw-bar ${pwScore >= 2 ? 'on' : ''}`} />
            <span className="pw-label">{strengthLabel(pwScore)}</span>
          </div>

          <button className="btn btn-sky w-full" disabled={busy || !valid}>
            {busy ? 'Creando…' : 'Registrarme'}
          </button>

          <footer className="auth-foot compact-foot">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="auth-link">Iniciar sesión</Link>
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