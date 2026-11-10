// src/admin/pages/AdminChat.jsx
// Chat de Anthony (pedido de la usuaria, 10/11): desde acá el super-admin edita a qué mails llegan
// los mensajes, el WhatsApp de contacto y todo lo que dice Anthony (saludo, opciones del menú, la
// pregunta corta de cada una y el pedido final). Abajo, los últimos mensajes recibidos.
import React, { useEffect, useState } from 'react';
import { TextField, Button, IconButton, MenuItem, Select, Tooltip, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { AdminAPI } from '../../servicios/apiAdmin';
import { showAlert } from '../../servicios/appAlert';
import { showConfirm } from '../../servicios/appConfirm';

const BRAND = { tinta: '#15213E' };
const tarjeta = { background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 };
const titulo = { fontWeight: 700, color: BRAND.tinta, fontSize: 15 };
const ayuda = { fontSize: 12, color: '#64748b', marginTop: -8 };

const ERRORES = {
  falta_un_mail: 'Tiene que haber al menos un mail que reciba los mensajes.',
  falta_una_opcion: 'El menú tiene que tener al menos una opción.',
};

// La pregunta corta de una opción: ninguna, con botones (una por línea) o de texto libre.
const tipoPregunta = (o) => (!o.pregunta ? 'ninguna' : o.pregunta.libre ? 'libre' : 'botones');

export default function AdminChat() {
  const [cfg, setCfg] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMail, setNuevoMail] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);

  const cargar = async () => {
    const [c, m] = await Promise.all([AdminAPI.getSoporteConfig(), AdminAPI.listSoporteMensajes().catch(() => ({ mensajes: [] }))]);
    setCfg(c.config);
    setMensajes(m.mensajes || []);
    setCambios(false);
  };
  useEffect(() => { cargar().catch(() => showAlert('No se pudo cargar la configuración del chat.', 'error')); }, []);

  if (!cfg) return <div style={{ padding: 24 }}>Cargando…</div>;

  const set = (fn) => { setCfg((c) => fn(structuredClone(c))); setCambios(true); };
  const setChat = (k, v) => set((c) => { c.chat[k] = v; return c; });
  const setOp = (i, fn) => set((c) => { c.chat.opciones[i] = fn(c.chat.opciones[i]); return c; });

  const agregarMail = () => {
    const m = nuevoMail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) { showAlert('Ese mail no es válido.', 'error'); return; }
    set((c) => { if (!c.emails.includes(m)) c.emails.push(m); return c; });
    setNuevoMail('');
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await AdminAPI.saveSoporteConfig(cfg);
      setCfg(r.config);
      setCambios(false);
      showAlert('Chat guardado. Los usuarios ya ven los cambios.', 'success');
    } catch (e) {
      const code = e?.data?.error || e?.message || '';
      showAlert(ERRORES[code] || (code.startsWith('mail_invalido') ? `Mail inválido: ${code.split(': ')[1]}` : 'No se pudo guardar.'), 'error');
    } finally { setGuardando(false); }
  };

  const quitarOpcion = async (i) => {
    if (!(await showConfirm(`¿Sacar la opción "${cfg.chat.opciones[i].texto}" del menú?`, { danger: true }))) return;
    set((c) => { c.chat.opciones.splice(i, 1); return c; });
  };
  const mover = (i, d) => set((c) => {
    const j = i + d;
    if (j < 0 || j >= c.chat.opciones.length) return c;
    [c.chat.opciones[i], c.chat.opciones[j]] = [c.chat.opciones[j], c.chat.opciones[i]];
    return c;
  });

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '20px 28px', borderBottom: '0.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: BRAND.tinta }}>Chat de Anthony</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>A quién le llegan los mensajes y qué dice Anthony en el chat de ayuda.</p>
        </div>
        <Button variant="contained" disabled={guardando || !cambios} onClick={guardar}>{guardando ? 'Guardando…' : cambios ? 'Guardar cambios' : 'Guardado'}</Button>
      </div>

      <div style={{ padding: '20px 28px', display: 'grid', gap: 18, maxWidth: 900 }}>
        {/* ── A quién le llega ── */}
        <div style={tarjeta}>
          <div style={titulo}>A quién le llegan los mensajes</div>
          <div style={ayuda}>Cada mensaje del chat llega por mail a todas estas direcciones. Respondiendo el mail le contestás directo al usuario.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cfg.emails.map((m) => (
              <Chip key={m} label={m} onDelete={cfg.emails.length > 1 ? () => set((c) => { c.emails = c.emails.filter((x) => x !== m); return c; }) : undefined} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <TextField size="small" label="Agregar mail" value={nuevoMail} onChange={(e) => setNuevoMail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregarMail(); }} sx={{ flex: 1 }} />
            <Button onClick={agregarMail}>Agregar</Button>
          </div>
          <TextField size="small" label="WhatsApp para lo urgente (con código de país, ej. 5491163989934)"
            value={cfg.whatsapp || ''} onChange={(e) => set((c) => { c.whatsapp = e.target.value; return c; })} />
        </div>

        {/* ── Lo que dice Anthony ── */}
        <div style={tarjeta}>
          <div style={titulo}>Lo que dice Anthony</div>
          <TextField size="small" label="Saludo (al abrir el chat)" multiline value={cfg.chat.saludo} onChange={(e) => setChat('saludo', e.target.value)} />
          <TextField size="small" label="Despedida (cuando se envía el mensaje)" multiline value={cfg.chat.despedida} onChange={(e) => setChat('despedida', e.target.value)} />
        </div>

        {/* ── Menú ── */}
        <div style={tarjeta}>
          <div style={titulo}>Opciones del menú</div>
          <div style={ayuda}>El usuario elige una opción; si tiene pregunta corta, la responde; y al final Anthony le pide el mensaje.</div>
          {cfg.chat.opciones.map((o, i) => (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, display: 'grid', gap: 10, background: '#fafcff' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <TextField size="small" label={`Opción ${i + 1}`} value={o.texto} onChange={(e) => setOp(i, (x) => ({ ...x, texto: e.target.value }))} sx={{ flex: 1 }} />
                <Tooltip title="Subir"><span><IconButton size="small" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Bajar"><span><IconButton size="small" disabled={i === cfg.chat.opciones.length - 1} onClick={() => mover(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Sacar"><span><IconButton size="small" disabled={cfg.chat.opciones.length === 1} onClick={() => quitarOpcion(i)}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#475569' }}>Pregunta corta:</span>
                <Select size="small" value={tipoPregunta(o)} onChange={(e) => setOp(i, (x) => {
                  const t = e.target.value;
                  if (t === 'ninguna') { const { pregunta: _p, ...resto } = x; return resto; }
                  const texto = x.pregunta?.texto || '';
                  return { ...x, pregunta: t === 'libre' ? { texto, libre: true } : { texto, opciones: x.pregunta?.opciones || [] } };
                })}>
                  <MenuItem value="ninguna">Sin pregunta</MenuItem>
                  <MenuItem value="botones">Con botones</MenuItem>
                  <MenuItem value="libre">Respuesta escrita</MenuItem>
                </Select>
              </div>
              {o.pregunta && (
                <TextField size="small" label="Pregunta" value={o.pregunta.texto} onChange={(e) => setOp(i, (x) => ({ ...x, pregunta: { ...x.pregunta, texto: e.target.value } }))} />
              )}
              {o.pregunta && !o.pregunta.libre && (
                <TextField size="small" label="Botones (uno por línea)" multiline minRows={2}
                  value={(o.pregunta.opciones || []).join('\n')}
                  onChange={(e) => setOp(i, (x) => ({ ...x, pregunta: { ...x.pregunta, opciones: e.target.value.split('\n') } }))} />
              )}
              <TextField size="small" label="Lo que pide Anthony al final (antes del mensaje)" value={o.pedido} onChange={(e) => setOp(i, (x) => ({ ...x, pedido: e.target.value }))} />
            </div>
          ))}
          <div>
            <Button onClick={() => set((c) => { c.chat.opciones.push({ id: `op${Date.now()}`, texto: 'Nueva opción', pedido: 'Escribinos tu mensaje.' }); return c; })}>+ Agregar opción</Button>
          </div>
        </div>

        {/* ── Mensajes recibidos ── */}
        <div style={tarjeta}>
          <div style={titulo}>Últimos mensajes recibidos</div>
          {!mensajes.length && <div style={{ fontSize: 13, color: '#64748b' }}>Todavía no llegó ninguno.</div>}
          {mensajes.map((m) => {
            const op = cfg.chat.opciones.find((x) => x.id === m.opcion);
            return (
              <div key={m.id} style={{ borderTop: '1px solid #eef2f7', paddingTop: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', color: '#475569' }}>
                  <b style={{ color: BRAND.tinta }}>{op?.texto || m.opcion || 'Mensaje'}</b>
                  {m.respuesta && <span>· {m.respuesta}</span>}
                  <span>· {m.usuario || 'sin usuario'}</span>
                  {m.negocio && <span>· {m.negocio}</span>}
                  <span style={{ marginLeft: 'auto' }}>{new Date(m.created_at).toLocaleString('es-AR')}</span>
                  <Chip size="small" color={m.enviado ? 'success' : 'warning'} label={m.enviado ? 'mail enviado' : 'mail NO enviado'} title={m.error || ''} />
                </div>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{m.mensaje}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
