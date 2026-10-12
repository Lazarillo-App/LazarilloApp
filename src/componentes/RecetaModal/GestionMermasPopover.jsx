// src/componentes/RecetaModal/GestionMermasPopover.jsx
// Popover compacto para agregar/editar/eliminar mermas de un insumo sin salir
// de donde se lo esté usando (ej. la pestaña Uso) — misma lógica que la
// pestaña Merma completa (TabMermaInsumo.jsx), pero condensada.
import { useState } from 'react';
import { Box, Typography, TextField, IconButton, Tooltip, Popover } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { insumoMermaCreate, insumoMermaUpdate, insumoMermaDelete } from '@/servicios/apiInsumos';
import { sanitizeDecimal } from '@/utils/decimales';
import { PRIMARY } from './helpers';
import ConfirmDialog from './ConfirmDialog';

const pctMerma = (bruto, neto) => (Number(bruto) > 0 ? ((Number(bruto) - Number(neto)) / Number(bruto)) * 100 : 0);

const ROW_COLS = '1fr 64px 64px 42px 26px';

export default function GestionMermasPopover({ insumoId, businessId, mermas = [], onChanged }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [nuevo, setNuevo] = useState({ nombre: '', peso_inicial: '', peso_final: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aBorrar, setABorrar] = useState(null);

  const open = Boolean(anchorEl);
  const cerrar = () => setAnchorEl(null);

  const editar = async (m, campo, valor) => {
    const payload = { [campo]: campo === 'nombre' ? valor : Number(valor) };
    try {
      await insumoMermaUpdate(insumoId, m.id, payload, businessId);
      onChanged?.();
    } catch (e) {
      setError(e.message || 'No se pudo actualizar');
    }
  };

  const agregar = async () => {
    if (!nuevo.nombre.trim() || !(Number(nuevo.peso_inicial) > 0) || !(Number(nuevo.peso_final) > 0)) return;
    setGuardando(true); setError('');
    try {
      await insumoMermaCreate(insumoId, {
        nombre: nuevo.nombre.trim(),
        peso_inicial: Number(nuevo.peso_inicial),
        peso_final: Number(nuevo.peso_final),
        es_default: mermas.length === 0,
      }, businessId);
      setNuevo({ nombre: '', peso_inicial: '', peso_final: '' });
      onChanged?.();
    } catch (e) {
      setError(e.message || 'No se pudo agregar');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (mId) => {
    try {
      await insumoMermaDelete(insumoId, mId, businessId);
      onChanged?.();
    } catch (e) {
      setError(e.message || 'No se pudo borrar');
    }
  };

  return (
    <>
      <Tooltip title="Gestionar mermas de este insumo">
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: PRIMARY }}>
          <SettingsIcon sx={{ fontSize: 17 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={cerrar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, width: 380 }}>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
            Mermas de este insumo
          </Typography>
          {error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>{error}</Typography>
          )}

          {mermas.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Todavía no hay ninguna cargada.
            </Typography>
          )}

          {mermas.map((m) => (
            <Box key={m.id} sx={{ display: 'grid', gridTemplateColumns: ROW_COLS, gap: 0.5, alignItems: 'center', mb: 0.5 }}>
              <TextField
                size="small" defaultValue={m.nombre}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value !== m.nombre) editar(m, 'nombre', e.target.value.trim()); }}
                inputProps={{ style: { fontSize: '0.78rem' } }}
              />
              <TextField
                size="small" type="text" inputMode="decimal"
                defaultValue={String(Number(m.peso_inicial)).replace('.', ',')}
                onBlur={(e) => { const v = sanitizeDecimal(e.target.value); if (Number(v) > 0 && Number(v) !== Number(m.peso_inicial)) editar(m, 'peso_inicial', v); }}
                inputProps={{ style: { textAlign: 'right', fontSize: '0.78rem' } }}
              />
              <TextField
                size="small" type="text" inputMode="decimal"
                defaultValue={String(Number(m.peso_final)).replace('.', ',')}
                onBlur={(e) => { const v = sanitizeDecimal(e.target.value); if (Number(v) > 0 && Number(v) !== Number(m.peso_final)) editar(m, 'peso_final', v); }}
                inputProps={{ style: { textAlign: 'right', fontSize: '0.78rem' } }}
              />
              <Typography variant="caption" sx={{ textAlign: 'right', fontWeight: 700, color: '#c62828' }}>
                {pctMerma(m.peso_inicial, m.peso_final).toFixed(1)}%
              </Typography>
              <IconButton size="small" onClick={() => setABorrar({ id: m.id, nombre: m.nombre })} sx={{ color: 'error.main', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>
          ))}

          <Box sx={{ display: 'grid', gridTemplateColumns: ROW_COLS, gap: 0.5, alignItems: 'center', mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
            <TextField
              size="small" placeholder="Ej: Pelada, Cepillada…" value={nuevo.nombre}
              onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
              inputProps={{ style: { fontSize: '0.78rem' } }}
            />
            <TextField
              size="small" type="text" inputMode="decimal" placeholder="1000" value={nuevo.peso_inicial}
              onChange={(e) => setNuevo((n) => ({ ...n, peso_inicial: sanitizeDecimal(e.target.value) }))}
              inputProps={{ style: { textAlign: 'right', fontSize: '0.78rem' } }}
            />
            <TextField
              size="small" type="text" inputMode="decimal" placeholder="930" value={nuevo.peso_final}
              onChange={(e) => setNuevo((n) => ({ ...n, peso_final: sanitizeDecimal(e.target.value) }))}
              inputProps={{ style: { textAlign: 'right', fontSize: '0.78rem' } }}
            />
            <Box />
            <IconButton
              size="small" onClick={agregar}
              disabled={guardando || !nuevo.nombre.trim() || !(Number(nuevo.peso_inicial) > 0) || !(Number(nuevo.peso_final) > 0)}
              sx={{ color: PRIMARY }}
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>
      </Popover>

      <ConfirmDialog
        open={!!aBorrar}
        tipo="merma"
        nombre={aBorrar?.nombre || ''}
        onCancel={() => setABorrar(null)}
        onConfirm={async () => { const id = aBorrar?.id; setABorrar(null); if (id != null) await borrar(id); }}
      />
    </>
  );
}
