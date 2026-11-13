// src/componentes/super/SuperPedidos.jsx
// Bandeja de pedidos de los clientes (13/11/2026): lo que mandan desde el chat de Anthony, con su
// captura. Se cambia el estado, el tipo, el alcance y a quién está asignado; se responde al cliente
// (lo ve en el chat y le llega por mail) o se deja una nota interna; y se crean ajustes a medida.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Chip, TextField, MenuItem, InputAdornment, Drawer, IconButton, Button,
  Switch, FormControlLabel, CircularProgress, Alert, Tooltip, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import AjusteDialog from './AjusteDialog';

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

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
          {FILTROS.map(([k, l]) => {
            const n = k === 'abiertos' ? abiertos : k ? cuentas[k] : undefined;
            return (
              <Chip key={k || 'todos'} label={n ? `${l} · ${n}` : l} onClick={() => setFiltro(k)}
                color={filtro === k ? 'primary' : 'default'} variant={filtro === k ? 'filled' : 'outlined'} sx={{ fontWeight: 600 }} />
            );
          })}
        </Stack>
        <TextField size="small" placeholder="Buscar: texto, mail, negocio o #" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        <Tooltip title="Actualizar"><IconButton onClick={cargar}><RefreshIcon /></IconButton></Tooltip>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!datos && !error && <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>}
      {datos?.pedidos?.length === 0 && <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No hay pedidos con ese filtro.</Typography>}

      <Stack spacing={1}>
        {datos?.pedidos?.map((p) => (
          <Box key={p.id} onClick={() => abrir(p.id)} sx={{
            display: 'flex', gap: 1.5, alignItems: 'center', p: 1.25, borderRadius: 2, cursor: 'pointer', bgcolor: 'background.paper',
            border: '1px solid', borderColor: p.estado === 'nuevo' ? 'primary.light' : 'divider', '&:hover': { borderColor: 'primary.main' },
          }}>
            {p.captura_url
              ? <Box component="img" src={p.captura_url} alt="" sx={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
              : <Box sx={{ width: 72, height: 48, borderRadius: 1, bgcolor: 'action.hover', flexShrink: 0 }} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography fontWeight={800} sx={{ fontSize: 13 }}>#{p.id}</Typography>
                <ChipColor label={nombreDe(TIPOS, p.tipo)} color={colorDe(TIPOS, p.tipo)} />
                <ChipColor label={nombreDe(ESTADOS, p.estado)} color={colorDe(ESTADOS, p.estado)} />
                {p.ultima_del_equipo === false && <Chip size="small" label="Respondió el cliente" color="warning" sx={{ height: 22 }} />}
                <Typography variant="caption" color="text.secondary">{fecha(p.created_at)}</Typography>
                {p.asignado_nombre && <Typography variant="caption" color="text.secondary">· {p.asignado_nombre}</Typography>}
              </Stack>
              <Typography variant="body2" noWrap sx={{ mt: 0.25 }}>{p.mensaje}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {p.usuario_nombre || p.usuario_email || 'Sin usuario'}{p.usuario_email ? ` · ${p.usuario_email}` : ''}{p.negocio ? ` · ${p.negocio}` : ''}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>

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
        <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>Pedido #{p.id}</Typography>
        <ChipColor label={nombreDe(TIPOS, p.tipo)} color={colorDe(TIPOS, p.tipo)} />
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
