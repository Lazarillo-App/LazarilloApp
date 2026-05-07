// src/componentes/LinkChainIcon.jsx
//
// Ícono de cadena que aparece en cada fila de artículo vinculado.
// Al hacer click abre un popover con:
//   - Lista de artículos en la vinculación
//   - Opción de sacar este artículo de la vinculación
//   - Opción de eliminar toda la vinculación

/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import {
  Tooltip, IconButton, Popover, Box, Typography,
  List, ListItem, ListItemText, Divider, Button, Chip,
} from '@mui/material';
import LinkIcon       from '@mui/icons-material/Link';
import LinkOffIcon    from '@mui/icons-material/LinkOff';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

/**
 * LinkChainIcon
 *
 * Props:
 *   articleId       number
 *   groupInfo       { groupId, groupName, memberIds: Set<number> }
 *   nameById        Map<number, string>   — para mostrar nombres en el popover
 *   onRemoveSelf    (groupId, articleId) => void   — sacar solo este artículo
 *   onDeleteGroup   (groupId) => void               — eliminar toda la vinculación
 */
export default function LinkChainIcon({
  articleId,
  groupInfo,
  nameById = new Map(),
  onRemoveSelf,
  onDeleteGroup,
}) {
  const [anchorEl, setAnchorEl] = useState(null);

  if (!groupInfo) return null;

  const { groupId, groupName, memberIds } = groupInfo;
  const members = Array.from(memberIds || []);
  const others = members.filter(id => id !== Number(articleId));
  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Artículo vinculado — click para gestionar">
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
          sx={{
            p: 0.25,
            color: '#7c3aed',
            opacity: 0.8,
            '&:hover': { opacity: 1, bgcolor: 'rgba(124,58,237,0.08)' },
          }}
        >
          <LinkIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{
          elevation: 4,
          sx: {
            width: 280, borderRadius: 2, overflow: 'hidden',
            border: '1px solid rgba(124,58,237,0.2)',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2, py: 1.25,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.04) 100%)',
          borderBottom: '1px solid rgba(124,58,237,0.12)',
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <LinkIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#4c1d95' }}>
            Vinculación
            {groupName && (
              <span style={{ fontWeight: 400, fontSize: '0.78rem', marginLeft: 6, opacity: 0.7 }}>
                {groupName}
              </span>
            )}
          </Typography>
          <Chip
            label={`${members.length} artículos`}
            size="small"
            sx={{
              ml: 'auto', height: 18, fontSize: '0.68rem', fontWeight: 700,
              bgcolor: 'rgba(124,58,237,0.12)', color: '#7c3aed',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>

        {/* Lista de miembros */}
        <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
          <List dense disablePadding>
            {members.map((id, i) => {
              const name = nameById.get(id) || `#${id}`;
              const isMe = id === Number(articleId);
              return (
                <ListItem key={id} disablePadding sx={{
                  px: 2, py: 0.5,
                  bgcolor: isMe ? 'rgba(124,58,237,0.06)' : 'transparent',
                  borderLeft: isMe ? '3px solid #7c3aed' : '3px solid transparent',
                }}>
                  <ListItemText
                    primary={
                      <span style={{ fontSize: '0.8rem', fontWeight: isMe ? 700 : 400 }}>
                        {isMe && <span style={{ fontSize: '0.65rem', color: '#7c3aed', marginRight: 4, textTransform: 'uppercase', fontWeight: 800 }}>Este</span>}
                        {name}
                      </span>
                    }
                    secondary={<span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>#{id}</span>}
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>

        <Divider />

        {/* Acciones */}
        <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', mb: 0.25 }}>
            Acciones
          </Typography>

          {/* Sacar solo este artículo */}
          <Button
            size="small"
            startIcon={<LinkOffIcon sx={{ fontSize: 15 }} />}
            onClick={() => {
              onRemoveSelf?.(groupId, Number(articleId));
              setAnchorEl(null);
            }}
            sx={{
              justifyContent: 'flex-start', textTransform: 'none',
              fontSize: '0.8rem', color: '#374151', fontWeight: 500,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
            }}
          >
            Quitar de la vinculación
          </Button>

          {/* Eliminar toda la vinculación */}
          <Button
            size="small"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 15 }} />}
            onClick={() => {
              onDeleteGroup?.(groupId);
              setAnchorEl(null);
            }}
            sx={{
              justifyContent: 'flex-start', textTransform: 'none',
              fontSize: '0.8rem', color: '#dc2626', fontWeight: 500,
              '&:hover': { bgcolor: 'rgba(220,38,38,0.06)' },
            }}
          >
            Eliminar vinculación completa
          </Button>
        </Box>
      </Popover>
    </>
  );
}