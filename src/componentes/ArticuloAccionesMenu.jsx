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
  todoGroupId,            // id del grupo "TODO" (Sin agrupación)
  isTodo = false,         // si estás en "Sin agrupación" no mostramos "Quitar de..."
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
      .filter(g => Number(g.id) !== currentGroupId)     // no el mismo grupo
      .filter(g => Number(g.id) !== Number(todoGroupId)) // no el TODO
    ,
    [agrupaciones, currentGroupId, todoGroupId]
  );

  const openMover = () => {
    handleClose();
    setTimeout(() => setDlgMoverOpen(true), 0); // deja que el foco salga del Menu
  };

  const closeMover = () => setDlgMoverOpen(false);

  async function mover() {
    if (!destId) return;
    const idNum = getNum(articulo.id);
    const toId = Number(destId);
    const fromId = (!isTodo && currentGroupId) ? Number(currentGroupId) : null;

    // Evitar mover al mismo destino
    if (fromId && fromId === toId) {
      notify?.('El artículo ya está en esa agrupación', 'info');
      return closeMover();
    }

    // mover({ idNum, fromId, toId })
setIsMoving(true);
try {
  if (fromId) {
    try {
      await axios.post(`${BASE}/agrupaciones/${fromId}/move-items`, { toId, ids:[idNum] });
    } catch (e) {
      const st = e?.response?.status;
      const canFallback = st === 404 || st === 405 || st === 500;
      if (!canFallback) throw e;

      await axios.put(`${BASE}/agrupaciones/${toId}/articulos`, { ids:[idNum] })
        .catch(e2 => {
          const s = e2?.response?.status;
          const tx = JSON.stringify(e2?.response?.data || {});
          const dup = s === 409 || /duplicate|1062|23505/i.test(tx);
          if (!dup) throw e2;
        });

      try { await axios.delete(`${BASE}/agrupaciones/${fromId}/articulos/${idNum}`); }
      catch { notify?.('Agregado al destino, pero no se pudo quitar del origen', 'warning'); }
    }
  } else {
    await axios.put(`${BASE}/agrupaciones/${toId}/articulos`, { ids:[idNum] })
      .catch(e2 => {
        const s = e2?.response?.status;
        const tx = JSON.stringify(e2?.response?.data || {});
        const dup = s === 409 || /duplicate|1062|23505/i.test(tx);
        if (!dup) throw e2;
      });
  }

  notify?.(`Artículo #${idNum} movido`, 'success');
  onRefetch?.();
} catch (e) {
  console.error('MOVER_ERROR', {
    status: e?.response?.status,
    data: e?.response?.data,
    url: e?.config?.url, method: e?.config?.method
  });
  notify?.('No se pudo mover el artículo', 'error');
} finally {
  setIsMoving(false);
  closeMover();
}
  };

  async function quitarDeActual() {
    if (isTodo || !currentGroupId) return;
    try {
      await axios.delete(`${BASE}/agrupaciones/${currentGroupId}/articulos/${getNum(articulo.id)}`);
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

        {/* NUEVO: abre el modal completo mover/crear */}
        <MenuItem onClick={() => { handleClose(); setOpenGestor(true); }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación…</ListItemText>
        </MenuItem>
      </Menu>

      {/* Diálogo simple para "Mover a…" con select nativo */}
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
