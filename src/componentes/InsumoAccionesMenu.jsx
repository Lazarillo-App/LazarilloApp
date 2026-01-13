/* eslint-disable no-unused-vars */
// src/componentes/InsumoAccionesMenu.jsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import {
  insumoGroupAddItem,
  insumoGroupRemoveItem,
  insumoGroupReplaceItems,
} from '../servicios/apiInsumos';

const getNum = (v) => Number(v ?? 0);
const norm = (s) => String(s || '').trim().toLowerCase();

const esDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

function InsumoAccionesMenu({
  insumo,
  groups = [],
  selectedGroupId,
  discontinuadosGroupId,
  todoGroupId,
  onRefetch,
  onReloadCatalogo,
  notify,
  onMutateGroups,
  onAfterMutation,
  onCreateGroupFromInsumo,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const open = Boolean(anchorEl);
  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const insumoId = getNum(insumo?.id);
  const currentGroupId = selectedGroupId ? Number(selectedGroupId) : null;
  const isTodoView = todoGroupId && currentGroupId === todoGroupId;

  // ✅ Verificar si está en Discontinuados
  const isInDiscontinuados = useMemo(() => {
    if (!discontinuadosGroupId || !insumoId) return false;
    const g = groups.find((gg) => Number(gg.id) === discontinuadosGroupId);
    const items = g?.items || g?.insumos || [];
    return items.some((item) => Number(item.insumo_id ?? item.id) === insumoId);
  }, [groups, insumoId, discontinuadosGroupId]);

  // ✅ Grupos destino (excepto el actual)
  const gruposDestino = useMemo(
    () => groups.filter((g) => Number(g.id) !== currentGroupId),
    [groups, currentGroupId]
  );

  const openMover = useCallback(() => {
    handleClose();
    setTimeout(() => setDlgMoverOpen(true), 0);
  }, [handleClose]);

  const closeMover = useCallback(() => setDlgMoverOpen(false), []);

  /* ========== DISCONTINUAR / REACTIVAR ========== */
 /* ========== DISCONTINUAR / REACTIVAR ========== */
async function toggleDiscontinuar() {
  if (!discontinuadosGroupId) {
    notify?.('No existe la agrupación "Discontinuados"', 'error');
    handleClose();
    return;
  }

  try {
    if (!isInDiscontinuados) {
      // ✅ DISCONTINUAR
      console.log(`🗑️ [Discontinuar] Insumo ${insumoId}`);
      
      await insumoGroupAddItem(discontinuadosGroupId, insumoId);
      
      notify?.(`Insumo discontinuado`, 'success');
    } else {
      // ✅ REACTIVAR
      console.log(`♻️ [Reactivar] Insumo ${insumoId}`);
      
      await insumoGroupRemoveItem(discontinuadosGroupId, insumoId);
      
      notify?.(`Insumo reactivado`, 'success');
    }

    // ✅ SECUENCIA CORRECTA (esperar TODO antes de cerrar)
    console.log('🔄 [1/2] Recargando catálogo...');
    await onReloadCatalogo?.();
    
    console.log('🔄 [2/2] Forzando refresh...');
    await onRefetch?.(); // Este ejecuta forceRefresh dentro
    
    console.log('✅ Refresh completado');
  } catch (e) {
    console.error('TOGGLE_DISCONTINUAR_ERROR', e);
    notify?.('Error al cambiar estado', 'error');
    await onRefetch?.();
  } finally {
    handleClose();
  }
}

/* ========== QUITAR DE AGRUPACIÓN ========== */
async function quitarDeActual() {
  if (isTodoView) {
    notify?.('El insumo ya está en "Sin agrupación"', 'info');
    handleClose();
    return;
  }

  if (!currentGroupId) {
    handleClose();
    return;
  }

  try {
    console.log(`🗑️ [Quitar] Insumo ${insumoId} del grupo ${currentGroupId}`);
    
    await insumoGroupRemoveItem(currentGroupId, insumoId);
    
    const groupName = groups.find(g => Number(g.id) === currentGroupId)?.nombre || 'agrupación';
    notify?.(`Insumo quitado de ${groupName}`, 'success');

    // ✅ SECUENCIA CORRECTA
    console.log('🔄 [1/2] Recargando catálogo...');
    await onReloadCatalogo?.();
    
    console.log('🔄 [2/2] Forzando refresh...');
    await onRefetch?.();
    
    console.log('✅ Refresh completado');
  } catch (e) {
    console.error('QUITAR_INSUMO_ERROR', e);
    notify?.('Error al quitar insumo', 'error');
    await onRefetch?.();
  } finally {
    handleClose();
  }
}
  /* ========== MOVER A OTRA AGRUPACIÓN ========== */
  async function mover() {
    if (!destId) return;

    const toId = Number(destId);
    const fromId = !isTodoView && currentGroupId ? currentGroupId : null;

    if (fromId && fromId === toId) {
      notify?.('El insumo ya está en esa agrupación', 'info');
      onAfterMutation?.([insumoId]);
      return closeMover();
    }

    setIsMoving(true);
    try {
      if (fromId) {
        // Mover desde grupo actual
        console.log(`🔄 [Mover] Insumo ${insumoId} de ${fromId} a ${toId}`);

        await insumoGroupAddItem(toId, insumoId);
        await insumoGroupRemoveItem(fromId, insumoId);

        onMutateGroups?.({
          type: 'move',
          fromId,
          toId,
          ids: [insumoId],
        });
      } else {
        // Agregar desde TODO
        console.log(`➕ [Agregar] Insumo ${insumoId} a ${toId}`);

        await insumoGroupAddItem(toId, insumoId);

        onMutateGroups?.({
          type: 'append',
          groupId: toId,
          insumos: [{ id: insumoId }],
        });
      }

      notify?.(`Insumo #${insumoId} movido`, 'success');

      // ✅ FORZAR REFRESH
      onAfterMutation?.([insumoId]);
      await onReloadCatalogo?.();
      await onRefetch?.();
    } catch (e) {
      console.error('MOVER_INSUMO_ERROR', e);
      notify?.('Error al mover insumo', 'error');
      await onRefetch?.();
    } finally {
      setIsMoving(false);
      closeMover();
    }
  }

  return (
    <>
      <IconButton size="small" onClick={handleOpen}>
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        {/* 1. Discontinuar / Reactivar */}
        <MenuItem onClick={toggleDiscontinuar}>
          <ListItemIcon>
            {isInDiscontinuados ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {isInDiscontinuados
              ? 'Reactivar (quitar de Discontinuados)'
              : 'Discontinuar'}
          </ListItemText>
        </MenuItem>

        {/* 2. Quitar de esta agrupación */}
        <MenuItem onClick={quitarDeActual} disabled={isTodoView}>
          <ListItemIcon>
            <UndoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {isTodoView ? 'Ya está en Sin agrupación' : 'Quitar de esta agrupación'}
          </ListItemText>
        </MenuItem>

        {/* 3. Mover a… */}
        <MenuItem onClick={openMover}>
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Mover a…</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          handleClose();
          onCreateGroupFromInsumo?.(insumo);
        }}>
          <ListItemIcon>
            <GroupAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Crear agrupación desde este insumo
          </ListItemText>
        </MenuItem>
    </Menu >

      {/* Dialog Mover */ }
      < Dialog open = { dlgMoverOpen } onClose = { closeMover } keepMounted >
        <DialogTitle>Mover insumo #{insumo?.id} a…</DialogTitle>
        <DialogContent>
          <TextField
            select
            SelectProps={{ native: true }}
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            <option value="" disabled>
              Seleccionar…
            </option>
            {gruposDestino.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMover} disabled={isMoving}>
            Cancelar
          </Button>
          <Button
            onClick={mover}
            variant="contained"
            disabled={!destId || isMoving}
          >
            {isMoving ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog >
    </>
  );
}

export default React.memo(InsumoAccionesMenu);