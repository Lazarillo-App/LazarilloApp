// src/componentes/configuracion/LotesPanelArticulos.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Stack, Box, Typography, Chip, Table, TableHead, TableBody,
  TableRow, TableCell, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, IconButton, Tooltip, Paper,
} from '@mui/material';
import VisibilityIcon    from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReceiptLongIcon   from '@mui/icons-material/ReceiptLong';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import { BASE } from '@/servicios/apiBase';
import { SectionCard } from './configHelpers';

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return String(v).slice(0, 10); }
}

// "csv" o "manual,csv" → chips legibles
function OrigenChips({ origenes }) {
  const tc = 'var(--color-primary, #3b82f6)';
  const raw = String(origenes || '');
  const tipos = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))];

  const label = (t) => {
    if (t === 'manual') return { text: 'Manual (1 artículo)', bg: '#ede9fe', color: '#5b21b6' };
    if (t === 'csv')    return { text: 'Lote (CSV/Excel)',    bg: '#dbeafe', color: '#1e40af' };
    if (t === 'maxi')   return { text: 'Maxi',                bg: `${tc}15`, color: tc };
    return { text: t, bg: '#f1f5f9', color: '#475569' };
  };

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap">
      {tipos.map(t => {
        const { text, bg, color } = label(t);
        return (
          <Chip key={t} size="small" label={text}
            sx={{ height: 18, fontSize: '0.65rem', bgcolor: bg, color, fontWeight: 600 }} />
        );
      })}
    </Stack>
  );
}

