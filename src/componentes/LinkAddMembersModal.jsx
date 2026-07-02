/* eslint-disable no-unused-vars */
// src/componentes/LinkAddMembersModal.jsx
//
// Modal para agregar artículos a una vinculación existente.
// Muestra todo el catálogo del negocio. Los artículos que ya están en otra
// vinculación del mismo tipo aparecen deshabilitados.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, Checkbox, Tooltip,
  CircularProgress, Chip, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';

export default function LinkAddMembersModal({
  open,
  onClose,
  groupId,
  groupName,
  linkType,                 // 'precio' | 'receta' | 'objetivo'
  currentMemberIds = [],    // miembros actuales del grupo (para excluir de la lista)
  catalogo = [],            // [{ id, nombre, codigo? }]
  linkByArticleId,          // Map<id, Array<{ linkType, groupId, groupName }>>
  onConfirm,                // async (articleIds) => void
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(new Set());
    }
  }, [open]);

  const currentSet = useMemo(
    () => new Set(currentMemberIds.map(Number)),
    [currentMemberIds]
  );

  // Catálogo filtrado por búsqueda, excluyendo a los miembros actuales
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalogo || [])
      .filter(a => !currentSet.has(Number(a.id)))
      .filter(a => {
        if (!q) return true;
        return (a.nombre || '').toLowerCase().includes(q) ||
               String(a.codigo || a.id || '').toLowerCase().includes(q);
      })
      .slice(0, 200); // Cap visual
  }, [catalogo, currentSet, query]);

  const isBlocked = useCallback((articleId) => {
    if (!linkByArticleId) return null;
    const groups = linkByArticleId.get(Number(articleId));
    if (!Array.isArray(groups)) return null;
    const conflict = groups.find(g => g.linkType === linkType && Number(g.groupId) !== Number(groupId));
    return conflict || null;
  }, [linkByArticleId, linkType, groupId]);

  const toggle = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selected.size) return;
    setSaving(true);
    try {
      await onConfirm?.(Array.from(selected));
      onClose?.();
    } finally {
      setSaving(false);
    }
  }, [selected, onConfirm, onClose]);

  const typeLabel = linkType === 'precio' ? 'precio'
    : linkType === 'receta' ? 'receta'
    : linkType === 'objetivo' ? 'objetivo' : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <LinkIcon sx={{ fontSize: 20, color: '#7c3aed' }} />
        Agregar artículos a la vinculación
        <Chip label={typeLabel} size="small" sx={{
          height: 18, fontSize: '0.65rem', fontWeight: 700,
          bgcolor: linkType === 'precio' ? '#dbeafe' : linkType === 'receta' ? '#dcfce7' : '#fef3c7',
          color: linkType === 'precio' ? '#1e40af' : linkType === 'receta' ? '#15803d' : '#92400e',
        }} />
      </DialogTitle>

      <DialogContent sx={{ pt: '8px !important' }}>
        {groupName && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Grupo: <strong>{groupName}</strong>
          </Typography>
        )}

        <TextField
          autoFocus fullWidth size="small"
          placeholder="Buscar artículo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
        />

        {selected.size > 0 && (
          <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
            {selected.size} artículo{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </Typography>
        )}

        <Box sx={{
          maxHeight: 360, overflowY: 'auto',
          border: '1px solid', borderColor: 'divider', borderRadius: 1,
        }}>
          {filtered.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.disabled' }}>
              <Typography variant="body2">
                {query ? 'No se encontraron artículos' : 'Sin artículos disponibles'}
              </Typography>
            </Box>
          ) : filtered.map(a => {
            const id = Number(a.id);
            const conflict = isBlocked(id);
            const isSelected = selected.has(id);
            const row = (
              <Box key={id}
                onClick={() => !conflict && toggle(id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1.5, py: 0.75,
                  cursor: conflict ? 'not-allowed' : 'pointer',
                  bgcolor: isSelected ? 'rgba(124,58,237,0.06)' : 'transparent',
                  opacity: conflict ? 0.5 : 1,
                  borderBottom: '1px solid', borderColor: 'divider',
                  '&:hover': { bgcolor: conflict ? 'transparent' : 'action.hover' },
                  '&:last-child': { borderBottom: 'none' },
                }}>
                <Checkbox size="small" checked={isSelected} disabled={!!conflict}
                  sx={{ p: 0.25 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{
                    fontWeight: isSelected ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.nombre}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    #{a.codigo || id}
                  </Typography>
                </Box>
                {conflict && (
                  <Chip label="ya vinculado" size="small" sx={{
                    height: 16, fontSize: '0.62rem', fontWeight: 600,
                    bgcolor: '#fee2e2', color: '#991b1b',
                  }} />
                )}
              </Box>
            );
            return conflict ? (
              <Tooltip key={id} title={`Ya está en "${conflict.groupName || 'otra vinculación'}" (${typeLabel})`} placement="left">
                <div>{row}</div>
              </Tooltip>
            ) : row;
          })}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={saving || selected.size === 0}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {saving ? 'Agregando…' : `Agregar ${selected.size || ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}