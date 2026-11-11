// src/componentes/RecetaModal/BorrarMermaEnUsoDialog.jsx
// Borrar una merma que usan recetas: avisa cuáles y pregunta si se reemplaza por otra
// merma del mismo insumo (Sí → elegir cuál / No → las recetas quedan sin esta merma).
import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box,
  RadioGroup, FormControlLabel, Radio, Select, MenuItem, Stack,
} from '@mui/material';

const factorDe = (m) => {
  const pi = Number(m?.peso_inicial), pf = Number(m?.peso_final);
  return pi > 0 && pf > 0 ? pi / pf : 1;
};

export default function BorrarMermaEnUsoDialog({ open, merma, recetas = [], otras = [], onCancel, onConfirm }) {
  const hayOtras = otras.length > 0;
  const [reemplazar, setReemplazar] = useState('si');
  const [reemplazoId, setReemplazoId] = useState('');

  useEffect(() => {
    if (!open) return;
    const def = otras.find(m => m.es_default) || otras[0];
    setReemplazar(hayOtras ? 'si' : 'no');
    setReemplazoId(def ? Number(def.id) : '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = recetas.length;
  const visibles = recetas.slice(0, 6);
  const resto = n - visibles.length;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: 'error.main', pb: 1 }}>
        ¿Borrar merma «{merma?.nombre}»?
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          La usa{n === 1 ? '' : 'n'} <strong>{n} receta{n === 1 ? '' : 's'}</strong>:
        </Typography>
        <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5, fontSize: '0.82rem', color: 'text.secondary' }}>
          {visibles.map(r => <li key={r.recetaId}>{r.titulo}</li>)}
          {resto > 0 && <li>y {resto} más</li>}
        </Box>

        {hayOtras ? (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>¿Reemplazarla por otra merma?</Typography>
            <RadioGroup value={reemplazar} onChange={e => setReemplazar(e.target.value)} sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <FormControlLabel value="si" control={<Radio size="small" />} label="Sí, por" sx={{ mr: 0, ml: '-11px !important' }} />
                <Select size="small" value={reemplazoId} disabled={reemplazar !== 'si'}
                  onChange={e => setReemplazoId(Number(e.target.value))}
                  sx={{ minWidth: 180, fontSize: '0.82rem', '& .MuiSelect-select': { py: '4px' } }}>
                  {otras.map(m => (
                    <MenuItem key={m.id} value={Number(m.id)} sx={{ fontSize: '0.82rem' }}>
                      {m.nombre} (×{factorDe(m).toFixed(2)})
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
              <FormControlLabel value="no" control={<Radio size="small" />} label="No, quedan sin esta merma" />
            </RadioGroup>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Este insumo no tiene otra merma: esas recetas quedan sin merma y se recalcula su costo.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit" size="small">Cancelar</Button>
        <Button color="error" variant="contained" size="small"
          disabled={reemplazar === 'si' && hayOtras && !reemplazoId}
          onClick={() => onConfirm?.(reemplazar === 'si' && hayOtras ? Number(reemplazoId) : null)}>
          Borrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
