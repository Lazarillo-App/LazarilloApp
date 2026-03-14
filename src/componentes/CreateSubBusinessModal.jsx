/* eslint-disable no-unused-vars */
// src/componentes/CreateSubBusinessModal.jsx - FIXED
import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, TextField, Button,
  Alert, CircularProgress, Divider, Chip,
} from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { useOrganization } from '@/context/OrganizationContext';
import { useBusiness } from '@/context/BusinessContext';
import OrganizationNameModal from './OrganizationNameModal';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '95vw', sm: 480 },
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  p: 0,
  outline: 'none',
  overflow: 'hidden',
};

export default function CreateSubBusinessModal({ open, onClose, agrupacion, onCreated }) {
  const { organization, createSubBusiness, createOrg } = useOrganization() || {};
  const { active } = useBusiness() || {};

  const [name, setName]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [createdBiz, setCreatedBiz] = useState(null);

  // Controla si mostramos el modal de nombre de organización
  const [showOrgModal, setShowOrgModal] = useState(false);

  useEffect(() => {
    if (open && agrupacion?.nombre) {
      setName(agrupacion.nombre);
      setError('');
      setSuccess(false);
      setCreatedBiz(null);
      setShowOrgModal(false);
    }
  }, [open, agrupacion]);

  const articulosCount = Array.isArray(agrupacion?.articulos)
    ? agrupacion.articulos.length
    : 0;

  // Paso 1: validar y, si no hay org, abrir el modal de nombre de org primero
  const handleSubmit = () => {
    if (!name.trim()) { setError('El nombre del sub-negocio es requerido'); return; }

    if (!organization) {
      // Primero pedir el nombre de la organización
      setShowOrgModal(true);
    } else {
      doCreate(null);
    }
  };

  // Paso 2 (cuando no había org): usuario confirmó el nombre de la org
  const handleOrgNameConfirm = async (orgName) => {
    setShowOrgModal(false);
    await doCreate(orgName);
  };

  // Lógica real de creación
  const doCreate = async (orgName) => {
    setSaving(true);
    setError('');
    try {
      // Crear org si no existe, con el nombre que el usuario eligió
      if (!organization) {
        await createOrg(orgName || active?.name || name.trim());
      }

      const newBiz = await createSubBusiness({
        sourceGroupId: agrupacion.id,
        name: name.trim(),
      });

      setCreatedBiz(newBiz);
      setSuccess(true);

      // Avisar a los componentes que recarguen las agrupaciones del principal
      window.dispatchEvent(new CustomEvent('agrupaciones:reload'));
      window.dispatchEvent(new CustomEvent('business:created', { detail: { id: newBiz?.id } }));

      if (typeof onCreated === 'function') onCreated(newBiz);
    } catch (e) {
      console.error('[CreateSubBusinessModal] Error:', e);
      setError(e?.message || 'Error al crear el sub-negocio');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setName('');
    setError('');
    setSuccess(false);
    setCreatedBiz(null);
    setShowOrgModal(false);
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={handleClose} aria-labelledby="create-subbiz-title">
        <Box sx={modalStyle}>
          {/* Header */}
          <Box sx={{
            px: 3, py: 2.5,
            background: 'var(--color-primary, #111)',
            color: 'var(--on-primary, #fff)',
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <StoreIcon />
            <Typography id="create-subbiz-title" variant="h6" fontWeight={600}>
              Crear sub-negocio
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            {success && createdBiz ? (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  ¡Sub-negocio creado!
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>{createdBiz.name}</strong> fue creado. Los {articulosCount} artículo
                  {articulosCount !== 1 ? 's' : ''} fueron <strong>movidos</strong> desde el negocio principal.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Podés cambiarlo desde el selector de negocios en la barra superior.
                </Typography>
                <Box sx={{ mt: 3 }}>
                  <Button variant="contained" onClick={handleClose} fullWidth>Entendido</Button>
                </Box>
              </Box>
            ) : (
              <>
                {/* Info agrupación origen */}
                <Box sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1.5,
                  p: 2, bgcolor: 'action.hover', borderRadius: 1.5, mb: 3,
                }}>
                  <GroupWorkIcon sx={{ color: 'primary.main', mt: 0.25 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                      Agrupación origen
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {agrupacion?.nombre}
                    </Typography>
                    <Chip
                      label={`${articulosCount} artículo${articulosCount !== 1 ? 's' : ''}`}
                      size="small"
                      sx={{ mt: 0.75, height: 22 }}
                    />
                  </Box>
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Qué va a pasar:
                  </Typography>
                  {[
                    `Se crea un nuevo sub-negocio "${name.trim() || agrupacion?.nombre}"`,
                    `Los ${articulosCount} artículos se MUEVEN al nuevo negocio (se quitan del actual)`,
                    'Los artículos quedan en "Sin Agrupación" del nuevo negocio',
                  ].map((txt, i) => (
                    <Typography key={i} variant="caption" color="text.secondary"
                      sx={{ display: 'flex', gap: 0.75, mb: 0.5 }}>
                      <span style={{ color: 'var(--color-primary, #111)', fontWeight: 700 }}>•</span>
                      {txt}
                    </Typography>
                  ))}
                </Box>

                <Alert severity="warning" sx={{ mb: 3 }}>
                  <strong>⚠️ Importante:</strong> Los artículos se <strong>moverán</strong> del negocio actual
                  y dejarán de aparecer en él.
                </Alert>

                <TextField
                  label="Nombre del sub-negocio"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && !saving && handleSubmit()}
                  fullWidth
                  autoFocus
                  size="small"
                  disabled={saving}
                  error={!!error}
                  helperText={error || 'Podés cambiar el nombre propuesto'}
                  sx={{ mb: 2 }}
                />

                {error && !error.includes('nombre') && (
                  <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                )}

                {!organization && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    A continuación se te pedirá el nombre de tu <strong>organización</strong>, que agrupará todos tus negocios.
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                  <Button onClick={handleClose} disabled={saving} color="inherit">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={saving || !name.trim()}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <StoreIcon />}
                    sx={{
                      bgcolor: 'var(--color-primary, #111)',
                      color: 'var(--on-primary, #fff)',
                      '&:hover': { bgcolor: 'var(--color-primary, #111)', opacity: 0.9 },
                    }}
                  >
                    {saving ? 'Creando...' : 'Crear sub-negocio'}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Modal>

      {/* Modal de nombre de organización — se abre solo cuando no existe org */}
      <OrganizationNameModal
        open={showOrgModal}
        onClose={() => setShowOrgModal(false)}
        defaultName={active?.name ? `${active.name} Group` : 'Mi Organización'}
        onConfirm={handleOrgNameConfirm}
      />
    </>
  );
}