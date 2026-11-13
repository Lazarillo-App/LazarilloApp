// src/componentes/super/SuperAjustes.jsx
// Ajustes a medida (13/11/2026): todo lo que está prendido para un cliente, un negocio, una
// organización o para todos. Gana el más específico: usuario > negocio > organización > global.
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, Chip, IconButton, Tooltip, Switch, Alert, CircularProgress } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { showConfirm } from '@/servicios/appConfirm';
import AjusteDialog from './AjusteDialog';

const NOMBRE_ALCANCE = { global: 'Todos', organizacion: 'Organización', negocio: 'Negocio', usuario: 'Usuario' };
const verValor = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : v === true ? 'Prendido' : v === false ? 'Apagado' : JSON.stringify(v));

export default function SuperAjustes({ catalogo = [], onCatalogo }) {
  const [lista, setLista] = useState(null);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await SuperAPI.ajustes();
      setLista(r?.ajustes || []);
      onCatalogo?.(r?.catalogo || []);
    } catch { setError('No se pudieron cargar los ajustes.'); setLista([]); }
  }, [onCatalogo]);
  useEffect(() => { cargar(); }, [cargar]);

  const alternar = async (a) => {
    try { await SuperAPI.guardarAjuste({ ...a, activo: !a.activo }); cargar(); }
    catch { showAlert('No se pudo cambiar.', 'error'); }
  };
  const borrar = async (a) => {
    if (!(await showConfirm(`¿Borrar el ajuste "${a.clave}" para ${a.scope_nombre || NOMBRE_ALCANCE[a.alcance]}?`, { danger: true }))) return;
    try { await SuperAPI.borrarAjuste(a.id); cargar(); } catch { showAlert('No se pudo borrar.', 'error'); }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Lo que se prende acá le cambia la app a ese cliente, negocio u organización (o a todos). Si hay varios para la misma clave, gana el más específico: usuario, después negocio, después organización y por último todos.
        </Typography>
        <Button variant="contained" onClick={() => setEditando({})} sx={{ ml: 2, whiteSpace: 'nowrap' }}>+ Nuevo ajuste</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!lista && <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>}
      {lista?.length === 0 && <Typography color="text.secondary" sx={{ py: 3 }}>Todavía no hay ajustes.</Typography>}
      <Stack spacing={1}>
        {lista?.map((a) => (
          <Stack key={a.id} direction="row" alignItems="center" spacing={1.5}
            sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', opacity: a.activo ? 1 : 0.55 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography fontWeight={800} sx={{ fontSize: 14, fontFamily: 'monospace' }}>{a.clave}</Typography>
                <Chip size="small" label={`${NOMBRE_ALCANCE[a.alcance]}${a.scope_nombre ? `: ${a.scope_nombre}` : a.scope_id ? ` #${a.scope_id}` : ''}`} />
                {a.solicitud_id && <Chip size="small" variant="outlined" label={`Pedido #${a.solicitud_id}`} />}
              </Stack>
              <Typography variant="body2" noWrap>{verValor(a.valor)}</Typography>
              {a.nota && <Typography variant="caption" color="text.secondary" noWrap component="div">{a.nota}</Typography>}
            </Box>
            <Tooltip title={a.activo ? 'Apagar' : 'Prender'}><Switch checked={a.activo} onChange={() => alternar(a)} /></Tooltip>
            <Tooltip title="Editar"><IconButton onClick={() => setEditando(a)}><EditIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Borrar"><IconButton onClick={() => borrar(a)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          </Stack>
        ))}
      </Stack>

      {catalogo.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography fontWeight={700} sx={{ fontSize: 14, mb: 1 }}>Claves que ya entiende la app</Typography>
          <Stack spacing={0.75}>
            {catalogo.map((c) => (
              <Typography key={c.clave} variant="body2"><b style={{ fontFamily: 'monospace' }}>{c.clave}</b> — {c.titulo}: <span style={{ color: '#64748b' }}>{c.descripcion}</span></Typography>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Para algo programado a medida se usa cualquier otra clave, y en el código se lee con useAjuste('clave').
          </Typography>
        </Box>
      )}

      <AjusteDialog open={!!editando} inicial={editando} catalogo={catalogo}
        onClose={() => setEditando(null)} onGuardado={() => { cargar(); showAlert('Ajuste guardado.', 'success'); }} />
    </Box>
  );
}
