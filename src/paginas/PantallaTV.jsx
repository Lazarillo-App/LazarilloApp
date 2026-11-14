// src/paginas/PantallaTV.jsx — /pantalla: la TV de la cocina (Diego 14/11/2026: «quiero que cargue solo
// el tablero, todos los días, simple»). Sin login: la primera vez muestra un código de 6 dígitos; desde
// la PC, en el tablero de la plaza, «Vincular TV» con ese código. Desde ahí la TV guarda su token y al
// prender abre sola la plaza, solo para ver. Lo que se cambia en la PC llega en un minuto (si no cambió
// nada, el servidor contesta 304 y no se redibuja). Back: controllers/pantallasController.js.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import VistaPlaza from '@/componentes/plazas/VistaPlaza';
import { BASE } from '@/servicios/apiBase';
import LOGO from '@/assets/brand/logo.png';

const CLAVE = 'lz.pantalla.token';
const CADA_PENDIENTE = 3000;   // esperando que la vinculen
const CADA_VINCULADA = 60000;  // ya mostrando la plaza
const leer = () => { try { return localStorage.getItem(CLAVE) || ''; } catch { return ''; } };
const guardar = (t) => { try { if (t) localStorage.setItem(CLAVE, t); else localStorage.removeItem(CLAVE); } catch { /* sin storage */ } };

async function pedir(path, { method = 'GET', token } = {}) {
  const r = await fetch(`${BASE}/public/pantalla${path}`, {
    method, cache: 'no-cache', headers: token ? { 'X-Pantalla-Token': token } : {},
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 401) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

function Reloj() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 15000); return () => clearInterval(t); }, []);
  return <>{ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</>;
}

// La plaza ocupa la pantalla: se agranda para leer de lejos y se achica si no entra (la TV no scrollea).
function PlazaEnPantalla({ datos }) {
  const caja = useRef(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const ajustar = () => {
      const el = caja.current;
      if (!el) return;
      const base = Math.max(1, window.innerWidth / 1280);      // ~5 tarjetas por fila en una TV Full HD
      let z = base;
      el.style.zoom = String(z);
      for (let i = 0; i < 4; i++) {                             // achicar hasta que entre (mín. 55%)
        const alto = el.getBoundingClientRect().height;
        const libre = window.innerHeight - el.getBoundingClientRect().top;
        if (alto <= libre || z <= base * 0.55) break;
        z = Math.max(base * 0.55, z * Math.sqrt(libre / alto));
        el.style.zoom = String(z);
      }
      setZoom(z);
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [datos]);
  return (
    <Box ref={caja} sx={{ px: 2, pt: 1.5, pb: 2 }} data-zoom={zoom.toFixed(2)}>
      {datos.productos?.length
        ? <VistaPlaza productos={datos.productos} mostrarPlaza={datos.plaza?.mostrar || 'peso'} />
        : <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 8, fontSize: '1.2rem' }}>Esta plaza todavía no tiene productos.</Typography>}
    </Box>
  );
}

