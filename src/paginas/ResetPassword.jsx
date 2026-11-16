import React, { useState } from 'react';
import { PASSWORD_REGLA, passwordValida, mensajePassword } from '@/utils/password';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import AuthLayout from '@/componentes/auth/AuthLayout';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  // El link de restablecer trae el mail de la cuenta: se muestra para saber de quién es la contraseña
  // (usuaria 16/11/2026: un admin abre el link de otro usuario y no se veía a quién le cambiaba).
  const email = (params.get('email') || '').trim();
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
    if (!passwordValida(password)) { setErr(`${PASSWORD_REGLA} ${mensajePassword(password)}`); return; }
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
    <AuthLayout titulo="Creá tu contraseña nueva" bajada="Elegí una que te acuerdes y que nadie más sepa.">
      <form className="auth-card compact" onSubmit={onSubmit} noValidate>
        <header className="auth-head">
          <h2 className="auth-title">Nueva contraseña</h2>
          {email && (
            <p className="auth-sub" style={{ marginBottom: 4 }}>
              Para la cuenta <strong style={{ color: 'inherit', wordBreak: 'break-all' }}>{email}</strong>
            </p>
          )}
          <p className="auth-sub">{PASSWORD_REGLA}</p>
        </header>
        {/* Para que el gestor de contraseñas del navegador la guarde con el usuario correcto. */}
        {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
        {msg ? <div className="auth-success" style={{ marginBottom: 10 }}>{msg}</div> : null}
        {err ? <div className="auth-error">{err}</div> : null}

        <label className="auth-label" htmlFor="pw1">Contraseña</label>
        <input id="pw1" className="input" type="password" autoComplete="new-password" value={password} onChange={e => setPass(e.target.value)} />

        <label className="auth-label" htmlFor="pw2">Confirmar contraseña</label>
        <input id="pw2" className="input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />

        <button className="btn btn-sky w-full" style={{ marginTop: 18 }} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        <div className="auth-cta-row" style={{ justifyContent: 'center' }}>
          <Link to="/login" className="auth-link">← Volver a iniciar sesión</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
