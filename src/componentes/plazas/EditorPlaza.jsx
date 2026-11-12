// src/componentes/plazas/EditorPlaza.jsx — crear / editar una plaza de despacho (nombre + productos).
// Se usa en Configuración › Sectores (con el sector fijo) y en Operación › Tableros (con el «+», eligiendo
// el sector entre los que la persona puede gestionar: dueño/admin todos, el jefe los que conduce).
import React from 'react';
import { Box, Stack, Typography, Button, TextField, Chip, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem } from '@mui/material';
import { showAlert } from '@/servicios/appAlert';
import { PlazasAPI } from '@/servicios/apiPlazas';

export default function EditorPlaza({ abierto, sector, sectores = [], plaza, onCerrar, onGuardado }) {
  // Sin sector fijo (desde Tableros): se elige entre los sectores donde la persona puede crear plazas.
  const [sectorId, setSectorId] = React.useState(sector?.id || sectores[0]?.id || '');
  const sectorElegido = sector || sectores.find((x) => String(x.id) === String(sectorId)) || null;
  const [nombre, setNombre] = React.useState('');
  const [elegidos, setElegidos] = React.useState([]); // [{ id, nombre }]
  const [q, setQ] = React.useState('');
  const [articulos, setArticulos] = React.useState([]);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    if (!abierto) return;
    setNombre(plaza?.nombre || '');
    setElegidos((plaza?.productos || []).map((p) => ({ id: p.articleId, nombre: p.nombre || `#${p.articleId}` })));
    setQ('');
    if (!sector) setSectorId((v) => v || sectores[0]?.id || '');
    PlazasAPI.articulos('').then(setArticulos).catch(() => setArticulos([]));
  }, [abierto, plaza]);

  const ids = new Set(elegidos.map((e) => Number(e.id)));
  const filtrados = articulos.filter((a) => !q.trim() || String(a.nombre).toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (a) => setElegidos((prev) => (ids.has(Number(a.id)) ? prev.filter((e) => Number(e.id) !== Number(a.id)) : [...prev, { id: Number(a.id), nombre: a.nombre }]));

  const guardar = async () => {
    setGuardando(true);
    try {
      const articleIds = elegidos.map((e) => Number(e.id));
      let id = plaza?.id;
      if (plaza?.id) await PlazasAPI.editar(plaza.id, nombre.trim(), articleIds);
      else id = (await PlazasAPI.crear(sectorElegido.id, nombre.trim(), articleIds))?.id;
      try { window.dispatchEvent(new CustomEvent('plazas:changed')); } catch { /* sin evento */ }
      onGuardado(id);
    } catch (e) {
      showAlert(e?.message || 'No se pudo guardar la plaza', 'error');
    } finally { setGuardando(false); }
  };

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
        {plaza?.id ? 'Editar plaza' : 'Nueva plaza'}{sectorElegido && <Typography component="span" color="text.secondary" sx={{ fontSize: '0.85rem' }}> · {sectorElegido.nombre}</Typography>}
      </DialogTitle>
      <DialogContent>
        {!sector && sectores.length > 1 && (
          <TextField select fullWidth size="small" label="Sector" value={sectorId} onChange={(e) => setSectorId(e.target.value)} sx={{ mt: 1 }}>
            {sectores.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
          </TextField>
        )}
        <TextField autoFocus fullWidth size="small" label="Nombre" placeholder="Ej. Ensaladas, Freidora, Tostados" value={nombre}
          onChange={(e) => setNombre(e.target.value)} sx={{ mt: 1.5, mb: 2 }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
          PRODUCTOS DE LA PLAZA ({elegidos.length})
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5, minHeight: 24 }}>
          {elegidos.map((e) => <Chip key={e.id} label={e.nombre} size="small" onDelete={() => toggle(e)} sx={{ height: 24, fontSize: '0.72rem' }} />)}
          {!elegidos.length && <Typography variant="caption" color="text.secondary">Tildá abajo los productos que se arman en esta plaza.</Typography>}
        </Stack>
        <TextField fullWidth size="small" placeholder="Buscar producto con receta…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Box sx={{ maxHeight: 280, overflowY: 'auto', mt: 0.5, border: '1px solid #eef0f4', borderRadius: 1.5 }}>
          {filtrados.slice(0, 200).map((a) => (
            <Stack key={a.id} direction="row" alignItems="center" onClick={() => toggle(a)}
              sx={{ px: 1, minHeight: 34, cursor: 'pointer', borderBottom: '1px solid #f5f6f8', '&:hover': { bgcolor: 'action.hover' } }}>
              <Checkbox size="small" checked={ids.has(Number(a.id))} sx={{ p: 0.5, mr: 0.5 }} />
              <Typography sx={{ fontSize: '0.8rem' }}>{a.nombre}</Typography>
            </Stack>
          ))}
          {!filtrados.length && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1.5 }}>Sin resultados</Typography>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" disableElevation disabled={guardando || !nombre.trim() || !sectorElegido} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

