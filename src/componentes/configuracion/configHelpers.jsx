/* eslint-disable react-refresh/only-export-components */
/* eslint-disable no-unused-vars */
// src/componentes/configuracion/configHelpers.jsx
// Componentes auxiliares compartidos entre los tabs de configuración
import React from 'react';
import {
  Box, Stack, Paper, Typography, Button, TextField,
  InputAdornment, Alert, CircularProgress,
} from '@mui/material';
import SaveIcon        from '@mui/icons-material/Save';
import PercentIcon     from '@mui/icons-material/Percent';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

export function authHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const bid   = bizId ?? localStorage.getItem('activeBusinessId') ?? '';
  const h     = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bid)   h['X-Business-Id'] = String(bid);
  return h;
}

export function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

export function SectionCard({ icon, title, children, accent }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2, overflow: 'hidden', height: '100%',
        ...(accent && { borderColor: `${themeColor}40` }),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{
        px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider',
        ...(accent && { bgcolor: `${themeColor}06` }),
      }}>
        {icon && React.cloneElement(icon, { sx: { color: themeColor, fontSize: 18 } })}
        <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
      </Stack>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Paper>
  );
}

export function CostoIdealSection({ label, value, onChange, saving, onSave }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Define el porcentaje de costo objetivo para las recetas del negocio.
        Puede sobreescribirse individualmente por agrupación, rubro o insumo elaborado.
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField
          label="Costo ideal" type="number" size="small"
          value={value} onChange={e => onChange(e.target.value)}
          inputProps={{ min: 0, max: 100, step: 0.5 }}
          InputProps={{ endAdornment: <InputAdornment position="end"><PercentIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 150 }}
        />
        <Button variant="contained" size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={onSave} disabled={saving}
          sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </Stack>
      {Number(value) > 0 && (
        <Alert severity="info" sx={{ py: 0.5, fontSize: '0.78rem' }}>
          Con {value}% de costo → precio sugerido: <strong>Costo ÷ {(Number(value) / 100).toFixed(2)}</strong>
        </Alert>
      )}
    </Stack>
  );
}

export function AlertaConfigSection({ label, value, onChange, saving, onSave, unit = 'días' }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField
          label={unit === 'días' ? 'Días sin datos' : 'Semanas sin compras'}
          type="number" size="small" value={value}
          onChange={e => onChange(e.target.value)}
          inputProps={{ min: 1, max: unit === 'días' ? 365 : 52, step: 1 }}
          sx={{ width: 150 }}
        />
        <Button variant="contained" size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={onSave} disabled={saving}
          sx={{ bgcolor: themeColor, '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor } }}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </Stack>
    </Stack>
  );
}

export function ImportPlaceholder({ tipo, columnasDemo, onAbrir }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{
      p: 2, borderRadius: 1.5, border: '1.5px dashed',
      borderColor: `${themeColor}30`, bgcolor: `${themeColor}04`,
    }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <CloudUploadIcon sx={{ color: themeColor, fontSize: 22, flexShrink: 0 }} />
        <Box>
          <Typography variant="body2" fontWeight={600} lineHeight={1.3}>
            Importar desde archivo externo
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Lazarillo te guía para mapear columnas.
          </Typography>
        </Box>
      </Stack>
      <Button size="small" variant="outlined" startIcon={<AutoFixHighIcon />}
        onClick={() => onAbrir(tipo, columnasDemo)}
        sx={{ borderColor: themeColor, color: themeColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
        Ver equivalencias
      </Button>
    </Stack>
  );
}