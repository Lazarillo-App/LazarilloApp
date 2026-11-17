// src/componentes/plazas/EditorPlaza.jsx — crear / editar una plaza de despacho (nombre + productos).
// Se usa en Configuración › Sectores (con el sector fijo) y en Operación › Tableros (con el «+», eligiendo
// el sector entre los que la persona puede gestionar: dueño/admin todos, el jefe los que conduce).
import React from 'react';
import { Box, Stack, Typography, Button, TextField, Chip, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, ToggleButton, ToggleButtonGroup } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { showAlert } from '@/servicios/appAlert';
import { showPrompt } from '@/servicios/appPrompt';
import { PlazasAPI } from '@/servicios/apiPlazas';

export default function EditorPlaza({ abierto, sector, sectores = [], puedeCrearSector = false, plaza, onCerrar, onGuardado }) {
  // Sin sector fijo (desde Tableros): se elige entre los sectores donde la persona puede crear plazas.
  // Dueño/admin también pueden crear uno ahí mismo (Diego 17/11/2026): «+ Crear sector» arriba de la lista.
  const [secs, setSecs] = React.useState(sectores);
  React.useEffect(() => { if (abierto) setSecs(sectores); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sectorId, setSectorId] = React.useState(sector?.id || sectores[0]?.id || '');
  const sectorElegido = sector || secs.find((x) => String(x.id) === String(sectorId)) || null;
  const crearSector = async () => {
    const n = await showPrompt('Nombre del sector (ej. Cocina, Barra, Cafetería):', '');
    if (n == null || !String(n).trim()) return;
    try {
      const s = await PlazasAPI.crearSector(String(n).trim());
      setSecs((l) => (l.some((x) => Number(x.id) === Number(s.id)) ? l : [...l, s].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))));
      setSectorId(s.id);
    } catch (e) { showAlert(e?.message || 'No se pudo crear el sector', 'error'); }
  };
  const conSelector = !sector && (secs.length > 1 || puedeCrearSector);
  const [nombre, setNombre] = React.useState('');
  const [elegidos, setElegidos] = React.useState([]); // [{ id, nombre }]
  const [q, setQ] = React.useState('');
  const [articulos, setArticulos] = React.useState([]);
  // Diego 12/11/2026: ordenados por ventas, filtro de agrupación (opcional) y agrupados por rubro o subrubro.
  const [agrupaciones, setAgrupaciones] = React.useState([]);
  const [agrupFiltro, setAgrupFiltro] = React.useState('');
  const [modoGrupo, setModoGrupo] = React.useState('rubro');
  const [guardando, setGuardando] = React.useState(false);
  // Chips de los productos elegidos: se pueden ocultar para ganar lugar en la lista (Diego 14/11/2026).
  // Se recuerda la elección; si nunca eligió, se ocultan cuando son muchos.
  const [verElegidos, setVerElegidos] = React.useState(() => {
    try { const v = localStorage.getItem('plazas.editor.verElegidos'); return v == null ? null : v === '1'; } catch { return null; }
  });
  const chipsVisibles = verElegidos ?? elegidos.length <= 12;
  // Selección de chips para sacar varios de una (Diego 14/11/2026): tocar un chip lo marca; «Todos» marca todos.
  const [marcados, setMarcados] = React.useState(() => new Set());
  React.useEffect(() => { if (abierto) setMarcados(new Set()); }, [abierto, plaza?.id]);
  const marcar = (id) => setMarcados((prev) => { const n = new Set(prev); if (n.has(Number(id))) n.delete(Number(id)); else n.add(Number(id)); return n; });
  const quitarMarcados = () => {
    setElegidos((prev) => prev.filter((e) => !marcados.has(Number(e.id))));
    setMarcados(new Set());
  };
  const alternarElegidos = () => {
    const v = !chipsVisibles;
    setVerElegidos(v);
    try { localStorage.setItem('plazas.editor.verElegidos', v ? '1' : '0'); } catch { /* sin storage */ }
  };

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
    // Alto fijo: lo que se gana arriba (nombre en la primera fila, chips ocultables) va a la lista de productos.
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth PaperProps={{ sx: { height: 'calc(100% - 64px)' } }}>
      {/* Primera fila: título · sector y el nombre de la plaza al lado (Diego 14/11/2026: ganar lugar). */}
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1.5 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {plaza?.id ? 'Editar plaza' : 'Nueva plaza'}
          {sectorElegido && !conSelector && <Typography component="span" color="text.secondary" sx={{ fontSize: '0.85rem' }}> · {sectorElegido.nombre}</Typography>}
        </Typography>
        {conSelector && (
          <TextField select size="small" value={sectorId} onChange={(e) => { if (e.target.value === '__crear') { crearSector(); return; } setSectorId(e.target.value); }}
            sx={{ width: 170, flexShrink: 0, '& .MuiInputBase-root': { height: 40 } }}
            SelectProps={{ displayEmpty: true, renderValue: (v) => `Sector: ${secs.find((x) => String(x.id) === String(v))?.nombre || 'elegí'}` }}>
            {/* Acción primero, en franja gris (mismo patrón que SelectorBuscable / «+ Crear merma»). */}
            {puedeCrearSector && (
              <MenuItem value="__crear" sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'primary.main',
                bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'action.selected' } }}>
                + Crear sector
              </MenuItem>
            )}
            {secs.map((x) => <MenuItem key={x.id} value={x.id}>{x.nombre}</MenuItem>)}
          </TextField>
        )}
        <TextField autoFocus={!plaza?.id} fullWidth size="small" placeholder="Nombre de la plaza (ej. Ensaladas, Freidora, Tostados)" value={nombre}
          onChange={(e) => setNombre(e.target.value)} inputProps={{ 'aria-label': 'Nombre de la plaza' }}
          sx={{ '& .MuiInputBase-root': { height: 40 } }} />
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Productos elegidos: el título los muestra u oculta. Ocultos, el número sigue cambiando al tildar. */}
        <Stack direction="row" alignItems="center" sx={{ mb: 0.75, minHeight: 26 }}>
        <Stack direction="row" alignItems="center" onClick={elegidos.length ? alternarElegidos : undefined}
          sx={{ cursor: elegidos.length ? 'pointer' : 'default', userSelect: 'none', flex: 1 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            PRODUCTOS DE LA PLAZA ({elegidos.length})
          </Typography>
          {!!elegidos.length && (
            <>
              <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary', ml: 0.25, transition: 'transform .15s', transform: chipsVisibles ? 'rotate(180deg)' : 'none' }} />
              <Typography variant="caption" sx={{ color: '#2492C8', fontWeight: 600 }}>{chipsVisibles ? 'Ocultar' : 'Ver'}</Typography>
            </>
          )}
        </Stack>
        {/* Acciones de la selección: a la derecha, del mismo alto. */}
        {chipsVisibles && elegidos.length > 1 && (
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {marcados.size ? `${marcados.size} marcado${marcados.size !== 1 ? 's' : ''}` : 'Tocá un producto para marcarlo'}
            </Typography>
            <Button size="small" onClick={() => setMarcados(marcados.size === elegidos.length ? new Set() : new Set(elegidos.map((e) => Number(e.id))))}
              sx={{ height: 26, minWidth: 0, px: 1, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
              {marcados.size === elegidos.length ? 'Ninguno' : 'Marcar todos'}
            </Button>
            <Button size="small" variant="outlined" color="error" disabled={!marcados.size} onClick={quitarMarcados}
              sx={{ height: 26, minWidth: 0, px: 1.25, textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}>
              Quitar{marcados.size ? ` ${marcados.size}` : ''}
            </Button>
          </Stack>
        )}
        </Stack>
        {(chipsVisibles || !elegidos.length) && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5, minHeight: 24, flexShrink: 0, maxHeight: 132, overflowY: 'auto' }}>
            {elegidos.map((e) => {
              const m = marcados.has(Number(e.id));
              return (
                <Chip key={e.id} label={e.nombre} size="small" onClick={() => marcar(e.id)} onDelete={() => toggle(e)}
                  sx={{ height: 24, fontSize: '0.72rem', border: '1px solid', borderColor: m ? '#5BC2EA' : 'transparent',
                    bgcolor: m ? 'rgba(91,194,234,.22)' : undefined, fontWeight: m ? 700 : 400, '&:hover': { bgcolor: m ? 'rgba(91,194,234,.32)' : undefined } }} />
              );
            })}
            {!elegidos.length && <Typography variant="caption" color="text.secondary">Tildá abajo los productos que se arman en esta plaza.</Typography>}
          </Stack>
        )}
        {/* Buscador y filtros, del mismo alto (40). La agrupación no es obligatoria. */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, '& .MuiInputBase-root': { height: 40 } }}>
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
        <Box sx={{ flex: 1, minHeight: 160, overflowY: 'auto', mt: 0.75, border: '1px solid #eef0f4', borderRadius: 1.5 }}>
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
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" disableElevation disabled={guardando || !nombre.trim() || !sectorElegido} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
