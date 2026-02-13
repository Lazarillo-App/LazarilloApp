/* eslint-disable no-unused-vars */
// src/componentes/InsumoRubroAccionesMenu.jsx
import React, { useState, useMemo, useCallback } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Divider,
} from "@mui/material";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import UndoIcon from "@mui/icons-material/Undo";
import BlockIcon from "@mui/icons-material/Block";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { emitUiAction } from '@/servicios/uiEvents';
import {
  insumoGroupAddMultipleItems,
  insumoGroupRemoveItem,
} from "../servicios/apiInsumos";

import { addExclusionesInsumos } from "../servicios/apiInsumosTodo";

const norm = (s) => String(s || "").trim().toLowerCase();

const isDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === "discontinuados" || n === "descontinuados";
};

export default function InsumoRubroAccionesMenu({
  rubroLabel,
  insumoIds = [],
  groups = [],
  selectedGroupId = null,
  discontinuadosGroupId = null,
  onRefetch,
  notify,
  onMutateGroups,
  onCreateGroupFromRubro,
  todoGroupId = null,
  isTodoView = false,
  onReloadCatalogo,
  fromSidebar = false,
  businessId,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  const open = Boolean(anchorEl);

  const handleMenuOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleMenuClose = useCallback(() => setAnchorEl(null), []);

  const currentGroupId = selectedGroupId ? Number(selectedGroupId) : null;

  const grupoSeleccionado = useMemo(() => {
    if (!currentGroupId) return null;
    return (groups || []).find((g) => Number(g.id) === currentGroupId) || null;
  }, [groups, currentGroupId]);

  const isInDiscontinuadosView = useMemo(
    () => !!grupoSeleccionado && isDiscontinuadosGroup(grupoSeleccionado),
    [grupoSeleccionado]
  );

  const gruposDestino = useMemo(
    () =>
      (groups || [])
        .filter((g) => g?.id)
        .filter((g) => Number(g.id) !== currentGroupId),
    [groups, currentGroupId]
  );

  const normalizedIds = useMemo(() => {
    return (insumoIds || [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
  }, [insumoIds]);

  const labelCount =
    normalizedIds.length === 1
      ? "1 insumo"
      : `${normalizedIds.length} insumos`;

  /* ========== 🆕 DISCONTINUAR (CON BULK) ========== */

  const handleToggleDiscontinuar = async () => {
    handleMenuClose();

    if (!normalizedIds.length) return;

    const discId = Number(discontinuadosGroupId);
    if (!Number.isFinite(discId) || discId <= 0) {
      notify?.('No existe la agrupación "Discontinuados"', "error");
      return;
    }

    try {
      const wasInDiscontinuados = !!isInDiscontinuadosView;

      if (!wasInDiscontinuados) {
        // ✅ DISCONTINUAR: agregar a Discontinuados
        await insumoGroupAddMultipleItems(discId, normalizedIds);

        emitUiAction({
          businessId,
          kind: "discontinue",
          scope: "insumo",
          title: `⛔ Rubro "${rubroLabel || 'Sin rubro'}" discontinuado`,
          message: `${labelCount} movido(s) a Discontinuados.`,
          createdAt: new Date().toISOString(),
          payload: {
            ids: normalizedIds,
            undo: {
              payload: {
                prev: {
                  wasInDiscontinuados: false,
                  discontinuadosGroupId: discId,
                  fromGroupId: currentGroupId ?? null,
                },
              },
            },
          },
        });

        console.log(`✅ Rubro discontinuado (${labelCount})`);
      } else {
        // ✅ REACTIVAR: quitar de Discontinuados
        const results = await Promise.allSettled(
          normalizedIds.map((id) => insumoGroupRemoveItem(discId, id))
        );

        const exitosos = results.filter((r) => r.status === "fulfilled").length;

        emitUiAction({
          businessId,
          kind: "discontinue",
          scope: "insumo",
          title: `✅ Rubro "${rubroLabel || 'Sin rubro'}" reactivado`,
          message: `${exitosos}/${normalizedIds.length} reactivado(s).`,
          createdAt: new Date().toISOString(),
          payload: {
            ids: normalizedIds,
            undo: {
              payload: {
                prev: {
                  wasInDiscontinuados: true,
                  discontinuadosGroupId: discId,
                  fromGroupId: currentGroupId ?? null,
                },
              },
            },
          },
        });

        console.log(`✅ Rubro reactivado (${labelCount})`);
      }

      // ✅ Refrescar SIN cambiar vista
      await onReloadCatalogo?.();
      await onRefetch?.();
    } catch (e) {
      console.error("DISCONTINUAR_RUBRO_ERROR", e);
      notify?.("Error al cambiar estado", "error");
    }
  };

  /* ========== 🆕 MOVER (CON BULK) ========== */
  const openMover = useCallback(() => {
    handleMenuClose();
    setTimeout(() => setDlgMoverOpen(true), 0);
  }, [handleMenuClose]);

  const closeMover = useCallback(() => {
    setDlgMoverOpen(false);
    setDestId("");
  }, []);

  const handleMover = async () => {
    if (!normalizedIds.length || !destId) return;

    const toId = Number(destId);

    if (currentGroupId && currentGroupId === toId) {
      notify?.("Ya está en esa agrupación", "info");
      closeMover();
      return;
    }

    setIsMoving(true);
    try {
      console.log(`🔄 [Mover] ${normalizedIds.length} insumos → grupo ${toId}`);

      // 1️⃣ Agregar a nuevo grupo en BULK
      await insumoGroupAddMultipleItems(toId, normalizedIds);

      // 2️⃣ Quitar de grupo actual (si no es TODO)
      if (currentGroupId && currentGroupId !== todoGroupId) {
        for (const id of normalizedIds) {
          try {
            await insumoGroupRemoveItem(currentGroupId, id);
          } catch (err) {
            console.warn(`No se pudo quitar ${id} de grupo ${currentGroupId}`);
          }
        }
      }

      notify?.(`Rubro movido (${labelCount})`, "success");
      await onReloadCatalogo?.();
      await onRefetch?.();
    } catch (e) {
      console.error("MOVER_RUBRO_INSUMOS_ERROR", e);
      notify?.("No se pudo mover el rubro", "error");
    } finally {
      setIsMoving(false);
      closeMover();
    }
  };

  /* ========== QUITAR DE AGRUPACIÓN ACTUAL ========== */
  const handleQuitarDeActual = async () => {
    handleMenuClose();

    if (!currentGroupId || !normalizedIds.length) return;

    try {
      for (const id of normalizedIds) {
        try {
          await insumoGroupRemoveItem(currentGroupId, id);
        } catch {
          console.warn(`No se pudo quitar ${id}`);
        }
      }

      notify?.(`Quitados ${labelCount} de ${grupoSeleccionado?.nombre}`, "success");
      await onReloadCatalogo?.();
      await onRefetch?.();
    } catch (e) {
      console.error("QUITAR_RUBRO_INSUMOS_ERROR", e);
      notify?.("No se pudo quitar el rubro", "error");
    }
  };

  /* ========== 🆕 QUITAR DEL TODO ========== */
  const handleQuitarDelTodo = async () => {
    handleMenuClose();

    if (!todoGroupId || !normalizedIds.length) {
      notify?.("No se puede quitar del TODO", "error");
      return;
    }

    try {
      const exclusions = normalizedIds.map((id) => ({
        scope: "insumo",
        ref_id: id,
      }));

      await addExclusionesInsumos(todoGroupId, exclusions);

      notify?.(`Rubro quitado de Sin agrupación (${labelCount})`, "success");
      await onReloadCatalogo?.();
      await onRefetch?.();
    } catch (e) {
      console.error("QUITAR_RUBRO_DEL_TODO_ERROR", e);
      notify?.("Error al quitar rubro del TODO", "error");
    }
  };

  /* ========== CREAR AGRUPACIÓN DESDE RUBRO ========== */
  const handleCreateGroupFromRubro = () => {
    handleMenuClose();
    if (!onCreateGroupFromRubro) return;
    onCreateGroupFromRubro(rubroLabel || "Sin rubro");
  };

  /* ========== RENDER ========== */
  return (
    <>
      <IconButton
        size="small"
        onClick={handleMenuOpen}
        title={`Acciones para el rubro "${rubroLabel || "Sin rubro"}"`}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {fromSidebar ? (
          // ✅ SIDEBAR: Solo "Mover a..."
          <MenuItem onClick={openMover}>
            <ListItemIcon>
              <DriveFileMoveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Mover a…" />
          </MenuItem>
        ) : (
          // ✅ TABLE: Menú completo como ARRAY con keys
          [
            // 1️⃣ Discontinuar / Reactivar
            <MenuItem key="discontinuar" onClick={handleToggleDiscontinuar}>
              <ListItemIcon>
                {isInDiscontinuadosView ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <BlockIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  isInDiscontinuadosView
                    ? "Reactivar (quitar de Discontinuados)"
                    : "Discontinuar"
                }
              />
            </MenuItem>,

            // 2️⃣ Quitar de esta agrupación
            <MenuItem
              key="quitar"
              onClick={handleQuitarDeActual}
              disabled={isTodoView} // ✅ Deshabilitar si está en TODO
            >
              <ListItemIcon>
                <UndoIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  isTodoView
                    ? "Ya está en Sin agrupación"
                    : "Quitar de esta agrupación"
                }
              />
            </MenuItem>,

            // Divider
            <Divider key="divider" />,

            // 3️⃣ Mover a…
            <MenuItem key="mover" onClick={openMover}>
              <ListItemIcon>
                <DriveFileMoveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Mover a…" />
            </MenuItem>,

            // 4️⃣ Crear agrupación
            <MenuItem key="crear" onClick={handleCreateGroupFromRubro}>
              <ListItemIcon>
                <GroupAddIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Crear agrupación con este rubro…"
                secondary={rubroLabel || "Sin rubro"}
              />
            </MenuItem>,
          ].filter(Boolean)
        )}
      </Menu>
      {/* ========== Dialog: Mover a… ========== */}
      <Dialog open={dlgMoverOpen} onClose={closeMover} keepMounted>
        <DialogTitle>Mover {labelCount} a…</DialogTitle>
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
              Seleccionar agrupación…
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
            onClick={handleMover}
            variant="contained"
            disabled={!destId || isMoving}
          >
            {isMoving ? "Moviendo…" : "Mover"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}