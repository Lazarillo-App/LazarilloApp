// src/componentes/InsumoAccionesMenu.jsx
/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import UndoIcon from "@mui/icons-material/Undo";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";

export default function InsumoAccionesMenu({
  insumo,

  // 🔧 Acciones básicas (ya no se muestran en el menú, pero las dejamos
  // por si las usás en otro contexto o a futuro)
  onEdit,                       // (insumo) => void  (no usado en el menú)
  onDelete,                     // (insumo) => void  (no usado en el menú)

  // 🔧 Estado de agrupación / discontinuados
  isInDiscontinuados = false,   // bool: está en grupo “Discontinuados” de insumos
  grupoActualNombre = "",       // nombre del grupo actual (si aplica, si no "")

  // 🔧 Callbacks “tipo artículos”
  onToggleDiscontinuado,        // (insumo, nowDiscontinuado: bool) => Promise|void
  onMove,                       // (insumo) => void → abre modal “Mover a…”
  onRemoveFromGroup,            // (insumo) => Promise|void
  onCreateGroupFromInsumo,      // (insumo) => void → abre modal de agrupación grande
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleToggleDiscontinuado = async () => {
    handleMenuClose();
    if (!onToggleDiscontinuado) return;
    try {
      await onToggleDiscontinuado(insumo, !isInDiscontinuados);
    } catch (e) {
      console.error("ERROR_TOGGLE_DISCONTINUADO_INSUMO", e);
    }
  };

  const handleMove = () => {
    handleMenuClose();
    onMove && onMove(insumo);
  };

  const handleRemoveFromGroup = async () => {
    handleMenuClose();
    if (!onRemoveFromGroup) return;
    try {
      await onRemoveFromGroup(insumo);
    } catch (e) {
      console.error("ERROR_REMOVE_INSUMO_FROM_GROUP", e);
    }
  };

  const handleOpenGroupModal = () => {
    handleMenuClose();
    onCreateGroupFromInsumo && onCreateGroupFromInsumo(insumo);
  };

  return (
    <>
      <IconButton size="small" onClick={handleMenuOpen}>
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {/* ─────────── Igual que artículos: discontinuar/reactivar ─────────── */}
        <MenuItem
          onClick={handleToggleDiscontinuado}
          disabled={!onToggleDiscontinuado}
        >
          <ListItemIcon>
            {isInDiscontinuados ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={
              isInDiscontinuados
                ? "Reactivar (quitar de Discontinuados)"
                : "Marcar como discontinuado"
            }
          />
        </MenuItem>

        {/* ─────────── Igual que artículos: mover / quitar del grupo ─────────── */}
        <MenuItem onClick={handleMove} disabled={!onMove}>
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Mover a…" />
        </MenuItem>

        {grupoActualNombre && (
          <MenuItem
            onClick={handleRemoveFromGroup}
            disabled={!onRemoveFromGroup}
          >
            <ListItemIcon>
              <UndoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={`Quitar de ${grupoActualNombre}`} />
          </MenuItem>
        )}

        <Divider />

        {/* ─────────── Igual que artículos: crear agrupación ─────────── */}
        <MenuItem onClick={handleOpenGroupModal}>
          <ListItemIcon>
            <GroupAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Crear agrupación con este insumo…" />
        </MenuItem>
      </Menu>
    </>
  );
}
