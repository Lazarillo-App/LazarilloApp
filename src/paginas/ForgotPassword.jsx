import React, { useState } from 'react';
import { AuthAPI } from '../servicios/apiAuth';
import '../css/Auth.css';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr(''); setMsg('');
        setBusy(true);
        try {
            const resp = await AuthAPI.requestPasswordReset(email.trim());
            // resp debería ser el JSON { ok, previewUrl }
            setMsg('Si el email existe, te enviamos un enlace para restablecer la contraseña.');
            if (resp?.previewUrl) {
                window.open(resp.previewUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (e) {
            setErr(e.message || 'No se pudo procesar la solicitud');
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="auth-wrap">
            <form className="card auth-card" onSubmit={onSubmit}>
                <h2 className="auth-title">Restablecer contraseña</h2>
                <p className="auth-sub">Ingresá tu email y te enviaremos un enlace.</p>

                {msg ? <div className="auth-success">{msg}</div> : null}
                {err ? <div className="auth-error">{err}</div> : null}

                <label className="auth-label">Email</label>
                <input className="input" autoFocus value={email} onChange={e => setEmail(e.target.value)} />

                <button className="btn w-full" disabled={busy || !email.trim()}>
                    {busy ? 'Enviando…' : 'Enviar enlace'}
                </button>
            </form>
        </div>
    );
}
