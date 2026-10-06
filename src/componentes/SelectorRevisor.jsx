// src/componentes/SelectorRevisor.jsx
// Elige para quién es la revisión: un miembro del staff del negocio, o todos (admin/dueño).
import React, { useEffect, useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { TeamAPI } from '@/servicios/apiTeam';

export default function SelectorRevisor({ businessId, value, onChange, size = 'small', minWidth = 200 }) {
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    if (!businessId) return undefined;
    let vivo = true;
    TeamAPI.listMembers({ scopeType: 'business', scopeId: businessId })
      .then((m) => { if (vivo) setStaff(m.filter((x) => x.role === 'staff')); })
      .catch(() => { if (vivo) setStaff([]); });
    return () => { vivo = false; };
  }, [businessId]);

  return (
    <FormControl size={size} sx={{ minWidth }}>
      <InputLabel>Para quién</InputLabel>
      <Select label="Para quién" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
        <MenuItem value=""><em>Admin y dueño</em></MenuItem>
        {staff.map((m) => (
          <MenuItem key={m.user_id} value={Number(m.user_id)}>
            {m.alias || m.name || m.email}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
