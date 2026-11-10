// src/componentes/asistente/AnthonyChat.jsx
// Chat de Anthony "Que lo haga Lazarillo" (pedido de la usuaria, 10/11): saluda, ofrece un menú de
// opciones (y a veces una pregunta corta), y al final el usuario escribe un mensaje que le llega
// por mail al equipo (Backend /api/soporte). El menú y las respuestas se editan desde el panel de
// super-admin (soporte_config). Se abre desde cualquier lado con abrirChatAnthony({ opcion, ... }).
import React, { useEffect, useRef, useState } from 'react';
import { http } from '@/servicios/apiBusinesses';
import { ANT } from './anthonyAssets';
import { ABRIR_CHAT } from './chatEvento';

const burbuja = (deAnthony) => ({
  alignSelf: deAnthony ? 'flex-start' : 'flex-end', maxWidth: '85%', padding: '9px 12px', borderRadius: 12,
  background: deAnthony ? '#eef4fa' : 'var(--color-primary, #2492C8)', color: deAnthony ? '#15213E' : 'var(--on-primary, #fff)',
  fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap',
});
const opcionBtn = {
  textAlign: 'left', border: '1px solid #bfdcef', background: '#fff', color: '#15213E', borderRadius: 10,
  padding: '8px 12px', fontSize: 13.5, cursor: 'pointer',
};

