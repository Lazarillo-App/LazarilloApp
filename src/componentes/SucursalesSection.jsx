/* eslint-disable no-unused-vars */
// src/componentes/SucursalesSection.jsx
// Sección de sucursales para la página de Perfil.
// Muestra cards detalladas de cada sucursal + botón "Nueva sucursal".
// Reutiliza BusinessCreateModal con mode="branch".

import React, { useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Avatar, Chip, Divider, IconButton, Tooltip, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions as MuiDialogActions,
  TextField, CircularProgress,
} from '@mui/material';
import AddIcon        from '@mui/icons-material/Add';
import EditIcon       from '@mui/icons-material/Edit';
import DeleteIcon     from '@mui/icons-material/Delete';
import StoreIcon      from '@mui/icons-material/Store';
import PhoneIcon      from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InstagramIcon  from '@mui/icons-material/Instagram';
import LanguageIcon   from '@mui/icons-material/Language';
import PaletteIcon    from '@mui/icons-material/Palette';

import { useBranch }   from '@/hooks/useBranch';
import { BranchesAPI } from '@/servicios/apiBranches';
import { useBusiness } from '@/context/BusinessContext';

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

// ─── Modal de crear/editar sucursal ───────────────────────────────────────────
function BranchFormModal({ open, onClose, onSaved, bizId, branch = null }) {
  const isEdit = !!branch;

  const [name,     setName]     = useState(branch?.name     || '');
  const [color,    setColor]    = useState(branch?.color    || '#1976d2');
  const [phone,    setPhone]    = useState(branch?.contacts?.phone || '');
  const [city,     setCity]     = useState(branch?.address?.city  || '');
  const [line1,    setLine1]    = useState(branch?.address?.line1 || '');
  const [instagram, setInstagram] = useState(branch?.props?.social?.instagram || '');
  const [website,  setWebsite]  = useState(branch?.props?.social?.website     || '');
  const [logoUrl,  setLogoUrl]  = useState(branch?.logo_url || '');
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');

  // Reset al abrir
  React.useEffect(() => {
    if (!open) return;
    setName(branch?.name || '');
    setColor(branch?.color || '#1976d2');
    setPhone(branch?.contacts?.phone || '');
    setCity(branch?.address?.city || '');
    setLine1(branch?.address?.line1 || '');
    setInstagram(branch?.props?.social?.instagram || '');
    setWebsite(branch?.props?.social?.website || '');
    setLogoUrl(branch?.logo_url || '');
    setErr('');
  }, [open, branch]);

  const handleSave = async () => {
    if (!name.trim()) { setErr('El nombre es requerido'); return; }
    setBusy(true);
    setErr('');
    try {
      const payload = {
        name: name.trim(),
        color,
        logo_url: logoUrl.trim() || null,
        address: { city: city.trim() || null, line1: line1.trim() || null },
        contacts: { phone: phone.trim() || null },
        props: { social: { instagram: instagram.trim() || null, website: website.trim() || null } },
      };
      if (isEdit) {
        await BranchesAPI.update(bizId, branch.id, payload);
        window.dispatchEvent(new CustomEvent('branch:updated'));
      } else {
        await BranchesAPI.create(bizId, payload);
        window.dispatchEvent(new CustomEvent('branch:created'));
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Error al guardar');
    } finally {
      setBusy(false);
    }
  };

  const field = (label, value, onChange, props = {}) => (
    <TextField
      label={label} value={value} onChange={(e) => onChange(e.target.value)}
      size="small" fullWidth variant="outlined"
      InputProps={{ sx: { borderRadius: 2 } }}
      {...props}
    />
  );

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>
        {isEdit ? `Editar — ${branch.name}` : 'Nueva sucursal'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>

          {/* Nombre + color */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              {field('Nombre *', name, setName, { autoFocus: true })}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Color</Typography>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 44, height: 40, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }}
              />
            </Box>
          </Box>

          {/* Logo */}
          {field('URL del logo (opcional)', logoUrl, setLogoUrl, { placeholder: 'https://...' })}

          <Divider />

          {/* Dirección */}
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Dirección
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {field('Ciudad', city, setCity)}
            {field('Calle / Dirección', line1, setLine1)}
          </Box>

          <Divider />

          {/* Contacto */}
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Contacto y redes
          </Typography>
          {field('Teléfono', phone, setPhone, { placeholder: '+54 9 ...' })}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {field('Instagram', instagram, setInstagram, { placeholder: 'https://instagram.com/...' })}
            {field('Sitio web', website, setWebsite, { placeholder: 'https://...' })}
          </Box>

          {err && (
            <Box sx={{ background: '#ffebe9', border: '1px solid #ffb3b3', color: '#b42318', borderRadius: 2, p: 1.5, fontSize: '0.875rem' }}>
              {err}
            </Box>
          )}
        </Box>
      </DialogContent>
      <MuiDialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none' }}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={busy || !name.trim()} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
          {busy ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : isEdit ? 'Guardar cambios' : 'Crear sucursal'}
        </Button>
      </MuiDialogActions>
    </Dialog>
  );
}

