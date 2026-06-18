// BusinessDivisionSelector.jsx
import React, { useState } from 'react';
import {
  Button, Menu, MenuItem, Box, Typography, CircularProgress,
  ListItemIcon, ListItemText, Divider, Chip, Collapse, IconButton, TextField,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckIcon from '@mui/icons-material/Check';
import StorefrontIcon from '@mui/icons-material/Storefront';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import BusinessCreateModal from '@/componentes/BusinessCreateModal';
import { useBusiness } from '@/context/BusinessContext';
import { useOrganization } from '@/context/OrganizationContext';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { useNavigate } from 'react-router-dom';

const API_BASE =
  import.meta.env.VITE_ASSETS_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://lazarilloapp-backend.onrender.com';

const toAbsolute = (u) => {
  const raw = String(u || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  return `${API_BASE}/${raw}`;
};

const getBranding = (b) => b?.branding || b?.props?.branding || {};
const getBizLogoUrl = (b) =>
  toAbsolute(getBranding(b)?.logo_url || b?.photo_url || getBranding(b)?.cover_url || b?.image_url || '');

export default function BusinessDivisionSelector({ canCreate = true }) {
  const biz = useBusiness() || {};
  const {
    activeBusinessId, active, selectBusiness,
    divisions = [], divisionsLoading: loadingDivisions,
    activeDivisionId, activeDivision, selectDivision,
  } = biz;

  const { organization } = useOrganization() || {};
  const orgBizList = organization?.businesses || [];
  const activeInOrg = orgBizList.some(b => String(b.id) === String(activeBusinessId));
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState(null);
  const [bizList, setBizList] = useState([]);
  const [loadingBiz, setLoadingBiz] = useState(false);
  const [expandedBizId, setExpandedBizId] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Colapsables
  const [collapsedOrgs, setCollapsedOrgs] = useState({});
  const [collapsedOtros, setCollapsedOtros] = useState(false);
  const toggleOrg = (orgId) => setCollapsedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));

  // Edición nombre negocio
  const [editingBizId, setEditingBizId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Edición nombre org
  const [editingOrg, setEditingOrg] = useState(false);
  const [editOrgName, setEditOrgName] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);

  const { updateOrg, refetchOrg } = useOrganization() || {};

  const open = Boolean(anchorEl);
  const businessName = active?.name || 'Local';
  const logoUrl = getBizLogoUrl(active);
  const activeDivisionIdNorm = activeDivisionId ?? null;
  const showDivisionLabel = activeDivisionIdNorm !== null && activeDivision;

  const handleOpen = async (e) => {
    setAnchorEl(e.currentTarget);
    setLoadingBiz(true);
    try {
      const items = await BusinessesAPI.listMine();
      setBizList(items || []);
      if (activeBusinessId) setExpandedBizId(String(activeBusinessId));

      // Inicializar colapsables: solo la org activa expandida
      const activeOrgIdLocal = items.find(b => String(b.id) === String(activeBusinessId))?.organization_id;
      const grupos = {};
      items.forEach(b => { if (b.organization_id) grupos[b.organization_id] = true; });

      const collapsed = {};
      Object.keys(grupos).forEach(orgId => {
        collapsed[orgId] = String(orgId) !== String(activeOrgIdLocal);
      });
      setCollapsedOrgs(collapsed);

      // Colapsar "Otros locales" si hay al menos una org
      setCollapsedOtros(Object.keys(grupos).length > 0);
    } finally {
      setLoadingBiz(false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setExpandedBizId(null);
    setEditingBizId(null);
    setEditingOrg(false);
  };

  const handleSelectBiz = async (bizId) => {
    if (switching) return;
    handleClose();
    setSwitching(true);
    try {
      if (String(bizId) === String(activeBusinessId)) {
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

  // Editar nombre negocio
  const startEdit = (e, b) => { e.stopPropagation(); setEditingBizId(String(b.id)); setEditingName(b.name || ''); };
  const cancelEdit = (e) => { e?.stopPropagation(); setEditingBizId(null); setEditingName(''); };
  const saveEdit = async (e, bizId) => {
    e?.stopPropagation();
    const trimmed = editingName.trim();
    if (!trimmed) return cancelEdit();
    setSavingName(true);
    try {
      await BusinessesAPI.update(bizId, { name: trimmed });
      setBizList(prev => prev.map(b => String(b.id) === String(bizId) ? { ...b, name: trimmed } : b));
      window.dispatchEvent(new CustomEvent('business:switched', {
        detail: { bizId: String(activeBusinessId) === String(bizId) ? bizId : null },
      }));
      if (String(activeBusinessId) === String(bizId)) await selectBusiness?.(bizId);
    } catch (err) { console.error('Error renombrando negocio:', err); }
    finally { setSavingName(false); setEditingBizId(null); setEditingName(''); }
  };

  // Editar nombre org
  const startEditOrg = (e) => { e.stopPropagation(); setEditingOrg(true); setEditOrgName(organization?.name || ''); };
  const cancelEditOrg = (e) => { e?.stopPropagation(); setEditingOrg(false); setEditOrgName(''); };
  const saveEditOrg = async (e) => {
    e?.stopPropagation();
    const trimmed = editOrgName.trim();
    if (!trimmed) return cancelEditOrg();
    setSavingOrg(true);
    try {
      await updateOrg(trimmed);
      await refetchOrg?.();
      // Actualizar nombre en bizList local
      setBizList(prev => prev.map(b =>
        b.organization_id && String(b.organization_id) === String(organization?.id)
          ? { ...b, organization_name: trimmed }
          : b
      ));
    } catch (err) { console.error('Error renombrando org:', err); }
    finally { setSavingOrg(false); setEditingOrg(false); }
  };

  if (!activeBusinessId) return null;

  // Agrupar por organization_id
  const orgGroups = {};
  const soloNegocios = [];
  bizList.forEach(b => {
    const orgId = b.organization_id;
    if (orgId) {
      if (!orgGroups[orgId]) orgGroups[orgId] = { id: orgId, negocios: [] };
      orgGroups[orgId].negocios.push(b);
    } else {
      soloNegocios.push(b);
    }
  });
  const activeOrgId = bizList.find(b => String(b.id) === String(activeBusinessId))?.organization_id;
  const hayOrgs = Object.keys(orgGroups).length > 0;

  const editFieldSx = {
    flex: 1,
    '& input': { color: 'var(--on-primary)', fontSize: '0.875rem' },
    '& .MuiInput-underline:before': { borderColor: 'color-mix(in srgb, var(--on-primary) 40%, transparent)' },
    '& .MuiInput-underline:after': { borderColor: 'var(--on-primary)' },
  };
  const iconBtnSx = { color: 'inherit', opacity: 0.5, '&:hover': { opacity: 1 } };

  const renderBizItem = (b, indent = false) => {
    const isActiveBiz = String(activeBusinessId) === String(b.id);
    const isExpanded = String(expandedBizId) === String(b.id);
    const isEditing = editingBizId === String(b.id);
    const isSub = b.created_from === 'from_group';
    const bLogoUrl = getBizLogoUrl(b);
    const bizDivisions = isActiveBiz ? divisions : [];
    const otherDivs = bizDivisions.filter(d => !d.is_main);

    return [
      <MenuItem
        key={`biz-${b.id}`}
        onClick={() => handleSelectBiz(b.id)}
        selected={isActiveBiz}
        sx={{
          pl: indent ? 3.5 : 2,
          fontWeight: isActiveBiz ? 700 : 500,
          '&.Mui-selected': { background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)' },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          {bLogoUrl ? (
            <Box component="img" src={bLogoUrl} alt={b.name} sx={{
              width: 22, height: 22, objectFit: 'contain', borderRadius: '6px',
              p: 0.5, background: 'rgba(255,255,255,0.92)', border: '1px solid',
              borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
              boxShadow: '0 0 0 1px color-mix(in srgb, var(--on-primary) 10%, transparent) inset',
            }} />
          ) : (
            isSub
              ? <StorefrontIcon fontSize="small" sx={{ color: 'inherit', opacity: .8 }} />
              : <BusinessIcon fontSize="small" />
          )}
        </ListItemIcon>

        {isEditing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}
            onClick={e => e.stopPropagation()}>
            <TextField value={editingName} onChange={e => setEditingName(e.target.value)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') saveEdit(e, b.id); if (e.key === 'Escape') cancelEdit(e); }}
              autoFocus size="small" variant="standard" sx={editFieldSx} />
            <IconButton size="small" onClick={e => saveEdit(e, b.id)} disabled={savingName} sx={{ color: 'inherit' }}>
              {savingName ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <CheckCircleOutlineIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={cancelEdit} sx={{ color: 'inherit' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 0.5 }}>
            <ListItemText primary={b.name} />
            {canCreate && (
              <IconButton size="small" onClick={e => startEdit(e, b)} sx={iconBtnSx}
                aria-label={`Editar nombre de ${b.name}`}>
                <EditIcon fontSize="small" />
              </IconButton>
            )}
            {isActiveBiz && bizDivisions.length > 1 && (
              <IconButton size="small"
                onClick={e => { e.stopPropagation(); setExpandedBizId(p => p === String(b.id) ? null : String(b.id)); }}
                sx={{ color: 'inherit' }}>
                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            )}
          </Box>
        )}
      </MenuItem>,

      // Divisiones
      isActiveBiz && (
        <Collapse key={`divs-${b.id}`} in={isExpanded} timeout="auto" unmountOnExit>
          <Box sx={{ pl: indent ? 5 : 2, bgcolor: 'color-mix(in srgb, var(--on-primary) 5%, transparent)' }}>
            {!loadingDivisions && otherDivs.map(div => {
              const isActiveDiv = String(activeDivisionIdNorm) === String(div.id);
              return (
                <MenuItem key={div.id} onClick={() => handleSelectDivision(div.id)}
                  selected={isActiveDiv}
                  sx={{ pl: 4, '&.Mui-selected': { background: 'color-mix(in srgb, var(--on-primary) 15%, transparent)' } }}>
                  <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                    <FolderIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <span>{div.name}</span>
                      {(div.assigned_groups_count || 0) > 0 && (
                        <Chip label={div.assigned_groups_count} size="small"
                          sx={{
                            height: 18, fontSize: '0.65rem', minWidth: 24,
                            bgcolor: 'color-mix(in srgb, var(--on-primary) 12%, transparent)', color: 'inherit'
                          }} />
                      )}
                    </Box>
                  } />
                  {isActiveDiv && <CheckIcon fontSize="small" sx={{ opacity: 0.8 }} />}
                </MenuItem>
              );
            })}
          </Box>
        </Collapse>
      ),
    ].filter(Boolean);
  };

  return (
    <>
      {/* Botón navbar */}
      <Button
        aria-label="Cambiar negocio o división"
        onClick={handleOpen}
        sx={{
          color: 'var(--on-primary)', textTransform: 'none', fontWeight: 700,
          border: '1px solid color-mix(in srgb, var(--on-primary) 22%, transparent)',
          px: 1.25, gap: 0.5,
          '&:focus-visible': {
            outline: '2px solid color-mix(in srgb, var(--on-primary) 65%, transparent)',
            outlineOffset: 2,
          },
        }}
        endIcon={<ExpandMoreIcon />}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {logoUrl ? (
            <Box component="img" src={logoUrl} alt={businessName} sx={{
              width: 22, height: 22, objectFit: 'contain', borderRadius: '6px',
              p: 0.5, background: 'rgba(255,255,255,0.92)', border: '1px solid',
              borderColor: 'color-mix(in srgb, var(--on-primary) 25%, transparent)',
              boxShadow: '0 0 0 1px color-mix(in srgb, var(--on-primary) 10%, transparent) inset',
            }} />
          ) : (
            <span style={{
              display: 'inline-grid', placeItems: 'center', width: 22, height: 22,
              borderRadius: 6, border: '1px solid color-mix(in srgb, var(--on-primary) 25%, transparent)',
              background: 'color-mix(in srgb, var(--on-primary) 10%, transparent)',
              fontSize: 11, fontWeight: 800, color: 'var(--on-primary)',
            }} aria-hidden>
              {String(businessName || '#').slice(0, 1).toUpperCase()}
            </span>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
            {activeInOrg && organization?.name && (
              <span style={{ fontSize: '.68rem', opacity: .7, fontWeight: 500, lineHeight: 1.1 }}>
                {organization.name}
              </span>
            )}
            <span style={{ fontSize: '0.875rem' }}>{businessName}</span>
            {showDivisionLabel && (
              <span style={{ fontSize: '.8rem', opacity: 0.75, fontWeight: 500 }}>
                ✅ {activeDivision?.name}
              </span>
            )}
          </Box>
        </Box>
      </Button>

      {/* Menú desplegable */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{
          '& .MuiPaper-root': {
            background: 'var(--color-primary)', color: 'var(--on-primary)',
            minWidth: 300, maxHeight: 520, overflowY: 'auto',
          },
        }}
        MenuListProps={{
          'aria-label': 'Selección de negocio y división',
          dense: true,
          onKeyDownCapture: (e) => {
            if (document.activeElement?.tagName === 'INPUT' ||
              document.activeElement?.tagName === 'TEXTAREA') {
              e.stopPropagation();
            }
          },
        }}
      >
        {/* Loading */}
        {loadingBiz && (
          <MenuItem disabled>
            <ListItemIcon sx={{ color: 'inherit', minWidth: 28 }}>
              <CircularProgress size={16} sx={{ color: 'var(--on-primary)' }} />
            </ListItemIcon>
            <ListItemText primary="Cargando negocios…" />
          </MenuItem>
        )}

        {/* Orgs colapsables */}
        {!loadingBiz && Object.values(orgGroups).map((og, ogIdx) => {
          const isActiveOrg = String(og.id) === String(activeOrgId);
          const orgName = og.negocios[0]?.organization_name || `Organización #${og.id}`;
          const isCollapsed = !!collapsedOrgs[og.id];

          return [
            ogIdx > 0 && (
              <Divider key={`sep-org-${og.id}`}
                sx={{ borderColor: 'color-mix(in srgb, var(--on-primary) 20%, transparent)', my: 0.25 }} />
            ),

            // Header org — clickeable para colapsar
            <MenuItem
              key={`org-header-${og.id}`}
              onClick={() => toggleOrg(og.id)}
              sx={{
                px: 2, py: 0.75, cursor: 'pointer',
                '&:hover': { background: 'color-mix(in srgb, var(--on-primary) 8%, transparent)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: 'inherit', opacity: .6 }}>
                <AccountTreeIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>

              {isActiveOrg && editingOrg ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}
                  onClick={e => e.stopPropagation()}>
                  <TextField value={editOrgName} onChange={e => setEditOrgName(e.target.value)}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') saveEditOrg(e); if (e.key === 'Escape') cancelEditOrg(e); }}
                    autoFocus size="small" variant="standard" placeholder="Nombre de la organización"
                    sx={{ ...editFieldSx, '& input': { ...editFieldSx['& input'], fontWeight: 700 } }} />
                  <IconButton size="small" onClick={saveEditOrg} disabled={savingOrg} sx={{ color: 'inherit' }}>
                    {savingOrg ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <CheckCircleOutlineIcon fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={cancelEditOrg} sx={{ color: 'inherit' }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 0.5 }}>
                  <Typography variant="caption" sx={{
                    fontWeight: 800, fontSize: '.72rem', opacity: .85,
                    textTransform: 'uppercase', letterSpacing: '.07em', flex: 1, color: 'inherit',
                  }}>
                    {orgName}
                  </Typography>
                  {isActiveOrg && !isCollapsed && canCreate && (
                    <IconButton size="small"
                      onClick={e => { e.stopPropagation(); startEditOrg(e); }}
                      sx={iconBtnSx} aria-label="Editar nombre de organización">
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                  {isCollapsed
                    ? <ExpandMoreIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                    : <ExpandLessIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                  }
                </Box>
              )}
            </MenuItem>,

            // Negocios de esta org — solo si expandida
            !isCollapsed && (
              <Divider key={`org-div-${og.id}`}
                sx={{ borderColor: 'color-mix(in srgb, var(--on-primary) 15%, transparent)', my: 0 }} />
            ),
            ...(!isCollapsed ? og.negocios.flatMap(b => renderBizItem(b, true)) : []),
          ].filter(Boolean);
        })}

        {/* Otros locales (sin org) */}
        {!loadingBiz && soloNegocios.length > 0 && (
          <>
            {hayOrgs && (
              <Divider sx={{ borderColor: 'color-mix(in srgb, var(--on-primary) 20%, transparent)', my: 0.25 }} />
            )}
            <MenuItem
              onClick={() => setCollapsedOtros(v => !v)}
              sx={{
                px: 2, py: 0.5, cursor: 'pointer',
                '&:hover': { background: 'color-mix(in srgb, var(--on-primary) 8%, transparent)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: 'inherit', opacity: .6 }}>
                <BusinessIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <Typography variant="caption" sx={{
                opacity: 0.75, fontSize: '.72rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '.07em', flex: 1, color: 'inherit'
              }}>
                {hayOrgs ? 'Otros locales' : 'Negocios'}
              </Typography>
              {collapsedOtros
                ? <ExpandMoreIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                : <ExpandLessIcon sx={{ fontSize: 16, opacity: 0.6 }} />
              }
            </MenuItem>
            {!collapsedOtros && (
              <Divider sx={{ borderColor: 'color-mix(in srgb, var(--on-primary) 15%, transparent)', my: 0 }} />
            )}
            {!collapsedOtros && soloNegocios.flatMap(b => renderBizItem(b, false))}
          </>
        )}

        {!loadingBiz && bizList.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary="No tenés negocios todavía" />
          </MenuItem>
        )}

        {/* Nuevo negocio — solo si es owner */}
        {!loadingBiz && canCreate && [
          <Divider key="div-nuevo"
            sx={{ borderColor: 'color-mix(in srgb, var(--on-primary) 15%, transparent)', my: 0.5 }} />,
          <MenuItem key="nuevo-negocio"
            onClick={() => { handleClose(); setShowCreate(true); }}
            sx={{ px: 2, py: 1, gap: 1, opacity: 0.85, '&:hover': { opacity: 1 } }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Nuevo negocio"
              primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }} />
          </MenuItem>,
        ]}
      </Menu>

      <BusinessCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreateComplete={async (biz) => {
          setShowCreate(false);
          const items = await BusinessesAPI.listMine();
          setBizList(items || []);
          if (biz?.id) {
            await selectBusiness?.(biz.id);
            navigate('/configuracion?tab=3');
          }
        }}
      />
    </>
  );
}