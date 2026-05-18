// src/componentes/configuracion/LotesPanel.jsx
// Panel de lotes de importación de ventas o compras
import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack, Box, Typography, Button, Chip, Table, TableHead, TableBody,
  TableRow, TableCell, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import VisibilityIcon    from '@mui/icons-material/Visibility';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { BASE } from '@/servicios/apiBase';

function authHeaders(bizId) {
  const token = localStorage.getItem('token') || '';
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (bizId) h['X-Business-Id'] = String(bizId);
  return h;
}

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return String(v).slice(0, 10); }
}

function LotePreviewModal({ open, onClose, lote, businessId, previewEndpoint }) {
  const [loading, setLoading]     = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError]         = useState('');
  const themeColor = 'var(--color-primary, #3b82f6)';

  useEffect(() => {
    if (!open || !lote) return;
    setLoading(true); setError(''); setPreviewData(null);
    fetch(previewEndpoint || `${BASE}/purchases/batches/${lote.batch_id}/preview`, {
      headers: authHeaders(businessId),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.columns && data?.rows) setPreviewData(data);
        else setError('No se pudo obtener la vista previa del lote.');
      })
      .catch(() => setError('Error al cargar la vista previa.'))
      .finally(() => setLoading(false));
  }, [open, lote, businessId, previewEndpoint]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '80vh' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <VisibilityIcon sx={{ color: themeColor }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>Vista previa — lote {lote?.batch_id}</Typography>
            {lote?.original_name && (
              <Typography variant="caption" color="text.secondary">{lote.original_name}</Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {loading && <Stack alignItems="center" py={4}><CircularProgress /></Stack>}
        {error   && <Alert severity="error">{error}</Alert>}
        {previewData && (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {previewData.columns.map(col => (
                    <TableCell key={col} sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: `${themeColor}08` }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.rows.map((row, i) => (
                  <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    {previewData.columns.map(col => (
                      <TableCell key={col} sx={{ fontSize: '0.75rem' }}>
                        {String(row[col] ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function LotesPanel({ businessId, lotesTipo = 'compras', allBusinesses }) {
  const themeColor = 'var(--color-primary, #3b82f6)';
  const endpoint   = lotesTipo === 'ventas'
    ? `${BASE}/sales/batches`
    : `${BASE}/purchases/batches`;

  const [lotes,          setLotes]          = useState([]);
  const [lotesLoading,   setLotesLoading]   = useState(false);
  const [dlgDeleteOpen,  setDlgDeleteOpen]  = useState(false);
  const [dlgMoveOpen,    setDlgMoveOpen]    = useState(false);
  const [dlgPreviewOpen, setDlgPreviewOpen] = useState(false);
  const [selectedLote,   setSelectedLote]   = useState(null);
  const [moveTargetBiz,  setMoveTargetBiz]  = useState('');
  const [actionLoading,  setActionLoading]  = useState(false);
  const [notify,         setNotify]         = useState(null);

  const showNotify = (msg, sev = 'success') => {
    setNotify({ msg, sev });
    setTimeout(() => setNotify(null), 3000);
  };

  const loadLotes = useCallback(async () => {
    if (!businessId) return;
    setLotesLoading(true);
    try {
      const res  = await fetch(endpoint, { headers: authHeaders(businessId) });
      const data = await res.json().catch(() => ({}));
      setLotes(Array.isArray(data?.data) ? data.data : []);
    } catch { setLotes([]); }
    finally { setLotesLoading(false); }
  }, [businessId, endpoint]);

  useEffect(() => { loadLotes(); }, [loadLotes]);

  const handleDeleteLote = async () => {
    if (!selectedLote) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${endpoint}/${selectedLote.batch_id}`, {
        method: 'DELETE', headers: authHeaders(businessId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showNotify(`Lote ${selectedLote.batch_id} eliminado`);
      setDlgDeleteOpen(false); setSelectedLote(null);
      await loadLotes();
      window.dispatchEvent(new CustomEvent('purchases:batch:changed', {
        detail: { businessId, action: 'deleted', batchId: selectedLote.batch_id },
      }));
    } catch (e) { showNotify('Error al eliminar: ' + e.message, 'error'); }
    finally { setActionLoading(false); }
  };

  const handleMoveLote = async () => {
    if (!selectedLote || !moveTargetBiz) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${endpoint}/${selectedLote.batch_id}/move`, {
        method: 'POST', headers: authHeaders(businessId),
        body: JSON.stringify({ targetBusinessId: Number(moveTargetBiz) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showNotify(`Lote movido al negocio #${moveTargetBiz}`);
      setDlgMoveOpen(false); setSelectedLote(null); setMoveTargetBiz('');
      await loadLotes();
    } catch (e) { showNotify('Error al mover: ' + e.message, 'error'); }
    finally { setActionLoading(false); }
  };

  return (
    <>
      <Stack spacing={1.5}>
        {/* <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" fontWeight={700} color="text.secondary">Lotes importados</Typography>
            {lotes.length > 0 && (
              <Chip size="small" label={lotes.length}
                sx={{ bgcolor: `${themeColor}15`, color: themeColor, fontWeight: 700, height: 18, fontSize: '0.65rem' }} />
            )}
          </Stack>
          <Button size="small" variant="text" onClick={loadLotes} disabled={lotesLoading}
            sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {lotesLoading ? <CircularProgress size={12} /> : 'Actualizar'}
          </Button>
        </Stack> */}

        {notify && <Alert severity={notify.sev} sx={{ py: 0.5, fontSize: '0.78rem' }}>{notify.msg}</Alert>}

        {lotesLoading ? (
          <Stack alignItems="center" py={2}><CircularProgress size={20} /></Stack>
        ) : lotes.length === 0 ? (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            No hay lotes de importación registrados.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: `${themeColor}0c` }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', minWidth: 140 }}>ID / Archivo</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', minWidth: 120, whiteSpace: 'nowrap' }}>Importado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem' }}>Registros</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', minWidth: 100 }}>Sucursal</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.72rem' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lotes.map(lote => (
                  <TableRow key={lote.batch_id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ fontSize: '0.78rem' }}>
                      {lotesTipo === 'ventas' ? (
                        <Stack>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160, fontSize: '0.78rem' }}>
                            {lote.original_name || lote.batch_id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
                            #{lote.batch_id}
                          </Typography>
                        </Stack>
                      ) : (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{lote.batch_id}</span>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                      {fmtDate(lote.created_at || lote.fecha)}
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={lote.total_items ?? lote.count ?? '—'}
                        sx={{ bgcolor: `${themeColor}15`, color: themeColor, fontSize: '0.7rem', height: 18 }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>
                      {lote.branch_name
                        ? <Chip size="small" label={lote.branch_name} sx={{ fontSize: '0.7rem', height: 18, bgcolor: `${themeColor}15`, color: themeColor }} />
                        : <Typography variant="caption" color="text.disabled">Principal</Typography>
                      }
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.25} justifyContent="center">
                        <Tooltip title="Vista previa">
                          <IconButton size="small" sx={{ color: '#6366f1' }}
                            onClick={() => { setSelectedLote(lote); setDlgPreviewOpen(true); }}>
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mover a otro negocio">
                          <IconButton size="small" sx={{ color: themeColor }}
                            onClick={() => { setSelectedLote(lote); setDlgMoveOpen(true); }}>
                            <DriveFileMoveIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar lote">
                          <IconButton size="small" sx={{ color: '#ef4444' }}
                            onClick={() => { setSelectedLote(lote); setDlgDeleteOpen(true); }}>
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
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

      <LotePreviewModal
        open={dlgPreviewOpen}
        onClose={() => { setDlgPreviewOpen(false); setSelectedLote(null); }}
        lote={selectedLote}
        businessId={businessId}
        previewEndpoint={selectedLote ? `${endpoint}/${selectedLote.batch_id}/preview` : undefined}
      />

      <Dialog open={dlgDeleteOpen} onClose={() => setDlgDeleteOpen(false)}>
        <DialogTitle>Eliminar lote de {lotesTipo}</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar el lote <strong>{selectedLote?.batch_id}</strong>?
            Esto elimina <strong>todos los registros</strong> de esa importación.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgDeleteOpen(false)} disabled={actionLoading}>Cancelar</Button>
          <Button onClick={handleDeleteLote} variant="contained" color="error" disabled={actionLoading}>
            {actionLoading ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dlgMoveOpen} onClose={() => setDlgMoveOpen(false)}>
        <DialogTitle>Mover lote a otro negocio</DialogTitle>
        <DialogContent>
          <Typography mb={2}>Mover el lote <strong>{selectedLote?.batch_id}</strong> a:</Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Negocio destino</InputLabel>
            <Select value={moveTargetBiz} label="Negocio destino"
              onChange={e => setMoveTargetBiz(e.target.value)}>
              {(allBusinesses || [])
                .filter(b => String(b.id) !== String(businessId))
                .map(b => (
                  <MenuItem key={b.id} value={String(b.id)}>{b.nombre || b.name || `Negocio #${b.id}`}</MenuItem>
                ))
              }
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgMoveOpen(false)} disabled={actionLoading}>Cancelar</Button>
          <Button onClick={handleMoveLote} variant="contained" disabled={!moveTargetBiz || actionLoading}
            sx={{ bgcolor: 'var(--color-primary)', '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary)' } }}>
            {actionLoading ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}