// src/componentes/InsumoListToolbar.jsx
// Replica el flujo de SelectionToolbar para insumos:
// 1. Click "Seleccionar" → modo 'list' activo → checkboxes en tabla
// 2. Seleccionás insumos → aparece "Guardar lista"
// 3. Ingresás nombre → se crea la lista con los IDs seleccionados

import React, { useState, useRef } from 'react';
import {
  Box, Button, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Typography, Chip, IconButton, CircularProgress,
} from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import PlaylistAddIcon          from '@mui/icons-material/PlaylistAdd';
import CloseIcon                from '@mui/icons-material/Close';
import CheckIcon                from '@mui/icons-material/Check';
import ArrowDropDownIcon        from '@mui/icons-material/ArrowDropDown';
import SaveIcon                 from '@mui/icons-material/Save';

export default function InsumoListToolbar({
  selectionMode = null,
  selectedIds   = new Set(),
  onToggleMode,
  onClearSelection,
  saving = false,
  existingLists = [],
  onCreateList,
  onAddToList,
}) {
  const [modeAnchor,    setModeAnchor]    = useState(null);
  const [actionAnchor,  setActionAnchor]  = useState(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [listNameInput, setListNameInput] = useState('');
  const inputRef = useRef(null);

  const count        = selectedIds.size;
  const hasSelection = count > 0;
  const isActive     = selectionMode !== null;
  const modeColor    = '#0369a1';
  const modeBg       = 'rgba(3,105,161,0.08)';

  const handleSelectMode = (mode) => {
    setModeAnchor(null);
    onToggleMode?.(mode === selectionMode ? null : mode);
  };

  const handleCreateList = async () => {
    const name = listNameInput.trim();
    if (!name) return;
    await onCreateList?.(name, Array.from(selectedIds));
    setListNameInput('');
    setShowNameInput(false);
    setActionAnchor(null);
    onClearSelection?.();
    onToggleMode?.(null);
  };

  const handleAddToList = async (listId) => {
    await onAddToList?.(listId, Array.from(selectedIds));
    setActionAnchor(null);
    onClearSelection?.();
    onToggleMode?.(null);
  };

  // Sin modo activo — solo botón Seleccionar
  if (!isActive) {
    return (
      <>
        <Tooltip title="Seleccionar insumos para crear lista">
          <Button
            onClick={(e) => setModeAnchor(e.currentTarget)}
            endIcon={<ArrowDropDownIcon sx={{ fontSize: '16px !important' }} />}
            sx={{
              textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
              border: '1px solid', borderColor: 'divider', color: 'text.secondary',
              bgcolor: 'background.paper', px: 1.25, height: 36, gap: 0.5, minWidth: 0,
              '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            }}
          >
            <CheckBoxOutlineBlankIcon sx={{ fontSize: 16 }} />
            <span style={{ marginLeft: 4 }}>Seleccionar</span>
          </Button>
        </Tooltip>
        <Menu
          anchorEl={modeAnchor} open={Boolean(modeAnchor)}
          onClose={() => setModeAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          sx={{ '& .MuiPaper-root': { minWidth: 240, mt: 0.5 } }}
        >
          <MenuItem disableRipple sx={{ cursor: 'default', '&:hover': { background: 'transparent' } }}>
            <Typography variant="caption" sx={{
              fontWeight: 800, fontSize: '.7rem', opacity: .6,
              textTransform: 'uppercase', letterSpacing: '.07em', color: 'text.secondary',
            }}>¿Qué querés hacer?</Typography>
          </MenuItem>
          <Divider sx={{ my: 0 }} />
          <MenuItem onClick={() => handleSelectMode('list')} sx={{ py: 1.25 }}>
            <ListItemIcon><PlaylistAddIcon sx={{ color: modeColor }} /></ListItemIcon>
            <ListItemText
              primary={<span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Crear lista</span>}
              secondary="Agrupá insumos para exportar compras"
              secondaryTypographyProps={{ sx: { fontSize: '0.75rem' } }}
            />
          </MenuItem>
        </Menu>
      </>
    );
  }

  // Modo activo
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      bgcolor: modeBg, border: `1px solid ${modeColor}30`,
      borderRadius: 2, px: 1.5, py: 0.5,
    }}>
      <PlaylistAddIcon sx={{ fontSize: 16, color: modeColor }} />
      <Typography variant="caption" sx={{
        fontWeight: 700, fontSize: '0.78rem', color: modeColor,
        textTransform: 'uppercase', letterSpacing: '.04em',
      }}>Lista</Typography>

      {hasSelection && (
        <Chip
          label={`${count} insumo${count !== 1 ? 's' : ''}`}
          size="small"
          sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700, bgcolor: modeColor, color: '#fff', '& .MuiChip-label': { px: 1 } }}
        />
      )}

      {hasSelection && (
        <>
          <Button
            onClick={(e) => setActionAnchor(e.currentTarget)}
            disabled={saving}
            endIcon={saving ? <CircularProgress size={12} sx={{ color: modeColor }} /> : <ArrowDropDownIcon sx={{ fontSize: '14px !important' }} />}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: '0.8rem',
              color: modeColor, border: `1px solid ${modeColor}50`,
              bgcolor: '#fff', px: 1.25, height: 28, minWidth: 0,
              '&:hover': { bgcolor: `${modeColor}08` },
            }}
          >
            Guardar lista
          </Button>
          <Menu
            anchorEl={actionAnchor} open={Boolean(actionAnchor)}
            onClose={() => { setActionAnchor(null); setShowNameInput(false); }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            sx={{ '& .MuiPaper-root': { minWidth: 280, mt: 0.5 } }}
          >
            {!showNameInput ? (
              <MenuItem onClick={() => { setShowNameInput(true); setTimeout(() => inputRef.current?.focus(), 50); }} sx={{ py: 1 }}>
                <ListItemIcon><SaveIcon sx={{ color: modeColor, fontSize: 18 }} /></ListItemIcon>
                <ListItemText primary="Crear lista nueva" primaryTypographyProps={{ sx: { fontWeight: 600, fontSize: '0.85rem' } }} />
              </MenuItem>
            ) : (
              <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  value={listNameInput}
                  onChange={e => setListNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateList(); if (e.key === 'Escape') setShowNameInput(false); }}
                  placeholder="Nombre de la lista..."
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem', border: `1.5px solid ${modeColor}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit' }}
                />
                <IconButton size="small" onClick={handleCreateList} disabled={!listNameInput.trim()}>
                  <CheckIcon sx={{ fontSize: 16, color: modeColor }} />
                </IconButton>
              </Box>
            )}
            {existingLists.length > 0 && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem disableRipple sx={{ cursor: 'default', '&:hover': { background: 'transparent' } }}>
                  <Typography variant="caption" sx={{ fontSize: '.7rem', opacity: .6, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary', fontWeight: 800 }}>
                    Agregar a lista existente
                  </Typography>
                </MenuItem>
                {existingLists.map(list => (
                  <MenuItem key={list.id} onClick={() => handleAddToList(list.id)} sx={{ py: 0.75 }}>
                    <ListItemIcon><PlaylistAddIcon sx={{ fontSize: 16, color: modeColor }} /></ListItemIcon>
                    <ListItemText primary={list.name} primaryTypographyProps={{ sx: { fontSize: '0.85rem' } }} />
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        </>
      )}

      <Tooltip title="Cancelar selección">
        <IconButton size="small" onClick={() => { onClearSelection?.(); onToggleMode?.(null); }} sx={{ ml: 0.5, color: modeColor, opacity: 0.7, '&:hover': { opacity: 1 } }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}