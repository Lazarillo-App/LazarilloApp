/* eslint-disable no-unused-vars */
// src/componentes/SucursalSelector.jsx
import React, { useState } from 'react';
import {
  Box, Button, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon      from '@mui/icons-material/Check';
import LayersIcon     from '@mui/icons-material/Layers';
import StoreIcon      from '@mui/icons-material/Store';

import { useBranch } from '@/hooks/useBranch';

export default function SucursalSelector({ variant = 'navbar' }) {
  const {
    branches, activeBranchId, activeBranch, hasBranches,
    setActiveBranch, MAIN_BRANCH_ID,
  } = useBranch() || {};
  const [anchorEl, setAnchorEl] = useState(null);

  // Solo mostrar si hay sucursales reales (branches ya incluye el main virtual)
  if (!hasBranches) return null;

  const open     = Boolean(anchorEl);
  const isNavbar = variant === 'navbar';

  // Texto del botón
  const isAll   = activeBranchId === null;
  const isMain  = activeBranchId === MAIN_BRANCH_ID;
  const label   = isAll ? 'Todas' : (activeBranch?.name || 'Sucursales');
  const color   = (!isAll && activeBranch?.color) ? activeBranch.color : null;

  const handleSelect = (id) => { setActiveBranch(id); setAnchorEl(null); };

  const btnSx = isNavbar ? {
    color: "var(--on-primary)", textTransform: "none", fontWeight: 600,
    fontSize: "0.8rem", border: "1px solid color-mix(in srgb, var(--on-primary) 22%, transparent)",
    px: 1.25, gap: 0.5, minWidth: 0, height: 36,
  } : {
    textTransform: "none", fontWeight: 600, fontSize: "0.82rem",
    border: "1px solid", borderColor: "divider", color: "text.primary",
    bgcolor: "background.paper", px: 1.25, gap: 0.5, minWidth: 0, height: 36,
    "&:hover": { bgcolor: "action.hover" },
  };

  const paperSx = isNavbar
    ? { background: "var(--color-primary)", color: "var(--on-primary)", minWidth: 240 }
    : { minWidth: 240 };

  const dividerSx = isNavbar
    ? { borderColor: "color-mix(in srgb, var(--on-primary) 15%, transparent)", my: 0 }
    : { my: 0 };

  const selectedSx = isNavbar
    ? { "&.Mui-selected": { background: "color-mix(in srgb, var(--on-primary) 10%, transparent)" } }
    : { "&.Mui-selected": { background: "action.selected" } };

  const dotBorder = isNavbar
    ? "1.5px solid color-mix(in srgb, var(--on-primary) 30%, transparent)"
    : "1.5px solid rgba(0,0,0,0.15)";

  return (
    <>
      <Button
        aria-label="Cambiar sucursal"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<ExpandMoreIcon sx={{ fontSize: "16px !important" }} />}
        sx={btnSx}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {isAll
            ? <LayersIcon sx={{ fontSize: 14 }} />
            : color
              ? <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, flexShrink: 0, border: dotBorder }} />
              : <StoreIcon sx={{ fontSize: 14 }} />
          }
          <span>{label}</span>
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ "& .MuiPaper-root": paperSx }}
      >
        {/* Header */}
        <MenuItem disableRipple disableGutters
          sx={{ px: 2, py: 0.75, cursor: "default", "&:hover": { background: "transparent" } }}>
          <Typography variant="caption" sx={{
            fontWeight: 800, fontSize: ".7rem", opacity: .7,
            textTransform: "uppercase", letterSpacing: ".07em",
            color: isNavbar ? "inherit" : "text.secondary",
          }}>
            Sucursales
          </Typography>
        </MenuItem>

        <Divider sx={dividerSx} />

        {/* Sucursales: principal primero, luego las reales */}
        {(branches || []).map((branch) => {
          const isActive = activeBranchId === branch.id;
          const dotColor = branch.color || (branch.isMain ? "var(--color-primary)" : "#1976d2");
          return (
            <MenuItem
              key={branch.id}
              onClick={() => handleSelect(branch.id)}
              selected={isActive}
              sx={{ pl: 2, ...selectedSx }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {branch.isMain
                  ? <StoreIcon sx={{ fontSize: 16, color: isNavbar ? "inherit" : dotColor }} />
                  : <Box sx={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: dotColor, border: dotBorder, flexShrink: 0 }} />
                }
              </ListItemIcon>
              <ListItemText
                primary={<span>{branch.name}{branch.isMain && <span style={{ fontSize: "0.7rem", opacity: 0.6, marginLeft: 6 }}>Principal</span>}</span>}
                secondary={branch.address?.line1 || null}
                secondaryTypographyProps={{
                  sx: { fontSize: "0.72rem", color: isNavbar ? "color-mix(in srgb, var(--on-primary) 60%, transparent)" : "text.secondary" }
                }}
              />
              {isActive && <CheckIcon fontSize="small" sx={{ opacity: 0.8 }} />}
            </MenuItem>
          );
        })}

        <Divider sx={{ ...dividerSx, mt: 0.5 }} />

        {/* Todas — al final como opción adicional */}
        <MenuItem
          onClick={() => handleSelect(null)}
          selected={activeBranchId === null}
          sx={{ pl: 2, opacity: 0.8, ...selectedSx }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <LayersIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Todas las sucursales" />
          {activeBranchId === null && <CheckIcon fontSize="small" sx={{ opacity: 0.8 }} />}
        </MenuItem>
      </Menu>
    </>
  );
}