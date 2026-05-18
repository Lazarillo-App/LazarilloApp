// src/componentes/configuracion/PrecioCosteoSection.jsx
import React from 'react';
import { Stack, Box, Typography, Button, Chip, Alert, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

export function PrecioCosteoSection({ value, onChange, saving, onSave }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const MODOS = [
    { value: 'ultima_compra', label: 'Última compra',  desc: 'Usa el precio de la compra más reciente (por defecto)' },
    { value: 'promedio_30',   label: 'Promedio 30 días', desc: 'Promedio de compras de los últimos 30 días' },
    { value: 'precio_db',     label: 'Precio DB',      desc: 'Usa el precio de referencia del sistema cuando no hay transaccionales.' },
  ];
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Definí qué precio usar para calcular el costo de los insumos en las recetas.
        Podés sobreescribir el precio individualmente desde el modal de receta.
      </Typography>
      <Stack spacing={0.75}>
        {MODOS.map(m => (
          <Box key={m.value} onClick={() => onChange(m.value)} sx={{
            p: 1.25, borderRadius: 1.5, cursor: 'pointer',
            border: `1.5px solid ${value === m.value ? themeColor : '#e2e8f0'}`,
            bgcolor: value === m.value ? `${themeColor}08` : 'transparent',
            transition: 'all .15s',
            '&:hover': { borderColor: themeColor, bgcolor: `${themeColor}05` },
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${value === m.value ? themeColor : '#cbd5e1'}`,
                bgcolor: value === m.value ? themeColor : 'transparent',
                transition: 'all .15s',
              }} />
              <Box>
                <Typography variant="body2" fontWeight={value === m.value ? 700 : 500} sx={{ fontSize: '0.82rem' }}>
                  {m.label}
                  {m.value === 'ultima_compra' && (
                    <Chip label="recomendado" size="small"
                      sx={{ ml: 0.75, height: 16, fontSize: '0.62rem', bgcolor: '#dcfce7', color: '#166534' }} />
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>{m.desc}</Typography>
              </Box>
            </Stack>
          </Box>
        ))}
      </Stack>
      <Button size="small" variant="contained" disabled={saving} onClick={onSave}
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
        sx={{ alignSelf: 'flex-start', bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </Button>
    </Stack>
  );
}

export function RedondeoSection({ value, onChange, saving, onSave }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const OPCIONES   = [2, 5, 10, 20, 50, 100, 500, 1000];
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Al aplicar aumentos de precio, los valores se redondean automáticamente al múltiplo elegido.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {OPCIONES.map(op => (
          <Chip key={op} label={`$${op}`} size="small"
            onClick={() => onChange(op === value ? null : op)}
            sx={{
              cursor: 'pointer', fontWeight: value === op ? 700 : 400,
              bgcolor: value === op ? themeColor : 'transparent',
              color: value === op ? '#fff' : 'text.secondary',
              border: `1px solid ${value === op ? themeColor : '#e2e8f0'}`,
              '&:hover': { bgcolor: value === op ? themeColor : `${themeColor}15` },
            }} />
        ))}
        <Chip label="Sin redondeo" size="small" onClick={() => onChange(null)}
          sx={{
            cursor: 'pointer', fontWeight: !value ? 700 : 400,
            bgcolor: !value ? '#64748b' : 'transparent',
            color: !value ? '#fff' : 'text.secondary',
            border: `1px solid ${!value ? '#64748b' : '#e2e8f0'}`,
          }} />
      </Box>
      {value && (
        <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem' }}>
          Los precios se redondearán al múltiplo de <strong>${value}</strong> más cercano.
        </Alert>
      )}
      <Button size="small" variant="contained" disabled={saving} onClick={onSave}
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
        sx={{ alignSelf: 'flex-start', bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
        {saving ? 'Guardando…' : 'Guardar redondeo'}
      </Button>
    </Stack>
  );
}