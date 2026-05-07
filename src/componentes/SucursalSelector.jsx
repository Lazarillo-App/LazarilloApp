/* eslint-disable no-unused-vars */
// src/componentes/SucursalSelector.jsx
import React, { useState } from 'react';
import {
  Box, Button, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Typography, IconButton, Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon      from '@mui/icons-material/Check';
import LayersIcon     from '@mui/icons-material/Layers';
import StoreIcon      from '@mui/icons-material/Store';
import AddIcon        from '@mui/icons-material/Add';
import EditIcon       from '@mui/icons-material/Edit';

import { useBranch }    from '@/hooks/useBranch';
import { useBusiness }  from '@/context/BusinessContext';
import { BranchesAPI }  from '@/servicios/apiBranches';
import BranchFormModal  from './BranchFormModal';

/**
 * SucursalSelector
 *
 * Siempre visible. Estructura del menú:
 *   1. "Todas"                ← primera opción (default)
 *   2. "Agregar nueva sucursal" ← segunda opción (abre modal)
 *   ─────────────────────────
 *   3..N  Sucursales reales (principal + ramas)  con ícono editar
 */
export default function SucursalSelector({ variant = 'navbar', onAddBranch }) {
  const {
    branches, activeBranchId, activeBranch,
    setActiveBranch, MAIN_BRANCH_ID, loadBranches,
  } = useBranch() || {};

  const { activeBusinessId } = useBusiness() || {};
  const [anchorEl,   setAnchorEl]   = useState(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editBranch, setEditBranch] = useState(null); // null = crear, objeto = editar

  const open     = Boolean(anchorEl);
  const isNavbar = variant === 'navbar';

  const isAll  = activeBranchId === null;
  const label  = isAll ? 'Todas' : (activeBranch?.name || 'Sucursal');
  const color  = (!isAll && activeBranch?.color) ? activeBranch.color : null;

  const handleSelect = (id) => { setActiveBranch(id); setAnchorEl(null); };

  const openCreate = (e) => {
    e?.stopPropagation();
    setAnchorEl(null);
    // Diferir apertura del modal para que el Menu termine de cerrar
    // y evitar el warning aria-hidden sobre elementos con foco
    setTimeout(() => { setEditBranch(null); setModalOpen(true); }, 50);
  };

  const openEdit = (e, branch) => {
    e.stopPropagation();
    setAnchorEl(null);
    setTimeout(() => { setEditBranch(branch); setModalOpen(true); }, 50);
  };

  const handleSaved = () => loadBranches?.(activeBusinessId);

  // ── Estilos según variante ──────────────────────────────────────────────
  const btnSx = isNavbar ? {
    color: 'var(--on-primary)', textTransform: 'none', fontWeight: 600,
    fontSize: '0.8rem', border: '1px solid color-mix(in srgb, var(--on-primary) 22%, transparent)',
    px: 1.25, gap: 0.5, minWidth: 0, height: 36,
  } : {
    textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
    border: '1px solid', borderColor: 'divider', color: 'text.primary',
    bgcolor: 'background.paper', px: 1.25, gap: 0.5, minWidth: 0, height: 36,
    '&:hover': { bgcolor: 'action.hover' },
  };

  const paperSx = isNavbar
    ? { background: 'var(--color-primary)', color: 'var(--on-primary)', minWidth: 240 }
    : { minWidth: 240 };

  const dividerSx = isNavbar
    ? { borderColor: 'color-mix(in srgb, var(--on-primary) 15%, transparent)', my: 0 }
    : { my: 0 };

  const selectedSx = isNavbar
    ? { '&.Mui-selected': { background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)' } }
    : { '&.Mui-selected': { background: 'action.selected' } };

  const dotBorder = isNavbar
    ? '1.5px solid color-mix(in srgb, var(--on-primary) 30%, transparent)'
    : '1.5px solid rgba(0,0,0,0.15)';

  const addItemSx = isNavbar ? {
    pl: 2, opacity: 0.85,
    '&:hover': { background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)', opacity: 1 },
  } : { pl: 2, opacity: 0.8, '&:hover': { opacity: 1 } };

  const editIconSx = isNavbar
    ? { fontSize: 15, color: 'inherit', opacity: 0.6, '&:hover': { opacity: 1 } }
    : { fontSize: 15, color: 'text.secondary', '&:hover': { color: 'primary.main' } };

  const branchList = branches || [];

  return (
    <>
      <Button
        aria-label="Cambiar sucursal"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<ExpandMoreIcon sx={{ fontSize: '16px !important' }} />}
        sx={btnSx}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {isAll
            ? <LayersIcon sx={{ fontSize: 14 }} />
            : color
              ? <Box sx={{
                  width: 10, height: 10, borderRadius: '50%',
                  backgroundColor: color, flexShrink: 0, border: dotBorder,
                }} />
              : <StoreIcon sx={{ fontSize: 14 }} />
          }
          <span>{label}</span>
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ '& .MuiPaper-root': paperSx }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <MenuItem disableRipple disableGutters sx={{
          px: 2, py: 0.75, cursor: 'default', '&:hover': { background: 'transparent' },
        }}>
          <Typography variant="caption" sx={{
            fontWeight: 800, fontSize: '.7rem', opacity: .7,
            textTransform: 'uppercase', letterSpacing: '.07em',
            color: isNavbar ? 'inherit' : 'text.secondary',
          }}>
            Sucursales
          </Typography>
        </MenuItem>

        <Divider sx={dividerSx} />

        {/* ── 1. Todas (siempre primera) ───────────────────────────── */}
        <MenuItem
          onClick={() => handleSelect(null)}
          selected={activeBranchId === null}
          sx={{ pl: 2, ...selectedSx }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
            <LayersIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Todas" />
          {activeBranchId === null && <CheckIcon fontSize="small" sx={{ opacity: 0.8 }} />}
        </MenuItem>

        {/* ── 2. Agregar nueva sucursal (siempre segunda) ─────────── */}
        <MenuItem onClick={openCreate} sx={addItemSx}>
          <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
            <AddIcon sx={{ fontSize: 16, color: 'inherit' }} />
          </ListItemIcon>
          <ListItemText
            primary="Agregar nueva sucursal"
            primaryTypographyProps={{
              sx: {
                fontSize: '0.85rem',
                fontStyle: 'italic',
                color: isNavbar ? 'inherit' : 'text.secondary',
              },
            }}
          />
        </MenuItem>

        {/* ── Separador antes de la lista de sucursales ────────────── */}
        {branchList.length > 0 && <Divider sx={{ ...dividerSx, mt: 0.5 }} />}

        {/* ── 3..N  Sucursales: principal + ramas reales ───────────── */}
        {branchList.map((branch) => {
          const isActive  = String(activeBranchId) === String(branch.id);
          const dotColor  = branch.color || (branch.isMain ? 'var(--color-primary)' : '#1976d2');

          return (
            <MenuItem
              key={branch.id}
              onClick={() => handleSelect(branch.id)}
              selected={isActive}
              sx={{ pl: 2, pr: 1, ...selectedSx, display: 'flex', alignItems: 'center' }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {branch.isMain
                  ? <StoreIcon sx={{ fontSize: 16, color: isNavbar ? 'inherit' : dotColor }} />
                  : <Box sx={{
                      width: 14, height: 14, borderRadius: '50%',
                      backgroundColor: dotColor, border: dotBorder, flexShrink: 0,
                    }} />
                }
              </ListItemIcon>
              <ListItemText
                primary={
                  <span>
                    {branch.name}
                    {branch.isMain && (
                      <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: 6 }}>
                        Principal
                      </span>
                    )}
                  </span>
                }
                secondary={branch.address?.line1 || null}
                secondaryTypographyProps={{
                  sx: {
                    fontSize: '0.72rem',
                    color: isNavbar
                      ? 'color-mix(in srgb, var(--on-primary) 60%, transparent)'
                      : 'text.secondary',
                  },
                }}
              />
              {isActive && <CheckIcon fontSize="small" sx={{ opacity: 0.8, mr: 0.5 }} />}
              {/* Ícono editar — stopPropagation para no seleccionar */}
              <Tooltip title={`Editar ${branch.isMain ? 'sucursal principal' : branch.name}`}>
                <IconButton size="small" onClick={(e) => openEdit(e, branch)} sx={{ p: 0.5 }}>
                  <EditIcon sx={editIconSx} />
                </IconButton>
              </Tooltip>
            </MenuItem>
          );
        })}
      </Menu>

      {/* Modal crear / editar sucursal */}
      <BranchFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditBranch(null); }}
        onSaved={handleSaved}
        bizId={activeBusinessId}
        branch={editBranch}
      />
    </>
  );
}