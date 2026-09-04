// src/componentes/RecetaModal/VistaPreviaFotoModal.jsx
import { Modal, Box, Typography, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { PRIMARY, ON_PRIMARY } from './helpers';

// Vista previa de la foto en un modal, con opciones de editar o quitar
export default function VistaPreviaFotoModal({ foto, onEditar, onQuitar, onClose }) {
  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 520 },
        maxHeight: '90vh',
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight={700}>Foto de la receta</Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', bgcolor: '#1c1917', overflow: 'auto' }}>
          <img src={foto} alt="Foto receta" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={onQuitar}>
            Quitar foto
          </Button>
          <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={onEditar}
            sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}>
            Editar / Recortar
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
