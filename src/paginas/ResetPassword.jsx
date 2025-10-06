import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import '../css/Auth.css';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const [password, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!token) { setErr('Enlace inválido.'); return; }
    if (password.length < 6) { setErr('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirm) { setErr('Las contraseñas no coinciden.'); return; }

    setBusy(true);
    try {
      await AuthAPI.resetPassword({ token, password });
      setMsg('Contraseña actualizada. Redirigiendo…');
      setTimeout(() => nav('/login', { replace: true }), 1000);
    } catch (e) {
      setErr(e.message || 'No se pudo restablecer la contraseña');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h2 className="auth-title">Nueva contraseña</h2>
        {msg ? <div className="auth-success">{msg}</div> : null}
        {err ? <div className="auth-error">{err}</div> : null}

        <label className="auth-label">Contraseña</label>
        <input className="input" type="password" value={password} onChange={e=>setPass(e.target.value)} />

        <label className="auth-label">Confirmar contraseña</label>
        <input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} />

        <button className="btn w-full" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
