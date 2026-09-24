// src/componentes/GestionarSectoresModal.jsx
// Vista Operación — gestionar sectores como overlay encima de donde estés
// (invitar miembro, editar acceso), en vez de navegar a Configuración y
// perder lo que estabas haciendo ahí.
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import SectoresTab from '@/componentes/configuracion/SectoresTab';

const tc = 'var(--color-primary, #3b82f6)';

export default function GestionarSectoresModal({ open, onClose, businessId }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <GroupsIcon sx={{ color: tc }} />
        Sectores
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: '#f8f9fb' }}>
        <SectoresTab businessId={businessId} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
