import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import AuthDiagram from "@/componentes/AuthDiagram";
import '../css/Auth.css';

function strengthLabel(score) {
  if (score >= 3) return 'Fuerte';
  if (score === 2) return 'Media';
  if (score === 1) return 'Débil';
  return 'Muy débil';
}
function scorePassword(pw = '') {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(3, Math.max(0, s - 1)); // 0..3
}
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

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
    [name, email, password]
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setOk(false);
    if (!valid) return;
    setBusy(true);
    try {
      await AuthAPI.register({ name: name.trim(), email: email.trim(), password });
      setOk(true);
      setTimeout(() => nav('/perfil', { replace: true }), 500);
    } catch (e2) {
      setErr(e2.message || 'No se pudo registrar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      {/* IZQ: hero con video/diagrama */}
      <aside className="auth-aside">
  <div className="auth-aside-inner">
    <h1 className="auth-brand">
      <span className="brand-dot" /> Lazarillo
    </h1>
    <h2 className="auth-aside-title">Todo tu negocio, en un solo lugar.</h2>
    <ul className="auth-bullets">
      <li>➤ Crea locales y sincroniza artículos</li>
      <li>➤ Agrupaciones y filtros por subrubro</li>
      <li>➤ Ventas y KPIs listos para usar</li>
    </ul>

    {/* ⬇️ Reemplaza ESTE bloque */}
    <div className="auth-illus">
      <AuthDiagram className="opacity-90" />
    </div>
  </div>
</aside>      {/* DER: formulario */}
      <main className="auth-main">
        <form className="auth-card compact" onSubmit={onSubmit} noValidate>
          <header className="auth-head">
            <h2 className="auth-title">Crear cuenta ✨</h2>
            <p className="auth-sub">Empezá en minutos. Sin instalaciones.</p>
          </header>

          {ok ? <div className="auth-ok">¡Listo! Redirigiendo…</div> : null}
          {err ? <div className="auth-error">{err}</div> : null}

          <label className="auth-label" htmlFor="name">Nombre</label>
          <input
            id="name"
            className={`input ${touched.name && String(name).trim().length < 2 ? 'input-error' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setTouched(s => ({ ...s, name: true }))}
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
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(s => ({ ...s, email: true }))}
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
              onChange={e => setPass(e.target.value)}
              onBlur={() => setTouched(s => ({ ...s, password: true }))}
              placeholder="Mínimo 8 caracteres"
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

          <button className="btn w-full" disabled={busy || !valid}>
            {busy ? 'Creando…' : 'Registrarme'}
          </button>

          <footer className="auth-foot compact-foot">
            ¿Ya tenés cuenta? <Link to="/login" className="auth-link">Iniciar sesión</Link>
          </footer>
        </form>
      </main>
    </div>
  );
}
