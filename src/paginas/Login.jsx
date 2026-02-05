// src/paginas/Login.jsx
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { syncAllBusinesses } from '@/servicios/syncAllBusinesses';
import AuthDiagram from '@/componentes/AuthDiagram';
import { setCssVarsFromPalette } from '../tema/paletteBoot';
import '../css/Auth.css';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });

  const valid = useMemo(
    () => emailOk(email) && String(password).length >= 1,
    [email, password]
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

    if (!valid) {
      setTouched({ email: true, password: true });
      return;
    }

    setBusy(true);

    try {
      // ✅ AuthAPI.login ya guarda token/user/activeBusinessId y dispara auth:login con detail
      const data = await AuthAPI.login(email.trim(), password);

      const user =
        data?.user ??
        (JSON.parse(localStorage.getItem('user') || 'null') || {});

      // ───── Post-login: negocio activo + paleta ─────
      let activeBizId = null;

      try {
        const uid = user?.id;

        const list = await BusinessesAPI.listMine(); // ya devuelve array (según tu API)
        activeBizId = localStorage.getItem('activeBusinessId') || list?.[0]?.id || null;

        if (activeBizId) {
          localStorage.setItem('activeBusinessId', String(activeBizId));

          const full = await BusinessesAPI.get?.(activeBizId);
          const branding = full?.branding || {};
          const pal = brandingToPalette(branding);

          setCssVarsFromPalette(pal);
          localStorage.setItem('bizTheme', JSON.stringify(pal));
          if (uid) {
            localStorage.setItem(`bizTheme:${uid}`, JSON.stringify(pal));
          }
          window.dispatchEvent(new Event('palette:changed'));
        }
      } catch {
        // no rompemos login por errores de branding
      }

      // ✅ (Opcional) si querés forzar que el BusinessContext se entere YA del biz activo:
      if (activeBizId) {
        window.dispatchEvent(new CustomEvent('business:switched', {
          detail: { bizId: activeBizId }
        }));
      }

      // ───── Auto-sync NO bloqueante ─────
      syncAllBusinesses({ scope: 'articles', alsoSalesDays: 14, concurrency: 2 })
        .catch(() => {});

      // ───── Redirect según rol ─────
      const role =
        user?.role ??
        (JSON.parse(localStorage.getItem('user') || 'null') || {}).role;

      const to = role === 'app_admin'
        ? '/admin'
        : (loc.state?.from || '/');

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
      {/* IZQ: hero con diagrama */}
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <h1 className="auth-brand">
            <span className="brand-dot" /> Lazarillo
          </h1>
          <h2 className="auth-aside-title">Ingresá y seguí donde quedaste.</h2>
          <ul className="auth-bullets">
            <li>➤ Sincronizá artículos automáticamente</li>
            <li>➤ Filtrá por subrubros y agrupaciones</li>
            <li>➤ Ventas y KPIs al instante</li>
          </ul>

          <div className="auth-illus">
            <AuthDiagram className="opacity-90" />
          </div>
        </div>
      </aside>

      {/* DER: formulario */}
      <main className="auth-main">
        <form className="auth-card compact" onSubmit={onSubmit} noValidate>
          <header className="auth-head">
            <h2 className="auth-title">Bienvenido 👋</h2>
            <p className="auth-sub">Ingresá para gestionar tus locales.</p>
          </header>

          {err ? <div className="auth-error">{err}</div> : null}

          <label className="auth-label" htmlFor="email">Email</label>
          <input
            id="email"
            className={`input ${touched.email && !emailOk(email) ? 'input-error' : ''}`}
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(s => ({ ...s, email: true }))}
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
              onChange={e => setPass(e.target.value)}
              onBlur={() => setTouched(s => ({ ...s, password: true }))}
              placeholder="Tu contraseña"
              style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent' }}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowPw(s => !s)}
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPw ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {touched.password && !password && (
            <div className="field-hint error">Ingresá tu contraseña.</div>
          )}

          <button className="btn w-full" disabled={busy || !valid}>
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
      </main>
    </div>
  );
}
