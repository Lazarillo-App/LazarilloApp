/* eslint-disable no-unused-vars */
// src/componentes/ArticleListSelector.jsx
// Selector de lista de precios — estética similar a SucursalSelector.
// Aparece al lado del título "Gestión de Artículos".

import React, { useState } from 'react';
import {
  Box, Button, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import SettingsIcon from '@mui/icons-material/Settings';

const DEFAULT_COLORS = ['#2492C8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const colorFor = (list, idx) =>
  list?.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

export default function ArticleListSelector({
  lists = [],
  currentListId,
  onChange,
  onOpenConfig,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const current = lists.find(l => Number(l.id) === Number(currentListId));
  const currentIdx = lists.findIndex(l => Number(l.id) === Number(currentListId));
  const label = current?.name || 'Lista';
  const color = currentIdx >= 0 ? colorFor(current, currentIdx) : 'var(--color-primary)';
  const isFav = current?.is_favorite === true;

  const handleSelect = (id) => {
    onChange?.(Number(id));
    setAnchorEl(null);
  };

  const handleConfig = (e) => {
    e?.stopPropagation();
    setAnchorEl(null);
    setTimeout(() => onOpenConfig?.(), 50);
  };

  return (
    <>
      <Box
        component="button"
        aria-label="Cambiar lista de precios"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color, fontWeight: 700, fontSize: '0.95rem',
          fontFamily: 'inherit', padding: 0, ml: 1.5,
          opacity: 0.95,
          transition: 'opacity 0.15s',
          '&:hover': { opacity: 1, textDecoration: 'underline', textDecorationThickness: '1.5px', textUnderlineOffset: '3px' },
        }}
      >
        <span style={{ opacity: 0.55, marginRight: 4, color: '#94a3b8', fontWeight: 400 }}>›</span>
        {isFav && <StarIcon sx={{ fontSize: 15, color: '#f59e0b' }} />}
        <span>{label}</span>
        <ExpandMoreIcon sx={{ fontSize: 16, opacity: 0.6 }} />
      </Box>

      <Menu
        anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ '& .MuiPaper-root': { minWidth: 240 } }}
      >
        {/* Header */}
        <MenuItem disableRipple disableGutters sx={{
          px: 2, py: 0.75, cursor: 'default', '&:hover': { background: 'transparent' },
        }}>
          <Typography variant="caption" sx={{
            fontWeight: 800, fontSize: '.7rem', opacity: .7,
            textTransform: 'uppercase', letterSpacing: '.07em',
            color: 'text.secondary',
          }}>
            Listas de precios
          </Typography>
        </MenuItem>
        <Divider sx={{ my: 0 }} />

        {/* Listas */}
        {lists.map((list, idx) => {
          const isActive = Number(list.id) === Number(currentListId);
          const dotColor = colorFor(list, idx);
          return (
            <MenuItem
              key={list.id}
              onClick={() => handleSelect(list.id)}
              selected={isActive}
              sx={{ pl: 2, pr: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {list.is_favorite ? (
                  <StarIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                ) : (
                  <Box sx={{
                    width: 14, height: 14, borderRadius: '50%',
                    backgroundColor: dotColor,
                    border: '1.5px solid rgba(0,0,0,0.15)',
                    flexShrink: 0,
                  }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <span style={{ fontSize: '0.85rem' }}>
                    {list.name}
                    {list.is_favorite && (
                      <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: 6 }}>
                        Favorita
                      </span>
                    )}
                  </span>
                }
                secondary={
                  !list.is_favorite && Number(list.ajuste_pct) !== 0
                    ? `${Number(list.ajuste_pct) > 0 ? '+' : ''}${list.ajuste_pct}% sobre favorita`
                    : null
                }
                secondaryTypographyProps={{ sx: { fontSize: '0.72rem', color: 'text.secondary' } }}
              />
              {isActive && <CheckIcon fontSize="small" sx={{ opacity: 0.8, mr: 0.5 }} />}
            </MenuItem>
          );
        })}

        <Divider sx={{ my: 0 }} />

        {/* Configurar */}
        <MenuItem onClick={handleConfig} sx={{ pl: 2 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <SettingsIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText
            primary="Configurar listas…"
            primaryTypographyProps={{
              sx: { fontSize: '0.85rem', fontStyle: 'italic', color: 'text.secondary' },
            }}
          />
        </MenuItem>
      </Menu>
    </>
  );
}