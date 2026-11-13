// src/componentes/asistente/AnthonyChat.jsx
// Chat de Anthony "Que lo haga Lazarillo" (10/11): saluda, ofrece un menú de opciones (y a veces una
// pregunta corta) y al final el usuario escribe un mensaje que le llega al equipo.
// 13/11 (usuaria): cada mensaje es un PEDIDO. En las opciones que lo piden ("Tengo un problema",
// "Quiero pedir un cambio") Anthony pide una captura de la pantalla: el chat se esconde, se saca la
// foto y se abre un chat grande con la captura cargada para describir el pedido. Al enviarlo queda
// la miniatura en el chat y Anthony confirma. En "Mis pedidos" el cliente ve el estado y las
// respuestas del equipo y puede contestar. Se abre desde cualquier lado con abrirChatAnthony().
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SoporteAPI } from '@/servicios/apiSoporte';
import { ANT } from './anthonyAssets';
import { ABRIR_CHAT, SIN_LEER } from './chatEvento';
import { capturarPantalla, imagenADataUrl } from '@/componentes/soporte/capturaPantalla';
import { escucharCapturasDelSistema, estadoAuto, activarAuto, apagarAuto, esMac } from '@/componentes/soporte/capturaDelSistema';
// 14/11 (usuaria): sin WhatsApp; el botón de Anthony abre directo este chat; "Chat" y "Mis pedidos"
// son pestañas arriba; y las capturas que el cliente saca con su compu (Win+Shift+S, Impr Pant) o pega
// con Ctrl+V abren el chat grande para mandarlas o cancelar (capturaDelSistema.js).

const AZUL = 'var(--color-primary, #2492C8)';
const burbuja = (deAnthony) => ({
  alignSelf: deAnthony ? 'flex-start' : 'flex-end', maxWidth: '85%', padding: '9px 12px', borderRadius: 12,
  background: deAnthony ? '#eef4fa' : AZUL, color: deAnthony ? '#15213E' : 'var(--on-primary, #fff)',
  fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap',
});
const opcionBtn = {
  textAlign: 'left', border: '1px solid #bfdcef', background: '#fff', color: '#15213E', borderRadius: 10,
  padding: '8px 12px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
};
const btnPrimario = { ...opcionBtn, textAlign: 'center', fontWeight: 700, background: AZUL, color: 'var(--on-primary, #fff)', border: 'none' };
const TIPOS = [['problema', '⚠️ Algo no anda'], ['pedido', '✨ Quiero un cambio'], ['consulta', '💬 Tengo una duda']];
const COLOR_ESTADO = {
  nuevo: '#64748b', revision: '#2563eb', contactar: '#d97706', desarrollo: '#7c3aed', resuelto: '#15803d', descartado: '#94a3b8',
};
const fecha = (iso) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const tipoDeOpcion = (op) => op?.tipo || (op?.id === 'tecnico' ? 'problema' : op?.id === 'cambio' ? 'pedido' : 'consulta');
const MAX_POLL_MS = 3 * 60 * 1000;
// Teclas según la compu (14/11): en Mac la captura al portapapeles es Cmd + Ctrl + Shift + 4.
const MAC = esMac();
const TECLAS = MAC
  ? { captura: 'Cmd + Ctrl + Shift + 4', pegar: 'Cmd + V' }
  : { captura: 'Windows + Shift + S', pegar: 'Ctrl + V' };

