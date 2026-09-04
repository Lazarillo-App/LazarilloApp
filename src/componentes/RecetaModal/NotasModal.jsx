// src/componentes/RecetaModal/NotasModal.jsx
import { useState, useRef } from 'react';
import {
  Modal, Box, Typography, TextField, Button, IconButton, Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NotesIcon from '@mui/icons-material/Notes';
import ImageIcon from '@mui/icons-material/Image';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { PRIMARY, ON_PRIMARY, fmtDate } from './helpers';
import { useFotoUploadQR } from './useFotoUploadQR';
import EditorFotoModal from './EditorFotoModal';

/* ════════════════════════════════════════
   MODAL DE NOTAS + FOTO
════════════════════════════════════════ */
export default function NotasModal({
  notas,
  foto,
  fotos,
  notasUpdatedAt,
  onSave,
  onClose,
  articuloId,
  businessId,
  esElaborado,
}) {
  const [localNotas, setLocalNotas] = useState(notas || '');
  // Array de fotos (hasta 6). Compat: si viene `fotos` la usa, si no cae al `foto` single.
  const [localFotos, setLocalFotos] = useState(() => {
    if (Array.isArray(fotos) && fotos.length) return fotos.filter(Boolean).slice(0, 6);
    return foto ? [foto] : [];
  });

  // Snapshot inicial para detectar cambios al cerrar
  const initialNotasRef = useRef(notas || '');
  const initialFotosRef = useRef(
    Array.isArray(fotos) && fotos.length ? fotos.filter(Boolean).slice(0, 6) : (foto ? [foto] : [])
  );

  // Cierre "accidental" (X, click afuera): guarda solo si cambió algo
  const handleCloseGuardando = () => {
    const cambio =
      localNotas !== initialNotasRef.current ||
      JSON.stringify(localFotos) !== JSON.stringify(initialFotosRef.current);
    if (cambio) {
      const now = new Date().toISOString();
      onSave(localNotas, localFotos, now);
    }
    onClose();
  };

  const [fotoActiva, setFotoActiva] = useState(0); // índice de la foto que se está viendo
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  // Fecha de modificación: se actualiza al guardar
  const [localUpdatedAt, setLocalUpdatedAt] = useState(notasUpdatedAt || null);
  const [fotoParaEditar, setFotoParaEditar] = useState(null); // foto cruda esperando recorte

  const {
    uploadToken, tokenLoading, showQR, hayFotosQR, uploadError, setHayFotosQR, setUploadError, toggleQR,
  } = useFotoUploadQR({
    articuloId, businessId,
    onFotosRecibidas: (fotosNuevas) => {
      const nueva = fotosNuevas[0];
      if (!localFotos.includes(nueva)) {
        setFotoParaEditar(nueva); // abrir editor con la foto del celular
        setHayFotosQR(true);
        setUploadError('📱 Foto recibida del celular — ajustala y guardá');
      }
    },
  });

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFotoParaEditar(ev.target.result); // abrir editor en vez de guardar directo
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <Modal open onClose={handleCloseGuardando}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '95vw', sm: 600 },
          bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
          outline: 'none', overflow: 'hidden',
          maxHeight: '99vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <Box sx={{
            px: 2.5,
            py: 1.5,
            bgcolor: PRIMARY,
            color: ON_PRIMARY,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <NotesIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700}>Notas e imagen de la receta</Typography>
            </Stack>
            <IconButton size="small" onClick={handleCloseGuardando} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
          </Box>

          <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Área de texto */}
            <TextField
              label="Notas / Instrucciones"
              multiline
              minRows={6}
              fullWidth
              value={localNotas}
              onChange={e => setLocalNotas(e.target.value)}
              placeholder={esElaborado
                ? "Método de Envasado: Ej: envasar al vacío, conservar en frío…"
                : "Método de Servido: Ej: servir frío, acompañar con salsa…"}
            />

            {/* Foto */}
            {localFotos.length > 0 ? (
              <Box>
                {/* Foto activa con navegación */}
                <Box sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                  <img
                    src={localFotos[fotoActiva]}
                    alt={`Foto receta ${fotoActiva + 1}`}
                    style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }}
                  />
                  {/* Quitar la foto activa */}
                  <IconButton
                    size="small"
                    onClick={() => {
                      setLocalFotos(prev => {
                        const next = prev.filter((_, i) => i !== fotoActiva);
                        setFotoActiva(a => Math.max(0, Math.min(a, next.length - 1)));
                        return next;
                      });
                    }}
                    sx={{
                      position: 'absolute', top: 6, right: 6,
                      bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  {/* Contador */}
                  {localFotos.length > 1 && (
                    <Box sx={{
                      position: 'absolute', bottom: 6, right: 6,
                      bgcolor: 'rgba(0,0,0,0.6)', color: '#fff',
                      px: 1, py: 0.25, borderRadius: 1, fontSize: '0.7rem',
                    }}>
                      {fotoActiva + 1}/{localFotos.length}
                    </Box>
                  )}
                </Box>

                {/* Miniaturas + botón agregar */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                  {localFotos.map((url, i) => (
                    <Box
                      key={i}
                      onClick={() => setFotoActiva(i)}
                      sx={{
                        width: 54, height: 42, borderRadius: 1, overflow: 'hidden', cursor: 'pointer',
                        border: i === fotoActiva ? '2px solid' : '1px solid',
                        borderColor: i === fotoActiva ? PRIMARY : 'divider',
                      }}
                    >
                      <img src={url} alt={`mini ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  ))}
                  {/* Agregar más (hasta 6) */}
                  {localFotos.length < 6 && (
                    <Box
                      onClick={() => fileInputRef.current?.click()}
                      sx={{
                        width: 54, height: 42, borderRadius: 1, cursor: 'pointer',
                        border: '2px dashed', borderColor: 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'text.disabled',
                      }}
                    >
                      +
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (

              <Box sx={{
                border: '2px dashed', borderColor: 'divider', borderRadius: 1.5,
                py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
                bgcolor: 'action.hover',
              }}>
                <ImageIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">Adjuntá una foto de la receta</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small" variant="outlined"
                    startIcon={<ImageIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ borderColor: PRIMARY, color: PRIMARY }}
                  >
                    Desde archivo
                  </Button>
                  <Button
                    size="small" variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    onClick={() => cameraInputRef.current?.click()}
                    sx={{ borderColor: PRIMARY, color: PRIMARY }}
                  >
                    Cámara
                  </Button>
                  <Button
                    size="small" variant="outlined"
                    onClick={toggleQR}
                    disabled={tokenLoading}
                    sx={{ borderColor: '#78350f', color: '#78350f' }}
                  >
                    {tokenLoading ? '…' : showQR ? 'Ocultar QR' : '📱 QR'}
                  </Button>
                </Stack>

                {uploadError && (
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: hayFotosQR ? '#16a34a' : 'warning.main', fontWeight: hayFotosQR ? 600 : 400 }}>
                    {uploadError}
                  </Typography>
                )}

                {showQR && uploadToken && (
                  <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e7e5e4', textAlign: 'center' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(uploadToken.uploadUrl)}`}
                      alt="QR para subir foto"
                      style={{ width: 130, height: 130, display: 'block', margin: '0 auto' }}
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.5, display: 'block' }}>
                      Escaneá para subir desde el celular
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', display: 'block' }}>
                      Vence: {new Date(uploadToken.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                )}

              </Box>
            )}
          </Box>
          {/* inputs ocultos */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
          <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            {/* Fecha última modificación */}
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
              {localUpdatedAt
                ? `Última modificación: ${fmtDate(localUpdatedAt)}`
                : 'Sin modificaciones previas'
              }
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
              <Button size="small" variant="contained"
                onClick={() => {
                  const now = new Date().toISOString();
                  setLocalUpdatedAt(now);
                  onSave(localNotas, localFotos, now);
                  onClose();
                }}
                sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}>
                Guardar notas
              </Button>
            </Box>
          </Box>
        </Box>

      </Modal>
      {fotoParaEditar && (
        <EditorFotoModal
          imagenSrc={fotoParaEditar}
          onConfirmar={(recortada) => {
            setLocalFotos(prev => {
              const next = [...prev, recortada].slice(0, 6); // suma al array, tope 6
              setFotoActiva(next.length - 1); // mostrar la recién agregada
              return next;
            });
            setFotoParaEditar(null);
          }}
          onCancelar={() => setFotoParaEditar(null)}
        />
      )}
    </>
  );
}