// ─── Card de una sucursal ─────────────────────────────────────────────────────
function BranchCard({ branch, bizId, onEdit, onDelete }) {
  const logo    = toAbsolute(branch.logo_url);
  const phone   = branch.contacts?.phone;
  const city    = branch.address?.city;
  const line1   = branch.address?.line1;
  const ig      = branch.props?.social?.instagram;
  const website = branch.props?.social?.website;
  const addr    = [line1, city].filter(Boolean).join(', ');

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, position: 'relative', overflow: 'visible' }}>
      {/* Franja de color arriba */}
      <Box sx={{ height: 6, borderRadius: '12px 12px 0 0', backgroundColor: branch.color || '#1976d2' }} />

      <CardContent sx={{ pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          {/* Logo o avatar */}
          <Avatar
            src={logo || undefined}
            sx={{ width: 52, height: 52, borderRadius: 2, bgcolor: branch.color || '#1976d2', border: '2px solid', borderColor: 'divider' }}
          >
            {!logo && <StoreIcon />}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} noWrap>{branch.name}</Typography>
            {addr && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                <LocationOnIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" noWrap>{addr}</Typography>
              </Box>
            )}
            {phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                <PhoneIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">{phone}</Typography>
              </Box>
            )}
          </Box>

          {/* Color chip */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: branch.color || '#1976d2', border: '1.5px solid rgba(0,0,0,0.12)' }} />
          </Box>
        </Box>

        {/* Redes */}
        {(ig || website) && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
            {ig && (
              <Chip
                icon={<InstagramIcon sx={{ fontSize: '14px !important' }} />}
                label="Instagram"
                size="small"
                component="a"
                href={ig}
                target="_blank"
                clickable
                sx={{ borderRadius: 1.5, fontSize: '0.72rem' }}
              />
            )}
            {website && (
              <Chip
                icon={<LanguageIcon sx={{ fontSize: '14px !important' }} />}
                label="Sitio web"
                size="small"
                component="a"
                href={website}
                target="_blank"
                clickable
                sx={{ borderRadius: 1.5, fontSize: '0.72rem' }}
              />
            )}
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 1.5, pt: 0, justifyContent: 'flex-end', gap: 0.5 }}>
        <Button
          size="small"
          startIcon={<EditIcon sx={{ fontSize: '14px !important' }} />}
          onClick={() => onEdit(branch)}
          sx={{ textTransform: 'none', borderRadius: 2, fontSize: '0.78rem' }}
        >
          Editar
        </Button>
        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon sx={{ fontSize: '14px !important' }} />}
          onClick={() => onDelete(branch)}
          sx={{ textTransform: 'none', borderRadius: 2, fontSize: '0.78rem' }}
        >
          Eliminar
        </Button>
      </CardActions>
    </Card>
  );
}

// ─── Sección principal ────────────────────────────────────────────────────────
export default function SucursalesSection() {
  const { activeBusinessId } = useBusiness() || {};
  const { branches, hasBranches, loading, loadBranches } = useBranch() || {};

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editBranch,   setEditBranch]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteErr,    setDeleteErr]    = useState('');

  const handleEdit   = (branch) => { setEditBranch(branch); setModalOpen(true); };
  const handleCreate = () => { setEditBranch(null); setModalOpen(true); };
  const handleClose  = () => { setModalOpen(false); setEditBranch(null); };
  const handleSaved  = () => loadBranches(activeBusinessId);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !activeBusinessId) return;
    setDeleting(true);
    setDeleteErr('');
    try {
      await BranchesAPI.delete(activeBusinessId, deleteTarget.id);
      window.dispatchEvent(new CustomEvent('branch:deleted'));
      setDeleteTarget(null);
      loadBranches(activeBusinessId);
    } catch (e) {
      setDeleteErr(e?.message || 'No se puede eliminar esta sucursal');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      {/* Header de sección */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1rem' }}>
            Sucursales
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hasBranches
              ? `${branches.length} sucursal${branches.length > 1 ? 'es' : ''} — mismos artículos e insumos, ventas y compras independientes`
              : 'Agregá sucursales para gestionar múltiples locales del mismo negocio'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
        >
          Nueva sucursal
        </Button>
      </Box>

      {/* Cards */}
      {loading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
          {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: 3 }} />)}
        </Box>
      ) : hasBranches ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
          {branches.map(branch => (
            <BranchCard
              key={branch.id}
              branch={branch}
              bizId={activeBusinessId}
              onEdit={handleEdit}
              onDelete={(b) => { setDeleteErr(''); setDeleteTarget(b); }}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{
          border: '1.5px dashed', borderColor: 'divider', borderRadius: 3,
          p: 4, textAlign: 'center', color: 'text.secondary',
        }}>
          <StoreIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
          <Typography variant="body2">Este negocio aún no tiene sucursales</Typography>
          <Typography variant="caption">Usá el botón "Nueva sucursal" para agregar la primera</Typography>
        </Box>
      )}

      {/* Modal crear/editar */}
      <BranchFormModal
        open={modalOpen}
        onClose={handleClose}
        onSaved={handleSaved}
        bizId={activeBusinessId}
        branch={editBranch}
      />

      {/* Diálogo confirmar eliminación */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>
          Eliminar sucursal
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Estás seguro que querés eliminar <strong>{deleteTarget?.name}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Solo se puede eliminar si no tiene ventas ni compras registradas.
          </Typography>
          {deleteErr && (
            <Box sx={{ mt: 1.5, background: '#ffebe9', border: '1px solid #ffb3b3', color: '#b42318', borderRadius: 2, p: 1.5, fontSize: '0.875rem' }}>
              {deleteErr}
            </Box>
          )}
        </DialogContent>
        <MuiDialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteConfirm} disabled={deleting} color="error" variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            {deleting ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : 'Eliminar'}
          </Button>
        </MuiDialogActions>
      </Dialog>
    </Box>
  );
}