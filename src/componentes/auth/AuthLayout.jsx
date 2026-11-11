// Marco de las pantallas de acceso (recuperar y restablecer contraseña): el mismo
// aside de Anthony que el login y la tarjeta a la derecha, para que no queden como
// páginas sueltas sin la línea de Lazarillo (Diego 10/11/2026).
import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/Auth.css';
import DOG from '@/assets/brand/anthony.png';
import LOGO from '@/assets/brand/logo.png';

export default function AuthLayout({ titulo = '¡Hola! Soy Anthony 👋', bajada = 'Tu guía para gestionar mejor tu restaurante.', children }) {
  return (
    <div className="auth-shell zoom-reset">
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <Link to="/" className="auth-brand">
            {LOGO ? <img src={LOGO} alt="Lazarillo" style={{ height: '40px' }} /> : <><span className="brand-dot" /> Lazarillo</>}
          </Link>
          <div className="auth-aside-kick">Gestión gastronómica</div>
          {DOG && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', flexShrink: 0 }}>
              <img src={DOG} alt="Anthony, la mascota de Lazarillo"
                style={{ width: '175px', filter: 'drop-shadow(0 16px 32px rgba(0,0,0,.4))' }} />
            </div>
          )}
          <h2 className="auth-aside-title" style={{ marginTop: DOG ? '12px' : '0' }}>{titulo}</h2>
          <p style={{ fontFamily: "'Archivo', system-ui, sans-serif", fontSize: '14px', color: 'rgba(255,255,255,.5)', textAlign: 'center', marginTop: '4px', flexShrink: 0 }}>
            {bajada}
          </p>
        </div>
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  );
}
