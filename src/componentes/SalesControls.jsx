import React, { useMemo } from 'react';
import { FormControl, InputLabel, Select, MenuItem, TextField, Stack } from '@mui/material';

const PRESETS = [
  { key: '7', label: 'Últimos 7 días', days: 7 },
  { key: '30', label: 'Últimos 30 días', days: 30 },
  { key: '90', label: 'Últimos 90 días', days: 90 },
  { key: 'custom', label: 'Personalizado', days: null },
];

function fmt(d) { return d.toISOString().slice(0, 10); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

export default function SalesControls({ value, onChange }) {
  const { mode, from, to } = value;

  const computed = useMemo(() => {
    if (mode === 'custom') return { from, to };
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1); // AYER
    const end = fmt(endDate);
    const preset = PRESETS.find(p => p.key === mode) ?? PRESETS[1];
    const start = fmt(addDays(today, -preset.days));
    return { from: start, to: end };
  }, [mode, from, to]);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Rango</InputLabel>
        <Select
          label="Rango"
          value={mode}
          onChange={(e) => onChange({ ...value, mode: e.target.value })}
        >
          {PRESETS.map(p => <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>)}
        </Select>
      </FormControl>

      <TextField
        size="small"
        label="Desde"
        type="date"
        disabled={mode !== 'custom'}
        value={mode === 'custom' ? from : computed.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        size="small"
        label="Hasta"
        type="date"
        disabled={mode !== 'custom'}
        value={mode === 'custom' ? to : computed.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        InputLabelProps={{ shrink: true }}
      />
    </Stack>
  );
}
