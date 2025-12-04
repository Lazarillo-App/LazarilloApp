/* eslint-disable no-unused-vars */
// src/componentes/InsumoRubroAccionesMenu.jsx
import React, { useState } from "react";
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import GroupAddIcon from "@mui/icons-material/GroupAdd";

export default function InsumoRubroAccionesMenu({
  rubroLabel,
  onCreateGroupFromRubro, // callback que viene desde InsumosMain a través de InsumosTable
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleCreateGroupFromRubro = () => {
    handleMenuClose();

    if (!onCreateGroupFromRubro) return;

    // 🔹 Ahora sí: le pasamos el label del rubro,
    // para que el modal pueda preseleccionar todos los insumos de este rubro.
    onCreateGroupFromRubro(rubroLabel || "Sin rubro");
  };

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
        <MenuItem onClick={handleCreateGroupFromRubro}>
          <ListItemIcon>
            <GroupAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Crear agrupación con este rubro…"
            secondary={rubroLabel || "Sin rubro"}
          />
        </MenuItem>
      </Menu>
    </>
  );
}
