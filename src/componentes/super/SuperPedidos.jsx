// src/componentes/super/SuperPedidos.jsx
// Bandeja de pedidos de los clientes (13/11/2026): lo que mandan desde el chat de Anthony, con su
// captura. Se cambia el estado, el tipo, el alcance y a quién está asignado; se responde al cliente
// (lo ve en el chat y le llega por mail) o se deja una nota interna; y se crean ajustes a medida.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Chip, TextField, MenuItem, Drawer, IconButton, Button,
  Switch, FormControlLabel, CircularProgress, Alert, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { Link } from 'react-router-dom';
import AjusteDialog from './AjusteDialog';
import { T, FT, FB } from '@/componentes/ui/temaDiego';

const ESTADOS = [
  ['nuevo', 'Nuevo', '#64748b'],
  ['revision', 'En revisión', '#2563eb'],
  ['contactar', 'Hay que contactarlo', '#d97706'],
  ['desarrollo', 'En desarrollo', '#7c3aed'],
  ['resuelto', 'Resuelto', '#15803d'],
  ['descartado', 'Descartado', '#94a3b8'],
];
const TIPOS = [['problema', 'Problema', '#dc2626'], ['pedido', 'Pedido', '#7c3aed'], ['consulta', 'Consulta', '#0891b2']];
const ALCANCES = [['', 'Sin definir'], ['negocio', 'Solo este negocio'], ['usuario', 'Los negocios de este usuario'], ['global', 'Global (todos)']];
const FILTROS = [['abiertos', 'Abiertos'], ...ESTADOS.map(([k, l]) => [k, l]), ['', 'Todos']];
const colorDe = (lista, k) => lista.find((x) => x[0] === k)?.[2] || '#64748b';
const nombreDe = (lista, k) => lista.find((x) => x[0] === k)?.[1] || k || '—';
// Título del pedido armado con lo que eligió en el chat (Diego 14/11/2026: el texto libre no sirve
// de título). Motivo + la respuesta a la pregunta o, si no hubo, la pantalla desde donde escribió.
const MOTIVOS = { armar: 'Armar mi negocio', pos: 'Conectar el POS', tecnico: 'Problema técnico', duda: 'Duda de uso',
  cambio: 'Pedido de cambio', otra: 'Mensaje' };
const PANTALLAS = [[/^\/rrhh\/cronogramas/, 'RRHH › Cronogramas'], [/^\/rrhh\/nomina/, 'RRHH › Nómina'], [/^\/rrhh/, 'RRHH'],
  [/^\/(tableros|plaza)/, 'Tableros'], [/^\/menu/, 'Recetas › Menú'], [/^\/insumos/, 'Recetas › Insumos'],
  [/^\/agrupaciones/, 'Recetas › Agrupaciones'], [/^\/gestion/, 'Resultados'], [/^\/conciliacion/, 'Conciliación'],
  [/^\/movimientos-bancarios/, 'Movimientos bancarios'], [/^\/configuracion/, 'Configuración'], [/^\/perfil/, 'Mi perfil'],
  [/^\/m(\/|$)/, 'Celular'], [/^\/(inicio|$)/, 'Inicio']];
export const nombrePantalla = (ruta) => PANTALLAS.find(([re]) => re.test(String(ruta || '')))?.[1] || '';
export const tituloPedido = (p) => {
  const motivo = MOTIVOS[p.opcion] || nombreDe(TIPOS, p.tipo) || 'Pedido';
  const resp = String(p.respuesta || '').trim();
  const extra = resp && !/^(otra|nada todav[ií]a)$/i.test(resp) ? resp : nombrePantalla(p.pantalla);
  return extra ? `${motivo} · ${extra}` : motivo;
};
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

const ChipColor = ({ label, color, ...p }) => (
  <Chip size="small" label={label} sx={{ bgcolor: `${color}1a`, color, fontWeight: 700, height: 22, ...p.sx }} />
);

