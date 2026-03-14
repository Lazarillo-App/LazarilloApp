// src/componentes/OrganizationNameModal.jsx
//
// Modal para solicitar el nombre de la nueva organización
// que se crea al guardar el primer sub-negocio
//
// Props:
//   open          → bool
//   onClose       → fn()
//   defaultName   → string (nombre sugerido)
//   onConfirm     → fn(name) — callback al confirmar con el nombre

import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, TextField, Button,
  Alert,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '95vw', sm: 480 },
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  p: 0,
  outline: 'none',
  overflow: 'hidden',
};

export default function OrganizationNameModal({ 
  open, 
  onClose, 
  defaultName = 'Nueva organización',
  onConfirm 
}) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState('');

  // Pre-llenar el nombre cuando se abre
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setError('');
    }
  }, [open, defaultName]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('El nombre de la organización es requerido');
      return;
    }

    if (typeof onConfirm === 'function') {
      onConfirm(name.trim());
    }
  };

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} aria-labelledby="org-name-title">
      <Box sx={modalStyle}>
        
        {/* Header */}
        <Box sx={{
          px: 3, py: 2.5,
          background: 'var(--color-primary, #111)',
          color: 'var(--on-primary, #fff)',
          display: 'flex', alignItems: 'center', gap: 1.5,
        }}>
          <BusinessIcon />
          <Typography id="org-name-title" variant="h6" fontWeight={600}>
            Crear organización
          </Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          {/* Explicación */}
          <Alert severity="info" sx={{ mb: 3 }}>
            Al crear tu primer sub-negocio, se crea una <strong>organización</strong> que 
            agrupa el negocio actual y todos los sub-negocios.
          </Alert>

          {/* Qué va a pasar */}
          <Box sx={{ mb: 3, bgcolor: 'action.hover', p: 2, borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Estructura resultante:
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'flex', gap: 0.75, mb: 0.5 }}
              >
                <span style={{ color: 'var(--color-primary, #111)', fontWeight: 700 }}>📁</span>
                {name || 'Nueva organización'} (agrupación)
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'flex', gap: 0.75, mb: 0.5 }}
                >
                  <span style={{ color: 'var(--color-primary, #111)', fontWeight: 700 }}>├─</span>
                  Negocio actual (sin cambios)
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'flex', gap: 0.75 }}
                >
                  <span style={{ color: 'var(--color-primary, #111)', fontWeight: 700 }}>└─</span>
                  Nuevo sub-negocio
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Campo nombre */}
          <TextField
            label="Nombre de la organización"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            fullWidth
            autoFocus
            size="small"
            error={!!error}
            helperText={error || 'Podés cambiarlo después desde la configuración'}
            sx={{ mb: 2 }}
            placeholder="Ej: Mi Empresa, Grupo Gastronómico, etc."
          />

          {/* Acciones */}
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button
              onClick={handleClose}
              color="inherit"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={!name.trim()}
              sx={{
                bgcolor: 'var(--color-primary, #111)',
                color: 'var(--on-primary, #fff)',
                '&:hover': { bgcolor: 'var(--color-primary, #111)', opacity: 0.9 },
              }}
            >
              Continuar
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