export default function PantallaTV() {
  const [token, setToken] = useState(leer);
  const [estado, setEstado] = useState(null);     // respuesta del servidor
  const [sinRed, setSinRed] = useState(false);
  const ultimo = useRef('');                     // para no redibujar si llegó lo mismo

  const nuevoCodigo = useCallback(async () => {
    try {
      const r = await pedir('/codigo', { method: 'POST' });
      guardar(r.token); setToken(r.token);
      setEstado({ estado: 'pendiente', codigo: r.codigo, venceEnSeg: r.venceEnSeg });
      setSinRed(false);
    } catch { setSinRed(true); }
  }, []);

  const consultar = useCallback(async () => {
    if (!token) { await nuevoCodigo(); return; }
    try {
      const r = await pedir('', { token });
      setSinRed(false);
      // Desvinculada, vencida o sin plaza: se pide un código nuevo y se vuelve a vincular.
      if (['desvinculada', 'vencido', 'sin_plaza'].includes(r.estado)) { guardar(''); setToken(''); return; }
      const s = JSON.stringify(r);
      if (s !== ultimo.current) { ultimo.current = s; setEstado(r); }
    } catch { setSinRed(true); }   // sin conexión: queda lo último que se vio
  }, [token, nuevoCodigo]);

  useEffect(() => {
    consultar();
    const cada = estado?.estado === 'vinculada' ? CADA_VINCULADA : CADA_PENDIENTE;
    const t = setInterval(consultar, cada);
    return () => clearInterval(t);
  }, [consultar, estado?.estado]);

  // Pantalla siempre encendida mientras esté abierta.
  useEffect(() => {
    let lock = null;
    const pedirLock = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* no soportado */ } };
    const alVolver = () => { if (document.visibilityState === 'visible') pedirLock(); };
    pedirLock();
    document.addEventListener('visibilitychange', alVolver);
    return () => { document.removeEventListener('visibilitychange', alVolver); try { lock?.release(); } catch { /* nada */ } };
  }, []);

  // Una vez por día (5 a. m.) se recarga sola para tomar la versión nueva de Lazarillo.
  useEffect(() => {
    const ahora = new Date();
    const prox = new Date(ahora); prox.setHours(5, 0, 0, 0);
    if (prox <= ahora) prox.setDate(prox.getDate() + 1);
    const t = setTimeout(() => window.location.reload(), prox - ahora);
    return () => clearTimeout(t);
  }, []);

  // Sin el zoom general de la app: la TV usa toda la pantalla.
  useEffect(() => {
    const root = document.getElementById('root');
    const antes = root?.style.zoom;
    if (root) root.style.zoom = '1';
    document.title = 'Lazarillo · Pantalla';
    // Tipografía de marca (la app no la carga en todas las pantallas).
    if (!document.getElementById('lz-fuente-sora')) {
      const l = document.createElement('link');
      l.id = 'lz-fuente-sora'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap';
      document.head.appendChild(l);
    }
    return () => { if (root) root.style.zoom = antes || ''; };
  }, []);

  const aviso = sinRed && (
    <Box sx={{ position: 'fixed', right: 12, bottom: 10, px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,.65)', color: '#fff', fontSize: '0.8rem' }}>
      Sin conexión · reintentando
    </Box>
  );

  if (estado?.estado === 'vinculada') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, height: 56, borderBottom: '3px solid #5BC2EA' }}>
          <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.6rem', textTransform: 'uppercase', lineHeight: 1 }}>
            {estado.plaza?.nombre}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '1.05rem', flex: 1 }}>{estado.plaza?.sectorNombre}</Typography>
          <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1.4rem', fontVariantNumeric: 'tabular-nums' }}><Reloj /></Typography>
          <Box component="img" src={LOGO} alt="Lazarillo" sx={{ height: 26, opacity: 0.85 }} />
        </Box>
        <PlazaEnPantalla datos={estado} />
        {aviso}
      </Box>
    );
  }

  const codigo = estado?.estado === 'pendiente' ? String(estado.codigo || '') : '';
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0f1b24', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, px: 3, textAlign: 'center' }}>
      <Box component="img" src={LOGO} alt="Lazarillo" sx={{ height: 44, filter: 'brightness(0) invert(1)' }} />
      {!codigo ? <CircularProgress sx={{ color: '#5BC2EA' }} /> : (
        <>
          <Typography sx={{ fontFamily: "'Sora', sans-serif", fontSize: '1.6rem', fontWeight: 700 }}>Vinculá esta pantalla</Typography>
          <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 'clamp(4rem, 12vw, 9rem)', letterSpacing: '.12em', color: '#5BC2EA', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {codigo.slice(0, 3)} {codigo.slice(3)}
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', opacity: 0.85, maxWidth: 640, lineHeight: 1.5 }}>
            En la PC, entrá a <b>Tableros</b>, abrí la plaza que va en esta TV y tocá <b>«Vincular TV»</b>. Escribí este código y listo: desde ahí se abre sola.
          </Typography>
          <Typography sx={{ fontSize: '0.9rem', opacity: 0.55 }}>El código se renueva solo si vence.</Typography>
        </>
      )}
      {aviso}
    </Box>
  );
}
