// src/componentes/SuperUsuariosSection.jsx
//
// "Super usuarios" en Mi perfil — solo lo ve quien tiene es_superusuario.
// Lista los super usuarios actuales y deja sumar (o quitar) a cualquier
// cuenta buscándola por email o nombre. La cuenta dueña de Lazarillo no se
// puede quitar y nadie se puede quitar a sí mismo (lo valida el back).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Paper, Stack, Box, Typography, Chip, Button, TextField, Avatar,
  InputAdornment, CircularProgress, Alert,
} from '@mui/material';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { http } from '@/servicios/apiBusinesses';
import { showConfirm } from '@/servicios/appConfirm';

const tc = 'var(--color-primary, #3b82f6)';

const ERRORES = {
  no_podes_quitarte_a_vos: 'No te podés quitar a vos mismo.',
  es_el_dueno: 'La cuenta dueña de Lazarillo no se puede quitar.',
  solo_superusuario: 'Ya no tenés permiso de super usuario.',
};

const nombreDe = (u) => u?.display_name || u?.name || u?.email || '';
const iniciales = (u) => nombreDe(u).split(/[\s@.]+/).filter(Boolean)
  .map((p) => p[0]).slice(0, 2).join('').toUpperCase();

function FilaUsuario({ u, yo, accion }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}
      sx={{ py: 1, minHeight: 48, '& + &': { borderTop: '1px solid #f3f4f6' } }}>
      <Avatar sx={{ width: 32, height: 32, fontSize: '0.78rem', fontWeight: 700, bgcolor: u.es_superusuario ? tc : '#cbd5e1' }}>
        {iniciales(u)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.85rem' }}>
          {nombreDe(u)}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {u.email}
        </Typography>
      </Box>
      {u.protegido && <Chip label="Dueño" size="small" sx={{ height: 30, width: 108, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }} />}
      {Number(u.id) === Number(yo) && !u.protegido && <Chip label="Vos" size="small" sx={{ height: 30, width: 108, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }} />}
      {accion}
    </Stack>
  );
}

export default function SuperUsuariosSection() {
  const [lista, setLista] = useState([]);
  const [yo, setYo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState(null); // null = sin búsqueda
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(null); // id en curso
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await http('/superusuarios', { withBusinessId: false, cache: false });
      setLista(r?.usuarios || []);
      setYo(r?.yo ?? null);
    } catch {
      setError('No se pudo cargar la lista de super usuarios.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Búsqueda con pausa corta mientras se escribe (mín. 2 letras)
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setResultados(null); return undefined; }
    let vivo = true;
    setBuscando(true);
    const h = setTimeout(async () => {
      try {
        const r = await http(`/superusuarios?q=${encodeURIComponent(t)}`, { withBusinessId: false, cache: false });
        if (vivo) setResultados(r?.usuarios || []);
      } catch {
        if (vivo) setResultados([]);
      } finally {
        if (vivo) setBuscando(false);
      }
    }, 300);
    return () => { vivo = false; clearTimeout(h); };
  }, [q]);

  const cambiar = useCallback(async (u, valor) => {
    const quien = nombreDe(u);
    const ok = await showConfirm(
      valor
        ? `¿Hacer super usuario a ${quien} (${u.email})? Va a poder dar y quitar este permiso a otras cuentas.`
        : `¿Quitarle el super usuario a ${quien} (${u.email})?`,
      { danger: !valor, confirmText: valor ? 'Hacer super usuario' : 'Quitar' }
    );
    if (!ok) return;
    setGuardando(u.id);
    setError('');
    try {
      const r = await http(`/superusuarios/${u.id}`, {
        method: 'PUT', body: { es_superusuario: valor }, withBusinessId: false,
      });
      const nuevo = r?.usuario;
      if (nuevo) setResultados((rs) => rs && rs.map((x) => (x.id === nuevo.id ? nuevo : x)));
      await cargar();
    } catch (e) {
      const code = String(e?.message || '').split(':')[0].trim();
      setError(ERRORES[code] || 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(null);
    }
  }, [cargar]);

  const boton = (u) => {
    if (u.protegido || Number(u.id) === Number(yo)) return null;
    const enCurso = guardando === u.id;
    return u.es_superusuario ? (
      <Button size="small" variant="outlined" color="error" disabled={enCurso}
        onClick={() => cambiar(u, false)} sx={{ height: 30, width: 108, textTransform: 'none', fontWeight: 600 }}>
        {enCurso ? <CircularProgress size={14} /> : 'Quitar'}
      </Button>
    ) : (
      <Button size="small" variant="contained" disableElevation disabled={enCurso}
        onClick={() => cambiar(u, true)}
        sx={{ height: 30, width: 108, textTransform: 'none', fontWeight: 600, bgcolor: tc, '&:hover': { bgcolor: tc, filter: 'brightness(0.92)' } }}>
        {enCurso ? <CircularProgress size={14} color="inherit" /> : 'Hacer super'}
      </Button>
    );
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1}
        sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <VerifiedUserOutlinedIcon sx={{ color: tc, fontSize: 18 }} />
        <Typography fontWeight={700} sx={{ fontSize: '0.88rem' }}>Super usuarios</Typography>
        {!cargando && (
          <Chip label={lista.length} size="small"
            sx={{ fontSize: '0.62rem', height: 18, bgcolor: '#f1f5f9', color: '#64748b' }} />
        )}
      </Stack>

      <Box sx={{ p: 2.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 1.5 }}>
          Cuentas de Lazarillo con permisos especiales en toda la app. Por ahora pueden sumar o quitar
          super usuarios; después se agregan «Ver como» y marcar lo que viene por default.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 1.5, py: 0 }} onClose={() => setError('')}>{error}</Alert>}

        {cargando ? (
          <Stack alignItems="center" sx={{ py: 2 }}><CircularProgress size={20} /></Stack>
        ) : (
          <Box>
            {lista.map((u) => <FilaUsuario key={u.id} u={u} yo={yo} accion={boton(u)} />)}
          </Box>
        )}

        <Typography fontWeight={700} sx={{ fontSize: '0.8rem', mt: 2.5, mb: 1 }}>
          Sumar un super usuario
        </Typography>
        <TextField
          fullWidth size="small" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscá la cuenta por email o nombre"
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>,
            endAdornment: buscando ? <InputAdornment position="end"><CircularProgress size={14} /></InputAdornment> : null,
          }}
        />
        {resultados && (
          <Box sx={{ mt: 1 }}>
            {resultados.length === 0 && !buscando && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', py: 1 }}>
                No hay cuentas que coincidan.
              </Typography>
            )}
            {resultados.map((u) => <FilaUsuario key={u.id} u={u} yo={yo} accion={boton(u)} />)}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
