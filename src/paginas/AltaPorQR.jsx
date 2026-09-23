// src/paginas/AltaPorQR.jsx
// Vista Operación — pantalla pública a la que llega quien escanea el QR de
// una sucursal. El negocio ya viene resuelto por el código; la persona solo
// carga su nombre, elige celular o email y confirma con un código.
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import '../css/Auth.css';
import LOGO from '@/assets/brand/logo.png';
import DOG from '@/assets/brand/anthony.png';
import {
  resolverCodigoPublico, pedirAccesoPublico, confirmarAccesoPublico,
} from '@/servicios/apiAccesoEquipo';

// Prefijos de los países donde opera el negocio hoy. Argentina lleva el "9"
// después del 54 porque así lo exige la API de WhatsApp para celulares
// argentinos, aunque nadie lo marque al llamar.
const PAISES = [
  { dial: '549', label: '🇦🇷 Argentina', codigo: '+54' },
  { dial: '598', label: '🇺🇾 Uruguay', codigo: '+598' },
  { dial: '56', label: '🇨🇱 Chile', codigo: '+56' },
  { dial: '595', label: '🇵🇾 Paraguay', codigo: '+595' },
  { dial: '591', label: '🇧🇴 Bolivia', codigo: '+591' },
  { dial: '51', label: '🇵🇪 Perú', codigo: '+51' },
  { dial: '57', label: '🇨🇴 Colombia', codigo: '+57' },
  { dial: '52', label: '🇲🇽 México', codigo: '+52' },
  { dial: '34', label: '🇪🇸 España', codigo: '+34' },
  { dial: '1', label: '🇺🇸 Estados Unidos', codigo: '+1' },
];

function normalizarCelular(dial, numeroLocal) {
  const soloDigitos = numeroLocal.replace(/\D/g, '').replace(/^0+/, '');
  return `+${dial}${soloDigitos}`;
}

