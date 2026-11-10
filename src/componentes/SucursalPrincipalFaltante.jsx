// src/componentes/SucursalPrincipalFaltante.jsx
// Sucursal obligatoria (Diego 10/11/2026): «el principal no tiene sucursal asignada, no tiene que
// volver a pasar al dar de alta un negocio». Si el negocio activo no tiene su sucursal principal
// guardada (fila is_main en app_branches), se pide el nombre antes de seguir. Cubre los negocios
// creados por cualquier camino (alta desde Perfil, asistente de alta) y los que ya existen sin ella.
// Fuera del asistente de alta (/alta, /perfil), para no cortarlo a la mitad.
import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, TextField, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { BranchesAPI } from '@/servicios/apiBranches';

export default function SucursalPrincipalFaltante() {
  const { activeBusinessId, active } = useBusiness() || {};
  const { isStaff } = useAccess() || {};
  const location = useLocation();
  const [falta, setFalta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const enAlta = location.pathname.startsWith('/alta') || location.pathname.startsWith('/perfil');

  useEffect(() => {
    let vivo = true;
    setFalta(false);
    if (!activeBusinessId || isStaff) return undefined;
    BranchesAPI.list(activeBusinessId)
      .then((res) => {
        const lista = res?.branches || [];
        if (vivo) setFalta(!lista.some((b) => b.props?.is_main === true));
      })
      .catch(() => { /* sin datos no se molesta al usuario */ });
    return () => { vivo = false; };
  }, [activeBusinessId, isStaff]);

  if (!falta || enAlta) return null;

  const guardar = async () => {
    const n = nombre.trim();
    if (!n) { setError('Poné el nombre de la sucursal'); return; }
    setGuardando(true); setError('');
    try {
      await BranchesAPI.updateMain(activeBusinessId, { name: n });
      setFalta(false);
      window.dispatchEvent(new CustomEvent('branch:updated'));
    } catch (e) {
      setError(e?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="h6" fontWeight={700}>Sucursal de {active?.name || 'tu negocio'}</Typography>
        <Typography variant="body2" color="text.secondary">
          Para separar ventas y compras por lugar, el negocio necesita el nombre de su sucursal principal.
        </Typography>
        <TextField
          autoFocus size="small" label="Sucursal *" placeholder="Ej.: Ramos Mejia" value={nombre}
          error={!!error} helperText={error || 'Generalmente es el nombre de la zona, por ejemplo, Ramos Mejia'}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
          slotProps={{ htmlInput: { maxLength: 60 } }}
        />
        <Button variant="contained" disabled={guardando || !nombre.trim()} onClick={guardar} sx={{ alignSelf: 'flex-end', boxShadow: 'none' }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </Box>
    </Dialog>
  );
}