export default function LotesPanelArticulos({ businessId }) {
  const themeColor = 'var(--color-primary, #3b82f6)';

  const [lotes,          setLotes]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [previewLote,    setPreviewLote]    = useState(null);
  const [previewData,    setPreviewData]    = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deletingId,     setDeletingId]     = useState(null);
  const [confirmDlg,     setConfirmDlg]     = useState(null); // { lote }
  const [notify,         setNotify]         = useState(null);

  const showNotify = (msg, sev = 'success') => {
    setNotify({ msg, sev });
    setTimeout(() => setNotify(null), 3500);
  };

  const authH = useCallback(() => {
    const token = localStorage.getItem('token') || '';
    return { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) };
  }, [businessId]);

  const loadLotes = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/businesses/${businessId}/articles/batches`, { headers: authH() });
      const data = await res.json().catch(() => ({}));
      setLotes(Array.isArray(data?.data) ? data.data : []);
    } catch { setLotes([]); }
    finally { setLoading(false); }
  }, [businessId, authH]);

  useEffect(() => { loadLotes(); }, [loadLotes]);

  // Escuchar evento de artículo creado/importado → recargar
  useEffect(() => {
    const reload = () => loadLotes();
    window.addEventListener('articulos:updated', reload);
    window.addEventListener('articulos:batch:changed', reload);
    return () => {
      window.removeEventListener('articulos:updated', reload);
      window.removeEventListener('articulos:batch:changed', reload);
    };
  }, [loadLotes]);

  const handlePreview = async (lote) => {
    setPreviewLote(lote);
    setPreviewLoading(true);
    setPreviewData([]);
    try {
      const res  = await fetch(
        `${BASE}/businesses/${businessId}/articles/batches/${lote.batch_id}/preview`,
        { headers: authH() }
      );
      const data = await res.json().catch(() => ({}));
      setPreviewData(Array.isArray(data?.data) ? data.data : []);
    } catch { setPreviewData([]); }
    finally { setPreviewLoading(false); }
  };

  const handleDelete = (lote) => {
    setConfirmDlg({ lote });
  };

  const doDelete = async (lote) => {
    setConfirmDlg(null);
    setDeletingId(lote.batch_id);
    try {
      const res  = await fetch(
        `${BASE}/businesses/${businessId}/articles/batches/${lote.batch_id}`,
        { method: 'DELETE', headers: authH() }
      );
      const data = await res.json().catch(() => ({}));
      showNotify(`${data.deleted ?? 0} artículo(s) eliminado(s)`);
      await loadLotes();
      window.dispatchEvent(new CustomEvent('articulos:batch:changed', {
        detail: { businessId, action: 'deleted', batchId: lote.batch_id },
      }));
    } catch (e) { showNotify('Error al eliminar: ' + e.message, 'error'); }
    finally { setDeletingId(null); }
  };

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}>
        <SectionCard
          icon={<ReceiptLongIcon />}
          title="Artículos cargados manualmente"
          subtitle="Historial de altas manuales y lotes importados por CSV/Excel"
        >
          <Stack spacing={1.5}>
            {notify && (
              <Alert severity={notify.sev} sx={{ py: 0.5, fontSize: '0.78rem' }}>
                {notify.msg}
              </Alert>
            )}

            {loading ? (
              <Stack alignItems="center" py={3}><CircularProgress size={20} /></Stack>
            ) : lotes.length === 0 ? (
              <Box sx={{ border: '2px dashed #e2e8f0', borderRadius: 1.5, p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.disabled">
                  No hay artículos cargados manualmente todavía.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: `${themeColor}0c` }}>
                      {['ID Lote', 'Fecha', 'Total', 'Tipo de carga', ''].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lotes.map(lote => (
                      <TableRow key={lote.batch_id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                          {lote.batch_id}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {fmtDate(lote.created_at)}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={lote.total_items}
                            sx={{ height: 18, fontSize: '0.68rem', bgcolor: `${themeColor}15`, color: themeColor }} />
                        </TableCell>
                        <TableCell>
                          <OrigenChips origenes={lote.origenes} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                            <Tooltip title="Ver artículos del lote">
                              <IconButton size="small" onClick={() => handlePreview(lote)} sx={{ color: '#6366f1' }}>
                                <VisibilityIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar lote">
                              <IconButton size="small"
                                onClick={() => handleDelete(lote)}
                                disabled={deletingId === lote.batch_id}
                                sx={{ color: '#ef4444' }}>
                                {deletingId === lote.batch_id
                                  ? <CircularProgress size={14} />
                                  : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Stack>
        </SectionCard>
      </Grid>

      {/* Confirm delete modal */}
      <Dialog open={!!confirmDlg} onClose={() => setConfirmDlg(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: '#ef4444', fontSize: 22 }} />
          Eliminar lote de artículos
        </DialogTitle>
        <DialogContent>
          {confirmDlg && (() => {
            const tipo = String(confirmDlg.lote.origenes || '');
            const esSolo = tipo.includes('manual') && !tipo.includes('csv');
            return (
              <>
                <Typography variant="body2" color="text.secondary">
                  {esSolo
                    ? <>¿Eliminar el artículo del lote <strong>{confirmDlg.lote.batch_id}</strong>?</>
                    : <>¿Eliminar el lote <strong>{confirmDlg.lote.batch_id}</strong>? Se borrarán los <strong>{confirmDlg.lote.total_items}</strong> artículos importados.</>
                  }
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  Esta acción no se puede deshacer.
                </Typography>
              </>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setConfirmDlg(null)}>Cancelar</Button>
          <Button size="small" variant="contained" color="error"
            onClick={() => doDelete(confirmDlg.lote)}
            disabled={!!deletingId}
            sx={{ fontWeight: 700 }}>
            {deletingId ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview modal */}
      <Dialog
        open={!!previewLote}
        onClose={() => { setPreviewLote(null); setPreviewData([]); }}
        maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '80vh' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>
          Artículos del lote {previewLote?.batch_id}
          <Typography component="span" variant="caption" color="text.secondary" ml={1}>
            ({previewLote?.total_items} artículos)
          </Typography>
          {previewLote && (
            <Box mt={0.5}>
              <OrigenChips origenes={previewLote.origenes} />
            </Box>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {previewLoading ? (
            <Stack alignItems="center" py={4}><CircularProgress /></Stack>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Nombre', 'Categoría', 'Subrubro', 'Precio', 'Origen'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>
                      Sin datos
                    </TableCell>
                  </TableRow>
                ) : previewData.map(art => (
                  <TableRow key={art.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{art.nombre || '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{art.categoria || '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{art.subrubro || '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>
                      {art.precio != null ? `$${Number(art.precio).toLocaleString('es-AR')}` : '—'}
                    </TableCell>
                    <TableCell>
                      <OrigenChips origenes={art.origen} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => { setPreviewLote(null); setPreviewData([]); }}>
            Cerrar
          </Button>
          <Button size="small" variant="outlined" color="error"
            onClick={() => { setPreviewLote(null); setPreviewData([]); handleDelete(previewLote); }}
            disabled={!!deletingId}>
            Eliminar este lote
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}