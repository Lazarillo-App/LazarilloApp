// src/componentes/AnthonyWidget.jsx
// Botón flotante de Anthony (logueado). 14/11 (usuaria): un clic abre directo el chat de Anthony
// (AnthonyChat); sin globo intermedio y sin WhatsApp. Si hay respuestas del equipo sin leer, abre
// en "Mis pedidos".
//
// Se puede minimizar (el "–" sobre el botón): queda una pestañita pegada al borde derecho que no
// tapa datos, y al tocarla vuelve. Se recuerda por navegador (solo comodidad: sin storage,
// arranca visible).
import { useEffect, useState } from 'react';
import { ANT } from '@/componentes/asistente/anthonyAssets';
import { useLocation } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { abrirChatAnthony, SIN_LEER } from '@/componentes/asistente/chatEvento';

const CLAVE_MINIMIZADO = 'lazarillo:anthony:minimizado';

function leerMinimizado() {
  try { return localStorage.getItem(CLAVE_MINIMIZADO) === '1'; } catch { return false; }
}
function guardarMinimizado(v) {
  try { if (v) localStorage.setItem(CLAVE_MINIMIZADO, '1'); else localStorage.removeItem(CLAVE_MINIMIZADO); } catch { /* sin storage: no se recuerda */ }
}

export default function AnthonyWidget() {
  const [minimizado, setMinimizado] = useState(leerMinimizado);
  const minimizar = (v) => { setMinimizado(v); guardarMinimizado(v); };
  // Respuestas del equipo sin leer (las cuenta AnthonyChat): globito rojo y acceso a Mis pedidos (13/11).
  const [sinLeer, setSinLeer] = useState(0);
  useEffect(() => {
    const al = (e) => setSinLeer(Number(e.detail?.n) || 0);
    window.addEventListener(SIN_LEER, al);
    return () => window.removeEventListener(SIN_LEER, al);
  }, []);
  const globito = sinLeer > 0 ? (
    <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, background: '#dc2626', color: '#fff', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}>{sinLeer}</span>
  ) : null;
  // En el asistente de alta (usuario sin negocio) no se muestra: el asistente ya tiene su propio
  // Anthony en pantalla (pedido de la usuaria, 09/11). Misma condición que el Navbar.
  const location = useLocation();
  const { items: negocios } = useBusiness() || {};
  const enAlta = location.pathname.startsWith('/alta') || (location.pathname.startsWith('/perfil') && (!negocios || negocios.length === 0));
  if (enAlta) return null;

  if (minimizado) {
    // Pestañita en el borde derecho: asoma la cabeza de Anthony.
    return (
      <button
        data-no-captura=""
        onClick={() => minimizar(false)}
        aria-label="Mostrar a Anthony"
        title="Mostrar a Anthony"
        style={{
          position: 'fixed', right: 0, bottom: 96, zIndex: 1400, width: 26, height: 52, padding: 0,
          border: 'none', borderRadius: '12px 0 0 12px', cursor: 'pointer', background: '#15213E',
          boxShadow: '-2px 4px 12px rgba(0,0,0,.25)', overflow: 'hidden', opacity: 0.85,
        }}
      >
        <img src={ANT.saluda} alt="" style={{ height: 40, width: 'auto', objectFit: 'cover', objectPosition: 'left', marginLeft: 2 }} />
        {sinLeer > 0 && <span style={{ position: 'absolute', top: 3, left: 3, width: 9, height: 9, borderRadius: '50%', background: '#dc2626' }} />}
      </button>
    );
  }

  return (
    <div data-no-captura="" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1400 }}>
      <button
        onClick={() => minimizar(true)}
        aria-label="Minimizar a Anthony"
        title="Minimizar"
        style={{
          position: 'absolute', top: -8, left: -8, zIndex: 1, width: 22, height: 22, borderRadius: '50%',
          border: '1px solid #e5e7eb', background: '#fff', color: '#475569', cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        –
      </button>
      <button
        onClick={() => abrirChatAnthony(sinLeer > 0 ? { vista: 'pedidos' } : {})}
        aria-label="Abrir el chat con Anthony"
        title="Hablar con Anthony"
        style={{
          width: 64, height: 64, borderRadius: 20, border: 'none', cursor: 'pointer',
          background: '#15213E', boxShadow: '0 6px 20px rgba(0,0,0,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, overflow: 'hidden',
        }}
      >
        <img src={ANT.saluda} alt="" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
      </button>
      {globito}
    </div>
  );
}
