/* eslint-disable no-unused-vars */
/**
 * MoverAgrupacionModal - Asignar una agrupación a una división (subnegocio)
 * Usa: POST /api/businesses/:businessId/agrupaciones/:groupId/assign-division
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Divider,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
} from '@mui/material';

import { useBusiness } from '../context/BusinessContext';
import { httpBiz } from '../servicios/apiBusinesses';
import { downwardMenuProps } from '@/utils/menuProps';

export default function MoverAgrupacionModal({
  open,
  businessId,
  agrupacion,
  onClose,
  onSuccess,
}) {
  const { divisions, divisionsLoading, activeId } = useBusiness() || {};

  const [mode, setMode] = useState('existente'); // 'existente' | 'principal'
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');

  const effectiveBusinessId = businessId || activeId;

  const refreshDivisions = useCallback(() => {
    window.dispatchEvent(new CustomEvent('divisions:updated'));
  }, []);

  useEffect(() => {
    if (!open) return;
    setMode('existente');
    setSelectedDivisionId('');
    setError(null);
    setProgress('');
    refreshDivisions();
  }, [open, refreshDivisions]);

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setProgress('');
    onClose?.();
  };

  const getGroupId = () => {
    const raw =
      agrupacion?.group_id ??
      agrupacion?.groupId ??
      agrupacion?.businessGroupId ??
      agrupacion?.business_group_id ??
      agrupacion?.id;

    const groupId = Number(raw);
    return Number.isFinite(groupId) ? groupId : null;
  };

  const availableDivisions = useMemo(() => {
    return (divisions || []).filter((d) => {
      if (d?.is_main) return false;
      if (String(d?.id) === String(effectiveBusinessId)) return false;
      return true;
    });
  }, [divisions, effectiveBusinessId]);

  const hasDivisions = availableDivisions.length > 0;
  const divLoading = !!divisionsLoading;
  const articulosCount = (agrupacion?.articulos || []).length;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!agrupacion) return setError('No hay agrupación seleccionada');
    if (!effectiveBusinessId) return setError('No hay negocio activo');

    const groupId = getGroupId();
    if (!groupId) return setError('No se pudo obtener el ID del grupo');

    // ✅ destino final: null => principal | number => subnegocio
    const divisionId = mode === 'existente' ? Number(selectedDivisionId) : null;

    if (mode === 'existente') {
      if (!selectedDivisionId) return setError('Debes seleccionar un subnegocio');
      if (!Number.isFinite(divisionId)) return setError('Subnegocio inválido');
    }

    setLoading(true);
    setError(null);
    setProgress(divisionId == null ? 'Devolviendo al negocio principal...' : 'Asignando a subnegocio...');

    try {
      const result = await httpBiz(
        `/agrupaciones/${groupId}/assign-division`,
        {
          method: 'POST',
          body: { divisionId },
        },
        effectiveBusinessId
      );

      // si el backend responde {ok:false,...}
      if (result?.ok === false) {
        throw new Error(result?.error || 'Error al asignar división');
      }

      window.dispatchEvent(new CustomEvent('agrupaciones:updated'));
      window.dispatchEvent(new CustomEvent('business:synced'));

      const divisionName =
        divisionId == null
          ? 'Principal'
          : (
              availableDivisions.find((d) => Number(d.id) === Number(divisionId))?.name ||
              availableDivisions.find((d) => Number(d.id) === Number(divisionId))?.nombre ||
              `Subnegocio #${divisionId}`
            );

      onSuccess?.({
        businessId: effectiveBusinessId,
        agrupacionId: groupId,
        agrupacionNombre: agrupacion?.nombre,
        divisionId,
        divisionName,
        articleCount: articulosCount,
        action: divisionId == null ? 'unassigned' : 'assigned',
      });

      handleClose();
    } catch (err) {
      console.error('[MoverAgrupacionModal] Error:', err);
      setError(err?.message || 'Error al procesar la operación');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  if (!agrupacion) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Mover Agrupación a Subnegocio</DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Agrupación:</strong> {agrupacion.nombre}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              <strong>Artículos:</strong> {articulosCount}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{ mt: 1, color: 'text.secondary' }}
            >
              💡 Esto cambia “a qué subnegocio pertenece” la agrupación (se verá con el filtro de división).
            </Typography>
          </Alert>

          <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
            <FormControlLabel
              value="existente"
              control={<Radio />}
              label="Asignar a subnegocio existente"
              disabled={loading || !hasDivisions}
            />
            <FormControlLabel
              value="principal"
              control={<Radio />}
              label="Volver al negocio principal"
              disabled={loading}
            />
          </RadioGroup>

          <Divider sx={{ my: 2 }} />

          {mode === 'existente' && (
            <FormControl fullWidth disabled={divLoading || loading || !hasDivisions}>
              <InputLabel>Seleccionar subnegocio</InputLabel>
              <Select MenuProps={downwardMenuProps()}
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                label="Seleccionar subnegocio"
                required
              >
                {divLoading && (
                  <MenuItem disabled>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} />
                      Cargando...
                    </Box>
                  </MenuItem>
                )}

                {!divLoading && !hasDivisions && (
                  <MenuItem disabled>No hay subnegocios creados</MenuItem>
                )}

                {availableDivisions.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>📁</span>
                      <span>{d.name || d.nombre || `Subnegocio #${d.id}`}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {loading && progress && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                {progress}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              loading ||
              (mode === 'existente' && (divLoading || !selectedDivisionId || !hasDivisions))
            }
          >
            {loading ? 'Procesando…' : 'Mover'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
