/**
 * BusinessDivisionSelector - Selector unificado para navbar
 * Muestra el negocio activo y permite cambiar tanto de negocio como de división
 * 
 * Estructura del menú:
 * ┌─────────────────────────┐
 * │ 🏢 Negocio 1            │ ← Cambiar negocio
 * │   ├─ 🏠 Principal        │ ← División principal
 * │   ├─ 📁 Cafetería       │ ← División 1
 * │   └─ 📁 Delivery        │ ← División 2
 * ├─────────────────────────┤
 * │ 🏢 Negocio 2            │
 * │   └─ 🏠 Principal        │
 * └─────────────────────────┘
 */

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
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckIcon from '@mui/icons-material/Check';
import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/Folder';
import { useBusiness } from '../context/BusinessContext';
import { BusinessesAPI } from '../servicios/apiBusinesses';

const getBranding = (biz) => biz?.branding || biz?.props?.branding || {};
const getBizLogoUrl = (biz) =>
  getBranding(biz)?.logo_url ||
  biz?.photo_url ||
  getBranding(biz)?.cover_url ||
  biz?.image_url || '';

export default function BusinessDivisionSelector() {
  const {
    activeBusinessId,
    activeBusiness,
    selectBusiness,
    divisions = [],
    loadingDivisions,
    activeDivisionId,
    activeDivision,
    selectDivision,
    isMainDivision,
  } = useBusiness() || {};

  const [anchorEl, setAnchorEl] = useState(null);
  const [bizList, setBizList] = useState([]);
  const [loadingBiz, setLoadingBiz] = useState(false);
  const [expandedBizId, setExpandedBizId] = useState(null);

  const open = Boolean(anchorEl);

  // Label principal del botón
  const businessName = activeBusiness?.name || 'Local';
  const divisionName = activeDivision?.name || 'Principal';
  
  // Logo del negocio
  const logoUrl = getBizLogoUrl(activeBusiness);

  // Mostrar división solo si NO es la principal
  const showDivisionLabel = !isMainDivision && activeDivision;

  const handleOpen = async (e) => {
    setAnchorEl(e.currentTarget);
    
    // Cargar lista de negocios
    try {
      setLoadingBiz(true);
      const items = await BusinessesAPI.listMine();
      setBizList(items);
      
      // Auto-expandir el negocio activo
      if (activeBusinessId) {
        setExpandedBizId(String(activeBusinessId));
      }
    } finally {
      setLoadingBiz(false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setExpandedBizId(null);
  };

  const handleToggleBusiness = (bizId) => {
    setExpandedBizId(prev => prev === String(bizId) ? null : String(bizId));
  };

  const handleSelectBusiness = async (bizId) => {
    if (String(bizId) === String(activeBusinessId)) {
      // Si ya está activo, solo expandir/contraer
      handleToggleBusiness(bizId);
    } else {
      // Cambiar de negocio
      await selectBusiness(bizId);
      setExpandedBizId(String(bizId));
    }
  };

  const handleSelectDivision = async (divisionId) => {
    await selectDivision(divisionId);
    handleClose();
  };

  if (!activeBusinessId) {
    return null;
  }

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
          }
        }}
        endIcon={<ExpandMoreIcon />}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Logo del negocio */}
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
                boxShadow: '0 0 0 1px color-mix(in srgb, var(--on-primary) 10%, transparent) inset'
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
                color: 'var(--on-primary)'
              }}
              aria-hidden
            >
              {String(businessName || '#').slice(0, 1).toUpperCase()}
            </span>
          )}
          
          {/* Nombre del negocio y división */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
            <span style={{ fontSize: '0.875rem' }}>{businessName}</span>
            {showDivisionLabel && (
              <span style={{ 
                fontSize: '0.7rem', 
                opacity: 0.75,
                fontWeight: 500,
              }}>
                📁 {divisionName}
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
            overflowY: 'auto'
          }
        }}
        MenuListProps={{ 'aria-label': 'Selección de negocio y división', dense: true }}
      >
        {/* Header */}
        <MenuItem disableRipple disableGutters>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" sx={{ opacity: 0.8, color: 'inherit' }}>
              Negocios y vistas
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

        {/* Lista de negocios con divisiones anidadas */}
        {!loadingBiz && bizList.map((biz, bizIndex) => {
          const isActiveBiz = String(activeBusinessId) === String(biz.id);
          const isExpanded = String(expandedBizId) === String(biz.id);
          const bizLogoUrl = getBizLogoUrl(biz);
          
          // Divisiones de este negocio (solo si está activo y expandido)
          const bizDivisions = isActiveBiz ? divisions : [];
          const mainDiv = bizDivisions.find(d => d.is_main);
          const otherDivs = bizDivisions.filter(d => !d.is_main);

          return (
            <Box key={biz.id}>
              {/* Separador entre negocios */}
              {bizIndex > 0 && (
                <Divider sx={{ my: 0.5, borderColor: 'color-mix(in srgb, var(--on-primary) 15%, transparent)' }} />
              )}

              {/* Negocio principal */}
              <MenuItem
                onClick={() => handleSelectBusiness(biz.id)}
                selected={isActiveBiz}
                sx={{
                  fontWeight: isActiveBiz ? 700 : 500,
                  '&.Mui-selected': {
                    background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)'
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {bizLogoUrl ? (
                    <Box
                      component="img"
                      src={bizLogoUrl}
                      alt={biz.name}
                      sx={{
                        width: 22, 
                        height: 22, 
                        objectFit: 'contain',
                        borderRadius: '6px', 
                        p: 0.5,
                        background: 'rgba(255,255,255,0.92)',
                        border: '1px solid',
                        borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
                        boxShadow: '0 0 0 1px color-mix(in srgb, var(--on-primary) 10%, transparent) inset'
                      }}
                    />
                  ) : (
                    <BusinessIcon fontSize="small" />
                  )}
                </ListItemIcon>
                
                <ListItemText
                  primary={biz.name}
                  secondary={biz.slug}
                  secondaryTypographyProps={{ sx: { opacity: .6, fontSize: '0.75rem' } }}
                />
                
                {/* Indicador de expansión */}
                {isActiveBiz && bizDivisions.length > 1 && (
                  isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />
                )}
              </MenuItem>

              {/* Divisiones anidadas (solo si el negocio está activo y expandido) */}
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

                    {/* Principal */}
                    {!loadingDivisions && mainDiv && (
                      <MenuItem
                        onClick={() => handleSelectDivision(mainDiv.id)}
                        selected={String(activeDivisionId) === String(mainDiv.id)}
                        sx={{
                          pl: 4,
                          '&.Mui-selected': {
                            background: 'color-mix(in srgb, var(--on-primary) 15%, transparent)'
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                          <HomeIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <span>{mainDiv.name || 'Principal'}</span>
                              <Chip
                                label="Todo"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  bgcolor: 'color-mix(in srgb, var(--on-primary) 12%, transparent)',
                                  color: 'inherit',
                                }}
                              />
                            </Box>
                          }
                        />
                        {String(activeDivisionId) === String(mainDiv.id) && (
                          <CheckIcon fontSize="small" sx={{ opacity: .8 }} />
                        )}
                      </MenuItem>
                    )}

                    {/* Otras divisiones */}
                    {!loadingDivisions && otherDivs.map(div => {
                      const isActiveDivision = String(activeDivisionId) === String(div.id);
                      const groupCount = div.assigned_groups_count || 0;

                      return (
                        <MenuItem
                          key={div.id}
                          onClick={() => handleSelectDivision(div.id)}
                          selected={isActiveDivision}
                          sx={{
                            pl: 4,
                            '&.Mui-selected': {
                              background: 'color-mix(in srgb, var(--on-primary) 15%, transparent)'
                            }
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
                          {isActiveDivision && (
                            <CheckIcon fontSize="small" sx={{ opacity: .8 }} />
                          )}
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

        {/* Footer informativo */}
        {!loadingBiz && bizList.length > 0 && (
          <>
            <Divider sx={{ my: 0.5, borderColor: 'color-mix(in srgb, var(--on-primary) 20%, transparent)' }} />
            <MenuItem disableRipple disableGutters>
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="caption" sx={{ opacity: 0.55, color: 'inherit', fontSize: '0.7rem' }}>
                  💡 Las divisiones filtran sin mover datos
                </Typography>
              </Box>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}