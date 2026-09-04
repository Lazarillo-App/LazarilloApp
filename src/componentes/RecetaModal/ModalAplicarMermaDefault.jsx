/* eslint-disable react-hooks/exhaustive-deps */
// src/componentes/RecetaModal/ModalAplicarMermaDefault.jsx
import { useState, useEffect, useMemo } from 'react';
import {
  Modal, Box, Typography, Button, IconButton,
  Alert, CircularProgress, Checkbox, Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { insumoMermaAplicarPreview, insumoMermaAplicar } from '@/servicios/apiInsumos';
import { PRIMARY, ON_PRIMARY, fmt } from './helpers';

// Se abre cada vez que se marca una merma como "default" de un insumo: pregunta si esa
// merma debe aplicarse a las recetas que usan el insumo — tengan otra merma asignada o
// ninguna — con opción de destildar cuáles no (a las tildadas se les reemplaza la merma
// actual, si tenían, por la nueva).
export default function ModalAplicarMermaDefault({ insumoId, insumoNombre, mermaId, mermaNombre, businessId, onClose, onAplicado }) {
  const [preview, setPreview] = useState(null);
  const [excluidas, setExcluidas] = useState(() => new Set());   // recetaIds destildadas
  const [confirmando, setConfirmando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!insumoId || !mermaId || !businessId) return;
    insumoMermaAplicarPreview(insumoId, mermaId, businessId)
      .then(r => setPreview({ detalle: Array.isArray(r.detalle) ? r.detalle : [] }))
      .catch(e => { setError(e.message || 'No se pudo calcular qué recetas se verían afectadas'); setPreview({ detalle: [] }); });
  }, [insumoId, mermaId, businessId]);

  const detalle = preview?.detalle || [];

  const multiNegocio = useMemo(() => new Set(detalle.map(d => d.businessId)).size > 1, [detalle]);
  const recetaIdsElegidos = useMemo(
    () => detalle.map(d => d.recetaId).filter(id => !excluidas.has(id)),
    [detalle, excluidas]
  );
  const totalElegidas = recetaIdsElegidos.length;

  const toggleReceta = (rid) => setExcluidas(prev => {
    const nx = new Set(prev);
    if (nx.has(rid)) nx.delete(rid); else nx.add(rid);
    return nx;
  });

  const ejecutar = async () => {
    if (!totalElegidas) return;
    setEjecutando(true); setError('');
    try {
      // Si están todas tildadas no mandamos filtro: el back aplica a todas las candidatas.
      const recetaIds = totalElegidas === detalle.length ? null : recetaIdsElegidos;
      const r = await insumoMermaAplicar(insumoId, mermaId, businessId, recetaIds);
      onAplicado?.(r);
    } catch (e) {
      setError(e.message || 'No se pudo aplicar la merma');
      setEjecutando(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 520 },
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
      }}>
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ fontSize: 20 }}>♻️</Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Aplicar merma default</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>{insumoNombre} · {mermaNombre}</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

          {!confirmando ? (
            <>
              <Typography variant="body2">
                <b>{mermaNombre}</b> quedó como merma default de <b>{insumoNombre}</b>. Hay
                recetas que usan este insumo — ¿querés aplicarle esta merma también a ellas?
                A las que ya tenían otra asignada, se les reemplaza.
              </Typography>

              {preview == null ? (
                <Typography variant="caption" color="text.secondary">Buscando recetas…</Typography>
              ) : detalle.length === 0 ? (
                <Box sx={{ bgcolor: '#fff8ec', border: '1px solid #f0c98a', borderRadius: 1.5, px: 2, py: 1.25 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.78rem', color: '#7a5200' }}>
                    No hay recetas de este insumo a las que aplicarles esta merma — ya la tienen todas.
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                      Recetas de este insumo ({totalElegidas} de {detalle.length})
                    </Typography>
                    <Box>
                      <Button size="small" sx={{ minWidth: 0, fontSize: '0.7rem', px: 0.75 }}
                        onClick={() => setExcluidas(new Set())}>Todas</Button>
                      <Button size="small" sx={{ minWidth: 0, fontSize: '0.7rem', px: 0.75 }}
                        onClick={() => setExcluidas(new Set(detalle.map(d => d.recetaId)))}>Ninguna</Button>
                    </Box>
                  </Box>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, maxHeight: 220, overflowY: 'auto' }}>
                    {detalle.map(d => {
                      const incluida = !excluidas.has(d.recetaId);
                      const cant = d.items.map(it => `${fmt(it.cantidad)} ${it.unidad || ''}`.trim()).join(' + ');
                      const mermaActual = d.items.find(it => it.mermaActual)?.mermaActual || null;
                      return (
                        <Box key={d.recetaId}
                          onClick={() => toggleReceta(d.recetaId)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, cursor: 'pointer',
                            borderBottom: '1px solid', borderColor: 'divider',
                            opacity: incluida ? 1 : 0.5,
                            '&:hover': { bgcolor: 'action.hover' },
                          }}>
                          <Checkbox size="small" checked={incluida} sx={{ p: 0.25 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" noWrap sx={{
                              fontSize: '0.8rem', fontWeight: 600,
                              textDecoration: incluida ? 'none' : 'line-through',
                            }}>
                              {d.titulo}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              {cant}
                              {d.esElaborado ? ' · Elaborado' : ''}
                              {multiNegocio ? ` · Negocio #${d.businessId}` : ''}
                              {' · '}
                              {mermaActual ? <>Tenía: <b>{mermaActual}</b></> : 'Sin merma'}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontSize: '0.72rem', color: '#7a5200' }}>
                    El costo de las recetas tildadas se recalcula ahora mismo.
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" color="inherit" onClick={onClose}>Ahora no</Button>
                <Button size="small" variant="contained"
                  disabled={preview == null || totalElegidas === 0}
                  onClick={() => setConfirmando(true)}
                  sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}>
                  Continuar
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Vas a aplicar la merma <b>{mermaNombre}</b> en{' '}
                  <b>{totalElegidas} receta{totalElegidas !== 1 ? 's' : ''}</b>
                  {totalElegidas !== detalle.length && <> (de {detalle.length})</>}.
                </Typography>
                <Typography variant="caption" color="error" sx={{ fontWeight: 700 }}>
                  Esta acción no se puede deshacer.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" color="inherit" disabled={ejecutando} onClick={() => setConfirmando(false)}>Volver</Button>
                <Button size="small" variant="contained" color="error"
                  disabled={ejecutando}
                  startIcon={ejecutando ? <CircularProgress size={14} color="inherit" /> : null}
                  onClick={ejecutar}>
                  {ejecutando ? 'Aplicando…' : `Sí, aplicar en ${totalElegidas}`}
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Modal>
  );
}
