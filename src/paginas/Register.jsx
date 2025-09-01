// src/paginas/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import '../css/Auth.css';

export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setOk(false); setBusy(true);
    try {
      await AuthAPI.register({ name: name.trim(), email: email.trim(), password });
      setOk(true);
      // si el back devuelve token, ya quedás logueada; mandamos al perfil
      setTimeout(() => nav('/perfil', { replace: true }), 600);
    } catch (e) {
      setErr(e.message || 'No se pudo registrar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h2 className="auth-title">Crear cuenta ✨</h2>
        <p className="auth-sub">Así centralizás toda la gestión.</p>

        {ok ? <div className="auth-ok">¡Listo! Redirigiendo…</div> : null}
        {err ? <div className="auth-error">{err}</div> : null}

        <label className="auth-label">Nombre</label>
        <input className="input" value={name} onChange={e=>setName(e.target.value)} />

        <label className="auth-label">Email</label>
        <input className="input" value={email} onChange={e=>setEmail(e.target.value)} />

        <label className="auth-label">Contraseña</label>
        <input className="input" type="password" value={password} onChange={e=>setPass(e.target.value)} />

        <button className="btn w-full" disabled={busy}>
          {busy ? 'Creando...' : 'Registrarme'}
        </button>

        <div className="auth-foot">
          ¿Ya tenés cuenta? <Link to="/login" className="auth-link">Iniciar sesión</Link>
        </div>
      </form>
    </div>
  );
}
