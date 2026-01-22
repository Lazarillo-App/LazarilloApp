/**
 * DivisionDeleteDialog - Diálogo de confirmación para eliminar división
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  Typography,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

export default function DivisionDeleteDialog({ open, division, onClose, onConfirm }) {
  if (!division) return null;
  
  const { name, is_main, article_count = 0 } = division;
  
  // No permitir eliminar división principal
  if (is_main) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm">
        <DialogTitle>No se puede eliminar</DialogTitle>
        <DialogContent>
          <Alert severity="error">
            No se puede eliminar la división principal del negocio.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        Eliminar División
      </DialogTitle>
      
      <DialogContent>
        <DialogContentText>
          ¿Estás seguro que deseas eliminar la división <strong>"{name}"</strong>?
        </DialogContentText>
        
        {article_count > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Esta división tiene <strong>{article_count}</strong> {article_count === 1 ? 'artículo' : 'artículos'}.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Los artículos se moverán automáticamente a la división principal.
            </Typography>
          </Alert>
        )}
        
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            Esta acción no se puede deshacer.
          </Typography>
        </Alert>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
        >
          Eliminar División
        </Button>
      </DialogActions>
    </Dialog>
  );
}