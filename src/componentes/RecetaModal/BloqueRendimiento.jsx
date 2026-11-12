// src/componentes/RecetaModal/BloqueRendimiento.jsx
// «Rendimiento del lote» del modal de receta (cantidad + unidad + equivalente en peso).
// Movido tal cual desde index.jsx (12/11/2026) para achicar ese archivo; el estado sigue
// en index.jsx y llega por props. Unidades: porción, media porción (Diego 12/11), unidad,
// litro, ml, kilo, gr — porción y media porción son 'u' para el costo.
import { Box, Typography, TextField, FormControl, Select, MenuItem } from '@mui/material';
import { sanitizeDecimal } from '@/utils/decimales';
import { downwardMenuProps } from '@/utils/menuProps';
import { fmt } from './helpers';

export default function BloqueRendimiento({
  isStaff, promoMode, rendimiento, rendimientoNoDefault, rendimientoOpen, rendimientoPeso, rendimientoUnidad, setRendimiento, setRendimientoManualOpen, setRendimientoPeso, setRendimientoUnidad, setUnidadPeso, unidadPeso,
}) {
  return (
    <>
    <Box sx={{ flex: 1, minWidth: 260, display: isStaff || promoMode ? 'none' : undefined }}>
      <Box
        onClick={() => setRendimientoManualOpen(!rendimientoOpen)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
          height: 40, boxSizing: 'border-box', px: 1, borderRadius: 1,
          bgcolor: rendimientoNoDefault ? 'rgba(3,105,161,0.05)' : 'transparent',
          border: '1px solid', borderColor: rendimientoNoDefault ? 'rgba(3,105,161,0.2)' : 'divider',
          '&:hover': { bgcolor: 'action.hover' }, transition: 'all .15s',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', flex: 1 }}>
          {rendimientoNoDefault
            ? `Rendimiento del lote: ${fmt(rendimiento)} ${{
                porcion: 'porciones', media_porcion: 'medias porciones', u: 'unidades', lt: 'litros', ml: 'ml', kg: 'kilos', gr: 'gr',
              }[rendimientoUnidad] || 'porciones'}`
            : 'Rendimiento del lote (1 porción)'}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{rendimientoOpen ? '▲' : '▼'}</Typography>
      </Box>
      {rendimientoOpen && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 0.75 }}>
          <TextField
            label="Cantidad"
            type="text"
            inputMode="decimal"
            value={rendimiento === '' ? '' : String(rendimiento).replace('.', ',')}
            onChange={e => {
              const raw = e.target.value;
              setRendimiento(raw === '' ? '' : sanitizeDecimal(raw));
            }}
            size="small"
            inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', padding: '0 8px' } }}
            sx={{ width: 72, flexShrink: 0, '& .MuiOutlinedInput-root': { height: 40 } }}
          />
          <FormControl size="small" sx={{ width: 140, flexShrink: 0 }}>
            <Select
              value={rendimientoUnidad}
              onChange={e => {
                const nueva = e.target.value;
                setRendimientoUnidad(nueva);
                if (!['porcion', 'media_porcion', 'u'].includes(nueva)) {
                  setRendimientoPeso(null);
                  setUnidadPeso(null);
                } else if (!unidadPeso) {
                  setUnidadPeso('gr');
                }
              }}
              MenuProps={downwardMenuProps()}
              sx={{ fontSize: '0.85rem', height: 40 }}
            >
              <MenuItem value="porcion">Porción</MenuItem>
              <MenuItem value="media_porcion">Media porción</MenuItem>
              <MenuItem value="u">Unidad</MenuItem>
              <MenuItem value="lt">Litro</MenuItem>
              <MenuItem value="ml">ml</MenuItem>
              <MenuItem value="kg">Kilo</MenuItem>
              <MenuItem value="gr">gr</MenuItem>
            </Select>
          </FormControl>
          {['porcion', 'media_porcion', 'u'].includes(rendimientoUnidad) && (
            <Box sx={{ display: 'flex', gap: 0.5, flex: 1, minWidth: 130 }}>
              <TextField
                label="Equivalente"
                type="text"
                inputMode="decimal"
                value={rendimientoPeso == null ? '' : String(rendimientoPeso).replace('.', ',')}
                onChange={e => {
                  const raw = e.target.value;
                  setRendimientoPeso(raw === '' ? null : sanitizeDecimal(raw));
                  // Si hay peso y aún no se eligió unidad, fijar el default visual (gr) como valor real.
                  // El usuario puede cambiarlo a kg/ml/lt en el Select de al lado.
                  if (raw !== '' && !unidadPeso) setUnidadPeso('gr');
                }}
                placeholder="—"
                size="small"
                inputProps={{ min: 0, step: 0.1, style: { textAlign: 'right', padding: '0 8px' } }}
                sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { height: 40 } }}
              />
              <FormControl size="small" sx={{ width: 64, flexShrink: 0 }}>
                <Select
                  value={unidadPeso || ''}
                  onChange={e => setUnidadPeso(e.target.value)}
                  displayEmpty
                  renderValue={(v) => v || 'u.'}
                  MenuProps={downwardMenuProps()}
                  sx={{ fontSize: '0.8rem', height: 40, color: unidadPeso ? 'inherit' : 'text.disabled' }}
                >
                  <MenuItem value="gr">gr</MenuItem>
                  <MenuItem value="kg">kg</MenuItem>
                  <MenuItem value="ml">ml</MenuItem>
                  <MenuItem value="lt">lt</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </Box>
      )}
    </Box>
    </>
  );
}
