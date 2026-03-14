// src/componentes/AppPromptModal.jsx
// Modal global que reemplaza window.prompt().
// Se monta una sola vez en App.jsx y escucha el evento 'app:prompt'.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { _resolvePrompt } from '../servicios/appPrompt';

export default function AppPromptModal() {
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState('');
  const [value, setValue]     = useState('');
  const inputRef              = useRef(null);

  const handleEvent = useCallback((e) => {
    const { message: msg = '', defaultValue = '' } = e.detail || {};
    setMessage(msg);
    setValue(defaultValue);
    setOpen(true);
    // Foco al input después del render
    setTimeout(() => inputRef.current?.select(), 80);
  }, []);

  useEffect(() => {
    window.addEventListener('app:prompt', handleEvent);
    return () => window.removeEventListener('app:prompt', handleEvent);
  }, [handleEvent]);

  const confirm = () => {
    setOpen(false);
    _resolvePrompt(value.trim() === '' ? '' : value);
  };

  const cancel = () => {
    setOpen(false);
    _resolvePrompt(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') cancel();
  };

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
      {/* Franja de color superior — usa el primario del negocio */}
      <Box sx={{ height: 5, background: 'var(--color-primary, #3b82f6)' }} />

      <DialogTitle sx={{ pb: 0.5, pt: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <EditOutlinedIcon sx={{ fontSize: 28, color: 'var(--color-primary, #3b82f6)' }} />
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {message}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, pb: 1 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            mt: 0.5,
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--color-primary, #3b82f6)',
            },
          }}
        />
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
            '&:hover': { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' },
          }}
        >
          Cancelar
        </Button>
        <Button
          onClick={confirm}
          variant="contained"
          disableElevation
          sx={{
            minWidth: 90,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: 'var(--color-primary, #3b82f6)',
            color: 'var(--on-primary, #fff)',
            '&:hover': { filter: 'brightness(0.92)', background: 'var(--color-primary)' },
          }}
        >
          Aceptar
        </Button>
      </DialogActions>
    </Dialog>
  );
}