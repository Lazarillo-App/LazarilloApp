// src/componentes/AppConfirmModal.jsx
// Modal global que reemplaza window.confirm().
// Se monta una sola vez en App.jsx y escucha el evento 'app:confirm'.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { _resolveConfirm } from '../servicios/appConfirm';

export default function AppConfirmModal() {
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState('');
  const [danger, setDanger]   = useState(false);

  const handleEvent = useCallback((e) => {
    const { message: msg = '', danger: d = false } = e.detail || {};
    setMessage(msg);
    setDanger(d);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('app:confirm', handleEvent);
    return () => window.removeEventListener('app:confirm', handleEvent);
  }, [handleEvent]);

  const accept = () => { setOpen(false); _resolveConfirm(true); };
  const cancel = () => { setOpen(false); _resolveConfirm(false); };

  const accentColor = danger
    ? 'var(--color-error, #ef4444)'
    : 'var(--color-primary, #3b82f6)';

  return (
    <Dialog
      open={open}
      onClose={cancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Franja superior */}
      <Box sx={{ height: 5, background: accentColor }} />

      <DialogTitle sx={{ pb: 0.5, pt: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {danger
            ? <WarningAmberIcon sx={{ fontSize: 28, color: accentColor }} />
            : <HelpOutlineIcon  sx={{ fontSize: 28, color: accentColor }} />
          }
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {danger ? 'Confirmar acción' : '¿Estás seguro?'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 1.5 }}>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', whiteSpace: 'pre-line', lineHeight: 1.6 }}
        >
          {message}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={cancel}
          variant="outlined"
          disableElevation
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            borderColor: 'var(--color-border, #e2e8f0)',
            color: 'text.secondary',
            '&:hover': { borderColor: accentColor, color: accentColor },
          }}
        >
          Cancelar
        </Button>
        <Button
          onClick={accept}
          variant="contained"
          disableElevation
          sx={{
            minWidth: 90,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: accentColor,
            color: danger ? '#fff' : 'var(--on-primary, #fff)',
            '&:hover': { filter: 'brightness(0.92)', background: accentColor },
          }}
        >
          {danger ? 'Eliminar' : 'Aceptar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}