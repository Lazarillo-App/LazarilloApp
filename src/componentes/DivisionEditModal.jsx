/**
 * DivisionEditModal - Modal para editar una división existente
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  FormControlLabel,
  Switch,
  Grid,
} from '@mui/material';
import ColorField from './ColorField';
import * as apiDivisions from '../servicios/apiDivisions';

export default function DivisionEditModal({ open, division, onClose, onSuccess }) {
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
  
  // Cargar datos de la división al abrir
  useEffect(() => {
    if (division && open) {
      setFormData({
        name: division.name || '',
        code: division.code || '',
        description: division.description || '',
        is_active: division.is_active ?? true,
        display_order: division.display_order ?? 0,
        config: {
          color: division.config?.color || '#2196f3',
          icon: division.config?.icon || '📁',
          ...division.config,
        },
      });
      setError(null);
    }
  }, [division, open]);
  
  // Reset al cerrar
  const handleClose = () => {
    setError(null);
    onClose();
  };
  
  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!division?.id) return;
    
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
      await apiDivisions.updateDivision(division.id, formData);
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (!division) return null;
  
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          Editar División: {division.name}
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {division.is_main && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Esta es la división principal del negocio
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
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  name: e.target.value,
                }))}
                placeholder="Ej: Cafetería"
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
            
            {/* Activa (solo si no es principal) */}
            {!division.is_main && (
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
            )}
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
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}