export default function AnthonyChat() {
  const [abierto, setAbierto] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState('');
  const [opcion, setOpcion] = useState(null);     // la opción elegida del menú
  const [respuesta, setRespuesta] = useState(''); // respuesta a la pregunta corta
  const [paso, setPaso] = useState('menu');       // menu | pregunta | mensaje | enviado
  const [mensaje, setMensaje] = useState('');
  const [libre, setLibre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [contexto, setContexto] = useState(null);
  const finRef = useRef(null);

  const reiniciar = () => { setOpcion(null); setRespuesta(''); setPaso('menu'); setMensaje(''); setLibre(''); setError(''); setContexto(null); };

  const elegir = (op, resp = '') => {
    setOpcion(op);
    if (op.pregunta && !resp) { setPaso('pregunta'); return; }
    setRespuesta(resp);
    setPaso('mensaje');
  };

  // Abrir (con opción y mensaje sugeridos si vienen) desde cualquier pantalla. La opción pedida se
  // aplica cuando el menú está cargado.
  const pendienteRef = useRef(null);
  const [aviso, setAviso] = useState(0);
  useEffect(() => {
    const abrir = (e) => {
      const d = e.detail || {};
      reiniciar();
      setAbierto(true);
      setContexto(d.contexto || null);
      if (d.mensaje) setMensaje(d.mensaje);
      pendienteRef.current = d.opcion ? d : null;
      setAviso((n) => n + 1);
    };
    window.addEventListener(ABRIR_CHAT, abrir);
    return () => window.removeEventListener(ABRIR_CHAT, abrir);
  }, []);

  // El menú se carga la primera vez que se abre.
  useEffect(() => {
    if (!abierto || cfg) return;
    http('/soporte/chat', { withBusinessId: false })
      .then((r) => setCfg({ chat: r.chat, whatsapp: r.whatsapp }))
      .catch(() => setError('No pude cargar el chat. Probá de nuevo en un rato.'));
  }, [abierto, cfg]);

  useEffect(() => {
    const d = pendienteRef.current;
    if (!cfg || !d) return;
    pendienteRef.current = null;
    const op = cfg.chat.opciones.find((o) => o.id === d.opcion);
    if (op) elegir(op, d.respuesta || '');
  }, [cfg, aviso]);

  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }); }, [paso, opcion, respuesta]);

  const enviar = async () => {
    if (!mensaje.trim()) return;
    setEnviando(true); setError('');
    try {
      let businessId = null;
      try { businessId = Number(localStorage.getItem('activeBusinessId')) || null; } catch { /* sin storage */ }
      await http('/soporte/mensaje', {
        method: 'POST', withBusinessId: false,
        body: { opcion: opcion?.id, respuesta, mensaje: mensaje.trim(), businessId, contexto },
      });
      setPaso('enviado');
    } catch (e) {
      setError(e?.status === 429 ? 'Mandaste muchos mensajes seguidos: esperá un rato y probá de nuevo.' : 'No se pudo enviar. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) return null;
  const chat = cfg?.chat;

  return (
    <div role="dialog" aria-label="Chat con Anthony" style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 1500, width: 'min(380px, calc(100vw - 32px))', maxHeight: 'min(600px, calc(100vh - 40px))',
      background: '#fff', borderRadius: 16, boxShadow: '0 12px 44px rgba(0,0,0,.3)', border: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Archivo', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#15213E', color: '#fff' }}>
        <img src={ANT.saluda} alt="" style={{ height: 38, width: 'auto' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Anthony</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Equipo de Lazarillo</div>
        </div>
        <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!chat && !error && <div style={burbuja(true)}>Un segundo…</div>}
        {chat && (
          <>
            <div style={burbuja(true)}>{chat.saludo}</div>
            {paso === 'menu' && chat.opciones.map((op) => (
              <button key={op.id} type="button" style={opcionBtn} onClick={() => elegir(op)}>{op.texto}</button>
            ))}
            {opcion && <div style={burbuja(false)}>{opcion.texto}</div>}
            {opcion?.pregunta && <div style={burbuja(true)}>{opcion.pregunta.texto}</div>}
            {paso === 'pregunta' && opcion?.pregunta?.opciones?.map((x) => (
              <button key={x} type="button" style={opcionBtn} onClick={() => elegir(opcion, x)}>{x}</button>
            ))}
            {paso === 'pregunta' && (opcion?.pregunta?.libre || !opcion?.pregunta?.opciones?.length) && (
              <form onSubmit={(e) => { e.preventDefault(); if (libre.trim()) elegir(opcion, libre.trim()); }} style={{ display: 'flex', gap: 6 }}>
                <input value={libre} onChange={(e) => setLibre(e.target.value)} autoFocus placeholder="Escribí acá…"
                  style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', fontSize: 13.5 }} />
                <button type="submit" style={{ ...opcionBtn, background: 'var(--color-primary, #2492C8)', color: 'var(--on-primary, #fff)', border: 'none' }}>→</button>
              </form>
            )}
            {respuesta && <div style={burbuja(false)}>{respuesta}</div>}
            {(paso === 'mensaje' || paso === 'enviado') && <div style={burbuja(true)}>{opcion?.pedido}</div>}
            {paso === 'mensaje' && (
              <>
                <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} autoFocus maxLength={4000}
                  placeholder="Escribí tu mensaje…" style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 10, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" disabled={enviando || !mensaje.trim()} onClick={enviar}
                    style={{ ...opcionBtn, flex: 1, textAlign: 'center', fontWeight: 700, background: 'var(--color-primary, #2492C8)', color: 'var(--on-primary, #fff)', border: 'none', opacity: enviando || !mensaje.trim() ? 0.6 : 1 }}>
                    {enviando ? 'Enviando…' : 'Enviar al equipo'}
                  </button>
                  <button type="button" onClick={reiniciar} style={opcionBtn}>Volver</button>
                </div>
              </>
            )}
            {paso === 'enviado' && (
              <>
                <div style={burbuja(false)}>{mensaje}</div>
                <div style={burbuja(true)}>{chat.despedida}</div>
                <button type="button" onClick={reiniciar} style={opcionBtn}>Otra consulta</button>
              </>
            )}
          </>
        )}
        {error && <div style={{ ...burbuja(true), background: '#fdecec', color: '#991b1b' }}>{error}</div>}
        <div ref={finRef} />
      </div>
      {cfg?.whatsapp && (
        <a href={`https://wa.me/${cfg.whatsapp}`} target="_blank" rel="noreferrer"
          style={{ display: 'block', textAlign: 'center', padding: '8px 12px', fontSize: 12.5, color: '#15803d', borderTop: '1px solid #eef2f7', textDecoration: 'none' }}>
          ¿Es urgente? Escribinos por WhatsApp
        </a>
      )}
    </div>
  );
}
