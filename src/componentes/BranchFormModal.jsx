// src/componentes/BranchFormModal.jsx
// Modal reutilizable para crear y editar sucursales.
// Soporta sucursales normales (app_branches) y la sucursal principal (isMain → PATCH al negocio).

import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, TextField, Divider, Typography, CircularProgress,
} from '@mui/material';

import { BranchesAPI } from '@/servicios/apiBranches';

/**
 * BranchFormModal
 *
 * Props:
 *   open      boolean
 *   onClose   () => void
 *   onSaved   () => void   — callback tras guardar (para refetch)
 *   bizId     number       — business_id activo
 *   branch    object|null  — null = crear nueva, objeto = editar
 *                            Si branch.isMain = true → edita el negocio principal
 */
export default function BranchFormModal({ open, onClose, onSaved, bizId, branch = null }) {
  const isEdit = !!branch;
  const isMain = !!branch?.isMain;

  const [name,      setName]      = useState(branch?.name     || '');
  const [color,     setColor]     = useState(branch?.color    || '#1976d2');
  const [phone,     setPhone]     = useState(branch?.contacts?.phone || '');
  const [city,      setCity]      = useState(branch?.address?.city  || '');
  const [line1,     setLine1]     = useState(branch?.address?.line1 || '');
  const [instagram, setInstagram] = useState(branch?.props?.social?.instagram || '');
  const [website,   setWebsite]   = useState(branch?.props?.social?.website   || '');
  const [logoUrl,   setLogoUrl]   = useState(branch?.logo_url || '');
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState('');

  // Reset al abrir
  React.useEffect(() => {
    if (!open) return;
    setName(branch?.name     || '');
    setColor(branch?.color   || '#1976d2');
    setPhone(branch?.contacts?.phone || '');
    setCity(branch?.address?.city    || '');
    setLine1(branch?.address?.line1  || '');
    setInstagram(branch?.props?.social?.instagram || '');
    setWebsite(branch?.props?.social?.website     || '');
    setLogoUrl(branch?.logo_url || '');
    setErr('');
  }, [open, branch]);

  const handleSave = async () => {
    if (!name.trim()) { setErr('El nombre es requerido'); return; }
    setBusy(true);
    setErr('');
    try {
      const payload = {
        name:     name.trim(),
        color,
        logo_url: logoUrl.trim() || null,
        address:  { city: city.trim() || null, line1: line1.trim() || null },
        contacts: { phone: phone.trim() || null },
        props:    { social: { instagram: instagram.trim() || null, website: website.trim() || null } },
      };

      if (isMain) {
        // Sucursal principal → PATCH al negocio mismo
        await BranchesAPI.updateMain(bizId, payload);
        // Disparar AMBOS eventos: branch:updated (para BranchContext) y business:updated (para BusinessContext → refresca estilos/tema)
        window.dispatchEvent(new CustomEvent('branch:updated'));
        window.dispatchEvent(new CustomEvent('business:updated'));
      } else if (isEdit) {
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
        {isMain
          ? `Editar sucursal principal — ${branch.name}`
          : isEdit
            ? `Editar — ${branch.name}`
            : 'Nueva sucursal'}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>

          {/* Nombre + color (color solo para sucursales no-principales) */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              {field('Nombre *', name, setName, { autoFocus: true })}
            </Box>
            {!isMain && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Color</Typography>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: 44, height: 40, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }}
                />
              </Box>
            )}
          </Box>

          {/* Logo — solo para sucursales no-principales */}
          {!isMain && field('URL del logo (opcional)', logoUrl, setLogoUrl, { placeholder: 'https://...' })}

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

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none' }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={busy || !name.trim()}
          variant="contained"
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
        >
          {busy
            ? <CircularProgress size={18} sx={{ color: 'inherit' }} />
            : isEdit ? 'Guardar cambios' : 'Crear sucursal'
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
}