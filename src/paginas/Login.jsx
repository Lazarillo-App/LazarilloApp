// src/paginas/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import '../css/Auth.css';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await AuthAPI.login(email.trim(), password);
      const to = loc.state?.from || '/perfil';
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
