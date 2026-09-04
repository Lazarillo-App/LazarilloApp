// src/componentes/RecetaModal/EditorFotoModal.jsx
import { useState, useCallback } from 'react';
import { Modal, Box, Typography, IconButton, Button, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/utils/cropImage';
import { PRIMARY, ON_PRIMARY } from './helpers';

export default function EditorFotoModal({ imagenSrc, onConfirmar, onCancelar }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const confirmar = async () => {
    if (!croppedAreaPixels) return;
    setProcesando(true);
    try {
      const recortada = await getCroppedImg(imagenSrc, croppedAreaPixels, rotation);
      onConfirmar(recortada);
    } catch (e) {
      console.error('[EditorFoto] error al recortar:', e);
      onConfirmar(imagenSrc); // fallback: usar la original si falla
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal open onClose={onCancelar}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 480 },
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight={700}>Ajustar foto</Typography>
          <IconButton size="small" onClick={onCancelar} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* Área de crop */}
        <Box sx={{ position: 'relative', width: '100%', height: 340, bgcolor: '#1c1917' }}>
          <Cropper
            image={imagenSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </Box>

        {/* Controles */}
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" sx={{ width: 44, color: 'text.secondary' }}>Zoom</Typography>
            <input type="range" min={1} max={3} step={0.05} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              style={{ flex: 1, accentColor: PRIMARY }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button size="small" onClick={() => setRotation(r => (r + 90) % 360)}
              sx={{ color: PRIMARY }}>
              ↻ Rotar 90°
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" color="inherit" onClick={onCancelar} disabled={procesando}>Cancelar</Button>
              <Button size="small" variant="contained" onClick={confirmar} disabled={procesando || !croppedAreaPixels}
                startIcon={procesando ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}>
                {procesando ? 'Procesando…' : 'Usar foto'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
