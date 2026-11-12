// src/componentes/plazas/EditorPlaza.jsx — crear / editar una plaza de despacho (nombre + productos).
// Se usa en Configuración › Sectores (con el sector fijo) y en Operación › Tableros (con el «+», eligiendo
// el sector entre los que la persona puede gestionar: dueño/admin todos, el jefe los que conduce).
import React from 'react';
import { Box, Stack, Typography, Button, TextField, Chip, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, ToggleButton, ToggleButtonGroup } from '@mui/material';
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
  // Diego 12/11/2026: ordenados por ventas, filtro de agrupación (opcional) y agrupados por rubro o subrubro.
  const [agrupaciones, setAgrupaciones] = React.useState([]);
  const [agrupFiltro, setAgrupFiltro] = React.useState('');
  const [modoGrupo, setModoGrupo] = React.useState('rubro');
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    if (!abierto) return;
    setNombre(plaza?.nombre || '');
    setElegidos((plaza?.productos || []).map((p) => ({ id: p.articleId, nombre: p.nombre || `#${p.articleId}` })));
    setQ('');
    if (!sector) setSectorId((v) => v || sectores[0]?.id || '');
    setAgrupFiltro('');
    PlazasAPI.articulos('').then((r) => { setArticulos(r.articulos); setAgrupaciones(r.agrupaciones); })
      .catch(() => { setArticulos([]); setAgrupaciones([]); });
  }, [abierto, plaza?.id]); // por id: desde la plaza el objeto se arma en cada render

  const ids = new Set(elegidos.map((e) => Number(e.id)));
  const filtrados = articulos.filter((a) => (!q.trim() || String(a.nombre).toLowerCase().includes(q.trim().toLowerCase()))
    && (!agrupFiltro || (a.agrupaciones || []).map(Number).includes(Number(agrupFiltro))));
  // Grupos por rubro o subrubro: el que más vende primero; adentro, cada producto por ventas (ya viene así).
  const grupos = React.useMemo(() => {
    const m = new Map();
    for (const a of filtrados) {
      const k = (modoGrupo === 'rubro' ? a.rubro : a.subrubro) || (modoGrupo === 'rubro' ? 'Sin rubro' : 'Sin subrubro');
      const g = m.get(k) || { nombre: k, ventas: 0, items: [] };
      g.ventas += Number(a.ventas) || 0; g.items.push(a); m.set(k, g);
    }
    return [...m.values()].sort((x, y) => y.ventas - x.ventas || x.nombre.localeCompare(y.nombre, 'es'));
  }, [filtrados, modoGrupo]);
  const toggleGrupo = (g) => {
    const todos = g.items.every((a) => ids.has(Number(a.id)));
    setElegidos((prev) => (todos
      ? prev.filter((e) => !g.items.some((a) => Number(a.id) === Number(e.id)))
      : [...prev, ...g.items.filter((a) => !ids.has(Number(a.id))).map((a) => ({ id: Number(a.id), nombre: a.nombre }))]));
  };
  const fmtVentas = (n) => (Number(n) > 0 ? `${Math.round(Number(n)).toLocaleString('es-AR')} vend.` : '');
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
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth>
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
        {/* Buscador y filtros, del mismo alto (40). La agrupación no es obligatoria. */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ '& .MuiInputBase-root': { height: 40 } }}>
          <TextField fullWidth size="small" placeholder="Buscar producto con receta…" value={q} onChange={(e) => setQ(e.target.value)} />
          <TextField select size="small" value={agrupFiltro} onChange={(e) => setAgrupFiltro(e.target.value)} sx={{ width: 220, flexShrink: 0 }}
            SelectProps={{ displayEmpty: true, renderValue: (v) => (v ? agrupaciones.find((g) => String(g.id) === String(v))?.nombre || '' : 'Agrupación: todas') }}>
            <MenuItem value="">Todas las agrupaciones</MenuItem>
            {agrupaciones.map((g) => <MenuItem key={g.id} value={String(g.id)}>{g.nombre}</MenuItem>)}
          </TextField>
          <ToggleButtonGroup exclusive size="small" value={modoGrupo} onChange={(_, v) => v && setModoGrupo(v)}
            sx={{ flexShrink: 0, height: 40, '& .MuiToggleButton-root': { px: 1.5, fontSize: '0.75rem', textTransform: 'none' } }}>
            <ToggleButton value="rubro">Rubro</ToggleButton>
            <ToggleButton value="subrubro">Subrubro</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Box sx={{ maxHeight: 340, overflowY: 'auto', mt: 0.75, border: '1px solid #eef0f4', borderRadius: 1.5 }}>
          {grupos.map((g) => {
            const marcados = g.items.filter((a) => ids.has(Number(a.id))).length;
            return (
              <Box key={g.nombre}>
                {/* Encabezado del grupo: tildarlo suma (o saca) todos sus productos. */}
                <Stack direction="row" alignItems="center" onClick={() => toggleGrupo(g)}
                  sx={{ px: 1, minHeight: 32, cursor: 'pointer', bgcolor: '#f5f7fa', borderBottom: '1px solid #eef0f4', position: 'sticky', top: 0, zIndex: 1 }}>
                  <Checkbox size="small" checked={marcados === g.items.length} indeterminate={marcados > 0 && marcados < g.items.length} sx={{ p: 0.5, mr: 0.5 }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', flex: 1, minWidth: 0 }} noWrap>{g.nombre}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap', mr: 1 }}>{g.items.length} · {fmtVentas(g.ventas)}</Typography>
                </Stack>
                {g.items.slice(0, 200).map((a) => (
                  <Stack key={a.id} direction="row" alignItems="center" onClick={() => toggle(a)}
                    sx={{ pl: 3, pr: 1, minHeight: 34, cursor: 'pointer', borderBottom: '1px solid #f5f6f8', '&:hover': { bgcolor: 'action.hover' } }}>
                    <Checkbox size="small" checked={ids.has(Number(a.id))} sx={{ p: 0.5, mr: 0.5 }} />
                    <Typography sx={{ fontSize: '0.8rem', flex: 1, minWidth: 0 }} noWrap>{a.nombre}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtVentas(a.ventas)}</Typography>
                  </Stack>
                ))}
              </Box>
            );
          })}
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

