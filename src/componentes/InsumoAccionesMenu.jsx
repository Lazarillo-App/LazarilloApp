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
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { emitUiAction } from '@/servicios/uiEvents';
import {
  insumoGroupAddItem,
  insumoGroupRemoveItem,
  insumoGroupReplaceItems,
  toggleInsumoElaborado,
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
  onAfterToggleElaborado,
  onCreateGroupFromInsumo,
  businessId,
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
  const insumoNombre = String(insumo?.nombre || '').trim() || `INS-${insumoId}`;

  // Derivado del objeto insumo — única fuente de verdad
  const isElaborado = Boolean(insumo?.es_elaborado);

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

  /* ========== MARCAR / DESMARCAR COMO ELABORADO ========== */
  async function handleToggleElaborado() {
    handleClose();
    try {
      await toggleInsumoElaborado(insumoId, !isElaborado, businessId);
      notify?.(
        isElaborado
          ? `"${insumoNombre}" desmarcado como elaborado`
          : `"${insumoNombre}" marcado como elaborado`,
        'success'
      );
      // Notificar al padre para que quite el insumo de la vista actual de forma optimista
      // y luego recargar catálogo completo (rubros + insumos)
      onAfterToggleElaborado?.(insumoId, !isElaborado);
      await onReloadCatalogo?.();
    } catch (e) {
      console.error('TOGGLE_ELABORADO_ERROR', e);
      notify?.('Error al cambiar estado elaborado', 'error');
    }
  }

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
        await insumoGroupAddItem(discontinuadosGroupId, insumoId, businessId);

        emitUiAction({
          businessId,
          kind: 'discontinue',
          scope: 'insumo',
          title: `⛔ ${insumoNombre} discontinuado`,
          message: `"${insumoNombre}" se movió a Discontinuados.`,
          createdAt: new Date().toISOString(),
          payload: {
            ids: [insumoId],
            undo: {
              payload: {
                prev: {
                  wasInDiscontinuados: false,
                  discontinuadosGroupId: Number(discontinuadosGroupId),
                  fromGroupId: currentGroupId ?? null,
                },
              },
            },
          },
        });
      } else {
        // ✅ REACTIVAR
        await insumoGroupRemoveItem(discontinuadosGroupId, insumoId, businessId);

        emitUiAction({
          businessId,
          kind: 'discontinue',
          scope: 'insumo',
          title: `✅ ${insumoNombre} reactivado`,
          message: `"${insumoNombre}" volvió a estar disponible.`,
          createdAt: new Date().toISOString(),
          payload: {
            ids: [insumoId],
            undo: {
              payload: {
                prev: {
                  wasInDiscontinuados: true,
                  discontinuadosGroupId: Number(discontinuadosGroupId),
                  fromGroupId: currentGroupId ?? null,
                },
              },
            },
          },
        });
      }

      await onReloadCatalogo?.();
      await onRefetch?.();
    } catch (e) {
      console.error('TOGGLE_DISCONTINUAR_ERROR', e);
      notify?.('Error al cambiar estado', 'error');
    } finally {
      handleClose();
    }
  }

  /* ========== QUITAR DE AGRUPACIÓN ========== */
  async function quitarDeActual() {
    if (isTodoView) {
      notify?.(`El insumo ya está en "Sin agrupación"`, 'info');
      handleClose();
      return;
    }

    if (!currentGroupId) {
      handleClose();
      return;
    }

    try {
      await insumoGroupRemoveItem(currentGroupId, insumoId, businessId);
      const groupName = groups.find(g => Number(g.id) === currentGroupId)?.nombre || 'agrupación';
      notify?.(`Insumo quitado de ${groupName}`, 'success');
      await onReloadCatalogo?.();
      await onRefetch?.();
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

    const fromGroupName = fromId
      ? groups.find(g => Number(g.id) === fromId)?.nombre || `Agrupación ${fromId}`
      : 'Sin agrupación';
    const toGroupName = groups.find(g => Number(g.id) === toId)?.nombre || `Agrupación ${toId}`;

    setIsMoving(true);
    try {
      if (fromId) {
        await insumoGroupAddItem(toId, insumoId, businessId);
        await insumoGroupRemoveItem(fromId, insumoId, businessId);

        onMutateGroups?.({
          type: 'move',
          fromId,
          toId,
          ids: [insumoId],
        });

        try {
          window.dispatchEvent(new CustomEvent('ui:action', {
            detail: {
              businessId,
              kind: 'move',
              scope: 'insumo',
              title: `📦 ${insumoNombre} movido`,
              message: `"${fromGroupName}" → "${toGroupName}"`,
              createdAt: new Date().toISOString(),
              payload: {
                ids: [insumoId],
                originGroupId: fromId,
                toGroupId: toId,
                undo: { payload: { prev: { fromGroupId: fromId, toGroupId: toId } } },
              },
            },
          }));
        } catch (err) {
          console.warn('[InsumoAccionesMenu] Error emitiendo notificación:', err);
        }
      } else {
        await insumoGroupAddItem(toId, insumoId, businessId);

        onMutateGroups?.({
          type: 'append',
          groupId: toId,
          insumos: [{ id: insumoId }],
        });

        try {
          window.dispatchEvent(new CustomEvent('ui:action', {
            detail: {
              businessId,
              kind: 'move',
              scope: 'insumo',
              title: `📦 ${insumoNombre} agregado`,
              message: `Agregado a "${toGroupName}"`,
              createdAt: new Date().toISOString(),
              payload: { ids: [insumoId], toGroupId: toId },
            },
          }));
        } catch (err) {
          console.warn('[InsumoAccionesMenu] Error emitiendo notificación:', err);
        }
      }

      notify?.(`Insumo #${insumoId} movido`, 'success');
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

        {/* 0. Marcar / desmarcar como elaborado */}
        <MenuItem onClick={handleToggleElaborado}>
          <ListItemIcon>
            {isElaborado ? (
              <RemoveCircleOutlineIcon fontSize="small" />
            ) : (
              <BuildCircleIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {isElaborado ? 'Desmarcar como elaborado' : 'Marcar como elaborado'}
          </ListItemText>
        </MenuItem>

        {/* 3. Mover a… */}
        <MenuItem onClick={openMover}>
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Mover a…</ListItemText>
        </MenuItem>

        {/* 4. Crear agrupación */}
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
      </Menu>

      {/* Dialog Mover */}
      <Dialog open={dlgMoverOpen} onClose={closeMover} keepMounted>
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
      </Dialog>
    </>
  );
}

export default React.memo(InsumoAccionesMenu);