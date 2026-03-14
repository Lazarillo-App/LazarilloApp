// src/componentes/AppAlertModal.jsx
// Modal global que reemplaza window.alert().
// Se monta una sola vez en App.jsx y escucha el evento 'app:alert'.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, IconButton,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const ICONS = {
  success: <CheckCircleOutlineIcon sx={{ fontSize: 36, color: 'var(--color-success, #10b981)' }} />,
  error:   <ErrorOutlineIcon      sx={{ fontSize: 36, color: 'var(--color-error,   #ef4444)' }} />,
  warning: <WarningAmberIcon      sx={{ fontSize: 36, color: 'var(--color-warning, #f59e0b)' }} />,
  info:    <InfoOutlinedIcon      sx={{ fontSize: 36, color: 'var(--color-primary, #3b82f6)' }} />,
};

const TITLES = {
  success: 'Listo',
  error:   'Ocurrió un error',
  warning: 'Atención',
  info:    'Información',
};

export default function AppAlertModal() {
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType]       = useState('info');
  const [copyText, setCopyText] = useState(null);
  const [copied, setCopied]   = useState(false);

  const handleEvent = useCallback((e) => {
    const { message: msg, type: t = 'info', copyText: ct = null } = e.detail || {};
    setMessage(msg || '');
    setType(['success', 'error', 'warning', 'info'].includes(t) ? t : 'info');
    setCopyText(ct);
    setCopied(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('app:alert', handleEvent);
    return () => window.removeEventListener('app:alert', handleEvent);
  }, [handleEvent]);

  const handleClose = () => setOpen(false);

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
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
      {/* Franja de color superior */}
      <Box
        sx={{
          height: 5,
          background: type === 'success' ? 'var(--color-success, #10b981)'
            : type === 'error'   ? 'var(--color-error,   #ef4444)'
            : type === 'warning' ? 'var(--color-warning, #f59e0b)'
            :                      'var(--color-primary, #3b82f6)',
        }}
      />

      <DialogTitle sx={{ pb: 0, pt: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {ICONS[type]}
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {TITLES[type]}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, pb: copyText ? 1 : 2 }}>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', whiteSpace: 'pre-line', lineHeight: 1.6 }}
        >
          {message}
        </Typography>

        {/* Bloque copyable (para tokens, etc.) */}
        {copyText && (
          <Box
            sx={{
              mt: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: 'var(--color-surface, #f8fafc)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', flex: 1, wordBreak: 'break-all', fontSize: '0.82rem' }}
            >
              {copyText}
            </Typography>
            <IconButton size="small" onClick={handleCopy} title="Copiar">
              <ContentCopyIcon sx={{ fontSize: 16, color: copied ? 'var(--color-success)' : 'text.secondary' }} />
            </IconButton>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={handleClose}
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
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
}