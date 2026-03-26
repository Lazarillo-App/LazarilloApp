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
  insumosRubroUpdate,
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
  businessId,
  rubroCodigo,
  isElaborado = false,
  onAfterRubroUpdate,
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

        // ✅ Emitir evento con estructura correcta
        emitUiAction({
          businessId,
          kind: 'discontinue',
          scope: 'insumo',
          title: `⛔ ${insumoNombre} discontinuado`,
          message: `“${insumoNombre}” se movió a Discontinuados.`,
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

        console.log('✅ Insumo discontinuado');
      } else {
        // ✅ REACTIVAR
        await insumoGroupRemoveItem(discontinuadosGroupId, insumoId, businessId);

        emitUiAction({
          businessId,
          kind: 'discontinue',
          scope: 'insumo',
          title: `✅ ${insumoNombre} reactivado`,
          message: `“${insumoNombre}” volvió a estar disponible.`,
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

        console.log('✅ Insumo reactivado');
      }

      // ✅ Refrescar SIN cambiar vista
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

      await insumoGroupRemoveItem(currentGroupId, insumoId, businessId);

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

    // ✅ Nombres de agrupaciones
    const fromGroupName = fromId
      ? groups.find(g => Number(g.id) === fromId)?.nombre || `Agrupación ${fromId}`
      : 'Sin agrupación';
    const toGroupName = groups.find(g => Number(g.id) === toId)?.nombre || `Agrupación ${toId}`;

    setIsMoving(true);
    try {
      if (fromId) {
        // Mover desde grupo actual
        console.log(`🔄 [Mover] Insumo ${insumoId} de ${fromId} a ${toId}`);

        await insumoGroupAddItem(toId, insumoId, businessId);
        await insumoGroupRemoveItem(fromId, insumoId, businessId);

        onMutateGroups?.({
          type: 'move',
          fromId,
          toId,
          ids: [insumoId],
        });

        // ✅ Emitir notificación CON UNDO
        try {
          window.dispatchEvent(
            new CustomEvent('ui:action', {
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
                  // ✅ Payload para UNDO
                  undo: {
                    payload: {
                      prev: {
                        fromGroupId: fromId,
                        toGroupId: toId,
                      },
                    },
                  },
                },
              },
            })
          );
        } catch (err) {
          console.warn('[InsumoAccionesMenu] Error emitiendo notificación:', err);
        }
      } else {
        // Agregar desde TODO
        console.log(`➕ [Agregar] Insumo ${insumoId} a ${toId}`);

        await insumoGroupAddItem(toId, insumoId, businessId);

        onMutateGroups?.({
          type: 'append',
          groupId: toId,
          insumos: [{ id: insumoId }],
        });

        // ✅ Notificación simple (sin undo porque viene de TODO)
        try {
          window.dispatchEvent(
            new CustomEvent('ui:action', {
              detail: {
                businessId,
                kind: 'move',
                scope: 'insumo',
                title: `📦 ${insumoNombre} agregado`,
                message: `Agregado a "${toGroupName}"`,
                createdAt: new Date().toISOString(),
                payload: {
                  ids: [insumoId],
                  toGroupId: toId,
                },
              },
            })
          );
        } catch (err) {
          console.warn('[InsumoAccionesMenu] Error emitiendo notificación:', err);
        }
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

  /* ========== MARCAR COMO ELABORADO / NO ELABORADO ========== */
  async function toggleElaborado() {
    if (!rubroCodigo) {
      notify?.('Este insumo no tiene rubro asignado', 'warning');
      handleClose();
      return;
    }

    const nuevoValor = !isElaborado;
    try {
      await insumosRubroUpdate(rubroCodigo, { es_elaborador: nuevoValor }, businessId);
      notify?.(
        nuevoValor
          ? `Rubro marcado como elaborado`
          : `Rubro marcado como no elaborado`,
        'success'
      );
      await onAfterRubroUpdate?.();
      await onReloadCatalogo?.();
      await onRefetch?.();
    } catch (e) {
      console.error('TOGGLE_ELABORADO_ERROR', e);
      notify?.('Error al cambiar tipo de rubro', 'error');
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
        {/* 0. Marcar como elaborado / no elaborado */}
        {rubroCodigo && (
          <MenuItem onClick={toggleElaborado}>
            <ListItemIcon>
              {isElaborado ? (
                <RemoveCircleOutlineIcon fontSize="small" />
              ) : (
                <BuildCircleIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText>
              {isElaborado
                ? 'Marcar como: No elaborado'
                : 'Marcar como: Elaborado'}
            </ListItemText>
          </MenuItem>
        )}

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

      {/* Dialog Mover */}
      < Dialog open={dlgMoverOpen} onClose={closeMover} keepMounted >
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