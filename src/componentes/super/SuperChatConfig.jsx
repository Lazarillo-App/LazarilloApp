// src/componentes/super/SuperChatConfig.jsx
// Chat de Anthony (10/11; pasó del /admin al panel de super usuarios el 13/11): a qué mails llegan
// los pedidos, el WhatsApp de contacto, todo lo que dice Anthony (saludo, opciones, pregunta corta,
// si pide captura) y a qué chats de Telegram llega el aviso al instante.
import React, { useEffect, useState } from 'react';
import { TextField, Button, IconButton, MenuItem, Select, Tooltip, Chip, Switch, FormControlLabel, Alert, Stack } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { showConfirm } from '@/servicios/appConfirm';

const tarjeta = { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 };
const titulo = { fontWeight: 700, color: '#15213E', fontSize: 15 };
const ayuda = { fontSize: 12.5, color: '#64748b', marginTop: -8, lineHeight: 1.5 };

const ERRORES = {
  falta_un_mail: 'Tiene que haber al menos un mail que reciba los pedidos.',
  falta_una_opcion: 'El menú tiene que tener al menos una opción.',
};
const tipoPregunta = (o) => (!o.pregunta ? 'ninguna' : o.pregunta.libre ? 'libre' : 'botones');

export default function SuperChatConfig() {
  const [cfg, setCfg] = useState(null);
  const [telegramListo, setTelegramListo] = useState(false);
  const [nuevoMail, setNuevoMail] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [chatsBot, setChatsBot] = useState(null);

  const cargar = async () => {
    const r = await SuperAPI.config();
    setCfg({ ...r.config, telegram: { chat_ids: r.config?.telegram?.chat_ids || [] } });
    setTelegramListo(!!r.telegram);
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
      const r = await SuperAPI.guardarConfig(cfg);
      setCfg(r.config);
      setCambios(false);
      showAlert('Guardado. Los clientes ya ven los cambios.', 'success');
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

  const buscarChats = async () => {
    try { const r = await SuperAPI.telegramChats(); setChatsBot(r?.chats || []); }
    catch (e) { showAlert(`No pude leer el bot: ${e?.data?.error || e?.message || 'error'}`, 'error'); }
  };
  const probar = async () => {
    if (cambios) { showAlert('Guardá los cambios antes de probar.', 'warning'); return; }
    try { const r = await SuperAPI.telegramProbar(); showAlert(`Listo: el mensaje de prueba salió a ${r.enviados} chat${r.enviados === 1 ? '' : 's'}.`, 'success'); }
    catch (e) { showAlert(`No salió: ${e?.data?.error || 'error'}`, 'error'); }
  };
  const chatIds = cfg.telegram?.chat_ids || [];

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 900 }}>
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" disabled={guardando || !cambios} onClick={guardar}>{guardando ? 'Guardando…' : cambios ? 'Guardar cambios' : 'Guardado'}</Button>
      </Stack>

      {/* ── Telegram ── */}
      <div style={tarjeta}>
        <div style={titulo}>Aviso al instante por Telegram</div>
        <div style={ayuda}>Cada pedido nuevo (y cada vez que un cliente contesta) llega como mensaje al Telegram de quien esté acá. El bot solo avisa: para responder se entra a esta página.</div>
        {!telegramListo ? (
          <Alert severity="info">
            Falta el bot. 1) En Telegram, escribile a <b>@BotFather</b>, mandá <b>/newbot</b> y seguí los pasos: te da un token.
            2) En Render, servicio LazarilloApp-Backend → Environment, agregá <b>TELEGRAM_BOT_TOKEN</b> con ese token.
            3) Volvé a esta pantalla.
          </Alert>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#334155' }}>Para sumar tu Telegram: abrí el bot, mandale <b>/start</b> y tocá <b>Buscar mi chat</b>.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {chatIds.map((id) => (
                <Chip key={id} label={chatsBot?.find((c) => c.id === id)?.nombre || `Chat ${id}`}
                  onDelete={() => set((c) => { c.telegram.chat_ids = c.telegram.chat_ids.filter((x) => x !== id); return c; })} />
              ))}
              {!chatIds.length && <span style={{ fontSize: 13, color: '#64748b' }}>Todavía no llega a ningún chat.</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={buscarChats}>Buscar mi chat</Button>
              <Button variant="outlined" onClick={probar} disabled={!chatIds.length}>Mandar mensaje de prueba</Button>
            </div>
            {chatsBot && (chatsBot.length ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {chatsBot.filter((c) => !chatIds.includes(c.id)).map((c) => (
                  <Chip key={c.id} color="primary" variant="outlined" label={`+ ${c.nombre}`}
                    onClick={() => set((x) => { x.telegram.chat_ids = [...(x.telegram.chat_ids || []), c.id]; return x; })} />
                ))}
                {chatsBot.every((c) => chatIds.includes(c.id)) && <span style={{ fontSize: 13, color: '#64748b' }}>Los chats que le escribieron ya están agregados.</span>}
              </div>
            ) : <span style={{ fontSize: 13, color: '#b45309' }}>Nadie le escribió al bot todavía: mandale /start y volvé a buscar.</span>)}
          </>
        )}
      </div>

      {/* ── Mails ── */}
      <div style={tarjeta}>
        <div style={titulo}>A quién le llegan los pedidos por mail</div>
        <div style={ayuda}>Cada pedido llega también por mail a estas direcciones, con la captura.</div>
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
        <TextField size="small" label="Despedida (cuando se envía el pedido)" multiline value={cfg.chat.despedida} onChange={(e) => setChat('despedida', e.target.value)} />
      </div>

      {/* ── Menú ── */}
      <div style={tarjeta}>
        <div style={titulo}>Opciones del menú</div>
        <div style={ayuda}>El cliente elige una opción; si tiene pregunta corta, la responde; si pide captura, Anthony le pide una foto de la pantalla; y al final escribe su mensaje.</div>
        {cfg.chat.opciones.map((o, i) => (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, display: 'grid', gap: 10, background: '#fafcff' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <TextField size="small" label={`Opción ${i + 1}`} value={o.texto} onChange={(e) => setOp(i, (x) => ({ ...x, texto: e.target.value }))} sx={{ flex: 1 }} />
              <Tooltip title="Subir"><span><IconButton size="small" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Bajar"><span><IconButton size="small" disabled={i === cfg.chat.opciones.length - 1} onClick={() => mover(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Sacar"><span><IconButton size="small" disabled={cfg.chat.opciones.length === 1} onClick={() => quitarOpcion(i)}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
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
              <FormControlLabel control={<Switch checked={!!o.captura} onChange={(e) => setOp(i, (x) => ({ ...x, captura: e.target.checked }))} />} label="Pide captura" />
              <span style={{ fontSize: 13, color: '#475569' }}>Llega como:</span>
              <Select size="small" value={o.tipo || ''} displayEmpty onChange={(e) => setOp(i, (x) => ({ ...x, tipo: e.target.value || undefined }))}>
                <MenuItem value="">Lo elige el cliente</MenuItem>
                <MenuItem value="problema">Problema</MenuItem>
                <MenuItem value="pedido">Pedido</MenuItem>
                <MenuItem value="consulta">Consulta</MenuItem>
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
    </div>
  );
}
