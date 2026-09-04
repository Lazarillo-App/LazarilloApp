// src/componentes/RecetaModal/VistaCocinaModal.jsx
import { Modal, Box, Typography, IconButton, Button, Chip, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';

/* ════════════════════════════════════════
   VISTA COCINA (preview de lectura)
════════════════════════════════════════ */
export default function VistaCocinaModal({ nombre, rendimiento, items, notas, foto, onClose }) {
  const ingredientesVisibles = items.filter(it => it.supplyId && it.tipoCosto !== 'nulo' && it.secreto !== true);
  const conNotas = ingredientesVisibles.filter(it => it.observaciones);
  const hayNotas = !!notas;
  const hayNotasIngredientes = conNotas.length > 0;

  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 680 },
        maxHeight: '92vh',
        bgcolor: '#fffdf7',
        borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header cocina */}
        <Box sx={{
          px: 3, py: 2,
          bgcolor: '#1c1917', color: '#fef9c3',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <RestaurantMenuIcon />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1} sx={{ letterSpacing: 0.5 }}>
                {nombre || 'Receta'}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Rinde {rendimiento} {rendimiento === 1 ? 'porción' : 'porciones'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip label="Vista Cocina" size="small" sx={{ bgcolor: '#fef9c3', color: '#1c1917', fontWeight: 700, fontSize: '0.7rem' }} />
            <IconButton size="small" onClick={onClose} sx={{ color: '#fef9c3' }}><CloseIcon fontSize="small" /></IconButton>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>

          {/* ── 1. Foto al inicio si hay ── */}
          {foto && (
            <Box sx={{ mb: 2.5, borderRadius: 1.5, overflow: 'hidden', boxShadow: 2 }}>
              <img src={foto} alt="Foto receta" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            </Box>
          )}

          {/* ── 2. Notas generales al principio ── */}
          {hayNotas && (
            <Box sx={{ mb: 2.5, bgcolor: '#fef9c3', borderRadius: 1.5, p: 2, border: '1px solid #fde68a' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, color: '#78350f' }}>
                Instrucciones generales
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.92rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {notas}
              </Typography>
            </Box>
          )}

          {/* ── 3. Ingredientes ── */}
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 1, color: '#78350f' }}>
            Ingredientes
          </Typography>
          <Box sx={{ mb: hayNotasIngredientes ? 2 : 2.5 }}>
            {ingredientesVisibles.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Sin ingredientes cargados.</Typography>
            ) : ingredientesVisibles.map((it, i) => (
              <Box key={i} sx={{
                py: 0.75, borderBottom: '1px solid #e7e5e4',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                    {it.supplyNombre || `Insumo #${it.supplyId}`}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: '#1c1917', ml: 2, flexShrink: 0 }}>
                    {it.cantidad} {it.unidad || it.supplyMedida || 'u'}
                  </Typography>
                </Box>
                {/* Nota e imagen del ingrediente si existen */}
                {(it.observaciones || it.fotosUrls?.length > 0) && (
                  <Box sx={{ mt: 0.5 }}>
                    {it.fotosUrls?.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                        {it.fotosUrls.map((url, fi) => (
                          <Box key={fi} sx={{ borderRadius: 1, overflow: 'hidden', width: 90, height: 70 }}>
                            <img src={url} alt={`${it.supplyNombre} ${fi + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </Box>
                        ))}
                      </Box>
                    )}
                    {it.observaciones && (
                      <Typography variant="caption" sx={{
                        fontSize: '0.78rem', color: '#78350f', fontStyle: 'italic',
                        display: 'block', lineHeight: 1.4,
                      }}>
                        ↳ {it.observaciones}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          {/* ── 4. Sin notas fallback ── */}
          {!hayNotas && !hayNotasIngredientes && (
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', mt: 1 }}>
              Sin instrucciones adicionales.
            </Typography>
          )}
        </Box>

        <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid #e7e5e4', display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onClose} variant="outlined" sx={{ borderColor: '#1c1917', color: '#1c1917' }}>
            Cerrar vista
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
