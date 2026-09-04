/* eslint-disable react-hooks/exhaustive-deps */
// src/componentes/RecetaModal/ModalReemplazarInsumo.jsx
import { useState, useEffect, useMemo } from 'react';
import {
  Modal, Box, Typography, TextField, Button, IconButton,
  Alert, CircularProgress, Checkbox, Stack, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { insumoReemplazarPreview, insumoReemplazar } from '@/servicios/apiInsumos';
import { PRIMARY, ON_PRIMARY, fmt, ordenarInsumosBusqueda } from './helpers';
import FilaResultadoInsumo from './FilaResultadoInsumo';

export default function ModalReemplazarInsumo({ insumoId, insumoNombre, businessId, insumos = [], alertaSemanas, onClose, onReemplazado }) {
  const [search, setSearch] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [preview, setPreview] = useState(null);
  const [excluidas, setExcluidas] = useState(() => new Set());   // recetaIds destildadas
  const [confirmando, setConfirmando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState('');

  // Cargar recetas afectadas al abrir
  useEffect(() => {
    if (!insumoId || !businessId) return;
    insumoReemplazarPreview(insumoId, businessId)
      .then(r => setPreview({
        recetas: r.recetas, items: r.items, negocios: r.negocios,
        detalle: Array.isArray(r.detalle) ? r.detalle : [],
      }))
      .catch(() => setPreview({ recetas: 0, items: 0, negocios: 0, detalle: [] }));
  }, [insumoId, businessId]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    // Mismas reglas que el buscador de ingredientes.
    return ordenarInsumosBusqueda(
      insumos
        .filter(i => Number(i.id) !== Number(insumoId))
        .filter(i => (i.nombre || '').toLowerCase().includes(q) || String(i.codigo_maxi || '').includes(q))
    ).slice(0, 20);
  }, [insumos, search, insumoId]);

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
    if (!seleccionado || !totalElegidas) return;
    setEjecutando(true); setError('');
    try {
      // Si están todas tildadas no mandamos filtro: el back se comporta como antes.
      const recetaIds = totalElegidas === detalle.length ? null : recetaIdsElegidos;
      const r = await insumoReemplazar(insumoId, seleccionado.id, businessId, recetaIds);
      onReemplazado?.(r);
    } catch (e) {
      setError(e.message || 'No se pudo reemplazar');
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
            <Box sx={{ fontSize: 20 }}>🔁</Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Reemplazar insumo</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>{insumoNombre}</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

          {!confirmando ? (
            <>
              {/* Buscador de insumo nuevo */}
              <Box sx={{ position: 'relative' }}>
                <TextField
                  autoFocus size="small" fullWidth
                  label="Reemplazar por"
                  placeholder="Buscar insumo…"
                  value={seleccionado ? seleccionado.nombre : search}
                  onChange={e => { setSeleccionado(null); setSearch(e.target.value); }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                {!seleccionado && filtrados.length > 0 && (
                  <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, boxShadow: 6, mt: 0.5, maxHeight: 240, overflowY: 'auto' }}>
                    {filtrados.map(ins => (
                      <FilaResultadoInsumo
                        key={ins.id}
                        ins={ins}
                        alertaSemanas={alertaSemanas}
                        onClick={() => { setSeleccionado(ins); setSearch(''); }}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              {/* Recetas afectadas — destildá las que no querés tocar */}
              {preview == null ? (
                <Typography variant="caption" color="text.secondary">Buscando recetas…</Typography>
              ) : detalle.length === 0 ? (
                <Box sx={{ bgcolor: '#fff8ec', border: '1px solid #f0c98a', borderRadius: 1.5, px: 2, py: 1.25 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.78rem', color: '#7a5200' }}>
                    Este insumo no se usa en ninguna receta.
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                      Recetas afectadas ({totalElegidas} de {detalle.length})
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
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontSize: '0.72rem', color: '#7a5200' }}>
                    Los costos se recalculan en las recetas tildadas. <b>Esta acción no se puede deshacer.</b>
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
                <Button size="small" variant="contained"
                  disabled={!seleccionado || preview == null || totalElegidas === 0}
                  onClick={() => setConfirmando(true)}
                  sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}>
                  Continuar
                </Button>
              </Box>
            </>
          ) : (
            <>
              {/* Confirmación final */}
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Vas a reemplazar <b>{insumoNombre}</b> por <b>{seleccionado.nombre}</b> en{' '}
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
                  {ejecutando ? 'Reemplazando…' : `Sí, reemplazar en ${totalElegidas}`}
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Modal>
  );
}
