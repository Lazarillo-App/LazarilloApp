// src/componentes/SubrubroAccionesMenu.jsx
import React, { useMemo, useState } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import GroupAddIcon from '@mui/icons-material/GroupAdd';

import { httpBiz } from '../servicios/apiBusinesses';
import AgrupacionCreateModal from './AgrupacionCreateModal';

const getNum = (v) => Number(v ?? 0);

export default function SubrubroAccionesMenu({
  isTodo = false,
  agrupaciones = [],
  agrupacionSeleccionada,
  todoGroupId,
  articuloIds = [],          // IDs de los artículos del subrubro
  onRefetch,
  notify,
  onAfterMutation,           // refresco optimista en la tabla

  // 🔹 NUEVOS: para usar el modal reutilizable
  todosArticulos = [],
  loading = false,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [openCrearAgr, setOpenCrearAgr] = useState(false);

  const open = Boolean(anchorEl);
  const handleOpen  = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const currentGroupId = agrupacionSeleccionada?.id ? Number(agrupacionSeleccionada.id) : null;

  // ✅ Permitimos mover a TODO: solo excluimos el grupo actual
  const gruposDestino = useMemo(
    () => (agrupaciones || [])
      .filter(g => g?.id)
      .filter(g => Number(g.id) !== currentGroupId),
    [agrupaciones, currentGroupId]
  );

  const openMover  = () => { handleClose(); setTimeout(() => setDlgMoverOpen(true), 0); };
  const closeMover = () => setDlgMoverOpen(false);

  async function mover() {
    if (!destId) return;
    const ids = articuloIds.map(getNum).filter(Boolean);
    if (!ids.length) return;

    const fromId = (!isTodo && currentGroupId) ? Number(currentGroupId) : null;
    const toId   = Number(destId);

    if (fromId && fromId === toId) {
      notify?.('Ya está en esa agrupación', 'info');
      onAfterMutation?.(ids);
      return closeMover();
    }

    setIsMoving(true);
    try {
      if (fromId) {
        try {
          await httpBiz(`/agrupaciones/${fromId}/move-items`, { method: 'POST', body: { toId, ids } });
        } catch {
          await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids } });
          for (const id of ids) {
            try { await httpBiz(`/agrupaciones/${fromId}/articulos/${id}`, { method: 'DELETE' }); } catch {}
          }
        }
      } else {
        // desde TODO / sin agrupación
        await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids } });
      }

      notify?.(`Subrubro movido (${ids.length} artículo/s)`, 'success');
      onAfterMutation?.(ids);    // ✅ optimista
      onRefetch?.();
    } catch (e) {
      console.error('MOVER_SUBRUBRO_ERROR', e);
      notify?.('No se pudo mover el subrubro', 'error');
    } finally {
      setIsMoving(false);
      closeMover();
    }
  }

  async function quitarDeActual() {
    if (isTodo || !currentGroupId) return;
    const ids = articuloIds.map(getNum).filter(Boolean);
    try {
      for (const id of ids) {
        try { await httpBiz(`/agrupaciones/${currentGroupId}/articulos/${id}`, { method: 'DELETE' }); }
        catch {}
      }
      notify?.(`Quitados ${ids.length} artículo(s) de ${agrupacionSeleccionada?.nombre}`, 'success');
      onAfterMutation?.(ids);    // ✅ optimista
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo quitar el subrubro', 'error');
    } finally {
      handleClose();
    }
  }

  // 🔒 Bloqueo para el modal "crear": artículos ya asignados a cualquier agrupación ≠ TODO
  const isArticuloBloqueadoCreate = useMemo(() => {
    const assigned = new Set();
    (agrupaciones || [])
      .filter(g => (g?.nombre || '').toUpperCase() !== 'TODO')
      .forEach(g => (g.articulos || []).forEach(a => assigned.add(String(a.id))));
    return (art) => assigned.has(String(art.id));
  }, [agrupaciones]);

  return (
    <>
      <IconButton size="small" onClick={handleOpen} title="Acciones de subrubro">
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        <MenuItem onClick={openMover}>
          <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Mover subrubro a…</ListItemText>
        </MenuItem>

        {!isTodo && (
          <MenuItem onClick={quitarDeActual}>
            <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Quitar del grupo actual</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={() => { handleClose(); setOpenCrearAgr(true); }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación con este subrubro…</ListItemText>
        </MenuItem>
      </Menu>

      {/* Diálogo "Mover a" */}
      <Dialog open={dlgMoverOpen} onClose={closeMover} keepMounted>
        <DialogTitle>Mover {articuloIds.length} artículo(s) a…</DialogTitle>
        <DialogContent>
          <TextField
            select
            SelectProps={{ native: true }}
            label=""
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            <option value="" disabled>Seleccionar…</option>
            {gruposDestino.map(g => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMover} disabled={isMoving}>Cancelar</Button>
          <Button onClick={mover} variant="contained" disabled={!destId || isMoving}>
            {isMoving ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>
      <AgrupacionCreateModal
        open={openCrearAgr}
        onClose={() => setOpenCrearAgr(false)}
        mode="create"
        todosArticulos={todosArticulos}
        loading={loading}
        isArticuloBloqueado={isArticuloBloqueadoCreate}
        onCreated={async (nombreCreado) => {
          notify?.(`Agrupación “${nombreCreado}” creada`, 'success');
          onRefetch?.();
        }}
      />
    </>
  );
}
