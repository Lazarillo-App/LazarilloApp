/**
 * DivisionCreateSimpleModal - Modal minimalista para crear división
 * Se usa desde BusinessCard en el Perfil
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box,
} from '@mui/material';
import * as apiDivisions from '../servicios/apiDivisions';

export default function DivisionCreateSimpleModal({ 
  open, 
  businessId, 
  onClose, 
  onSuccess 
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Reset al cerrar
  const handleClose = () => {
    setName('');
    setError(null);
    onClose();
  };
  
  // Generar código automático desde el nombre
  const generateCode = (name) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 4)
      .padEnd(4, 'X');
  };
  
  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const code = generateCode(name);
      
      await apiDivisions.createDivision({
        business_id: businessId,
        name: name.trim(),
        code,
        description: '',
        is_active: true,
        display_order: 0,
        config: {
          color: '#2196f3',
          icon: '📁',
        },
      });
      
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Crear Subnegocio</DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box sx={{ mt: 1 }}>
            <TextField
              label="Nombre del subnegocio"
              fullWidth
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cafetería, Delivery, Eventos"
              autoFocus
              helperText="Se generará automáticamente un código único"
            />
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Creando...' : 'Crear'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}