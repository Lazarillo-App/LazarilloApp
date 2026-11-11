/* eslint-disable no-empty */
// Chequeo activo de versión: aunque el navegador tenga cacheado un index.html
// viejo (de antes de que existiera el .htaccess de no-cache, o por cualquier
// otra capa de caché intermedia), esto detecta la versión nueva desde DENTRO
// del bundle viejo ya corriendo, y avisa — en vez de depender de que la
// persona sepa limpiar caché a mano.
import React, { useEffect, useRef, useState } from 'react';

/* global __APP_VERSION__ */
const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

export default function UpdateBanner() {
  const [available, setAvailable] = useState(null);   // la versión nueva (o null)
  const checking = useRef(false);

  // Al volver de «Actualizar ahora» se saca de la dirección el ?v= que se usó para saltear la caché.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('lzv')) {
        url.searchParams.delete('lzv');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!CURRENT_VERSION) return; // build local sin version.json (dev) — no molestar

    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const base = import.meta.env.BASE_URL || '/';
        const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.version && data.version !== CURRENT_VERSION) {
          setAvailable(data.version);
        }
      } catch {
      } finally {
        checking.current = false;
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, []);

  if (!available) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: '#15213E', color: '#fff', padding: '12px 18px', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 14, zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)', fontFamily: "'Archivo', system-ui, sans-serif",
      fontSize: 13, maxWidth: 'calc(100vw - 32px)',
    }}>
      <span>Hay una versión nueva de Lazarillo disponible.</span>
      <button
        // Diego 11/11/2026: con reload() a veces volvía la página guardada en caché (la versión vieja) y
        // el aviso aparecía otra vez. Se recarga pidiendo la versión nueva por su nombre (?lzv=…), que
        // trae todo lo último publicado de una sola vez.
        onClick={() => {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('lzv', String(available));
            window.location.replace(url.toString());
          } catch {
            window.location.reload();
          }
        }}
        style={{
          background: '#2492C8', color: '#fff', border: 'none', borderRadius: 6,
          padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
        }}
      >
        Actualizar ahora
      </button>
    </div>
  );
}
