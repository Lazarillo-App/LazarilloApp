import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthAPI } from '../servicios/apiAuth';
import AuthLayout from '@/componentes/auth/AuthLayout';

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [err, setErr] = useState('');
  const [tocado, setTocado] = useState(false);

  const enviar = async (e) => {
    e?.preventDefault();
    setTocado(true);
    if (!emailOk(email)) return;
    setErr('');
    setBusy(true);
    try {
      const resp = await AuthAPI.requestPasswordReset(email.trim());
      setEnviado(true);
      if (resp?.previewUrl) window.open(resp.previewUrl, '_blank', 'noopener,noreferrer');
    } catch (e2) {
      setErr(e2.message || 'No se pudo procesar la solicitud');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout titulo="¿Te olvidaste la contraseña?" bajada="Tranqui, te mando un enlace para crear una nueva.">
      {enviado ? (
        <div className="auth-card compact" role="status">
          <header className="auth-head">
            <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 10 }} aria-hidden>📬</div>
            <h2 className="auth-title">Revisá tu mail</h2>
            <p className="auth-sub">
              Si <b style={{ color: 'inherit' }}>{email.trim()}</b> tiene una cuenta en Lazarillo, te llega un enlace para crear una contraseña nueva. Vale por 1 hora.
            </p>
            <p className="auth-sub" style={{ marginTop: 8 }}>¿No llegó? Mirá en spam o pedilo de nuevo.</p>
          </header>
          <Link to="/login" className="btn btn-sky w-full" style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            Volver a iniciar sesión
          </Link>
          <div className="auth-cta-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="auth-link" style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              onClick={() => setEnviado(false)}>
              Usar otro mail o pedirlo de nuevo
            </button>
          </div>
        </div>
      ) : (
        <form className="auth-card compact" onSubmit={enviar} noValidate>
          <header className="auth-head">
            <h2 className="auth-title">Restablecer contraseña</h2>
            <p className="auth-sub">Ingresá el mail con el que entrás a Lazarillo.</p>
          </header>

          {err && <div className="auth-error">{err}</div>}

          <label className="auth-label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" autoFocus
            className={`input ${tocado && !emailOk(email) ? 'input-error' : ''}`}
            value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTocado(true)}
            placeholder="nombre@correo.com" />
          {tocado && !emailOk(email) && <div className="field-hint error">Ingresá un correo válido.</div>}

          <button className="btn btn-sky w-full" style={{ marginTop: 18 }} disabled={busy || !email.trim()}>
            {busy ? 'Enviando…' : 'Enviar enlace'}
          </button>

          <div className="auth-cta-row" style={{ justifyContent: 'center' }}>
            <Link to="/login" className="auth-link">← Volver a iniciar sesión</Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
