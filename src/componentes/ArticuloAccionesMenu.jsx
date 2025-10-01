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
import GestorAgrupacionesModal from './GestorAgrupacionesModal';

const getNum = (v) => Number(v ?? 0);

export default function ArticuloAccionesMenu({
  articulo,
  agrupaciones = [],
  agrupacionSeleccionada,
  todoGroupId,
  isTodo = false,
  onRefetch,
  notify
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [openGestor, setOpenGestor] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const open = Boolean(anchorEl);
  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const currentGroupId = agrupacionSeleccionada?.id ? Number(agrupacionSeleccionada.id) : null;

  const gruposDestino = useMemo(
    () => (agrupaciones || [])
      .filter(g => g?.id)
      .filter(g => Number(g.id) !== currentGroupId)
      .filter(g => Number(g.id) !== Number(todoGroupId)),
    [agrupaciones, currentGroupId, todoGroupId]
  );

  const openMover = () => { handleClose(); setTimeout(() => setDlgMoverOpen(true), 0); };
  const closeMover = () => setDlgMoverOpen(false);

  async function mover() {
    if (!destId) return;
    const idNum = getNum(articulo.id);
    const toId = Number(destId);
    const fromId = (!isTodo && currentGroupId) ? Number(currentGroupId) : null;

    if (fromId && fromId === toId) {
      notify?.('El artículo ya está en esa agrupación', 'info');
      return closeMover();
    }

    setIsMoving(true);
    try {
      if (fromId) {
        try {
          await httpBiz(`/agrupaciones/${fromId}/move-items`, { method: 'POST', body: { toId, ids:[idNum] } });
        } catch {
          await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids:[idNum] } });
          try { await httpBiz(`/agrupaciones/${fromId}/articulos/${idNum}`, { method: 'DELETE' }); } catch {}
        }
      } else {
        await httpBiz(`/agrupaciones/${toId}/articulos`, { method: 'PUT', body: { ids:[idNum] } });
      }

      notify?.(`Artículo #${idNum} movido`, 'success');
      onRefetch?.();
    } catch (e) {
      console.error('MOVER_ERROR', e);
      notify?.('No se pudo mover el artículo', 'error');
    } finally {
      setIsMoving(false);
      closeMover();
    }
  }

  async function quitarDeActual() {
    if (isTodo || !currentGroupId) return;
    try {
      await httpBiz(`/agrupaciones/${currentGroupId}/articulos/${getNum(articulo.id)}`, { method: 'DELETE' });
      notify?.(`Artículo #${articulo.id} quitado de ${agrupacionSeleccionada?.nombre}`, 'success');
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

        <MenuItem onClick={() => { handleClose(); setOpenGestor(true); }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación…</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={dlgMoverOpen} onClose={closeMover} keepMounted>
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
          <Button onClick={closeMover} disabled={isMoving}>Cancelar</Button>
          <Button onClick={mover} variant="contained" disabled={!destId || isMoving}>
            {isMoving ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>

      <GestorAgrupacionesModal
        open={openGestor}
        onClose={() => setOpenGestor(false)}
        preselectIds={[getNum(articulo.id)]}
        notify={notify}
        onRefetch={onRefetch}
      />
    </>
  );
}
