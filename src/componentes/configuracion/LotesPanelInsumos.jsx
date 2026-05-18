// src/componentes/configuracion/LotesPanelInsumos.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Stack, Box, Typography, Button, Chip, Table, TableHead, TableBody,
  TableRow, TableCell, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, IconButton, Tooltip, Paper,
} from '@mui/material';
import CloudUploadIcon   from '@mui/icons-material/CloudUpload';
import VisibilityIcon    from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReceiptLongIcon   from '@mui/icons-material/ReceiptLong';
import InfoOutlinedIcon  from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import { BASE } from '@/servicios/apiBase';
import { SectionCard } from './configHelpers';

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return String(v).slice(0, 10); }
}

export default function LotesPanelInsumos({ businessId }) {//luego agregar onUpload como prop para disparar la subida y refrescar la lista
  const themeColor   = 'var(--color-primary, #3b82f6)';
  const [lotes, setLotes]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [previewLote, setPreviewLote] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notify, setNotify]         = useState(null);

  const showNotify = (msg, sev = 'success') => { setNotify({ msg, sev }); setTimeout(() => setNotify(null), 3000); };
  const [confirmDlg, setConfirmDlg] = useState(null); // { lote }

  const loadLotes = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/insumos/batches`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      });
      const data = await res.json().catch(() => ({}));
      setLotes(Array.isArray(data?.data) ? data.data : []);
    } catch { setLotes([]); }
    finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { loadLotes(); }, [loadLotes]);

  const handlePreview = async (lote) => {
    setPreviewLote(lote); setPreviewLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/insumos/batches/${lote.batch_id}/preview`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      });
      const data = await res.json().catch(() => ({}));
      setPreviewData(Array.isArray(data?.data) ? data.data : []);
    } catch { setPreviewData([]); }
    finally { setPreviewLoading(false); }
  };

  const handleDelete = async (batchId) => {
    setDeletingId(null);
    setConfirmDlg({ batchId });
  };

  const doDelete = async (batchId) => {
    setConfirmDlg(null);
    setDeletingId(batchId);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/insumos/batches/${batchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      });
      const data = await res.json().catch(() => ({}));
      showNotify(`${data.deleted ?? 0} insumos eliminados del lote`);
      await loadLotes();
    } catch (e) { showNotify('Error al eliminar: ' + e.message, 'error'); }
    finally { setDeletingId(null); }
  };

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}>
        <SectionCard icon={<ReceiptLongIcon />} title="Lotes de insumos subidos manualmente" subtitle="Historial de importaciones manuales">
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
             
            </Stack>

            {notify && <Alert severity={notify.sev} sx={{ py: 0.5, fontSize: '0.78rem' }}>{notify.msg}</Alert>}

            {loading ? (
              <Stack alignItems="center" py={3}><CircularProgress size={20} /></Stack>
            ) : lotes.length === 0 ? (
              <Box sx={{ border: '2px dashed #e2e8f0', borderRadius: 1.5, p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.disabled">No hay lotes de insumos subidos manualmente.</Typography>
                {/* <Button size="small" variant="outlined" startIcon={<CloudUploadIcon />}
                  onClick={onUpload} sx={{ mt: 1.5, borderColor: themeColor, color: themeColor }}>
                  Subir primer lote
                </Button> */}
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: `${themeColor}0c` }}>
                    {['ID Lote', 'Fecha', 'Total', 'Sin equiv.', 'Con código', ''].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lotes.map(lote => (
                    <TableRow key={lote.batch_id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{lote.batch_id}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{fmtDate(lote.created_at)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={lote.total_items}
                          sx={{ height: 18, fontSize: '0.68rem', bgcolor: `${themeColor}15`, color: themeColor }} />
                      </TableCell>
                      <TableCell>
                        {lote.sin_equivalencia > 0
                          ? <Chip size="small" label={lote.sin_equivalencia} sx={{ height: 18, fontSize: '0.68rem', bgcolor: '#fef3c7', color: '#92400e' }} />
                          : <Chip size="small" label="✓ todos" sx={{ height: 18, fontSize: '0.68rem', bgcolor: '#dcfce7', color: '#166534' }} />
                        }
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={lote.con_codigo ?? '—'} sx={{ height: 18, fontSize: '0.68rem', bgcolor: '#f1f5f9', color: '#475569' }} />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.25}>
                          <Tooltip title="Ver insumos del lote">
                            <IconButton size="small" onClick={() => handlePreview(lote)} sx={{ color: '#6366f1' }}>
                              <VisibilityIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar insumos sin equivalencia">
                            <IconButton size="small" onClick={() => handleDelete(lote.batch_id)}
                              disabled={deletingId === lote.batch_id} sx={{ color: '#ef4444' }}>
                              {deletingId === lote.batch_id ? <CircularProgress size={14} /> : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Stack>
        </SectionCard>
      </Grid>

      {/* <Grid size={{ xs: 12, md: 5 }}>
        <SectionCard icon={<InfoOutlinedIcon />} title="¿Cómo funciona?">
          <Stack spacing={1.25}>
            {[
              { icon: '1️⃣', text: 'Subís un CSV o XLSX con los insumos' },
              { icon: '2️⃣', text: 'Lazarillo los guarda con SKU provisorio y los marca como "sin equivalencia"' },
              { icon: '3️⃣', text: 'Cuando llega la sync de Maxi, busca coincidencias por nombre y los reconcilia' },
              { icon: '4️⃣', text: 'Los que no lleguen de Maxi quedan activos con la info que subiste' },
              { icon: '⚠️', text: 'Solo se eliminan los insumos sin equivalencia asignada.' },
            ].map(({ icon, text }) => (
              <Stack key={text} direction="row" spacing={1} alignItems="flex-start">
                <Typography sx={{ fontSize: '0.85rem', flexShrink: 0 }}>{icon}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>{text}</Typography>
              </Stack>
            ))}
            <Divider sx={{ my: 0.5 }} />
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.72rem' }}>
              Columnas que reconoce:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {['NOMBRE *', 'CODIGO', 'RUBRO', 'UNIDAD', 'PRECIO', 'ELABORADO'].map(col => (
                <Chip key={col} label={col} size="small" sx={{
                  height: 18, fontSize: '0.65rem',
                  bgcolor: col.includes('*') ? `${themeColor}15` : '#f1f5f9',
                  color: col.includes('*') ? themeColor : '#475569',
                  fontWeight: col.includes('*') ? 700 : 400,
                }} />
              ))}
            </Box>
          </Stack>
        </SectionCard>
      </Grid>
 */}
      {/* Confirm delete modal */}
      <Dialog open={!!confirmDlg} onClose={() => setConfirmDlg(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: '#ef4444', fontSize: 22 }} />
          Eliminar lote de insumos
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            ¿Eliminar el lote <strong>{confirmDlg?.batchId}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Se borrarán los insumos <strong>sin equivalencia</strong> de este lote. Los insumos ya reconciliados con Maxi no se verán afectados.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button size="small" onClick={() => setConfirmDlg(null)}>Cancelar</Button>
          <Button size="small" variant="contained" color="error"
            onClick={() => doDelete(confirmDlg.batchId)}
            sx={{ fontWeight: 700 }}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview modal */}
      <Dialog open={!!previewLote} onClose={() => { setPreviewLote(null); setPreviewData([]); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
          Insumos del lote {previewLote?.batch_id}
          <Typography component="span" variant="caption" color="text.secondary" ml={1}>
            ({previewLote?.total_items} insumos)
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {previewLoading ? (
            <Stack alignItems="center" py={4}><CircularProgress /></Stack>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Nombre', 'Código', 'Rubro', 'Unidad', 'Precio', 'Estado'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.map(ins => (
                  <TableRow key={ins.id}>
                    <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{ins.nombre}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}>{ins.codigo_maxi || '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{ins.rubro || '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{ins.unidad_med || '—'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{ins.precio_ref ? `$${Number(ins.precio_ref).toLocaleString('es-AR')}` : '—'}</TableCell>
                    <TableCell>
                      <Chip size="small"
                        label={ins.sin_equivalencia ? 'Sin equiv.' : 'Reconciliado'}
                        sx={{
                          height: 18, fontSize: '0.65rem',
                          bgcolor: ins.sin_equivalencia ? '#fef3c7' : '#dcfce7',
                          color: ins.sin_equivalencia ? '#92400e' : '#166534',
                        }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button size="small" onClick={() => { setPreviewLote(null); setPreviewData([]); }}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}