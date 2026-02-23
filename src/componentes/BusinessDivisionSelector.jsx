import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Collapse,
  IconButton,
} from '@mui/material';

import BusinessIcon from '@mui/icons-material/Business';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckIcon from '@mui/icons-material/Check';
import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import { TextField } from '@mui/material';

import { useBusiness } from '@/context/BusinessContext';
import { BusinessesAPI } from '@/servicios/apiBusinesses';

const API_BASE =
  import.meta.env.VITE_ASSETS_BASE_URL || import.meta.env.VITE_API_BASE_URL || "https://lazarilloapp-backend.onrender.com";

const toAbsolute = (u) => {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${API_BASE}${raw}`;
  return `${API_BASE}/${raw}`;
};

const getBranding = (biz) => biz?.branding || biz?.props?.branding || {};
const getBizLogoUrl = (biz) =>
  toAbsolute(
    getBranding(biz)?.logo_url ||
    biz?.photo_url ||
    getBranding(biz)?.cover_url ||
    biz?.image_url ||
    ""
  );

export default function BusinessDivisionSelector() {
  const biz = useBusiness() || {};

  const {
    activeBusinessId,
    active,
    selectBusiness,
    divisions = [],
    divisionsLoading: loadingDivisions,
    activeDivisionId,
    activeDivision,
    selectDivision,
  } = biz;

  const [anchorEl, setAnchorEl] = useState(null);
  const [bizList, setBizList] = useState([]);
  const [loadingBiz, setLoadingBiz] = useState(false);
  const [expandedBizId, setExpandedBizId] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [editingBizId, setEditingBizId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const open = Boolean(anchorEl);

  const businessName = active?.name || 'Local';
  const divisionName = activeDivision?.name || 'Principal';
  const logoUrl = getBizLogoUrl(active);

  const activeDivisionIdNorm = activeDivisionId ?? null;
  const isMainDivisionNorm = activeDivisionIdNorm === null;
  const showDivisionLabel = !isMainDivisionNorm && activeDivision;

  const handleOpen = async (e) => {
    setAnchorEl(e.currentTarget);
    try {
      setLoadingBiz(true);
      const items = await BusinessesAPI.listMine();
      setBizList(items || []);
      if (activeBusinessId) setExpandedBizId(String(activeBusinessId));
    } finally {
      setLoadingBiz(false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setExpandedBizId(null);
  };

  const handleToggleBusiness = (bizId) => {
    setExpandedBizId((prev) => (prev === String(bizId) ? null : String(bizId)));
  };

  // ✅ Click en el negocio: lo activa y lo deja en Principal
  const handleSelectBusinessOnly = async (bizId) => {
    if (switching) return;
    setSwitching(true);
    try {
      if (String(bizId) === String(activeBusinessId)) {
        // si ya está activo, solo volver a Principal
        await selectDivision?.(null);
        return;
      }

      await selectBusiness?.(bizId);
      await selectDivision?.(null);
      setExpandedBizId(String(bizId));
    } finally {
      setSwitching(false);
    }
  };

  const handleSelectDivision = async (divisionId) => {
    await selectDivision?.(divisionId ?? null);
    handleClose();
  };

  const startEdit = (e, b) => {
    e.stopPropagation();
    setEditingBizId(String(b.id));
    setEditingName(b.name || '');
  };

  const cancelEdit = (e) => {
    e?.stopPropagation();
    setEditingBizId(null);
    setEditingName('');
  };

  const saveEdit = async (e, bizId) => {
    e?.stopPropagation();
    const trimmed = editingName.trim();
    if (!trimmed) return cancelEdit();
    setSavingName(true);
    try {
      await BusinessesAPI.update(bizId, { name: trimmed });
      // Actualizar la lista local y el negocio activo si corresponde
      setBizList((prev) =>
        prev.map((b) => String(b.id) === String(bizId) ? { ...b, name: trimmed } : b)
      );
      // Emitir evento para que Navbar y otros componentes actualicen el nombre
      window.dispatchEvent(new CustomEvent('business:switched', {
        detail: { bizId: String(activeBusinessId) === String(bizId) ? bizId : null }
      }));
      if (String(activeBusinessId) === String(bizId)) {
        // Refrescar el negocio activo para que Navbar actualice el nombre
        await selectBusiness?.(bizId);
      }
    } catch (e) {
      console.error('Error renombrando negocio:', e);
    } finally {
      setSavingName(false);
      setEditingBizId(null);
      setEditingName('');
    }
  };

  if (!activeBusinessId) return null;

  return (
    <>
      <Button
        aria-label="Cambiar negocio o división"
        onClick={handleOpen}
        sx={{
          color: 'var(--on-primary)',
          textTransform: 'none',
          fontWeight: 700,
          border: '1px solid color-mix(in srgb, var(--on-primary) 22%, transparent)',
          px: 1.25,
          gap: 0.5,
          '&:focus-visible': {
            outline: '2px solid color-mix(in srgb, var(--on-primary) 65%, transparent)',
            outlineOffset: 2,
          },
        }}
        endIcon={<ExpandMoreIcon />}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {logoUrl ? (
            <Box
              component="img"
              src={logoUrl}
              alt={businessName}
              sx={{
                width: 22,
                height: 22,
                objectFit: 'contain',
                borderRadius: '6px',
                p: 0.5,
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid',
                borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
                boxShadow: '0 0 0 1px color-mix(in srgb, var(--on-primary) 10%, transparent) inset',
              }}
            />
          ) : (
            <span
              style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: 22,
                height: 22,
                borderRadius: 6,
                border: '1px solid color-mix(in srgb, var(--on-primary) 25%, transparent)',
                background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)',
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--on-primary)',
              }}
              aria-hidden
            >
              {String(businessName || '#').slice(0, 1).toUpperCase()}
            </span>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
            <span style={{ fontSize: '0.875rem' }}>{businessName}</span>
            {showDivisionLabel && (
              <span style={{ fontSize: '.9rem', opacity: 0.75, fontWeight: 500 }}>
                ✅ {divisionName}
              </span>
            )}
          </Box>
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{
          '& .MuiPaper-root': {
            background: 'var(--color-primary)',
            color: 'var(--on-primary)',
            minWidth: 300,
            maxHeight: 500,
            overflowY: 'auto',
          },
        }}
        MenuListProps={{ 'aria-label': 'Selección de negocio y división', dense: true }}
      >
        <MenuItem disableRipple disableGutters>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" sx={{ opacity: 0.8, color: 'inherit' }}>
              Negocios 
            </Typography>
          </Box>
        </MenuItem>

        {loadingBiz && (
          <MenuItem disabled>
            <ListItemIcon sx={{ color: 'inherit', minWidth: 28 }}>
              <CircularProgress size={16} sx={{ color: 'var(--on-primary)' }} />
            </ListItemIcon>
            <ListItemText primary="Cargando negocios…" />
          </MenuItem>
        )}

        {!loadingBiz &&
          bizList.map((b, bizIndex) => {
            const isActiveBiz = String(activeBusinessId) === String(b.id);
            const isExpanded = String(expandedBizId) === String(b.id);
            const bLogoUrl = getBizLogoUrl(b);

            const bizDivisions = isActiveBiz ? divisions : [];
            const otherDivs = bizDivisions.filter((d) => !d.is_main);

            return (
              <Box key={b.id}>
                {bizIndex > 0 && (
                  <Divider sx={{ my: 0.5, borderColor: 'color-mix(in srgb, var(--on-primary) 15%, transparent)' }} />
                )}

                <MenuItem
                  onClick={() => handleSelectBusinessOnly(b.id)}
                  selected={isActiveBiz}
                  sx={{
                    fontWeight: isActiveBiz ? 700 : 500,
                    '&.Mui-selected': {
                      background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {bLogoUrl ? (
                      <Box
                        component="img"
                        src={bLogoUrl}
                        alt={b.name}
                        sx={{
                          width: 22,
                          height: 22,
                          objectFit: 'contain',
                          borderRadius: '6px',
                          p: 0.5,
                          background: 'rgba(255,255,255,0.92)',
                          border: '1px solid',
                          borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
                          boxShadow: '0 0 0 1px color-mix(in srgb, var(--on-primary) 10%, transparent) inset',
                        }}
                      />
                    ) : (
                      <BusinessIcon fontSize="small" />
                    )}
                  </ListItemIcon>

                  {editingBizId === String(b.id) ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TextField
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(e, b.id);
                          if (e.key === 'Escape') cancelEdit(e);
                        }}
                        autoFocus
                        size="small"
                        variant="standard"
                        sx={{
                          flex: 1,
                          '& input': { color: 'var(--on-primary)', fontSize: '0.875rem' },
                          '& .MuiInput-underline:before': { borderColor: 'color-mix(in srgb, var(--on-primary) 40%, transparent)' },
                          '& .MuiInput-underline:after': { borderColor: 'var(--on-primary)' },
                        }}
                      />
                      <IconButton size="small" onClick={(e) => saveEdit(e, b.id)} disabled={savingName}
                        sx={{ color: 'inherit' }} aria-label="Confirmar nombre">
                        {savingName ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <CheckCircleOutlineIcon fontSize="small" />}
                      </IconButton>
                      <IconButton size="small" onClick={cancelEdit} sx={{ color: 'inherit' }} aria-label="Cancelar">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <>
                      <ListItemText
                        primary={b.name}
                      />
                      {/* Lápiz de edición */}
                      <IconButton
                        size="small"
                        onClick={(e) => startEdit(e, b)}
                        sx={{ color: 'inherit', opacity: 0.5, '&:hover': { opacity: 1 } }}
                        aria-label={`Editar nombre de ${b.name}`}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      {/* Flecha divisiones */}
                      {isActiveBiz && bizDivisions.length > 1 && (
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleToggleBusiness(b.id); }}
                          sx={{ color: 'inherit' }}
                          aria-label={isExpanded ? 'Contraer divisiones' : 'Expandir divisiones'}
                        >
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      )}
                    </>
                  )}
                </MenuItem>

                {isActiveBiz && (
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ pl: 2, bgcolor: 'color-mix(in srgb, var(--on-primary) 5%, transparent)' }}>
                      {loadingDivisions && (
                        <MenuItem disabled sx={{ pl: 4 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <CircularProgress size={14} sx={{ color: 'var(--on-primary)' }} />
                          </ListItemIcon>
                          <ListItemText primary="Cargando divisiones…" />
                        </MenuItem>
                      )}



                      {!loadingDivisions &&
                        otherDivs.map((div) => {
                          const isActiveDiv = String(activeDivisionIdNorm) === String(div.id);
                          const groupCount = div.assigned_groups_count || 0;

                          return (
                            <MenuItem
                              key={div.id}
                              onClick={() => handleSelectDivision(div.id)}
                              selected={isActiveDiv}
                              sx={{
                                pl: 4,
                                '&.Mui-selected': {
                                  background: 'color-mix(in srgb, var(--on-primary) 15%, transparent)',
                                },
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                                <FolderIcon fontSize="small" />
                              </ListItemIcon>

                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <span>{div.name}</span>
                                    {groupCount > 0 && (
                                      <Chip
                                        label={groupCount}
                                        size="small"
                                        sx={{
                                          height: 18,
                                          fontSize: '0.65rem',
                                          minWidth: 24,
                                          bgcolor: 'color-mix(in srgb, var(--on-primary) 12%, transparent)',
                                          color: 'inherit',
                                        }}
                                      />
                                    )}
                                  </Box>
                                }
                              />

                              {isActiveDiv && <CheckIcon fontSize="small" sx={{ opacity: 0.8 }} />}
                            </MenuItem>
                          );
                        })}

                      {!loadingDivisions && bizDivisions.length === 0 && (
                        <MenuItem disabled sx={{ pl: 4 }}>
                          <ListItemText
                            primary="Sin divisiones"
                            primaryTypographyProps={{ sx: { fontSize: '0.85rem', opacity: 0.7 } }}
                          />
                        </MenuItem>
                      )}
                    </Box>
                  </Collapse>
                )}
              </Box>
            );
          })}

        {!loadingBiz && bizList.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary="No tenés negocios todavía" />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}