export default function AltaPorQR() {
  const { code } = useParams();
  const [negocio, setNegocio] = useState(null);
  const [errorCodigo, setErrorCodigo] = useState('');
  const [paso, setPaso] = useState('form'); // form | confirmar | listo

  const [nombre, setNombre] = useState('');
  const [canal, setCanal] = useState('celular');
  const [pais, setPais] = useState(PAISES[0].dial);
  const [numeroLocal, setNumeroLocal] = useState('');
  const [valor, setValor] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [requestId, setRequestId] = useState(null);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let alive = true;
    resolverCodigoPublico(code)
      .then((r) => {
        if (!alive) return;
        if (!r?.ok) {
          setErrorCodigo(r?.error === 'code_paused' ? 'Este acceso está pausado — pedile al administrador que lo reactive.' : 'Código no encontrado.');
          return;
        }
        setNegocio(r);
      })
      .catch(() => { if (alive) setErrorCodigo('No se pudo verificar el código.'); });
    return () => { alive = false; };
  }, [code]);

  const pedirAcceso = async (e) => {
    e.preventDefault();
    setErr('');
    if (!nombre.trim()) { setErr('Ingresá tu nombre'); return; }
    if (canal === 'celular' ? !numeroLocal.trim() : !valor.trim()) {
      setErr(canal === 'celular' ? 'Ingresá tu celular' : 'Ingresá tu email');
      return;
    }
    const valorFinal = canal === 'celular' ? normalizarCelular(pais, numeroLocal) : valor.trim();
    setBusy(true);
    try {
      const r = await pedirAccesoPublico(code, { nombre: nombre.trim(), canal, valor: valorFinal });
      if (!r?.ok) { setErr(r?.error === 'code_not_found' ? 'El acceso ya no está disponible' : 'No se pudo pedir el acceso'); return; }
      setValor(valorFinal);
      setRequestId(r.requestId);
      setPaso('confirmar');
    } catch (e2) {
      setErr(e2?.message || 'No se pudo pedir el acceso');
    } finally {
      setBusy(false);
    }
  };

  const volver = () => {
    setPaso('form');
    setOtp(''); setPassword(''); setErr('');
  };

  const confirmar = async (e) => {
    e.preventDefault();
    setErr('');
    if (otp.trim().length < 6) { setErr('Ingresá el código de 6 dígitos'); return; }
    if (password.length < 6) { setErr('La contraseña debe tener al menos 6 caracteres'); return; }
    setBusy(true);
    try {
      const r = await confirmarAccesoPublico(code, { requestId, otp: otp.trim(), password });
      if (!r?.ok) {
        setErr(r?.error === 'otp_expired' ? 'El código venció, pedí acceso de nuevo' : 'Código incorrecto');
        return;
      }
      setPaso('listo');
    } catch (e2) {
      setErr(e2?.message || 'No se pudo confirmar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <Link to="/" className="auth-brand">
            {LOGO
              ? <img src={LOGO} alt="Lazarillo" style={{ height: '40px' }} />
              : <><span className="brand-dot" /> Lazarillo</>
            }
          </Link>

          <div className="auth-aside-kick">Gestión gastronómica</div>

          {DOG && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', flexShrink: 0 }}>
              <img src={DOG} alt="Anthony, la mascota de Lazarillo"
                style={{ width: '175px', filter: 'drop-shadow(0 16px 32px rgba(0,0,0,.4))' }} />
            </div>
          )}

          <h2 className="auth-aside-title" style={{ marginTop: DOG ? '12px' : '0' }}>
            ¡Hola! Soy Anthony 👋
          </h2>
          <p style={{
            fontFamily: "'Archivo', system-ui, sans-serif",
            fontSize: '14px', color: 'rgba(255,255,255,.5)',
            textAlign: 'center', marginTop: '4px', flexShrink: 0,
          }}>
            {negocio?.businessName
              ? <>Te estás por sumar al equipo de <b>{negocio.businessName}</b>.</>
              : 'Te estás por sumar a un equipo en Lazarillo.'}
          </p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card compact">
          <header className="auth-head">
            <h2 className="auth-title">Sumate al equipo</h2>
            {paso === 'form' && <p className="auth-sub">Creá tu usuario. El administrador lo aprueba y listo.</p>}
          </header>

          {errorCodigo ? (
            <div className="auth-error">{errorCodigo}</div>
          ) : !negocio ? (
            <p className="auth-sub">Verificando…</p>
          ) : paso === 'form' ? (
            <form onSubmit={pedirAcceso} noValidate>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 10, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.35)',
                marginBottom: 16,
              }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{negocio.businessName}</div>
                  {negocio.branchName && <div style={{ fontSize: 12, opacity: .7 }}>{negocio.branchName}</div>}
                </div>
              </div>

              {err && <div className="auth-error">{err}</div>}

              <label className="auth-label" htmlFor="nombre">Nombre</label>
              <input id="nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Ana López" autoFocus />

              <label className="auth-label">Cómo querés entrar</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" className="btn"
                  style={{ flex: 1, background: canal === 'celular' ? 'var(--color-primary,#3b82f6)' : 'transparent', color: canal === 'celular' ? '#fff' : 'inherit', border: '1px solid #d8d3ca' }}
                  onClick={() => setCanal('celular')}>Celular</button>
                <button type="button" className="btn"
                  style={{ flex: 1, background: canal === 'email' ? 'var(--color-primary,#3b82f6)' : 'transparent', color: canal === 'email' ? '#fff' : 'inherit', border: '1px solid #d8d3ca' }}
                  onClick={() => setCanal('email')}>Email</button>
              </div>

              <label className="auth-label" htmlFor="valor">{canal === 'celular' ? 'Celular' : 'Email'}</label>
              {canal === 'celular' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="input" value={pais} onChange={(e) => setPais(e.target.value)}
                    style={{ flex: '0 0 auto', width: 120 }}>
                    {PAISES.map((p) => (
                      <option key={p.dial} value={p.dial}>{p.label} {p.codigo}</option>
                    ))}
                  </select>
                  <input id="valor" className="input" value={numeroLocal} onChange={(e) => setNumeroLocal(e.target.value)}
                    placeholder="11 5555 4321" inputMode="tel" style={{ flex: 1 }} />
                </div>
              ) : (
                <input id="valor" className="input" value={valor} onChange={(e) => setValor(e.target.value)}
                  placeholder="tu@email.com" inputMode="email" />
              )}

              <button className="btn btn-sky w-full" disabled={busy} style={{ marginTop: 12 }}>
                {busy ? 'Enviando…' : 'Pedir acceso'}
              </button>

              <footer className="auth-foot compact-foot">
                ¿Ya tenés cuenta? <Link to="/login" className="auth-link">Iniciar sesión</Link>
              </footer>
            </form>
          ) : paso === 'confirmar' ? (
            <form onSubmit={confirmar} noValidate>
              <button type="button" onClick={volver} className="auth-link"
                style={{ background: 'none', border: 'none', padding: 0, marginBottom: 10, cursor: 'pointer', fontSize: 13 }}>
                ‹ Volver
              </button>
              <p className="auth-sub">
                {canal === 'celular'
                  ? <>Te mandamos un código por WhatsApp al <b>{valor}</b>.</>
                  : <>Te mandamos un código por mail a <b>{valor}</b>.</>}
                {' '}Vence en 10 minutos.
              </p>
              {err && <div className="auth-error">{err}</div>}

              <label className="auth-label" htmlFor="otp">Código</label>
              <input id="otp" className="input" value={otp} onChange={(e) => setOtp(e.target.value)}
                placeholder="000000" inputMode="numeric" maxLength={6} autoFocus />

              <label className="auth-label" htmlFor="password">Elegí una contraseña</label>
              <input id="password" type="password" className="input" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />

              <button className="btn btn-sky w-full" disabled={busy} style={{ marginTop: 12 }}>
                {busy ? 'Confirmando…' : 'Confirmar'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>⏳</div>
              <h3 style={{ margin: '0 0 6px' }}>Listo, {nombre.split(' ')[0]}</h3>
              <p className="auth-sub">
                Tu pedido llegó al administrador de <b>{negocio?.businessName}</b>.<br />
                Te avisamos cuando te habilite.
              </p>
              <p style={{ fontSize: 12, opacity: .6, marginTop: 16 }}>Podés cerrar esta pantalla.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
