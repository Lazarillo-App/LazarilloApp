// Discontinuar un rubro o concepto de caja (Diego 20/11 y 24/11/2026): para toda la organización o solo
// en algunos negocios. No borra nada: deja de ofrecerse al cargar en esos negocios; lo cargado sigue igual.
import React, { useState } from 'react';
import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup,
} from '@mui/material';
import { useCelular } from '@/componentes/base';

// eslint-disable-next-line react-refresh/only-export-components
export const fechaCorta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

// item: { tipo, codigo, nombre, usoPorNegocio: Map(businessId → { ultimo, n12 }), alcance: null | 'org' | [ids] }
export default function DiscontinuarConcepto({ item, negocios, onCerrar, onConfirmar }) {
  const celular = useCelular();
  const varios = negocios.length > 1;
  // Arranca en «solo en…» con los negocios donde no se usó en 12 meses, si en otro sí se usa.
  const sinUso12 = negocios.filter((n) => !(item.usoPorNegocio.get(n.id)?.n12 > 0)).map((n) => n.id);
  const inicialSolo = Array.isArray(item.alcance) ? item.alcance : (varios && sinUso12.length && sinUso12.length < negocios.length ? sinUso12 : null);
  const [modo, setModo] = useState(inicialSolo ? 'solo' : 'org');
  const [ids, setIds] = useState(inicialSolo ?? []);
  const [guardando, setGuardando] = useState(false);
  const puede = modo === 'org' || ids.length > 0;

  async function confirmar() {
    setGuardando(true);
    try { await onConfirmar(modo === 'org' ? null : ids); } finally { setGuardando(false); }
  }

  return (
    <Dialog open onClose={onCerrar} fullScreen={celular} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 600, pb: 0.5 }}>
        Discontinuar {item.tipo === 'rubro' ? 'el rubro' : 'el concepto'} «{item.nombre}»
      </DialogTitle>
      <DialogContent sx={{ fontSize: 13 }}>
        <Box sx={{ color: 'text.secondary', mb: 1.5 }}>
          Deja de aparecer para cargar. No se borra nada: lo ya cargado sigue igual y se puede reactivar cuando quieras.
          {item.tipo === 'rubro' && ' Vale para todos sus conceptos.'}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 2, rowGap: 0.5, mb: 1.5, fontVariantNumeric: 'tabular-nums' }}>
          <Box sx={{ fontSize: 11, color: 'text.disabled' }}>Negocio</Box>
          <Box sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'right' }}>Último uso</Box>
          <Box sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'right' }}>En 12 meses</Box>
          {negocios.map((n) => {
            const u = item.usoPorNegocio.get(n.id);
            return (
              <React.Fragment key={n.id}>
                <span>{n.nombre}</span>
                <Box component="span" sx={{ textAlign: 'right' }}>{u?.ultimo ? fechaCorta(u.ultimo) : 'nunca'}</Box>
                <Box component="span" sx={{ textAlign: 'right' }}>{u?.n12 ?? 0}</Box>
              </React.Fragment>
            );
          })}
        </Box>
        {varios && (
          <RadioGroup value={modo} onChange={(e) => setModo(e.target.value)}>
            <FormControlLabel value="org" control={<Radio size="small" />} label="En toda la organización" sx={{ '& .MuiFormControlLabel-label': { fontSize: 14 } }} />
            <FormControlLabel value="solo" control={<Radio size="small" />} label="Solo en algunos negocios" sx={{ '& .MuiFormControlLabel-label': { fontSize: 14 } }} />
          </RadioGroup>
        )}
        {varios && modo === 'solo' && (
          <Box sx={{ pl: 3.5, display: 'flex', flexDirection: 'column' }}>
            {negocios.map((n) => (
              <FormControlLabel
                key={n.id}
                control={<Checkbox size="small" checked={ids.includes(n.id)} onChange={(e) => setIds(e.target.checked ? [...ids, n.id] : ids.filter((x) => x !== n.id))} />}
                label={n.nombre} sx={{ '& .MuiFormControlLabel-label': { fontSize: 14 } }}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onCerrar} sx={{ textTransform: 'none', minHeight: celular ? 44 : undefined }}>Cancelar</Button>
        <Button variant="contained" disabled={!puede || guardando} onClick={confirmar} sx={{ textTransform: 'none', minHeight: celular ? 44 : undefined }}>
          Discontinuar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