export default function AnthonyChat() {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState('chat');        // chat | pedidos
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState('');
  const [opcion, setOpcion] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const [paso, setPaso] = useState('menu');          // menu | pregunta | captura | mensaje | enviado
  const [mensaje, setMensaje] = useState('');
  const [libre, setLibre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [contexto, setContexto] = useState(null);
  const [captura, setCaptura] = useState(null);      // data URL
  const [capturando, setCapturando] = useState(false);
  const [grande, setGrande] = useState(false);       // chat grande con la captura
  const [tipo, setTipo] = useState('consulta');
  const [enviado, setEnviado] = useState(null);      // { id, captura }
  const [sinLeer, setSinLeer] = useState(0);
  const finRef = useRef(null);
  const archivoRef = useRef(null);

  const [delSistema, setDelSistema] = useState(false); // la captura vino de la compu del cliente
  const [auto, setAuto] = useState('no');              // capturas automáticas: activo | apagado | no
  const [comoMac, setComoMac] = useState(false);       // explicación de cómo activarlo en Mac
  const [arrastrando, setArrastrando] = useState(false); // una imagen arrastrada sobre Lazarillo

  const reiniciar = () => {
    setOpcion(null); setRespuesta(''); setPaso('menu'); setMensaje(''); setLibre(''); setError('');
    setContexto(null); setCaptura(null); setGrande(false); setEnviado(null); setTipo('consulta'); setDelSistema(false);
  };

  const elegir = (op, resp = '') => {
    setOpcion(op);
    setTipo(tipoDeOpcion(op));
    if (op.pregunta && !resp) { setPaso('pregunta'); return; }
    setRespuesta(resp);
    setPaso(op.captura ? 'captura' : 'mensaje');
  };

  // Globito de respuestas nuevas del equipo (lo muestra también el botón de Anthony).
  const actualizarSinLeer = useCallback(async () => {
    try {
      const r = await SoporteAPI.sinLeer();
      const n = Number(r?.n) || 0;
      setSinLeer(n);
      window.dispatchEvent(new CustomEvent(SIN_LEER, { detail: { n } }));
    } catch { /* sin conexión: queda como estaba */ }
  }, []);
  useEffect(() => {
    actualizarSinLeer();
    const t = setInterval(actualizarSinLeer, MAX_POLL_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') actualizarSinLeer(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [actualizarSinLeer]);

  // Abrir (con opción y mensaje sugeridos si vienen, o directo en "Mis pedidos") desde cualquier lado.
  const pendienteRef = useRef(null);
  const [aviso, setAviso] = useState(0);
  useEffect(() => {
    const abrir = (e) => {
      const d = e.detail || {};
      reiniciar();
      setAbierto(true);
      setVista(d.vista === 'pedidos' ? 'pedidos' : 'chat');
      setContexto(d.contexto || null);
      if (d.mensaje) setMensaje(d.mensaje);
      pendienteRef.current = d.opcion ? d : null;
      setAviso((n) => n + 1);
    };
    window.addEventListener(ABRIR_CHAT, abrir);
    return () => window.removeEventListener(ABRIR_CHAT, abrir);
  }, []);

  useEffect(() => {
    if ((!abierto && !grande) || cfg) return;
    SoporteAPI.chat()
      .then((r) => setCfg({ chat: r.chat }))
      .catch(() => setError('No pude cargar el chat. Probá de nuevo en un rato.'));
  }, [abierto, grande, cfg]);

  // Capturas sacadas con la compu (o pegadas con Ctrl+V): se abren en el chat grande para mandar o cancelar.
  // Si el cliente ya estaba armando un pedido, la captura se suma a ese pedido.
  const estadoRef = useRef({});
  estadoRef.current = { abierto, paso, grande, enviando };
  useEffect(() => {
    estadoAuto().then(setAuto);
    return escucharCapturasDelSistema(async (blob) => {
      const st = estadoRef.current;
      if (st.enviando) return;
      let url;
      try { url = await imagenADataUrl(blob); } catch { return; }
      // Con el chat grande abierto solo se cambia la imagen; armando un pedido, se suma a ese pedido.
      const enCurso = st.grande || (st.abierto && (st.paso === 'captura' || st.paso === 'mensaje'));
      if (!enCurso) {
        reiniciar();
        setTipo('problema');
        setDelSistema(true);
      }
      setError('');
      setCaptura(url);
      setGrande(true);
    }, { onArrastre: setArrastrando });
  }, []);
  const cambiarAuto = async () => {
    if (auto === 'activo') { apagarAuto(); setAuto('apagado'); return; }
    const r = await activarAuto();
    setAuto(r);
    if (r === 'activo') setComoMac(false);
    else setError(`El navegador no dio permiso para ver tus capturas. Igual podés pegarlas con ${TECLAS.pegar} o arrastrarlas.`);
  };

  useEffect(() => {
    const d = pendienteRef.current;
    if (!cfg || !d) return;
    pendienteRef.current = null;
    const op = cfg.chat.opciones.find((o) => o.id === d.opcion);
    if (op) elegir(op, d.respuesta || '');
  }, [cfg, aviso]);

  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }); }, [paso, opcion, respuesta, enviado, vista]);

  // ── captura ──
  const sacarCaptura = async () => {
    setError('');
    setCapturando(true);
    // Dos cuadros para que el chat ya no esté en pantalla cuando se saca la foto.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      setCaptura(await capturarPantalla());
      setGrande(true);
    } catch {
      setError(`No pude sacar la captura. Sacala vos con ${TECLAS.captura} y pegala acá con ${TECLAS.pegar}, o adjuntá una imagen.`);
    } finally {
      setCapturando(false);
    }
  };
  const usarArchivo = async (archivo) => {
    if (!archivo) return;
    try { setCaptura(await imagenADataUrl(archivo)); setGrande(true); } catch { setError('Esa imagen no se pudo leer.'); }
  };
  const alPegar = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); usarArchivo(item.getAsFile()); }
  };

  const enviar = async () => {
    if (!mensaje.trim()) return;
    setEnviando(true); setError('');
    try {
      const r = await SoporteAPI.enviar({
        opcion: opcion?.id, respuesta, mensaje: mensaje.trim(), tipo, captura: captura || undefined,
        pantalla: `${window.location.pathname}${window.location.search}`,
        contexto: {
          ...(contexto || {}), pantalla_ancho: window.innerWidth, pantalla_alto: window.innerHeight, navegador: navigator.userAgent.slice(0, 160),
          ...(delSistema ? { origen: 'captura_propia' } : {}),
        },
      });
      setEnviado({ id: r?.id, captura: r?.captura_url || captura || null });
      setGrande(false);
      setPaso('enviado');
      setVista('chat');
      setAbierto(true); // si vino de una captura propia, la confirmación queda en el chat chico
    } catch (e) {
      setError(e?.status === 429 ? 'Mandaste muchos mensajes seguidos: esperá un rato y probá de nuevo.' : 'No se pudo enviar. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const avisoArrastre = arrastrando && !grande ? (
    <div data-no-captura="" style={{
      position: 'fixed', inset: 12, zIndex: 1700, pointerEvents: 'none', border: '3px dashed #2492C8', borderRadius: 18,
      background: 'rgba(36,146,200,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: '#15213E', color: '#fff', borderRadius: 14, padding: '14px 20px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Archivo', system-ui, sans-serif" }}>
        <img src={ANT.saluda} alt="" style={{ height: 36, width: 'auto' }} />
        Soltá la imagen y se la mandamos al equipo
      </div>
    </div>
  ) : null;
  if (capturando) return null;
  if (!abierto && !grande) return avisoArrastre;
  const chat = cfg?.chat;
  const pestaña = (activa) => ({
    flex: 1, position: 'relative', background: 'none', border: 'none', borderBottom: `3px solid ${activa ? '#2492C8' : 'transparent'}`,
    color: activa ? '#15213E' : '#64748b', fontWeight: activa ? 700 : 500, fontSize: 13.5, padding: '9px 6px 7px', cursor: 'pointer', fontFamily: 'inherit',
  });
  const cancelarGrande = () => {
    if (delSistema) { reiniciar(); return; } // era una captura suelta: no queda nada abierto de más
    setGrande(false);
    setPaso(captura ? 'mensaje' : paso);
  };

  return (
    <>
      {avisoArrastre}
      {abierto && (
      <div data-no-captura="" role="dialog" aria-label="Chat con Anthony" style={{
        position: 'fixed', right: 20, bottom: 20, zIndex: 1500, width: 'min(380px, calc(100vw - 32px))', maxHeight: 'min(620px, calc(100vh - 40px))',
        background: '#fff', borderRadius: 16, boxShadow: '0 12px 44px rgba(0,0,0,.3)', border: '1px solid #e5e7eb',
        display: grande ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Archivo', system-ui, sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#15213E', color: '#fff' }}>
          <img src={ANT.saluda} alt="" style={{ height: 38, width: 'auto' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Anthony</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Equipo de Lazarillo</div>
          </div>
          <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button type="button" role="tab" aria-selected={vista === 'chat'} onClick={() => setVista('chat')} style={pestaña(vista === 'chat')}>💬 Chat</button>
          <button type="button" role="tab" aria-selected={vista === 'pedidos'} onClick={() => setVista('pedidos')} style={pestaña(vista === 'pedidos')}>
            📋 Mis pedidos
            {sinLeer > 0 && <PuntoRojo n={sinLeer} />}
          </button>
        </div>

        {vista === 'pedidos' ? (
          <MisPedidos onSinLeer={actualizarSinLeer} />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }} onPaste={alPegar}>
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
                    <button type="submit" style={{ ...btnPrimario, padding: '8px 12px' }}>→</button>
                  </form>
                )}
                {respuesta && <div style={burbuja(false)}>{respuesta}</div>}

                {paso === 'captura' && (
                  <>
                    <div style={burbuja(true)}>
                      {opcion?.pedido || 'Mostrame dónde.'}
                      {'\n\n'}Tocá <b>📷 Capturar esta pantalla</b>: me escondo un segundo, saco la foto de lo que estás viendo y la mandamos con tu pedido.
                    </div>
                    <button type="button" style={btnPrimario} onClick={sacarCaptura}>📷 Capturar esta pantalla</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={{ ...opcionBtn, flex: 1, textAlign: 'center' }} onClick={() => archivoRef.current?.click()}>🖼 Adjuntar imagen</button>
                      <button type="button" style={{ ...opcionBtn, flex: 1, textAlign: 'center' }} onClick={() => setPaso('mensaje')}>Seguir sin captura</button>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.45 }}>
                      Si es de otra pantalla, andá a esa pantalla primero (el chat queda abierto) y después tocá capturar.
                      {' '}También podés sacarla vos (<b>{TECLAS.captura}</b>) y pegarla con <b>{TECLAS.pegar}</b>, o arrastrar una imagen sobre Lazarillo.
                    </div>
                  </>
                )}

                {paso === 'mensaje' && (
                  <>
                    <div style={burbuja(true)}>{opcion?.pedido}</div>
                    <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} autoFocus maxLength={4000}
                      placeholder="Escribí tu mensaje…" style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 10, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" disabled={enviando || !mensaje.trim()} onClick={enviar}
                        style={{ ...btnPrimario, flex: 1, opacity: enviando || !mensaje.trim() ? 0.6 : 1 }}>
                        {enviando ? 'Enviando…' : 'Enviar al equipo'}
                      </button>
                      <button type="button" onClick={reiniciar} style={opcionBtn}>Volver</button>
                    </div>
                    <button type="button" onClick={sacarCaptura} style={{ ...opcionBtn, textAlign: 'center', fontSize: 12.5 }}>📷 Sumar una captura de pantalla</button>
                  </>
                )}

                {paso === 'enviado' && (
                  <>
                    <div style={{ ...burbuja(false), padding: enviado?.captura ? 6 : '9px 12px' }}>
                      {enviado?.captura && (
                        <img src={enviado.captura} alt="Captura enviada" style={{ display: 'block', width: 160, maxWidth: '100%', borderRadius: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,.4)' }} />
                      )}
                      <div style={{ padding: enviado?.captura ? '0 6px 4px' : 0 }}>{mensaje}</div>
                    </div>
                    <div style={burbuja(true)}>
                      {enviado?.id ? `Listo, tu pedido #${enviado.id} llegó al equipo de Lazarillo. ` : ''}{chat.despedida}
                      {'\n\n'}Vas a ver la respuesta en <b>Mis pedidos</b> (acá arriba) y te va a llegar por mail.
                    </div>
                    <button type="button" onClick={reiniciar} style={opcionBtn}>Otra consulta</button>
                  </>
                )}
              </>
            )}
            {error && <div style={{ ...burbuja(true), background: '#fdecec', color: '#991b1b' }}>{error}</div>}
            <div ref={finRef} />
          </div>
        )}
        {vista === 'chat' && paso === 'menu' && (auto !== 'no' || MAC) && (
          <div style={{ borderTop: '1px solid #eef2f7', padding: '7px 12px', fontSize: 11.5, color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>
                {auto === 'activo'
                  ? '📸 Cuando saques una captura con la compu, te la ofrezco para mandar.'
                  : MAC
                    ? '📸 ¿Sacás capturas en tu Mac? Te las puedo ofrecer para mandar.'
                    : '📸 ¿Sacás capturas con Windows + Shift + S? Te las puedo ofrecer para mandar.'}
              </span>
              {auto === 'activo' ? (
                <button type="button" onClick={cambiarAuto} style={{ background: 'none', border: 'none', color: '#2492C8', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Desactivar</button>
              ) : MAC ? (
                <button type="button" onClick={() => setComoMac((v) => !v)} style={{ background: 'none', border: 'none', color: '#2492C8', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{comoMac ? 'Cerrar' : 'Cómo activarlo'}</button>
              ) : (
                <button type="button" onClick={cambiarAuto} style={{ background: 'none', border: 'none', color: '#2492C8', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Activar</button>
              )}
            </div>
            {MAC && comoMac && auto !== 'activo' && (
              <ol style={{ margin: '8px 0 2px', paddingLeft: 18, color: '#334155', fontSize: 12, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <li>Apretá <b>Cmd + Shift + 5</b>, tocá <b>Opciones</b> y en «Guardar en» elegí <b>Portapapeles</b>. Se hace una sola vez.</li>
                {auto !== 'no' ? (
                  <li>
                    Tocá <button type="button" onClick={cambiarAuto} style={{ ...btnPrimario, padding: '2px 10px', fontSize: 12, borderRadius: 6 }}>Activar</button>
                    {' '}y, cuando el navegador pregunte, poné <b>Permitir</b>. Listo: cada captura que saques te la ofrezco para mandar.
                  </li>
                ) : (
                  <li>Después de sacar la captura, pegala en Lazarillo con <b>Cmd + V</b>. (En este navegador no puedo verla solo; en Chrome sí.)</li>
                )}
                <li>Si preferís que quede en el escritorio, arrastrá la miniatura que aparece en la esquina y soltala sobre Lazarillo.</li>
              </ol>
            )}
          </div>
        )}
      </div>
      )}
      <input data-no-captura="" ref={archivoRef} type="file" accept="image/*" hidden onChange={(e) => { usarArchivo(e.target.files?.[0]); e.target.value = ''; }} />

      {grande && (
        <ChatGrande
          captura={captura} tipo={tipo} setTipo={setTipo} mensaje={mensaje} setMensaje={setMensaje}
          titulo={delSistema ? '¿Le mandamos esta captura al equipo?' : opcion?.texto}
          pedido={delSistema
            ? 'Vi que sacaste una captura. Si es por un problema o algo que querés pedir, contame qué pasa y la mando con tu mensaje. Si no era para nosotros, tocá Cancelar y seguí con lo tuyo.'
            : opcion?.pedido}
          enviando={enviando} error={error}
          onEnviar={enviar} onCancelar={cancelarGrande}
          onRecapturar={() => { setGrande(false); sacarCaptura(); }}
          onCambiar={() => archivoRef.current?.click()}
          onQuitar={() => { setCaptura(null); setGrande(false); setPaso('mensaje'); setAbierto(true); }}
          onPegar={alPegar} delSistema={delSistema}
        />
      )}
    </>
  );
}

function PuntoRojo({ n }) {
  return (
    <span style={{
      marginLeft: 6, verticalAlign: 'middle', minWidth: 18, height: 18, borderRadius: 9, background: '#dc2626', color: '#fff',
      fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
    }}>{n}</span>
  );
}

// Chat grande: la captura a la izquierda (o arriba en celular) y el pedido al lado.
function ChatGrande({ captura, tipo, setTipo, mensaje, setMensaje, titulo, pedido, enviando, error, onEnviar, onCancelar, onRecapturar, onCambiar, onQuitar, onPegar, delSistema }) {
  return (
    <div data-no-captura="" role="dialog" aria-label="Contanos tu pedido" onPaste={onPegar}
      style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(1000px, 100%)', maxHeight: '100%', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#15213E', color: '#fff' }}>
          <img src={ANT.saluda} alt="" style={{ height: 36, width: 'auto' }} />
          <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{titulo || 'Contanos tu pedido'}</div>
          <button type="button" onClick={onCancelar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16 }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            {captura ? (
              <img src={captura} alt="Tu captura" style={{ display: 'block', width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }} />
            ) : (
              <div style={{ height: 200, borderRadius: 10, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>Sin captura</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {!delSistema && <button type="button" style={{ ...opcionBtn, fontSize: 12.5 }} onClick={onRecapturar}>📷 Volver a capturar</button>}
              <button type="button" style={{ ...opcionBtn, fontSize: 12.5 }} onClick={onCambiar}>🖼 Usar otra imagen</button>
              {captura && !delSistema && <button type="button" style={{ ...opcionBtn, fontSize: 12.5 }} onClick={onQuitar}>Quitar captura</button>}
            </div>
          </div>
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={burbuja(true)}>{pedido || 'Contanos qué pasa o qué necesitás.'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TIPOS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTipo(k)}
                  style={{ ...opcionBtn, padding: '6px 10px', fontSize: 12.5, ...(tipo === k ? { background: '#15213E', color: '#fff', borderColor: '#15213E' } : {}) }}>{l}</button>
              ))}
            </div>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={7} autoFocus maxLength={4000}
              placeholder={tipo === 'pedido' ? 'Qué querés que cambie o se agregue, y para qué te serviría…' : tipo === 'problema' ? 'Qué estabas haciendo, qué esperabas que pase y qué pasó…' : 'Escribí tu duda…'}
              style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', flex: 1, minHeight: 140 }} />
            {error && <div style={{ fontSize: 13, color: '#991b1b' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={enviando || !mensaje.trim()} onClick={onEnviar}
                style={{ ...btnPrimario, flex: 1, padding: '10px 12px', opacity: enviando || !mensaje.trim() ? 0.6 : 1 }}>
                {enviando ? 'Enviando…' : 'Enviar al equipo'}
              </button>
              <button type="button" onClick={onCancelar} style={opcionBtn}>Cancelar</button>
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>Junto con tu pedido mandamos tu usuario, el negocio y la pantalla donde estabas, para no tener que preguntártelo.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// "Mis pedidos": estado de cada pedido y la charla con el equipo.
function MisPedidos({ onSinLeer }) {
  const [pedidos, setPedidos] = useState(null);
  const [abiertoId, setAbiertoId] = useState(null);
  const [texto, setTexto] = useState('');
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await SoporteAPI.misPedidos();
      setPedidos(r?.pedidos || []);
      if ((r?.pedidos || []).some((p) => p.sin_leer > 0)) { await SoporteAPI.marcarVistos().catch(() => {}); onSinLeer?.(); }
      setAbiertoId((id) => id ?? (r?.pedidos || []).find((p) => p.sin_leer > 0)?.id ?? null);
    } catch { setError('No pude cargar tus pedidos.'); setPedidos([]); }
  }, [onSinLeer]);
  useEffect(() => { cargar(); }, [cargar]);

  const contestar = async (id) => {
    if (!texto.trim()) return;
    setMandando(true); setError('');
    try { await SoporteAPI.responder(id, texto.trim()); setTexto(''); await cargar(); }
    catch { setError('No se pudo enviar. Probá de nuevo.'); }
    finally { setMandando(false); }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pedidos === null && <div style={burbuja(true)}>Un segundo…</div>}
      {pedidos?.length === 0 && <div style={burbuja(true)}>Todavía no mandaste ningún pedido. Cuando lo hagas, acá vas a ver en qué estado está y lo que te responda el equipo.</div>}
      {pedidos?.map((p) => {
        const abierto = abiertoId === p.id;
        return (
          <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: p.sin_leer > 0 ? '#f0f7ff' : '#fff' }}>
            <button type="button" onClick={() => setAbiertoId(abierto ? null : p.id)}
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', gap: 9, alignItems: 'center' }}>
              {p.captura_url && <img src={p.captura_url} alt="" style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#64748b' }}>
                  <b style={{ color: '#15213E' }}>#{p.id}</b>
                  <span>{fecha(p.created_at)}</span>
                  <span style={{ marginLeft: 'auto', color: '#fff', background: COLOR_ESTADO[p.estado] || '#64748b', borderRadius: 999, padding: '1px 8px', fontWeight: 600, fontSize: 11 }}>{p.estado_nombre}</span>
                </div>
                <div style={{ fontSize: 13, color: '#15213E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: abierto ? 'normal' : 'nowrap' }}>{p.mensaje}</div>
              </div>
              {p.sin_leer > 0 && <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />}
            </button>
            {abierto && (
              <div style={{ padding: '0 11px 11px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.captura_url && (
                  <a href={p.captura_url} target="_blank" rel="noreferrer"><img src={p.captura_url} alt="Captura" style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }} /></a>
                )}
                {p.respuestas.length === 0 && <div style={{ fontSize: 12.5, color: '#64748b' }}>El equipo todavía no respondió. Te avisamos por mail cuando lo haga.</div>}
                {p.respuestas.map((r) => (
                  <div key={r.id} style={{ ...burbuja(r.de_equipo), maxWidth: '92%' }}>
                    {r.de_equipo && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Equipo de Lazarillo</div>}
                    {r.texto}
                    <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 3 }}>{fecha(r.created_at)}</div>
                  </div>
                ))}
                {p.estado !== 'descartado' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responder…" maxLength={4000}
                      onKeyDown={(e) => { if (e.key === 'Enter') contestar(p.id); }}
                      style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', fontSize: 13 }} />
                    <button type="button" disabled={mandando || !texto.trim()} onClick={() => contestar(p.id)} style={{ ...btnPrimario, padding: '8px 12px', opacity: mandando || !texto.trim() ? 0.6 : 1 }}>→</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {error && <div style={{ ...burbuja(true), background: '#fdecec', color: '#991b1b' }}>{error}</div>}
    </div>
  );
}
