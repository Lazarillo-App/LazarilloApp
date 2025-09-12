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

export default function SubrubroAccionesMenu({
  isTodo = false,                      // si estás en "Sin agrupación"
  agrupaciones = [],
  agrupacionSeleccionada,              // puede venir null
  todoGroupId,
  articuloIds = [],                    // TODOS los ids del subrubro
  onRefetch,
  notify
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [openGestor, setOpenGestor] = useState(false);

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
    const ids = articuloIds.map(getNum).filter(Boolean);
    if (!ids.length) return;

    const fromId = (!isTodo && currentGroupId) ? Number(currentGroupId) : null;
    const toId = Number(destId);

    setIsMoving(true);
    try {
      if (fromId) {
        // intento con endpoint masivo (si existe en tu API)
        try {
          await axios.post(`${BASE}/agrupaciones/${fromId}/move-items`, { toId, ids });
        } catch (e) {
          // fallback: add en destino y luego delete del origen
          await axios.put(`${BASE}/agrupaciones/${toId}/articulos`, { ids })
            .catch(e2 => {
              const s = e2?.response?.status;
              const tx = JSON.stringify(e2?.response?.data || {});
              const dup = s === 409 || /duplicate|1062|23505/i.test(tx);
              if (!dup) throw e2;
            });

          // quitamos del origen uno x uno (si no tenés endpoint masivo)
          for (const id of ids) {
            try { await axios.delete(`${BASE}/agrupaciones/${fromId}/articulos/${id}`); }
            catch { /* no detengas todo si alguno falla */ }
          }
        }
      } else {
        // venimos de 'Sin agrupación' o sin selección → solo agregamos
        await axios.put(`${BASE}/agrupaciones/${toId}/articulos`, { ids })
          .catch(e2 => {
            const s = e2?.response?.status;
            const tx = JSON.stringify(e2?.response?.data || {});
            const dup = s === 409 || /duplicate|1062|23505/i.test(tx);
            if (!dup) throw e2;
          });
      }

      notify?.(`Subrubro movido (${ids.length} artículo/s)`, 'success');
      onRefetch?.();
    } catch (e) {
      console.error('MOVER_SUBRUBRO_ERROR', e?.response || e);
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
        try { await axios.delete(`${BASE}/agrupaciones/${currentGroupId}/articulos/${id}`); }
        catch { /* continuar */ }
      }
      notify?.(`Quitados ${ids.length} artículo(s) de ${agrupacionSeleccionada?.nombre}`, 'success');
      onRefetch?.();
    } catch (e) {
      console.error(e);
      notify?.('No se pudo quitar el subrubro', 'error');
    } finally {
      handleClose();
    }
  }

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

        <MenuItem onClick={() => { handleClose(); setOpenGestor(true); }}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación con este subrubro…</ListItemText>
        </MenuItem>
      </Menu>

      {/* diálogo mover */}
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

      {/* modal crear agrupación con preselección de este subrubro */}
      <GestorAgrupacionesModal
        open={openGestor}
        onClose={() => setOpenGestor(false)}
        preselectIds={articuloIds.map(getNum)}
        agrupaciones={agrupaciones}
        todoGroupId={todoGroupId}
        notify={notify}
        onRefetch={onRefetch}
      />
    </>
  );
}
