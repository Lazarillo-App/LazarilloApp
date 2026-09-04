// src/componentes/RecetaModal/NotasItemModal.jsx
import { useState, useRef, useMemo } from 'react';
import { Box, Typography, TextField, Button, IconButton, CircularProgress, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NotesIcon from '@mui/icons-material/Notes';
import ImageIcon from '@mui/icons-material/Image';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { BASE } from '@/servicios/apiBase';
import { PRIMARY, ON_PRIMARY, fmtDate } from './helpers';
import { useFotoUploadQR } from './useFotoUploadQR';

/**
 * NotasItemModal — Modal de notas por ingrediente
 * - Texto libre con persistencia
 * - Múltiples fotos (array de URLs)
 * - Upload autenticado via backend (/api/recetas/:articuloId/fotos) → Cloudinary server-side
 * - Fallback a base64 local si el endpoint no responde
 * - QR para subir desde celular
 */
export default function NotasItemModal({
  supplyNombre, observaciones, fotosUrls: fotosIniciales,
  updatedAt, onSave, onClose, articuloId, businessId,
}) {
  const [texto, setTexto] = useState(observaciones || '');
  const [fotos, setFotos] = useState(() => {
    if (!fotosIniciales) return [];
    if (Array.isArray(fotosIniciales)) return fotosIniciales.filter(Boolean);
    if (typeof fotosIniciales === 'string' && fotosIniciales) return [fotosIniciales];
    return [];
  });

  const initialTextoRef = useRef(observaciones || '');
  const initialFotosRef = useRef(
    !fotosIniciales ? []
      : Array.isArray(fotosIniciales) ? fotosIniciales.filter(Boolean)
        : (typeof fotosIniciales === 'string' && fotosIniciales) ? [fotosIniciales]
          : []
  );

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const pollQuery = useMemo(() => ({ supplyId: String(articuloId) }), [articuloId]);
  const tokenBody = useMemo(() => ({ supplyId: articuloId, supplyNombre }), [articuloId, supplyNombre]);

  const {
    uploadToken, tokenLoading, showQR, hayFotosQR, uploadError, setUploadError, toggleQR,
  } = useFotoUploadQR({
    articuloId, businessId, tokenBody, pollQuery,
    onFotosRecibidas: (fotosNuevas) => {
      setFotos(prev => {
        const nuevas = fotosNuevas.filter(u => !prev.includes(u));
        if (nuevas.length > 0) {
          setUploadError(`📱 ${nuevas.length} foto(s) nueva(s) del celular — guardá para confirmar`);
          return [...prev, ...nuevas];
        }
        return prev;
      });
    },
  });

  // Cierre "accidental" (X, click afuera, Escape): guarda solo si cambió algo
  const handleCloseGuardando = () => {
    const cambio =
      texto !== initialTextoRef.current ||
      JSON.stringify(fotos) !== JSON.stringify(initialFotosRef.current);
    if (cambio) onSave(texto, fotos);
    onClose();
  };

  // ── Upload desde la computadora via backend → Cloudinary ──
  const uploadViaBackend = async (file) => {
    setUploading(true);
    setUploadError('');
    try {
      const token = localStorage.getItem('token') || '';
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${BASE}/recetas/${articuloId || 'general'}/fotos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId || ''),
        },
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.url) {
        setFotos(prev => [...prev, data.url]);
      } else {
        throw new Error('Sin URL en respuesta');
      }
    } catch (err) {
      // Fallback base64 local si el backend falla
      console.warn('[NotasItemModal] Backend upload falló, usando base64 local:', err.message);
      const reader = new FileReader();
      reader.onload = (ev) => setFotos(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
      setUploadError('Sin conexión al servidor — foto guardada localmente (no persistirá)');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => uploadViaBackend(file));
    e.target.value = '';
  };

  const removePhoto = (idx) => setFotos(prev => prev.filter((_, i) => i !== idx));

  const handleGuardar = () => {
    onSave(texto, fotos);
  };

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 1400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'rgba(0,0,0,0.35)',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) handleCloseGuardando(); }}
    >
      <Box sx={{
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 8,
        width: { xs: '95vw', sm: 500 }, maxHeight: '92vh',
        overflowY: 'auto', p: 2.5,
        display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>

        {/* ── Header ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <NotesIcon sx={{ fontSize: 16, color: PRIMARY }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: PRIMARY }}>
              Notas — {supplyNombre || 'Ingrediente'}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleCloseGuardando}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* ── Textarea ── */}
        <TextField
          autoFocus
          multiline
          minRows={3}
          maxRows={8}
          fullWidth
          size="small"
          placeholder="Ej: agregar al final, mezclar suavemente, reservar en frío…"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          inputProps={{ style: { fontSize: '0.88rem', lineHeight: 1.6 } }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCloseGuardando();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGuardar();
          }}
        />

        {/* ── Galería de fotos existentes ── */}
        {fotos.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {fotos.map((url, idx) => (
              <Box key={idx} sx={{
                position: 'relative', width: 110, height: 90,
                borderRadius: 1.5, overflow: 'hidden',
                border: '1px solid', borderColor: 'divider', flexShrink: 0,
              }}>
                <img
                  src={url}
                  alt={`Foto ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <IconButton
                  size="small"
                  onClick={() => removePhoto(idx)}
                  sx={{
                    position: 'absolute', top: 2, right: 2, p: '2px',
                    bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* ── Zona de carga ── */}
        <Box sx={{
          border: '1px dashed', borderColor: hayFotosQR ? '#16a34a' : 'divider',
          borderRadius: 1.5, py: 1.5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
          bgcolor: hayFotosQR ? '#f0fdf4' : 'action.hover',
          transition: 'all 0.3s',
        }}>
          {uploading ? (
            <Stack direction="row" alignItems="center" spacing={1} py={0.5}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">Subiendo foto…</Typography>
            </Stack>
          ) : (
            <>
              <Typography variant="caption" sx={{ fontSize: '0.72rem', color: hayFotosQR ? '#16a34a' : 'text.secondary' }}>
                {hayFotosQR
                  ? '📱 Fotos recibidas del celular'
                  : fotos.length > 0 ? 'Agregar más fotos' : 'Foto del ingrediente o preparación'
                }
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
                <Button
                  size="small" variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ borderColor: PRIMARY, color: PRIMARY, fontSize: '0.72rem' }}
                >
                  Archivo
                </Button>
                <Button
                  size="small" variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => cameraInputRef.current?.click()}
                  sx={{ borderColor: PRIMARY, color: PRIMARY, fontSize: '0.72rem' }}
                >
                  Cámara
                </Button>
                <Button
                  size="small" variant="outlined"
                  onClick={toggleQR}
                  disabled={tokenLoading}
                  sx={{ borderColor: '#78350f', color: '#78350f', fontSize: '0.72rem' }}
                >
                  {tokenLoading ? '…' : showQR ? 'Ocultar QR' : '📱 QR'}
                </Button>
              </Stack>
            </>
          )}

          {/* Mensaje de estado / fotos QR recibidas */}
          {uploadError && (
            <Typography variant="caption"
              sx={{
                fontSize: '0.7rem', textAlign: 'center', px: 1,
                color: hayFotosQR ? '#16a34a' : 'warning.main',
                fontWeight: hayFotosQR ? 600 : 400,
              }}
            >
              {uploadError}
            </Typography>
          )}

          {/* QR */}
          {showQR && uploadToken && (
            <Box sx={{
              mt: 0.5, p: 1.5, bgcolor: '#fff',
              borderRadius: 1.5, border: '1px solid #e7e5e4', textAlign: 'center',
            }}>
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

        {/* inputs ocultos */}
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFile} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />

        {/* Fecha última edición */}
        {updatedAt && (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
            Última edición: {fmtDate(updatedAt)}
          </Typography>
        )}

        {/* ── Acciones ── */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleGuardar}
            disabled={uploading}
            sx={{
              bgcolor: hayFotosQR ? '#16a34a' : PRIMARY,
              color: ON_PRIMARY,
              fontWeight: 700,
              '&:hover': {
                filter: 'brightness(0.9)',
                bgcolor: hayFotosQR ? '#16a34a' : PRIMARY,
              },
              // Pulso suave cuando hay fotos QR esperando
              ...(hayFotosQR && {
                animation: 'qr-pulse 1.5s ease-in-out infinite',
              }),
            }}
          >
            {hayFotosQR ? '💾 Guardar fotos del celular' : 'Guardar nota'}
          </Button>
        </Box>
      </Box>

      {/* Animación pulso para el botón cuando hay fotos QR */}
      <style>{`
        @keyframes qr-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
          50%       { box-shadow: 0 0 0 6px rgba(22,163,74,0); }
        }
      `}</style>
    </Box>
  );
}
