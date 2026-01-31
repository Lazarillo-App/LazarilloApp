/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import React, { useMemo, useState, useCallback } from "react";
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField
} from "@mui/material";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import UndoIcon from "@mui/icons-material/Undo";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import BlockIcon from "@mui/icons-material/Block";

import {
  insumoGroupAddItem,
  insumoGroupRemoveItem,
  insumoGroupsList,
  insumoGroupCreate,
} from "../servicios/apiInsumos";

import {
  ensureTodoInsumos,
  addExclusionesInsumos,
} from "../servicios/apiInsumosTodo";

const norm = (s) => String(s ?? "").trim().toLowerCase();
const isDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === "discontinuados" || n === "descontinuados";
};

export default function InsumosRowActions({
  row,
  groups = [],
  businessId,
  onRefetch,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const [dlgMoverOpen, setDlgMoverOpen] = useState(false);
  const [destId, setDestId] = useState("");
  const [busy, setBusy] = useState(false);

  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const gruposDestino = useMemo(
    () => (groups || []).filter(g => g?.id),
    [groups]
  );

  // helpers
  const insumoId = Number(row?.id);
  const insumoLabel = row?.nombreMostrar || row?.nombre || `#${insumoId}`;

  async function openMover() {
    handleClose();
    setDlgMoverOpen(true);
  }

  async function mover() {
    const toId = Number(destId);
    if (!insumoId || !toId) return;

    setBusy(true);
    try {
      await insumoGroupAddItem(toId, insumoId);
      onRefetch?.();
    } catch (e) {
      console.error("MOVER_INSUMO_ERROR", e);
    } finally {
      setBusy(false);
      setDlgMoverOpen(false);
    }
  }

  async function quitarDeTodo() {
    // “TODO” para insumos se maneja por exclusiones del TODO
    setBusy(true);
    try {
      const todo = await ensureTodoInsumos();
      const todoId = Number(todo?.id);
      if (!todoId) return;

      await addExclusionesInsumos(todoId, [{ scope: "insumo", ref_id: insumoId }]);
      onRefetch?.();
    } catch (e) {
      console.error("QUITAR_TODO_INSUMO_ERROR", e);
    } finally {
      setBusy(false);
      handleClose();
    }
  }

  async function quitarDeGrupoSeleccionado(groupId) {
    setBusy(true);
    try {
      await insumoGroupRemoveItem(Number(groupId), insumoId);
      onRefetch?.();
    } catch (e) {
      console.error("QUITAR_DE_GRUPO_INSUMO_ERROR", e);
    } finally {
      setBusy(false);
      handleClose();
    }
  }

  async function crearAgrupacionDesdeInsumo() {
    // Crea una agrupación con el nombre del insumo y mete este insumo adentro
    setBusy(true);
    try {
      const created = await insumoGroupCreate({
        nombre: insumoLabel,
        descripcion: `Creada desde insumo ${row?.codigoMostrar || row?.codigo_maxi || ""}`.trim(),
      });

      const newId = Number(created?.data?.id ?? created?.id);
      if (newId) {
        await insumoGroupAddItem(newId, insumoId);
      }

      // refrescar grupos también (por si tu pantalla depende de esa lista)
      try { await insumoGroupsList(businessId); } catch {}
      onRefetch?.();
    } catch (e) {
      console.error("CREAR_AGRUPACION_DESDE_INSUMO_ERROR", e);
    } finally {
      setBusy(false);
      handleClose();
    }
  }

  async function discontinuarToggle() {
    /**
     * OJO:
     * En tu DB `insumos.estado` controla esto.
     * Aquí falta tu endpoint real (ej: PUT /insumos/:id con { estado }).
     * Si ya lo tenés, lo conectamos acá.
     */
    console.warn("TODO: conectar endpoint para toggle estado activo/discontinuado del insumo", row);
    handleClose();
  }

  return (
    <>
      <IconButton size="small" onClick={handleOpen} title="Acciones">
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
        <MenuItem onClick={discontinuarToggle} disabled={busy}>
          <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon>
          <ListItemText>
            {row?.estado === "discontinuado" ? "Reactivar" : "Discontinuar"}
          </ListItemText>
        </MenuItem>

        {/* Quitar de TODO (exclusiones) */}
        <MenuItem onClick={quitarDeTodo} disabled={busy}>
          <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Quitar de “Sin agrupación”</ListItemText>
        </MenuItem>

        <MenuItem onClick={openMover} disabled={busy}>
          <ListItemIcon><DriveFileMoveIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Mover a agrupación…</ListItemText>
        </MenuItem>

        <MenuItem onClick={crearAgrupacionDesdeInsumo} disabled={busy}>
          <ListItemIcon><GroupAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear agrupación con este insumo</ListItemText>
        </MenuItem>

        {/* Si querés permitir quitarlo manualmente de una agrupación específica desde acá:
            podríamos agregar un submenú; por ahora lo dejo simple para evitar ruido. */}
      </Menu>

      <Dialog open={dlgMoverOpen} onClose={() => setDlgMoverOpen(false)} keepMounted>
        <DialogTitle>Mover “{insumoLabel}” a…</DialogTitle>
        <DialogContent>
          <TextField
            select
            SelectProps={{ native: true }}
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            <option value="" disabled>Seleccionar…</option>
            {gruposDestino.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgMoverOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={mover} variant="contained" disabled={!destId || busy}>
            {busy ? "Moviendo…" : "Mover"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