export default function SuperPedidos({ pedidoInicial = null, onPedidoAbierto, catalogo = [] }) {
  const [filtro, setFiltro] = useState('abiertos');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [abiertoId, setAbiertoId] = useState(pedidoInicial);

  const cargar = useCallback(async () => {
    setError('');
    try { setDatos(await SuperAPI.pedidos({ estado: filtro, q })); }
    catch (e) { setError(e?.status === 403 ? 'Tu cuenta ya no es super usuario.' : 'No se pudieron cargar los pedidos.'); }
  }, [filtro, q]);
  useEffect(() => { const t = setTimeout(cargar, q ? 300 : 0); return () => clearTimeout(t); }, [cargar, q]);
  useEffect(() => { if (pedidoInicial) setAbiertoId(pedidoInicial); }, [pedidoInicial]);

  const abrir = (id) => { setAbiertoId(id); onPedidoAbierto?.(id); };
  const cerrar = () => { setAbiertoId(null); onPedidoAbierto?.(null); cargar(); };
  const cuentas = datos?.cuentas || {};
  const abiertos = ESTADOS.filter(([k]) => !['resuelto', 'descartado'].includes(k)).reduce((s, [k]) => s + (cuentas[k] || 0), 0);

  const ALTO = 40;
  const campo = { height: ALTO, boxSizing: 'border-box', fontFamily: FB, fontSize: 14, color: T.text, border: `1px solid ${T.border2}`,
    borderRadius: 10, padding: '0 12px', background: T.band, outline: 'none' };
  const chip = (label, color) => (
    <span style={{ fontFamily: FB, fontSize: 11.5, fontWeight: 700, color, background: `${color}18`, borderRadius: 7, padding: '2px 8px', whiteSpace: 'nowrap' }}>{label}</span>
  );

  return (
    <Box sx={{ fontFamily: FB, color: T.text }}>
      {/* Barra en una fila, todo de 40 px (Diego 14/11/2026: depurar el diseño del panel) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} title="Estado" style={{ ...campo, width: 230, cursor: 'pointer' }}>
          {FILTROS.map(([k, l]) => {
            const n = k === 'abiertos' ? abiertos : k ? cuentas[k] : undefined;
            return <option key={k || 'todos'} value={k}>{n ? `${l} · ${n}` : l}</option>;
          })}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: texto, mail, negocio o #"
          style={{ ...campo, flex: '1 1 220px', minWidth: 180 }} />
        <button type="button" onClick={cargar} title="Actualizar" style={{ ...campo, width: ALTO, padding: 0, cursor: 'pointer', color: T.text2 }}>
          <RefreshIcon sx={{ fontSize: 20, verticalAlign: 'middle' }} />
        </button>
      </div>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!datos && !error && <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>}
      {datos?.pedidos?.length === 0 && (
        <div style={{ background: T.card, borderRadius: 14, padding: '36px 16px', textAlign: 'center', fontSize: 13.5, color: T.text2 }}>
          No hay pedidos con ese filtro. Los clientes los mandan desde el chat de Anthony.
        </div>
      )}

      {!!datos?.pedidos?.length && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: T.sombraSuave }}>
          {datos.pedidos.map((p, i) => (
            <div key={p.id} onClick={() => abrir(p.id)} style={{
              display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: T.band,
              borderTop: i ? `1px solid ${T.border}` : 'none', borderLeft: `3px solid ${p.estado === 'nuevo' ? T.accent : 'transparent'}`,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.head; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.band; }}>
              {p.captura_url && (
                <img src={p.captura_url} alt="" style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.border}`, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: FT, fontSize: 12.5, fontWeight: 700, color: T.text3 }}>#{p.id}</span>
                  {chip(nombreDe(TIPOS, p.tipo), colorDe(TIPOS, p.tipo))}
                  {chip(nombreDe(ESTADOS, p.estado), colorDe(ESTADOS, p.estado))}
                  {p.ultima_del_equipo === false && chip('Respondió el cliente', T.warn)}
                  {p.tarea_id && chip(`En pendientes #${p.tarea_id}`, T.accentTxt)}
                </div>
                <div style={{ fontFamily: FT, fontSize: 13.5, fontWeight: 600, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tituloPedido(p)}</div>
                <div style={{ fontSize: 12.5, color: T.text2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.mensaje ? `«${String(p.mensaje).replace(/\s+/g, ' ')}»` : 'Sin mensaje'}
                </div>
                <div style={{ fontSize: 12, color: T.text3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.usuario_nombre || p.usuario_email || 'Sin usuario'}{p.asignado_nombre ? ` · lo atiende ${p.asignado_nombre.split(' ')[0]}` : ''}
                </div>
              </div>
              <div style={{ width: 168, flexShrink: 0, textAlign: 'center' }} className="lz-ped-neg">
                <span title={p.negocio || 'Sin negocio'} style={{
                  display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700,
                  borderRadius: 7, padding: '3px 8px', boxSizing: 'border-box',
                  color: p.negocio ? T.accentTxt : T.text3, background: p.negocio ? `${T.accent}1c` : T.card,
                }}>{p.negocio || 'Sin negocio'}</span>
              </div>
              <div style={{ width: 118, flexShrink: 0, textAlign: 'right', fontSize: 11.5, color: T.text3, whiteSpace: 'nowrap' }}>{fecha(p.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      <Drawer anchor="right" open={!!abiertoId} onClose={cerrar} PaperProps={{ sx: { width: { xs: '100%', md: 760 } } }}>
        {abiertoId && <DetallePedido id={abiertoId} onCerrar={cerrar} catalogo={catalogo} />}
      </Drawer>
    </Box>
  );
}

function DetallePedido({ id, onCerrar, catalogo }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [interna, setInterna] = useState(false);
  const [mandando, setMandando] = useState(false);
  const [supers, setSupers] = useState([]);
  const [ajusteAbierto, setAjusteAbierto] = useState(null);
  const [zoom, setZoom] = useState(false);

  const cargar = useCallback(async () => {
    try { const r = await SuperAPI.pedido(id); setP(r.pedido); }
    catch (e) { setError(e?.status === 404 ? 'Ese pedido no existe.' : 'No se pudo cargar el pedido.'); }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { SuperAPI.superusuarios().then((r) => setSupers(r?.usuarios || [])).catch(() => {}); }, []);

  const cambiar = async (cambios) => {
    try { const r = await SuperAPI.actualizarPedido(id, cambios); setP(r.pedido); }
    catch { showAlert('No se pudo guardar el cambio.', 'error'); }
  };
  const responder = async () => {
    if (!texto.trim()) return;
    setMandando(true);
    try {
      const r = await SuperAPI.responder(id, texto.trim(), interna);
      setP(r.pedido); setTexto('');
      if (!interna) showAlert(r.mail ? 'Respuesta enviada: la ve en el chat y le llegó por mail.' : 'Respuesta guardada: la ve en el chat (el mail no salió).', r.mail ? 'success' : 'warning');
    } catch { showAlert('No se pudo enviar la respuesta.', 'error'); }
    finally { setMandando(false); }
  };

  // Pasar el pedido a «Pendientes de desarrollo» con su negocio (Diego 14/11/2026).
  const pasarAPendientes = async () => {
    const pant = String(p.pantalla || '');
    const modulo = [[/^\/rrhh/, 'rrhh'], [/^\/(menu|insumos|recetas|articulos)/, 'recetas'], [/^\/(gestion|resultados|panel)/, 'resultados'],
      [/^\/(tableros|plaza)/, 'tableros'], [/^\/(conciliacion|movimientos)/, 'administracion'], [/^\/m(\/|$)/, 'celular']]
      .find(([re]) => re.test(pant))?.[1] || 'general';
    try {
      const r = await SuperAPI.crearTarea({
        titulo: tituloPedido(p).slice(0, 200),
        detalle: `Pedido #${p.id} de ${p.usuario_nombre || p.usuario_email || 'un cliente'}${pant ? ` · pantalla ${pant}` : ''}.\n\n${p.mensaje || ''}`,
        modulo, business_id: p.business_id || null, pedido_id: p.id, prioridad: 'normal', solicitante_id: p.user_id || null,
      });
      if (p.estado === 'nuevo' || p.estado === 'revision') await cambiar({ estado: 'desarrollo' });
      setP((x) => ({ ...x, tarea_id: r.tarea.id }));
      showAlert(`Quedó en Pendientes de desarrollo (#${r.tarea.id}).`, 'success');
    } catch { showAlert('No se pudo pasar a pendientes.', 'error'); }
  };

  const rapidas = useMemo(() => {
    if (!p) return [];
    const out = [];
    if (p.business_id) out.push({ alcance: 'negocio', id: p.business_id, nombre: p.negocio || `#${p.business_id}` });
    (p.negocios || []).filter((n) => n.id !== p.business_id).forEach((n) => out.push({ alcance: 'negocio', id: n.id, nombre: n.name }));
    if (p.user_id) out.push({ alcance: 'usuario', id: p.user_id, nombre: p.usuario_nombre || p.usuario_email || `#${p.user_id}` });
    if (p.organization_id) out.push({ alcance: 'organizacion', id: p.organization_id, nombre: p.organizacion || `#${p.organization_id}` });
    return out;
  }, [p]);
  const nuevoAjuste = () => {
    const alcance = p.alcance === 'global' ? 'global' : p.alcance === 'usuario' ? 'usuario' : 'negocio';
    const scope = alcance === 'usuario' ? { scope_id: p.user_id, scope_nombre: p.usuario_nombre || p.usuario_email }
      : alcance === 'negocio' && p.business_id ? { scope_id: p.business_id, scope_nombre: p.negocio } : {};
    setAjusteAbierto({ alcance, ...scope, solicitud_id: p.id, nota: `Pedido #${p.id}` });
  };

  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!p) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>;
  const ctx = p.contexto || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={800} sx={{ flex: 1, minWidth: 0 }} noWrap>#{p.id} · {tituloPedido(p)}</Typography>
        <ChipColor label={nombreDe(TIPOS, p.tipo)} color={colorDe(TIPOS, p.tipo)} />
        {p.tarea_id
          ? <Button size="small" component={Link} to={`/super?tab=tareas&tarea=${p.tarea_id}`} sx={{ textTransform: 'none', fontWeight: 700 }}>Ver pendiente #{p.tarea_id}</Button>
          : <Button size="small" variant="outlined" onClick={pasarAPendientes} sx={{ textTransform: 'none', fontWeight: 700 }}>Pasar a pendientes</Button>}
        <IconButton onClick={onCerrar}><CloseIcon /></IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
        {/* Quién y dónde */}
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', mb: 2 }}>
          <Typography variant="body2"><b>Usuario:</b> {p.usuario_nombre || '—'} · <b>Correo:</b> {p.usuario_email || '—'} · <b>Id:</b> {p.user_id || '—'}</Typography>
          <Typography variant="body2"><b>Negocio:</b> {p.negocio ? `${p.negocio} (#${p.business_id})` : '—'}{p.organizacion ? ` · Organización: ${p.organizacion}` : ''}</Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {fecha(p.created_at)}{p.pantalla ? ` · Pantalla: ${p.pantalla}` : ''}{p.respuesta ? ` · Eligió: ${p.respuesta}` : ''}
            {ctx.pantalla_ancho ? ` · Pantalla ${ctx.pantalla_ancho}×${ctx.pantalla_alto}` : ''}
          </Typography>
          {(p.negocios || []).length > 1 && (
            <Typography variant="caption" color="text.secondary" component="div">Sus negocios: {p.negocios.map((n) => n.name).join(', ')}</Typography>
          )}
        </Box>

        <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 15, mb: 2 }}>{p.mensaje}</Typography>

        {p.captura_url && (
          <Box component="img" src={p.captura_url} alt="Captura del cliente" onClick={() => setZoom(true)}
            sx={{ width: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', cursor: 'zoom-in', mb: 2 }} />
        )}

        {/* Manejo */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
          <TextField select size="small" label="Estado" value={p.estado} onChange={(e) => cambiar({ estado: e.target.value })} sx={{ flex: 1 }}>
            {ESTADOS.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Tipo" value={p.tipo || 'consulta'} onChange={(e) => cambiar({ tipo: e.target.value })} sx={{ flex: 1 }}>
            {TIPOS.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Alcance" value={p.alcance || ''} onChange={(e) => cambiar({ alcance: e.target.value || null })} sx={{ flex: 1.3 }}>
            {ALCANCES.map(([k, l]) => <MenuItem key={k || 'nada'} value={k}>{l}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Asignado" value={p.asignado_a || ''} onChange={(e) => cambiar({ asignado_a: e.target.value || null })} sx={{ flex: 1 }}>
            <MenuItem value="">Nadie</MenuItem>
            {supers.map((u) => <MenuItem key={u.id} value={u.id}>{u.display_name || u.name || u.email}</MenuItem>)}
          </TextField>
        </Stack>

        {/* Ajustes a medida de este pedido */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography fontWeight={700} sx={{ flex: 1, fontSize: 14 }}>Ajustes a medida de este pedido</Typography>
            <Button size="small" onClick={nuevoAjuste}>+ Crear ajuste</Button>
          </Stack>
          {!(p.ajustes || []).length && <Typography variant="caption" color="text.secondary">Ninguno. Si lo resolvés solo para este cliente (o para todos), creá un ajuste.</Typography>}
          {(p.ajustes || []).map((a) => (
            <Chip key={a.id} sx={{ mr: 0.75, mb: 0.75 }} label={`${a.clave} · ${a.alcance}${a.activo ? '' : ' (apagado)'}`}
              onClick={() => setAjusteAbierto({ ...a, scope_nombre: rapidas.find((r) => r.id === a.scope_id)?.nombre })} />
          ))}
        </Box>

        <Divider sx={{ mb: 1.5 }} />
        {/* Charla */}
        <Typography fontWeight={700} sx={{ fontSize: 14, mb: 1 }}>Conversación</Typography>
        <Stack spacing={1}>
          {(p.respuestas || []).length === 0 && <Typography variant="caption" color="text.secondary">Todavía nadie respondió.</Typography>}
          {(p.respuestas || []).map((r) => (
            <Box key={r.id} sx={{
              alignSelf: r.de_equipo ? 'flex-end' : 'flex-start', maxWidth: '88%', px: 1.5, py: 1, borderRadius: 2,
              bgcolor: r.interna ? '#fef9c3' : r.de_equipo ? 'primary.main' : 'action.hover',
              color: r.de_equipo && !r.interna ? 'primary.contrastText' : 'text.primary',
            }}>
              <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.85 }} component="div">
                {r.interna ? '🔒 Nota interna · ' : ''}{r.de_equipo ? (r.autor || 'Equipo') : 'Cliente'} · {fecha(r.created_at)}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.texto}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: interna ? '#fffbeb' : 'background.paper' }}>
        <TextField fullWidth multiline minRows={2} maxRows={8} size="small" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder={interna ? 'Nota para el equipo (el cliente no la ve)…' : 'Respuesta al cliente (la ve en el chat y le llega por mail)…'} />
        <Stack direction="row" alignItems="center" sx={{ mt: 1 }}>
          <FormControlLabel control={<Switch size="small" checked={interna} onChange={(e) => setInterna(e.target.checked)} />} label="Nota interna" sx={{ flex: 1 }} />
          <Button variant="contained" disabled={mandando || !texto.trim()} onClick={responder}>
            {mandando ? 'Enviando…' : interna ? 'Guardar nota' : 'Responder'}
          </Button>
        </Stack>
      </Box>

      <AjusteDialog open={!!ajusteAbierto} inicial={ajusteAbierto} catalogo={catalogo} opcionesRapidas={rapidas}
        onClose={() => setAjusteAbierto(null)} onGuardado={() => { cargar(); showAlert('Ajuste guardado. Se aplica la próxima vez que el cliente cargue la app.', 'success'); }} />

      {zoom && (
        <Box onClick={() => setZoom(false)} sx={{ position: 'fixed', inset: 0, zIndex: 2000, bgcolor: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', p: 2 }}>
          <Box component="img" src={p.captura_url} alt="" sx={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 1 }} />
        </Box>
      )}
    </Box>
  );
}
