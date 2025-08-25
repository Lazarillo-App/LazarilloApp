// src/componentes/ArticuloAccionesMenu.jsx
import React, { useMemo, useState } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import axios from 'axios';
import { BASE } from '../servicios/apiBase';
import GestorAgrupacionesModal from './GestorAgrupacionesModal';

const getNum = (v) => Number(v ?? 0);

export default function ArticuloAccionesMenu({
  articulo,
  agrupaciones = [],
  agrupacionSeleccionada,
  todoGroupId,            // 👈 importante para el modal
  isTodo = false,         // si estás en "Sin agrupación" no mostramos "Quitar de..."
  onRefetch,
  notify
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');

  // Modal gestor (mover/crear en bloque)
  const [openGestor, setOpenGestor] = useState(false);

  const open = Boolean(anchorEl);
  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const gruposDestino = useMemo(
    () => (agrupaciones || []).filter(g => g?.id && g.id !== agrupacionSeleccionada?.id),
    [agrupaciones, agrupacionSeleccionada?.id]
  );

  const openMover = () => { setDlgMoverOpen(true); handleClose(); };
  const closeMover = () => setDlgMoverOpen(false);

  async function mover() {
    if (!destId) return;
    try {
      // 1) agregar en destino
      await axios.put(`${BASE}/agrupaciones/${destId}/articulos`, {
        articulos: [{ id: getNum(articulo.id) }]
      });

      // 2) si venimos de agrupación real, quitar de la actual
      if (!isTodo && agrupacionSeleccionada?.id) {
        await axios.delete(`${BASE}/agrupaciones/${agrupacionSeleccionada.id}/articulos/${articulo.id}`);
      }

      notify?.(`Artículo #${articulo.id} movido`, 'success');
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo mover el artículo', 'error');
    } finally {
      closeMover();
    }
  }

  async function quitarDeActual() {
    if (isTodo || !agrupacionSeleccionada?.id) return;
    try {
      await axios.delete(`${BASE}/agrupaciones/${agrupacionSeleccionada.id}/articulos/${articulo.id}`);
      notify?.(`Artículo #${articulo.id} quitado de ${agrupacionSeleccionada.nombre}`, 'success');
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo quitar el artículo', 'error');
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
          <ListItemText>Mover a…</ListItemText>
        </MenuItem>

        {!isTodo && (
          <MenuItem onClick={quitarDeActual}>
            <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Quitar de {agrupacionSeleccionada?.nombre}</ListItemText>
          </MenuItem>
        )}

        {/* NUEVO: abre el modal completo mover/crear */}
        <MenuItem onClick={() => { handleClose(); setOpenGestor(true); }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación…</ListItemText>
        </MenuItem>
      </Menu>

      {/* Diálogo simple para "Mover a…" con select nativo */}
      <Dialog open={dlgMoverOpen} onClose={closeMover}>
        <DialogTitle>Mover artículo #{articulo.id} a…</DialogTitle>
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
          <Button onClick={mover} variant="contained" disabled={!destId}>Mover</Button>
        </DialogActions>
      </Dialog>

      {/* Modal gestor para mover/crear en bloque (con artículo preseleccionado) */}
      <GestorAgrupacionesModal
        open={openGestor}
        onClose={() => setOpenGestor(false)}
        preselectIds={[getNum(articulo.id)]}
        agrupaciones={agrupaciones}
        todoGroupId={todoGroupId}
        notify={notify}
        onRefetch={onRefetch}
      />
    </>
  );
}