/* eslint-disable no-empty */
// src/componentes/configuracion/DeleteRecetasModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Stack, Radio, RadioGroup, FormControlLabel,
  FormControl, Select, MenuItem, Alert, CircularProgress, Box,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { RecetasAPI } from '../../servicios/apiBusinesses';
import { obtenerAgrupaciones } from '../../servicios/apiAgrupaciones';
import { insumoGroupsList } from '../../servicios/apiInsumos';

/**
 * Modal de borrado masivo de recetas.
 * tipo: 'articulo' | 'elaborado'
 */
export default function DeleteRecetasModal({ open, onClose, businessId, tipo, themeColor }) {
  const tc = themeColor || 'var(--color-primary, #3b82f6)';
  const isArticulo = tipo === 'articulo';
  const labelTipo = isArticulo ? 'artículos' : 'insumos elaborados';

  const [filtroScope, setFiltroScope] = useState('all');
  const [agrupacionId, setAgrupacionId] = useState('');
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [step, setStep] = useState(1); // 1=elegir filtro, 2=confirmar
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setFiltroScope('all');
    setAgrupacionId('');
    setStep(1);
    setError('');
    setDone(false);
    setPreviewCount(null);
  }, [open]);

  // Cargar agrupaciones al abrir
  useEffect(() => {
    if (!open || !businessId) return;
    setLoadingGroups(true);
    const fetcher = isArticulo
      ? obtenerAgrupaciones(businessId).then(r => Array.isArray(r?.list) ? r.list : (Array.isArray(r) ? r : []))
      : insumoGroupsList(businessId).then(r => Array.isArray(r?.data) ? r.data : []);
    fetcher
      .then(list => {
        // Filtrar especiales: Sin Agrupación, Discontinuados (no aportan al borrado masivo)
        const filtered = (list || []).filter(g => {
          const n = String(g?.nombre || '').toLowerCase().trim();
          return n !== 'sin agrupacion' && n !== 'sin agrupación'
              && n !== 'discontinuados' && n !== 'descontinuados'
              && n !== 'todo';
        });
        setAgrupaciones(filtered);
      })
      .catch(() => setAgrupaciones([]))
      .finally(() => setLoadingGroups(false));
  }, [open, businessId, isArticulo]);

  // Recalcular preview cuando cambian los filtros
  useEffect(() => {
    if (!open || !businessId) { setPreviewCount(null); return; }
    if (filtroScope === 'agrupacion' && !agrupacionId) { setPreviewCount(null); return; }

    setPreviewLoading(true);
    RecetasAPI.previewBulkDelete(businessId, {
      tipo,
      filtroScope,
      agrupacionId: filtroScope === 'agrupacion' ? Number(agrupacionId) : null,
    })
      .then(r => setPreviewCount(Number(r?.count) || 0))
      .catch(() => setPreviewCount(null))
      .finally(() => setPreviewLoading(false));
  }, [open, businessId, tipo, filtroScope, agrupacionId]);

  const handleConfirm = useCallback(async () => {
    setDeleting(true);
    setError('');
    try {
      const r = await RecetasAPI.bulkDelete(businessId, {
        tipo,
        filtroScope,
        agrupacionId: filtroScope === 'agrupacion' ? Number(agrupacionId) : null,
      });
      setDone(true);

      // Notificar a otros componentes para que refresquen costos
      try {
        window.dispatchEvent(new CustomEvent('recetas:bulk-deleted', {
          detail: { tipo, deleted: r?.deleted || 0 },
        }));
      } catch { }

      // Auto-cerrar luego de mostrar resultado
      setTimeout(() => onClose?.(r?.deleted || 0), 1500);
    } catch (e) {
      setError(e?.message || 'Error al borrar las recetas');
    } finally {
      setDeleting(false);
    }
  }, [businessId, tipo, filtroScope, agrupacionId, onClose]);

  const agrupacionNombre = agrupacionId
    ? agrupaciones.find(g => Number(g.id) === Number(agrupacionId))?.nombre
    : '';

  const canPreview = filtroScope === 'all' || (filtroScope === 'agrupacion' && !!agrupacionId);
  const canDelete = canPreview && previewCount > 0 && !previewLoading;

  return (
    <Dialog open={open} onClose={deleting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
        <DeleteForeverIcon sx={{ color: 'error.main' }} />
        {step === 1 ? `Borrar recetas de ${labelTipo}` : 'Confirmar borrado'}
      </DialogTitle>

      <DialogContent>
        {done ? (
          <Alert severity="success">
            Recetas borradas correctamente.
          </Alert>
        ) : step === 1 ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Elegí qué recetas de {labelTipo} querés borrar. La acción no se puede deshacer.
            </Typography>

            <FormControl>
              <RadioGroup
                value={filtroScope}
                onChange={(e) => { setFiltroScope(e.target.value); setAgrupacionId(''); }}
              >
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" sx={{ '&.Mui-checked': { color: tc } }} />}
                  label={<Typography variant="body2">Todas las recetas de {labelTipo} del negocio activo</Typography>}
                />
                <FormControlLabel
                  value="agrupacion"
                  control={<Radio size="small" sx={{ '&.Mui-checked': { color: tc } }} />}
                  label={<Typography variant="body2">Solo las de una agrupación específica</Typography>}
                />
              </RadioGroup>
            </FormControl>

            {filtroScope === 'agrupacion' && (
              <FormControl size="small" fullWidth>
                <Select
                  value={agrupacionId}
                  onChange={(e) => setAgrupacionId(e.target.value)}
                  displayEmpty
                  disabled={loadingGroups}
                >
                  <MenuItem value="" disabled>
                    {loadingGroups ? 'Cargando agrupaciones…' : 'Elegí una agrupación…'}
                  </MenuItem>
                  {agrupaciones.map(g => (
                    <MenuItem key={g.id} value={g.id}>{g.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {canPreview && (
              <Box sx={{
                p: 1.5, borderRadius: 1.5,
                bgcolor: previewCount > 0 ? '#fef3c7' : '#f1f5f9',
                border: '1px solid', borderColor: previewCount > 0 ? '#fde68a' : '#e2e8f0',
                display: 'flex', alignItems: 'center', gap: 1,
              }}>
                {previewLoading ? (
                  <>
                    <CircularProgress size={14} />
                    <Typography variant="body2">Contando…</Typography>
                  </>
                ) : previewCount === null ? (
                  <Typography variant="body2" color="text.secondary">No se pudo contar.</Typography>
                ) : previewCount === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No hay recetas para borrar con ese filtro.
                  </Typography>
                ) : (
                  <>
                    <WarningAmberIcon sx={{ color: '#d97706', fontSize: 18 }} />
                    <Typography variant="body2" fontWeight={600}>
                      Se borrarán <strong>{previewCount}</strong> receta{previewCount !== 1 ? 's' : ''}.
                    </Typography>
                  </>
                )}
              </Box>
            )}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="error" icon={<WarningAmberIcon />}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                Acción irreversible
              </Typography>
              <Typography variant="body2">
                Se borrarán <strong>{previewCount}</strong> receta{previewCount !== 1 ? 's' : ''} de {labelTipo}
                {filtroScope === 'agrupacion' && agrupacionNombre ? ` en la agrupación "${agrupacionNombre}"` : ' del negocio activo'}.
                Los costos calculados dejarán de mostrarse y deberás cargar las recetas de nuevo si las necesitás.
              </Typography>
            </Alert>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        {done ? (
          <Button size="small" onClick={() => onClose?.(0)} sx={{ color: tc }}>Cerrar</Button>
        ) : step === 1 ? (
          <>
            <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
            <Button
              size="small" variant="contained" color="error"
              onClick={() => setStep(2)}
              disabled={!canDelete}
              startIcon={<DeleteForeverIcon />}
            >
              Continuar
            </Button>
          </>
        ) : (
          <>
            <Button size="small" color="inherit" onClick={() => setStep(1)} disabled={deleting}>
              Volver
            </Button>
            <Button
              size="small" variant="contained" color="error"
              onClick={handleConfirm}
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverIcon />}
            >
              {deleting ? 'Borrando…' : `Sí, borrar ${previewCount} receta${previewCount !== 1 ? 's' : ''}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}