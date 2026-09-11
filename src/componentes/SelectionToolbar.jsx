// src/componentes/SelectionToolbar.jsx
//
// Toolbar que aparece en ArticulosMain junto al buscador/calendario.
// Controla el modo de selección de artículos (lista / vinculación).
// Los checkboxes viven en TablaArticulos y comunican su estado aquí
// via props/callbacks.

/* eslint-disable no-unused-vars */
import React, { useState, useRef, useCallback } from 'react';
import {
  Box, Button, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Typography, Chip, IconButton, CircularProgress,
} from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import LinkIcon from '@mui/icons-material/Link';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

/**
 * SelectionToolbar
 *
 * Props:
 *   selectionMode   null | 'list' | 'link'   — modo activo
 *   selectedIds     Set<number>               — artículos seleccionados
 *   onToggleMode    (mode: null|'list'|'link') => void
 *   onClearSelection () => void
 *   onCreateList    (name: string) => Promise<void>
 *   onCreateLink    () => Promise<void>         — crea vinculación con los IDs seleccionados
 *   saving          boolean                    — spinner mientras guarda
 *   existingLists   Array<{id, name}>          — listas ya creadas (para agregar a una)
 *   onAddToList     (listId: number) => void
 */
export default function SelectionToolbar({
  selectionMode = null,
  selectedIds = new Set(),
  onToggleMode,
  onClearSelection,
  onCreateList,
  onCreateLink,
  saving = false,
  existingLists = [],
  onAddToList,
  editingGroup = null,
  onSaveEditLink,
}) {
  const [actionAnchor, setActionAnchor] = useState(null);
  const [listNameInput, setListNameInput] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const inputRef = useRef(null);

  const count = selectedIds.size;
  const hasSelection = count > 0;
  const isActive = selectionMode !== null;

  // ── Colores por modo ──────────────────────────────────────────────────
  const modeColor = selectionMode === 'link' ? '#7c3aed' : '#0369a1';
  const modeBg = selectionMode === 'link' ? 'rgba(124,58,237,0.08)' : 'rgba(3,105,161,0.08)';

  // Al elegir la acción (una vez ya hay artículos tildados en modo 'picking'):
  // "Vincular artículos" dispara la vinculación directo con lo ya tildado.
  // "Crear lista" pasa a modo 'list', que muestra el campo para nombrarla.
  const handleChooseAction = (mode) => {
    onToggleMode?.(mode);
    if (mode === 'link') onCreateLink?.();
  };

  const handleCreateList = async () => {
    const name = listNameInput.trim();
    if (!name) return;
    await onCreateList?.(name);
    setListNameInput('');
    setShowNameInput(false);
    setActionAnchor(null);
  };

  const handleCreateLink = async () => {
    setActionAnchor(null);
    // En edición: guardar el diff sobre el grupo existente. Si no, crear grupo nuevo.
    if (editingGroup) {
      await onSaveEditLink?.();
    } else {
      await onCreateLink?.();
    }
  };

  // ── Sin modo activo: la selección ahora arranca desde el checkbox del
  //    header de la tabla (estilo Gmail) — este botón/menú ya no existe. ──
  if (!isActive) {
    return null;
  }

  // ── Modo 'picking': tildando artículos, todavía sin elegir qué hacer con
  //    ellos. Recién al tildar al menos uno aparecen las 2 acciones como
  //    botones (no como menú desplegable). ──
  if (selectionMode === 'picking') {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider',
        borderRadius: 2, px: 1.5, py: 0.5,
      }}>
        <CheckBoxOutlineBlankIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        {hasSelection ? (
          <>
            <Chip
              label={`${count} artículo${count !== 1 ? 's' : ''}`}
              size="small"
              sx={{ height: 20, fontSize: '0.72rem', fontWeight: 700, bgcolor: 'text.secondary', color: '#fff', '& .MuiChip-label': { px: 1 } }}
            />
            <Tooltip title="Agrupá artículos para exportar o gestionar">
              <Button
                size="small" onClick={() => handleChooseAction('list')}
                startIcon={<PlaylistAddIcon sx={{ fontSize: '16px !important' }} />}
                sx={{
                  textTransform: 'none', fontWeight: 700, fontSize: '0.8rem',
                  color: '#0369a1', border: '1px solid #0369a150', bgcolor: '#fff', px: 1.25, height: 28, minWidth: 0,
                  '&:hover': { bgcolor: '#0369a108' },
                }}
              >
                Crear lista
              </Button>
            </Tooltip>
            <Tooltip title="Los productos vinculados tendrán el mismo precio">
              <Button
                size="small" onClick={() => handleChooseAction('link')}
                startIcon={<LinkIcon sx={{ fontSize: '16px !important' }} />}
                sx={{
                  textTransform: 'none', fontWeight: 700, fontSize: '0.8rem',
                  color: '#7c3aed', border: '1px solid #7c3aed50', bgcolor: '#fff', px: 1.25, height: 28, minWidth: 0,
                  '&:hover': { bgcolor: '#7c3aed08' },
                }}
              >
                Vincular artículos
              </Button>
            </Tooltip>
          </>
        ) : (
          <Typography variant="caption" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            Tildá artículos para crear una lista o vincularlos
          </Typography>
        )}

        <Tooltip title="Cancelar selección">
          <IconButton
            size="small"
            onClick={() => { onClearSelection?.(); onToggleMode?.(null); }}
            sx={{ ml: 0.5, color: 'text.secondary', opacity: 0.7, '&:hover': { opacity: 1 } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // ── Estado activo: modo selección en curso ────────────────────────────
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      bgcolor: modeBg,
      border: `1px solid ${modeColor}30`,
      borderRadius: 2, px: 1.5, py: 0.5,
      transition: 'all 0.15s ease',
    }}>
      {/* Ícono de modo */}
      {selectionMode === 'link'
        ? <LinkIcon sx={{ fontSize: 16, color: modeColor }} />
        : <PlaylistAddIcon sx={{ fontSize: 16, color: modeColor }} />
      }

      {/* Label de modo */}
      <Typography variant="caption" sx={{
        fontWeight: 700, fontSize: '0.78rem', color: modeColor,
        textTransform: 'uppercase', letterSpacing: '.04em',
      }}>
       {selectionMode === 'link' ? (editingGroup ? 'Editar vínculo' : 'Vincular') : 'Lista'}
      </Typography>

      {/* Contador */}
      {hasSelection && (
        <Chip
          label={`${count} artículo${count !== 1 ? 's' : ''}`}
          size="small"
          sx={{
            height: 20, fontSize: '0.72rem', fontWeight: 700,
            bgcolor: modeColor, color: '#fff',
            '& .MuiChip-label': { px: 1 },
          }}
        />
      )}

      {/* Botón de acción principal */}
      {/* Botón de acción principal */}
      {hasSelection && (
        <>
          <Button
            onClick={(e) => {
              if (selectionMode === 'link') {
                // Vincular: ejecutar directo sin menú
                handleCreateLink();
              } else {
                // Lista: abrir menú con opciones (nueva o existente)
                setActionAnchor(e.currentTarget);
              }
            }}
            disabled={saving}
            endIcon={saving
              ? <CircularProgress size={12} sx={{ color: modeColor }} />
              : selectionMode === 'link'
                ? null
                : <ArrowDropDownIcon sx={{ fontSize: '14px !important' }} />
            }
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: '0.8rem',
              color: modeColor, border: `1px solid ${modeColor}50`,
              bgcolor: '#fff', px: 1.25, height: 28, minWidth: 0,
              '&:hover': { bgcolor: `${modeColor}08` },
            }}
          >
            {selectionMode === 'link' ? (editingGroup ? 'Guardar cambios' : 'Vincular') : 'Guardar lista'}
          </Button>

          {/* Menú de acción */}
          <Menu
            anchorEl={actionAnchor} open={Boolean(actionAnchor)}
            onClose={() => { setActionAnchor(null); setShowNameInput(false); }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            sx={{ '& .MuiPaper-root': { minWidth: 280, mt: 0.5 } }}
          >
            {selectionMode === 'list' && (
              <>
                {/* Crear lista nueva */}
                {!showNameInput ? (
                  <MenuItem onClick={() => {
                    setShowNameInput(true);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }} sx={{ py: 1 }}>
                    <ListItemIcon><SaveIcon sx={{ color: '#0369a1', fontSize: 18 }} /></ListItemIcon>
                    <ListItemText primary="Crear lista nueva" primaryTypographyProps={{ sx: { fontWeight: 600, fontSize: '0.85rem' } }} />
                  </MenuItem>
                ) : (
                  <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                    <input
                      ref={inputRef}
                      value={listNameInput}
                      onChange={e => setListNameInput(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation(); // ← evita que el Menu capture las letras
                        if (e.key === 'Enter') handleCreateList();
                        if (e.key === 'Escape') setShowNameInput(false);
                      }}
                      placeholder="Nombre de la lista..."
                      style={{
                        flex: 1, padding: '6px 10px', fontSize: '0.85rem',
                        border: '1.5px solid #0369a1', borderRadius: 6,
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <IconButton size="small" onClick={handleCreateList} disabled={!listNameInput.trim()}>
                      <CheckIcon sx={{ fontSize: 16, color: '#0369a1' }} />
                    </IconButton>
                  </Box>
                )}

                {/* Agregar a lista existente */}
                {existingLists.length > 0 && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <MenuItem disableRipple sx={{ cursor: 'default', '&:hover': { background: 'transparent' } }}>
                      <Typography variant="caption" sx={{ fontSize: '.7rem', opacity: .6, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary', fontWeight: 800 }}>
                        Agregar a lista existente
                      </Typography>
                    </MenuItem>
                    {existingLists.map(list => (
                      <MenuItem key={list.id} onClick={() => { onAddToList?.(list.id); setActionAnchor(null); }} sx={{ py: 0.75 }}>
                        <ListItemIcon>
                          <PlaylistAddIcon sx={{ fontSize: 16, color: list.color || '#0369a1' }} />
                        </ListItemIcon>
                        <ListItemText primary={list.name} primaryTypographyProps={{ sx: { fontSize: '0.85rem' } }} />
                      </MenuItem>
                    ))}
                  </>
                )}
              </>
            )}

          </Menu>
        </>
      )}

      {/* Cancelar / salir del modo */}
      <Tooltip title="Cancelar selección">
        <IconButton
          size="small"
          onClick={() => { onClearSelection?.(); onToggleMode?.(null); }}
          sx={{ ml: 0.5, color: modeColor, opacity: 0.7, '&:hover': { opacity: 1 } }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}