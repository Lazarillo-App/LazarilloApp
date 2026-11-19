// src/componentes/SelectorRevisor.jsx
// Elige para quién es la revisión: alguien del staff del PDV, o todos (admin/dueño).
// La lista sale de /receta-proposals/revisores: TODO el staff del negocio, lo haya
// invitado quien sea (Diego 19/11/2026: desde una cuenta admin solo aparecían los
// que había invitado ese admin, porque se usaba la lista de Mi equipo).
import React, { useEffect, useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem, ListSubheader } from '@mui/material';
import { listarRevisores } from '@/servicios/apiRecetaProposals';

export default function SelectorRevisor({ businessId, value, onChange, size = 'small', minWidth = 200 }) {
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    if (!businessId) return undefined;
    let vivo = true;
    listarRevisores(businessId)
      .then((r) => { if (vivo) setStaff(r); })
      .catch(() => { if (vivo) setStaff([]); });
    return () => { vivo = false; };
  }, [businessId]);

  const lista = staff || [];
  const valorValido = value != null && lista.some((m) => m.user_id === Number(value)) ? value : '';

  return (
    <FormControl size={size} sx={{ minWidth }}>
      <InputLabel>Para quién</InputLabel>
      <Select label="Para quién" value={staff ? valorValido : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
        <MenuItem value=""><em>Admin y dueño</em></MenuItem>
        {lista.map((m) => (
          <MenuItem key={m.user_id} value={m.user_id}>
            {m.nombre}
            {m.sectores && <span style={{ color: '#888', marginLeft: 6, fontSize: '0.85em' }}>· {m.sectores}</span>}
          </MenuItem>
        ))}
        {staff && !lista.length && (
          <ListSubheader sx={{ lineHeight: 1.4, py: 1, color: 'text.secondary', fontSize: '0.75rem' }}>
            Este PDV todavía no tiene staff. Se suma desde Mi equipo.
          </ListSubheader>
        )}
      </Select>
    </FormControl>
  );
}
