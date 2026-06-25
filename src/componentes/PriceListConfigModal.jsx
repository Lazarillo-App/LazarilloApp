/* eslint-disable no-empty */
// src/componentes/PriceListConfigModal.jsx
// Modal de gestión de listas de precios (modelo nuevo).
// Cada cambio guarda inmediato al onBlur — no hay "Guardar" final.

import React, { useEffect, useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Stack, Chip,
  IconButton, InputAdornment, CircularProgress, Alert, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PercentIcon from '@mui/icons-material/Percent';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExcluirListasModal from './ExcluirListasModal';
import { ArticleListsAPI } from '@/servicios/apiArticleLists';

const PRIMARY = 'var(--color-primary, #2492C8)';

// Paleta default rotativa para listas sin color asignado
const DEFAULT_COLORS = ['#2492C8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const colorForList = (list, idx) =>
  list.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  return '$' + Math.round(v).toLocaleString('es-AR');
}

function calcEjemplo(precioBase, ajustePct) {
  const pct = Number(ajustePct) || 0;
  return precioBase * (1 + pct / 100);
}

export default function PriceListConfigModal({
  open,
  onClose,
  bizId,
  byList = {},                  // NUEVO: viene de useArticleLists
  articleNameById = new Map(),
}) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingIds, setSavingIds] = useState(new Set()); // IDs que están guardando
  const [creating, setCreating] = useState(false);
  const [manageState, setManageState] = useState(null);
  // { mode: 'manage', scopeLabel } cuando está abierto

  /* ── Cargar listas ── */
  const reload = useCallback(async () => {
    if (!bizId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ArticleListsAPI.list(bizId);
      setLists(Array.isArray(res?.lists) ? res.lists : []);
    } catch (e) {
      setError(e.message || 'Error cargando listas');
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  /* ── Helpers de saving ── */
  const markSaving = (id, on) => {
    setSavingIds(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  /* ── Actualizar campo (optimista + PUT) ── */
  const updateField = useCallback(async (listId, patch) => {
    // 1) update optimista local
    setLists(prev => prev.map(l => l.id === listId ? { ...l, ...patch } : l));

    // 2) PUT al backend
    markSaving(listId, true);
    try {
      const res = await ArticleListsAPI.update(bizId, listId, patch);
      // Si el backend devuelve la lista actualizada, sincronizar
      if (res?.list) {
        setLists(prev => prev.map(l => l.id === listId ? { ...l, ...res.list } : l));
      }
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
      reload(); // revertir
    } finally {
      markSaving(listId, false);
    }
  }, [bizId, reload]);

  /* ── Crear nueva lista ── */
  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      // Nombre default: "Lista N+1" donde N es la cantidad actual
      const nextNumber = lists.length + 1;
      const name = `Lista ${nextNumber}`;
      const res = await ArticleListsAPI.create(bizId, {
        name,
        ajuste_pct: 0,
      });
      if (res?.list) {
        setLists(prev => [...prev, res.list]);
      } else {
        reload();
      }
    } catch (e) {
      setError(e.message || 'Error creando lista');
    } finally {
      setCreating(false);
    }
  };

  /* ── Eliminar lista ── */
  const handleDelete = async (list) => {
    if (list.is_favorite) return; // safety
    if (!confirm(`¿Eliminar la lista "${list.name}"? Esta acción no se puede deshacer.`)) return;

    markSaving(list.id, true);
    try {
      await ArticleListsAPI.remove(bizId, list.id);
      setLists(prev => prev.filter(l => l.id !== list.id));
    } catch (e) {
      setError(e.message || 'Error eliminando lista');
    } finally {
      markSaving(list.id, false);
    }
  };

  /* ── Reordenar (↑↓) ── */
  const handleMove = async (listId, direction) => {
    const idx = lists.findIndex(l => l.id === listId);
    if (idx < 0) return;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= lists.length) return;

    // Swap local
    const newLists = [...lists];
    [newLists[idx], newLists[target]] = [newLists[target], newLists[idx]];
    // Recalcular orden
    const reordered = newLists.map((l, i) => ({ ...l, orden: i + 1 }));
    setLists(reordered);

    // PUT cada uno con su nuevo orden (solo los dos afectados)
    try {
      await Promise.all([
        ArticleListsAPI.update(bizId, reordered[idx].id, { orden: reordered[idx].orden }),
        ArticleListsAPI.update(bizId, reordered[target].id, { orden: reordered[target].orden }),
      ]);
    } catch (e) {
      setError(e.message || 'Error reordenando');
      reload();
    }
  };

  const conteos = React.useMemo(() => {
    const out = { _base: 0, byList: {} };
    const baseExc = byList?._base?.byArticle || {};
    Object.values(baseExc).forEach(v => { if (v?.excluido === true) out._base++; });
    for (const l of lists) {
      if (l.is_favorite) continue;
      const bucket = byList?.[l.id]?.byArticle || {};
      let n = 0;
      Object.values(bucket).forEach(v => { if (v?.excluido === true) n++; });
      out.byList[l.id] = n;
    }
    return out;
  }, [byList, lists]);

  /* ── Render ── */
  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '92vh' } }}>

      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography fontWeight={700} sx={{ flex: 1 }}>
          Configurar listas de precios
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Alert severity="info" sx={{ mb: 2, py: 0.5, fontSize: '0.78rem' }}>
          La lista <strong>favorita</strong> (★) define los precios base. Las otras listas aplican un <strong>descuento (↓)</strong> o <strong>recargo (↑)</strong> sobre la favorita.
        </Alert>
        {conteos._base > 0 && (
          <Box sx={{
            mb: 2, p: 1.25, borderRadius: 1.5,
            bgcolor: '#fffbeb', border: '1px solid #fde68a',
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <Typography variant="body2" sx={{ flex: 1, fontSize: '0.82rem' }}>
              🌐 <strong>{conteos._base}</strong> artículo{conteos._base !== 1 ? 's' : ''} excluido{conteos._base !== 1 ? 's' : ''} globalmente (en todas las listas, incluyendo futuras).
            </Typography>
            <Button size="small" variant="outlined"
              onClick={() => setManageState({ scopeLabel: 'Exclusiones globales' })}
              sx={{ fontSize: '0.72rem', borderColor: '#92400e', color: '#92400e' }}>
              Ver / editar
            </Button>
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2, py: 0.5 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box>
            {/* Header */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '36px 60px 1fr 70px 130px 130px 110px 40px',
              gap: 1, px: 1.5, py: 0.75,
              bgcolor: '#f1f5f9', borderRadius: '8px 8px 0 0',
              border: '1px solid #e2e8f0', borderBottom: 'none',
            }}>
              {['', 'Orden', 'Nombre', 'Color', 'Tipo', 'Valor', 'Ejemplo $1.000', ''].map((h, i) => (
                <Typography key={i} variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </Typography>
              ))}
            </Box>

            {/* Filas */}
            {lists.map((list, idx) => {
              const isFav = !!list.is_favorite;
              const isSaving = savingIds.has(list.id);
              const colorPalette = colorForList(list, idx);
              const ejemplo = isFav ? 1000 : calcEjemplo(1000, list.ajuste_pct);
              const isLast = idx === lists.length - 1;

              return (
                <Box key={list.id} sx={{
                  display: 'grid',
                  gridTemplateColumns: '36px 60px 1fr 70px 130px 130px 110px 40px',
                  gap: 1, px: 1.5, py: 1,
                  border: '1px solid #e2e8f0',
                  borderTop: 'none',
                  borderRadius: isLast ? '0 0 8px 8px' : 0,
                  bgcolor: isFav ? `${PRIMARY}06` : 'background.paper',
                  alignItems: 'center',
                  opacity: isSaving ? 0.7 : 1,
                  transition: 'background 0.15s, opacity 0.15s',
                }}>
                  {/* Estrella favorita */}
                  <Tooltip title={isFav ? 'Lista favorita (precio base)' : 'No es la favorita'}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isFav ? '#f59e0b' : '#d1d5db',
                    }}>
                      {isFav ? <StarIcon sx={{ fontSize: 18 }} /> : <StarOutlineIcon sx={{ fontSize: 18 }} />}
                    </Box>
                  </Tooltip>

                  {/* Botones ↑↓ */}
                  <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
                    <IconButton size="small" disabled={idx === 0 || isSaving}
                      onClick={() => handleMove(list.id, 'up')}
                      sx={{ p: 0.25 }}>
                      <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton size="small" disabled={idx === lists.length - 1 || isSaving}
                      onClick={() => handleMove(list.id, 'down')}
                      sx={{ p: 0.25 }}>
                      <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>

                  {/* Nombre */}
                  <TextField
                    size="small"
                    defaultValue={list.name}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v && v !== list.name) updateField(list.id, { name: v });
                    }}
                    placeholder={`Lista ${idx + 1}`}
                    disabled={isSaving}
                    inputProps={{ style: { fontSize: '0.82rem', padding: '5px 8px' } }}
                  />

                  {/* Color */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="color"
                      value={colorPalette}
                      onChange={e => updateField(list.id, { color: e.target.value })}
                      disabled={isSaving}
                      style={{
                        width: 32, height: 24,
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        cursor: isSaving ? 'default' : 'pointer',
                        padding: 0,
                      }}
                      title="Color de la lista"
                    />
                  </Box>

                  {/* Tipo (descuento/recargo) — solo afecta el signo interno de ajuste_pct */}
                  {isFav ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', height: 32 }}>
                      <Chip label="Base" size="small" icon={<StarIcon sx={{ fontSize: 12 }} />}
                        sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                    </Box>
                  ) : (() => {
                    const ajusteNum = Number(list.ajuste_pct) || 0;
                    const tipo = ajusteNum < 0 ? 'descuento' : 'recargo';
                    const cambiarTipo = (nuevoTipo) => {
                      if (nuevoTipo === tipo) return;
                      // Voltear el signo del valor actual (si es 0, queda 0 pero se "etiqueta")
                      const valorAbs = Math.abs(ajusteNum);
                      const nuevoAjuste = nuevoTipo === 'descuento' ? -valorAbs : valorAbs;
                      updateField(list.id, { ajuste_pct: nuevoAjuste });
                    };
                    return (
                      <Stack direction="row" spacing={0.5}>
                        <Chip
                          label="↓ Desc."
                          size="small"
                          icon={<TrendingDownIcon sx={{ fontSize: 13 }} />}
                          onClick={() => !isSaving && cambiarTipo('descuento')}
                          sx={{
                            height: 24, fontSize: '0.7rem', cursor: isSaving ? 'default' : 'pointer',
                            bgcolor: tipo === 'descuento' ? '#dbeafe' : 'transparent',
                            color: tipo === 'descuento' ? '#1d4ed8' : 'text.secondary',
                            border: `1px solid ${tipo === 'descuento' ? '#93c5fd' : '#e2e8f0'}`,
                            '& .MuiChip-icon': { color: 'inherit' },
                            '&:hover': { bgcolor: '#dbeafe' },
                          }}
                        />
                        <Chip
                          label="↑ Rec."
                          size="small"
                          icon={<TrendingUpIcon sx={{ fontSize: 13 }} />}
                          onClick={() => !isSaving && cambiarTipo('recargo')}
                          sx={{
                            height: 24, fontSize: '0.7rem', cursor: isSaving ? 'default' : 'pointer',
                            bgcolor: tipo === 'recargo' ? '#dcfce7' : 'transparent',
                            color: tipo === 'recargo' ? '#15803d' : 'text.secondary',
                            border: `1px solid ${tipo === 'recargo' ? '#86efac' : '#e2e8f0'}`,
                            '& .MuiChip-icon': { color: 'inherit' },
                            '&:hover': { bgcolor: '#dcfce7' },
                          }}
                        />
                      </Stack>
                    );
                  })()}

                  {/* Valor — el input siempre muestra el valor absoluto;
                      el signo lo define el toggle de Tipo */}
                  {isFav ? (
                    <Box />
                  ) : (
                    <TextField
                      key={`pct-${list.id}-${list.ajuste_pct}`}
                      size="small"
                      type="number"
                      defaultValue={Math.abs(Number(list.ajuste_pct) || 0)}
                      onBlur={e => {
                        const inputAbs = e.target.value === '' ? 0 : Math.abs(Number(e.target.value));
                        const ajusteActual = Number(list.ajuste_pct) || 0;
                        const tipoActual = ajusteActual < 0 ? 'descuento' : 'recargo';
                        const nuevoAjuste = tipoActual === 'descuento' ? -inputAbs : inputAbs;
                        if (nuevoAjuste !== ajusteActual) updateField(list.id, { ajuste_pct: nuevoAjuste });
                      }}
                      placeholder="0"
                      disabled={isSaving}
                      inputProps={{
                        min: 0, max: 1000, step: 0.5,
                        style: { fontSize: '0.82rem', padding: '5px 8px', textAlign: 'right' },
                      }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end"><PercentIcon sx={{ fontSize: 14, opacity: 0.5 }} /></InputAdornment>,
                      }}
                    />
                  )}

                  {/* Ejemplo */}
                  <Box>
                    {isFav ? (
                      <Typography variant="caption" sx={{ fontSize: '0.78rem', color: 'text.primary', fontWeight: 700 }}>
                        $1.000
                      </Typography>
                    ) : (
                      <Stack spacing={0.25}>
                        <Typography variant="caption" fontWeight={700}
                          sx={{
                            fontSize: '0.78rem',
                            color: Number(list.ajuste_pct) < 0 ? '#1d4ed8'
                              : Number(list.ajuste_pct) > 0 ? '#15803d'
                                : 'text.secondary',
                          }}>
                          {fmtMoney(ejemplo)}
                        </Typography>
                        {Number(list.ajuste_pct) !== 0 && (
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                            {Number(list.ajuste_pct) > 0 ? '+' : ''}{list.ajuste_pct}% sobre base
                          </Typography>
                        )}
                        {(conteos.byList[list.id] || 0) > 0 && (
                          <Chip
                            label={`🚫 ${conteos.byList[list.id]} excluido${conteos.byList[list.id] !== 1 ? 's' : ''}`}
                            size="small"
                            onClick={() => setManageState({ scopeLabel: list.name })}
                            sx={{
                              height: 18, fontSize: '0.65rem', cursor: 'pointer',
                              bgcolor: '#fef3c7', color: '#92400e',
                              alignSelf: 'flex-start',
                              '&:hover': { bgcolor: '#fde68a' },
                            }}
                          />
                        )}
                      </Stack>
                    )}
                  </Box>

                  {/* Eliminar */}
                  {isFav ? (
                    <Box />
                  ) : (
                    <Tooltip title="Eliminar lista">
                      <IconButton size="small" disabled={isSaving}
                        onClick={() => handleDelete(list)}
                        sx={{ color: '#ef4444', p: 0.5 }}>
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              );
            })}

            {/* Botón agregar */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={creating ? <CircularProgress size={14} /> : <AddIcon />}
                onClick={handleCreate}
                disabled={creating}
                sx={{
                  fontWeight: 600, fontSize: '0.82rem',
                  borderStyle: 'dashed',
                  borderColor: PRIMARY,
                  color: PRIMARY,
                  '&:hover': { borderColor: PRIMARY, bgcolor: `${PRIMARY}10` },
                }}>
                Agregar lista
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" size="small"
          sx={{ bgcolor: PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}>
          Cerrar
        </Button>
      </DialogActions>
      {manageState && (
        <ExcluirListasModal
          open={!!manageState}
          onClose={() => { setManageState(null); reload(); }}
          bizId={bizId}
          lists={lists}
          byList={byList}
          mode="manage"
          scopeLabel={manageState.scopeLabel}
          articleNameById={articleNameById}
        />
      )}
    </Dialog>
  );
}