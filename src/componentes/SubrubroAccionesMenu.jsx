// src/componentes/SubrubroAccionesMenu.jsx
import React, { useMemo, useState } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import axios from 'axios';
import { BASE } from '../servicios/apiBase';

export default function SubrubroAccionesMenu({
  articuloIds = [],
  agrupaciones = [],
  agrupacionSeleccionada,
  isTodo,
  onRefetch,
  notify
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [destId, setDestId] = useState('');

  const open = Boolean(anchorEl);
  const gruposDestino = useMemo(
    () => (agrupaciones || []).filter(g => g?.id && g.id !== agrupacionSeleccionada?.id),
    [agrupaciones, agrupacionSeleccionada?.id]
  );

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const openMover = () => { setDlgOpen(true); handleClose(); };
  const closeMover = () => setDlgOpen(false);

  async function moverBloque() {
    if (!destId || !articuloIds.length) return;

    try {
      // 1) agregar en destino (PUT con array)
      const payload = articuloIds.map(id => ({ id: Number(id) }));
      await axios.put(`${BASE}/agrupaciones/${destId}/articulos`, { articulos: payload });

      // 2) si venimos de una agrupación real, debemos quitar de la actual
      if (!isTodo && agrupacionSeleccionada?.id) {
        for (const id of articuloIds) {
          await axios.delete(`${BASE}/agrupaciones/${agrupacionSeleccionada.id}/articulos/${id}`);
        }
      }

      notify?.(`Movidos ${articuloIds.length} artículos`, 'success');
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo mover el bloque', 'error');
    } finally {
      closeMover();
    }
  }

  async function quitarDeActual() {
    // Solo tiene sentido si estamos en agrupación real
    if (isTodo || !agrupacionSeleccionada?.id) return;
    try {
      for (const id of articuloIds) {
        await axios.delete(`${BASE}/agrupaciones/${agrupacionSeleccionada.id}/articulos/${id}`);
      }
      notify?.(`Quitados ${articuloIds.length} artículos de ${agrupacionSeleccionada.nombre}`, 'success');
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo quitar el bloque', 'error');
    } finally {
      handleClose();
    }
  }

  return (
    <>
      <IconButton size="small" onClick={handleOpen}>
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        <MenuItem onClick={openMover}>
          <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
          <ListItemText> Mover todo a… </ListItemText>
        </MenuItem>

        {!isTodo && (
          <MenuItem onClick={quitarDeActual}>
            <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
            <ListItemText> Quitar de {agrupacionSeleccionada?.nombre} </ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Diálogo seleccionar destino */}
      <Dialog open={dlgOpen} onClose={closeMover}>
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
          <Button onClick={closeMover}>Cancelar</Button>
          <Button onClick={moverBloque} variant="contained" disabled={!destId}>Mover</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}