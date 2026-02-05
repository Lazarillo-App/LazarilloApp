/**
 * AssignGroupToDivisionModal
 * Modal para asignar una agrupación a una división + crear división inline
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  TextField,
} from '@mui/material';
import { Store as StoreIcon, ViewModule as ViewModuleIcon } from '@mui/icons-material';
import { useDivisions } from '@/hooks/useDivisions';

export default function AssignGroupToDivisionModal({
  open,
  group,
  businessId,
  currentDivisionId,
  onClose,
  onAssign,
}) {
  const [selectedDivisionId, setSelectedDivisionId] = useState('principal');
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(null);

  // crear división inline
  const [newDivName, setNewDivName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  const { divisions, loading, loadDivisions, createDivision } = useDivisions(businessId);

  // ✅ evitar “Principal” duplicado si backend devuelve una división is_main
  const divisionsNoMain = useMemo(() => {
    const arr = Array.isArray(divisions) ? divisions : [];
    return arr.filter((d) => !d?.is_main);
  }, [divisions]);

  useEffect(() => {
    if (!open) return;

    const init = currentDivisionId == null ? 'principal' : String(currentDivisionId);
    setSelectedDivisionId(init);

    setAssigning(false);
    setError(null);

    setNewDivName('');
    setCreating(false);
    setCreateErr('');
  }, [open, group?.id, currentDivisionId]);

  const isAlreadyInTarget =
    (selectedDivisionId === 'principal' && currentDivisionId == null) ||
    (selectedDivisionId !== '' && String(selectedDivisionId) === String(currentDivisionId));

  const handleAssign = async () => {
    if (!group?.id) {
      setError('Grupo inválido');
      return;
    }
    if (isAlreadyInTarget) return;

    setAssigning(true);
    setError(null);

    try {
      // onAssign mapeará "principal" -> null afuera
      await onAssign(selectedDivisionId);
      onClose();
    } catch (err) {
      setError(err?.message || 'Error al asignar grupo');
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateDivision = async () => {
    const name = String(newDivName || '').trim();
    if (!name) {
      setCreateErr('Poné un nombre');
      return;
    }

    setCreateErr('');
    setCreating(true);

    try {
      const div = await createDivision({
        businessId,
        name,
        description: null,
        isMain: false,
      });

      await loadDivisions();

      if (div?.id != null) setSelectedDivisionId(String(div.id));
      setNewDivName('');
    } catch (e) {
      const msg = String(e?.message || '');
      setCreateErr(
        msg.includes('division_already_exists')
          ? 'Ya existe una división con ese nombre'
          : msg || 'Error creando división'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (assigning || creating) return;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Asignar agrupación a división</DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3, mt: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Agrupación:
          </Typography>
          <Chip
            label={group?.name || group?.nombre || 'Sin nombre'}
            color="primary"
            sx={{ fontWeight: 600 }}
          />
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <FormControl fullWidth disabled={loading || assigning || creating}>
          <InputLabel>División destino</InputLabel>
          <Select
            value={selectedDivisionId}
            onChange={(e) => setSelectedDivisionId(e.target.value)}
            label="División destino"
          >
            {/* ✅ Principal (una sola vez) */}
            <MenuItem value="principal">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                <StoreIcon fontSize="small" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">Principal</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sin asignar (visible en Principal)
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
            {divisionsNoMain.map((div) => (
              <MenuItem key={div.id} value={String(div.id)}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <ViewModuleIcon fontSize="small" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">
                      {div.config?.icon || '📂'} {div.name}
                    </Typography>
                    {div.description && (
                      <Typography variant="caption" color="text.secondary">
                        {div.description}
                      </Typography>
                    )}
                  </Box>
                  {Number(div.assigned_groups_count) > 0 && (
                    <Chip label={`${div.assigned_groups_count} grupos`} size="small" variant="outlined" />
                  )}
                </Box>
              </MenuItem>
            ))}

            {loading && (
              <MenuItem disabled>
                <CircularProgress size={20} sx={{ mr: 2 }} />
                Cargando divisiones...
              </MenuItem>
            )}

            {!loading && divisionsNoMain.length === 0 && (
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">
                  No hay divisiones creadas
                </Typography>
              </MenuItem>
            )}
          </Select>
        </FormControl>

        {/* ✅ Crear división inline */}
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, border: '1px dashed rgba(0,0,0,0.15)' }}>
          <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>
            Crear nueva división
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              size="small"
              fullWidth
              label="Nombre"
              value={newDivName}
              onChange={(e) => setNewDivName(e.target.value)}
              disabled={assigning || creating}
              error={!!createErr}
              helperText={createErr || 'Ej: Cafetería, Delivery, Barra'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateDivision();
                }
              }}
            />
            <Button
              variant="outlined"
              onClick={handleCreateDivision}
              disabled={assigning || creating || !String(newDivName || '').trim()}
              sx={{ height: 40, whiteSpace: 'nowrap' }}
            >
              {creating ? <CircularProgress size={18} /> : '+ Crear'}
            </Button>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={assigning || creating}>
          Cancelar
        </Button>
        <Button
          onClick={handleAssign}
          variant="contained"
          disabled={loading || assigning || creating || isAlreadyInTarget}
          startIcon={assigning ? <CircularProgress size={16} /> : null}
        >
          {isAlreadyInTarget ? 'Ya está ahí' : assigning ? 'Asignando...' : 'Asignar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
