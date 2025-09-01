import React, { useMemo } from 'react';
import { IconButton, Tooltip, Popover, Box, Stack, TextField, Button } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { lastNDaysUntilYesterday, daysByMode } from '../utils/fechas';

export default function SalesPickerIcon({ value, onChange }) {
  const { mode, from, to } = value;

  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  // Rango “efectivo” para mostrar (si no hay custom cargado)
  const computed = useMemo(() => {
    if (mode === 'custom' && from && to) return { from, to };
    const n = daysByMode(mode);
    return lastNDaysUntilYesterday(n);
  }, [mode, from, to]);

  // Preset: congela from/to explícitos (hasta AYER)
  const setPreset = (days) => {
    const r = lastNDaysUntilYesterday(days);
    onChange({ mode: String(days), from: r.from, to: r.to });
    setTimeout(handleClose, 0);
  };

  const applyRange = () => {
    if (!from || !to) return;
    if (new Date(from) > new Date(to)) return;
    setTimeout(handleClose, 0);
  };

  return (
    <>
      <Tooltip title="Elegir rango">
        <IconButton size="small" onClick={handleOpen}>
          <CalendarMonthIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        onClose={handleClose}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          <Stack spacing={1.2}>
            <Stack direction="row" spacing={1}>
              <Button variant={mode==='7'?'contained':'outlined'}  size="small" onClick={() => setPreset(7)}>7D</Button>
              <Button variant={mode==='30'?'contained':'outlined'} size="small" onClick={() => setPreset(30)}>30D</Button>
              <Button variant={mode==='90'?'contained':'outlined'} size="small" onClick={() => setPreset(90)}>90D</Button>
              <Button
                variant={mode==='custom'?'contained':'outlined'}
                size="small"
                onClick={() => {
                  const r = lastNDaysUntilYesterday(daysByMode(mode));
                  onChange({ mode: 'custom', from: r.from, to: r.to });
                }}
              >
                PERS.
              </Button>
            </Stack>

            <TextField
              size="small"
              label="Desde"
              type="date"
              disabled={mode !== 'custom'}
              value={mode === 'custom' ? (from || computed.from) : computed.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              label="Hasta"
              type="date"
              disabled={mode !== 'custom'}
              value={mode === 'custom' ? (to || computed.to) : computed.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={handleClose} size="small">Cancelar</Button>
              <Button onClick={applyRange} variant="contained" size="small">Aplicar</Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}