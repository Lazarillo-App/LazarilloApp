/* eslint-disable no-unused-vars */
// src/componentes/InsumoAccionesMenu.jsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UndoIcon from '@mui/icons-material/Undo';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { emitUiAction } from '@/servicios/uiEvents';
import {
  insumoGroupAddItem,
  insumoGroupRemoveItem,
  insumoGroupReplaceItems,
  toggleInsumoElaborado,
  insumoDeleteManual,
  insumoUpdate,
} from '../servicios/apiInsumos';
import { proponerDiscontinuarInsumo } from '@/servicios/apiRecetaProposals';
import { esDiscontinuadosGroup, esElaboradosGroup, esTop20Group } from '@/utils/insumoGruposEspeciales';

const getNum = (v) => Number(v ?? 0);

function InsumoAccionesMenu({
  insumo,
  groups = [],
  // En qué agrupaciones reales ya tiene insumos el rubro de ESTE insumo hoy
  // — [{groupId, nombre, count}]. Solo tiene sentido en Sin Agrupación: si
  // hay una única, el botón inline mueve directo; si no, abre el selector.
  reparto = undefined,
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
  onOpenRecetaElaborado,
  onOpenEditModal,
  businessId,
  rubrosMap,
  // Vista Operación, Fase 4: Staff solo ve "Discontinuar" y esa acción no se
  // aplica directo — crea una propuesta que queda pendiente de aprobación
  // (ver proponerDiscontinuarInsumo). El resto de las acciones de este menú
  // siguen siendo de aplicación directa, por eso quedan ocultas en este modo.
  staffMode = false,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [proponiendo, setProponiendo] = useState(false);
  const [dlgMoverRubroOpen, setDlgMoverRubroOpen] = useState(false);
  const [nuevoRubro, setNuevoRubro] = useState('');
  const [movingRubro, setMovingRubro] = useState(false);

  const open = Boolean(anchorEl);
  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const insumoId = getNum(insumo?.id);
  const currentGroupId = selectedGroupId ? Number(selectedGroupId) : null;
  const isTodoView = todoGroupId && currentGroupId === todoGroupId;
  const insumoNombre = String(insumo?.nombre || '').trim() || `INS-${insumoId}`;
  const [dlgEliminarOpen, setDlgEliminarOpen] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  // Solo los insumos manuales se pueden eliminar
  const esManual = String(insumo?.origen || '').toLowerCase() === 'manual';

  // Derivado del objeto insumo — única fuente de verdad
  const isElaborado = Boolean(insumo?.es_elaborado);

  // ✅ Verificar si está en Discontinuados
  const isInDiscontinuados = useMemo(() => {
    if (!discontinuadosGroupId || !insumoId) return false;
    const g = groups.find((gg) => Number(gg.id) === discontinuadosGroupId);
    const items = g?.items || g?.insumos || [];
    return items.some((item) => Number(item.insumo_id ?? item.id) === insumoId);
  }, [groups, insumoId, discontinuadosGroupId]);

  // ✅ Grupos destino (excepto el actual y "Elaborados"/"Top 20" — su
  // membresía se calcula sola, nunca se asigna a mano; ofrecerlos acá sería
  // un no-op confuso)
  const gruposDestino = useMemo(
    () => groups.filter((g) => Number(g.id) !== currentGroupId && !esElaboradosGroup(g) && !esTop20Group(g)),
    [groups, currentGroupId]
  );

  const openMover = useCallback(() => {
    handleClose();
    setTimeout(() => setDlgMoverOpen(true), 0);
  }, [handleClose]);

  const closeMover = useCallback(() => setDlgMoverOpen(false), []);

  // ── Mover a otro rubro (categoría del insumo, independiente de la
  // agrupación) ── mismo criterio de resolución de etiqueta que
  // InsumosTable.jsx (getRubroLabel): código → rubrosMap → nombre.
  const rubroActual = useMemo(() => {
    const code = insumo?.rubro_codigo ?? insumo?.rubroCodigo ?? insumo?.codigo_rubro ?? insumo?.rubro ?? null;
    if (code != null && rubrosMap?.get) {
      const info = rubrosMap.get(String(code));
      if (info?.nombre) return info.nombre;
    }
    return insumo?.rubro_nombre || insumo?.rubroNombre || (code != null ? String(code) : '');
  }, [insumo, rubrosMap]);

  const rubrosDisponibles = useMemo(() => {
    if (!rubrosMap?.values) return [];
    return Array.from(rubrosMap.values())
      .map((r) => r.nombre)
      .filter((n) => n && n !== rubroActual)
      .sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }));
  }, [rubrosMap, rubroActual]);

  const openMoverRubro = useCallback(() => {
    setNuevoRubro('');
    handleClose();
    setTimeout(() => setDlgMoverRubroOpen(true), 0);
  }, [handleClose]);

  const ejecutarMoverRubro = useCallback(async () => {
    const destino = nuevoRubro.trim();
    if (!destino || destino === rubroActual) { setDlgMoverRubroOpen(false); return; }
    setMovingRubro(true);
    try {
      await insumoUpdate(insumoId, { rubro: destino }, businessId);
      notify?.(`"${insumoNombre}" movido a "${destino}"`, 'success');
      window.dispatchEvent(new CustomEvent('insumos:updated'));
      await onReloadCatalogo?.();
      setDlgMoverRubroOpen(false);
    } catch (e) {
      console.error('MOVER_RUBRO_INSUMO_ERROR', e);
      notify?.(e.message || 'No se pudo mover el insumo de rubro', 'error');
    } finally {
      setMovingRubro(false);
    }
  }, [nuevoRubro, rubroActual, insumoId, businessId, insumoNombre, notify, onReloadCatalogo]);

  /* ========== MARCAR COMO ELABORADO (abre la receta) ==========
     Un insumo solo debe ser "elaborado" cuando tiene una receta propia cargada —
     antes este botón prendía el flag directo, sin ninguna receta detrás (ej. "azúcar"
     marcado elaborado sin nada cargado). Ahora abre el editor de receta: al guardarla
     con al menos un ingrediente, el backend (saveRecetaElaborado) ya pone es_elaborado
     en true solo. Para desmarcarlo, hay que borrar la receta desde ese mismo editor
     (deleteRecetaElaborado ya revierte el flag) — por eso ya no hay una acción de
     "desmarcar" directa acá. */
  function handleToggleElaborado() {
    handleClose();
    onOpenRecetaElaborado?.(insumo);
  }

  const ejecutarEliminar = useCallback(async () => {
    if (!esManual) return;
    setEliminando(true);
    try {
      await insumoDeleteManual(insumoId, businessId);
      notify?.(`"${insumoNombre}" eliminado`, 'success');
      window.dispatchEvent(new CustomEvent('insumos:updated'));
      await onReloadCatalogo?.();
      setDlgEliminarOpen(false);
    } catch (e) {
      console.error('ELIMINAR_INSUMO_ERROR', e);
      notify?.(e.message || 'No se pudo eliminar el insumo', 'error');
    } finally {
      setEliminando(false);
    }
  }, [esManual, insumoId, businessId, insumoNombre, notify, onReloadCatalogo]);

  /* ========== DISCONTINUAR (Staff, vía propuesta) ========== */
  async function proponerDiscontinuar() {
    handleClose();
    setProponiendo(true);
    try {
      await proponerDiscontinuarInsumo(businessId, insumoId);
      notify?.(`Se propuso discontinuar "${insumoNombre}" — queda pendiente de aprobación.`, 'success');
    } catch (e) {
      console.error('PROPONER_DISCONTINUAR_ERROR', e);
      if (e?.message?.toLowerCase().includes('pendiente')) {
        notify?.('Ya hay una propuesta pendiente para este insumo.', 'info');
      } else {
        notify?.('No se pudo enviar la propuesta', 'error');
      }
    } finally {
      setProponiendo(false);
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
  async function ejecutarMoverA(toId) {
    if (!toId) return;

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

  function mover() { return ejecutarMoverA(Number(destId)); }

  // Si el rubro de este insumo ya vive en una única agrupación real hoy,
  // mover directo ahí sin preguntar; si está repartido entre 2+, o es nuevo
  // (no vive en ninguna), abrir el selector de siempre.
  const openMoverInline = useCallback(() => {
    if (Array.isArray(reparto) && reparto.length === 1) {
      ejecutarMoverA(Number(reparto[0].groupId));
      return;
    }
    openMover();
  }, [reparto, openMover]);

  return (
    <>
      {isTodoView && Array.isArray(reparto) && (
        reparto.length === 1 ? (
          <Button
            size="small" variant="outlined" color="success"
            onClick={() => ejecutarMoverA(Number(reparto[0].groupId))}
            disabled={isMoving}
            sx={{ fontSize: '0.68rem', py: 0.1, px: 0.8, lineHeight: 1.3, whiteSpace: 'nowrap', minWidth: 0 }}
          >
            → Mover a {reparto[0].nombre}
          </Button>
        ) : (
          <Button
            size="small" variant="outlined" color="warning"
            onClick={openMoverInline}
            sx={{ fontSize: '0.68rem', py: 0.1, px: 0.8, lineHeight: 1.3, whiteSpace: 'nowrap', minWidth: 0 }}
          >
            {reparto.length > 1 ? '⚠ Elegir agrupación' : '⚠ Insumo sin agrupar'}
          </Button>
        )
      )}
      <IconButton size="small" onClick={handleOpen} disabled={staffMode && proponiendo}>
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        {staffMode ? (
          /* Staff: por ahora solo puede proponer discontinuar — no se aplica
             directo, admin/owner la revisa desde la Bandeja de aprobaciones. */
          <MenuItem onClick={proponerDiscontinuar} disabled={proponiendo}>
            <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Discontinuar (a revisión)</ListItemText>
          </MenuItem>
        ) : (
          <>
            {/* 1. Editar — mismo modal que la creación, en modo edición */}
            <MenuItem onClick={() => { handleClose(); onOpenEditModal?.(insumo); }}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Editar insumo</ListItemText>
            </MenuItem>
            {/* 1.5. Mover a otro rubro — cambia la categoría del insumo, no su agrupación */}
            <MenuItem onClick={openMoverRubro}>
              <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Mover a otro rubro…</ListItemText>
            </MenuItem>
            {/* 2. Discontinuar / Reactivar */}
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

            {/* 3. Quitar de esta agrupación */}
            <MenuItem onClick={quitarDeActual} disabled={isTodoView}>
              <ListItemIcon>
                <UndoIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                {isTodoView ? 'Ya está en Sin agrupación' : 'Quitar de esta agrupación'}
              </ListItemText>
            </MenuItem>

            {/* 4. Marcar como elaborado (abre la receta) / ver receta si ya lo es */}
            <MenuItem onClick={handleToggleElaborado}>
              <ListItemIcon>
                <BuildCircleIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                {isElaborado ? 'Ver / editar receta' : 'Marcar como elaborado (cargar receta)'}
              </ListItemText>
            </MenuItem>

            {/* 5. Mover a otra agrupación */}
            <MenuItem onClick={openMover}>
              <ListItemIcon>
                <DriveFileMoveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Mover a otra agrupación…</ListItemText>
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

            {/* 5. Eliminar (solo manuales) */}
            {esManual && (
              <MenuItem
                onClick={() => { handleClose(); setTimeout(() => setDlgEliminarOpen(true), 0); }}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Eliminar insumo</ListItemText>
              </MenuItem>
            )}
          </>
        )}
      </Menu>

      {/* Dialog Mover */}
      {/* Dialog Mover a otro rubro */}
      <Dialog open={dlgMoverRubroOpen} onClose={() => !movingRubro && setDlgMoverRubroOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Mover a otro rubro</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={rubrosDisponibles}
            value={nuevoRubro}
            onInputChange={(e, val) => setNuevoRubro(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label="Nuevo rubro"
                helperText={rubroActual ? `Rubro actual: ${rubroActual}` : undefined}
                fullWidth
                sx={{ mt: 1 }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgMoverRubroOpen(false)} disabled={movingRubro}>
            Cancelar
          </Button>
          <Button
            onClick={ejecutarMoverRubro}
            variant="contained"
            disabled={!nuevoRubro.trim() || movingRubro}
          >
            {movingRubro ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Dialog Eliminar */}
      <Dialog open={dlgEliminarOpen} onClose={() => !eliminando && setDlgEliminarOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Eliminar insumo</DialogTitle>
        <DialogContent>
          ¿Seguro que querés eliminar <strong>{insumoNombre}</strong>? Esta acción no se puede deshacer.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgEliminarOpen(false)} disabled={eliminando}>Cancelar</Button>
          <Button onClick={ejecutarEliminar} variant="contained" color="error" disabled={eliminando}>
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

    </>
  );
}

export default React.memo(InsumoAccionesMenu);