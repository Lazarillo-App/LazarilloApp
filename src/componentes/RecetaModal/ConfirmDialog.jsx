// src/componentes/RecetaModal/ConfirmDialog.jsx
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

// Diálogo de confirmación reutilizable para borrados (receta / equivalencia / merma)
export default function ConfirmDialog({ open, tipo = 'elemento', nombre = '', onConfirm, onCancel }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>¿Borrar {tipo}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          ¿Seguro querés borrar esta {tipo}{nombre ? <> (<strong>{nombre}</strong>)</> : ''}? Esta acción no se puede deshacer.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit" size="small">Cancelar</Button>
        <Button onClick={onConfirm} color="error" variant="contained" size="small">Sí, borrar</Button>
      </DialogActions>
    </Dialog>
  );
}
