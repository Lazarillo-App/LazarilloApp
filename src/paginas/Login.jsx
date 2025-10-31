/* eslint-disable no-empty */
// src/paginas/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { setCssVarsFromPalette } from '../tema/paletteBoot';
import '../css/Auth.css';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const brandingToPalette = (br = {}) => ({
    "color-primary": br.primary || "#111111",
    "color-secondary": br.secondary || "#6366f1",
    "color-bg": br.background || "#ffffff",
    "color-surface": "#ffffff",
    "color-border": "#e5e7eb",
    "color-fg": br.fg || br.primary || "#1f2937",
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const data = await AuthAPI.login(email.trim(), password);

      try {
        const uid = (data?.user?.id) || (JSON.parse(localStorage.getItem('user') || 'null') || {}).id;
        const resp = await BusinessesAPI.listMine();
        const list = Array.isArray(resp) ? resp : (resp?.items || []);
        const active = localStorage.getItem('activeBusinessId') || list[0]?.id;
        if (active) {
          localStorage.setItem('activeBusinessId', active);
          // si tenés endpoint para branding del negocio, traelo:
          const full = await BusinessesAPI.get?.(active);
          const branding = full?.branding || {};
          const pal = brandingToPalette(branding);
          setCssVarsFromPalette(pal);
          localStorage.setItem('bizTheme', JSON.stringify(pal));
          if (uid) localStorage.setItem(`bizTheme:${uid}`, JSON.stringify(pal));
          window.dispatchEvent(new Event('palette:changed'));
        }
      } catch { }

      // rol desde la respuesta o desde localStorage
      const role =
        data?.user?.role ??
        (JSON.parse(localStorage.getItem('user') || 'null') || {}).role;

      const to = role === 'app_admin' ? '/admin' : (loc.state?.from || '/');
      nav(to, { replace: true });
    } catch (e) {
      setErr(e.message || 'Error de inicio de sesión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h2 className="auth-title">Bienvenido 👋</h2>
        <p className="auth-sub">Ingresá para gestionar tus locales.</p>

        {err ? <div className="auth-error">{err}</div> : null}

        <label className="auth-label">Email</label>
        <input className="input" autoFocus value={email} onChange={e => setEmail(e.target.value)} />

        <label className="auth-label">Contraseña</label>
        <input className="input" type="password" value={password} onChange={e => setPass(e.target.value)} />

        <button className="btn w-full" disabled={busy}>
          {busy ? 'Entrando...' : 'Iniciar sesión'}
        </button>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Link to="/forgot-password" className="auth-link">¿Olvidaste tu contraseña?</Link>
        </div>

        <div className="auth-foot">
          ¿No tenés cuenta? <Link to="/register" className="auth-link">Crear cuenta</Link>
        </div>
      </form>
    </div>
  );
}
