/**
 * DivisionCreateModal - Modal para crear una nueva división
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  FormControlLabel,
  Switch,
  Grid,
} from '@mui/material';
import ColorField from './ColorField';
import * as apiDivisions from '../servicios/apiDivisions';

export default function DivisionCreateModal({ open, businessId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
    display_order: 0,
    config: {
      color: '#2196f3',
      icon: '📁',
    },
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Reset al cerrar
  const handleClose = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      is_active: true,
      display_order: 0,
      config: {
        color: '#2196f3',
        icon: '📁',
      },
    });
    setError(null);
    onClose();
  };
  
  // Generar código automático desde el nombre
  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      // Auto-generar código solo si está vacío
      code: prev.code ? prev.code : generateCode(name),
    }));
  };
  
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
    
    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    
    if (!formData.code.trim()) {
      setError('El código es requerido');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await apiDivisions.createDivision({
        business_id: businessId,
        ...formData,
      });
      
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Nueva División</DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Nombre */}
            <Grid item xs={12}>
              <TextField
                label="Nombre"
                fullWidth
                required
                value={formData.name}
                onChange={handleNameChange}
                placeholder="Ej: Cafetería"
                autoFocus
              />
            </Grid>
            
            {/* Código */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Código"
                fullWidth
                required
                value={formData.code}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  code: e.target.value.toUpperCase(),
                }))}
                placeholder="Ej: CAFE"
                inputProps={{ maxLength: 10 }}
              />
            </Grid>
            
            {/* Orden */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Orden de visualización"
                fullWidth
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  display_order: parseInt(e.target.value, 10) || 0,
                }))}
                inputProps={{ min: 0 }}
              />
            </Grid>
            
            {/* Descripción */}
            <Grid item xs={12}>
              <TextField
                label="Descripción"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value,
                }))}
                placeholder="Descripción opcional de la división"
              />
            </Grid>
            
            {/* Color */}
            <Grid item xs={12} sm={6}>
              <ColorField
                label="Color"
                value={formData.config.color}
                onChange={(color) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, color },
                }))}
              />
            </Grid>
            
            {/* Icono */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Icono (emoji)"
                fullWidth
                value={formData.config.icon}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, icon: e.target.value },
                }))}
                placeholder="📁"
                inputProps={{ maxLength: 4 }}
              />
            </Grid>
            
            {/* Activa */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))}
                  />
                }
                label="División activa"
              />
            </Grid>
          </Grid>
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