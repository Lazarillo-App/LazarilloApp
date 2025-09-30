import React, { useEffect, useMemo, useState } from 'react';
import {
  Paper, Stack, Typography, FormControl, InputLabel, Select, MenuItem,
  Button, Chip, Divider, CircularProgress, Tooltip
} from '@mui/material';
import { BusinessesAPI } from '../servicios/apiBusinesses';

/** Normaliza la respuesta del backend para evitar falsos "faltan credenciales" */
function normalizeMaxiStatus(res = {}) {
  // Posibles formas que puede devolver el backend
  const hasFlag = res.has_credentials;
  const email = res.email ?? res.user ?? res.username;
  const password = res.password ?? res.pass;
  const codcli = res.codcli ?? res.client_code ?? res.codigo_cliente;
  const credsOk = [email, password, codcli].every(v => !!(v && String(v).trim()));

  // connected puede venir como boolean, string o status
  const connected =
    typeof res.connected === 'boolean' ? res.connected :
      (res.status === 'ok' || res.state === 'connected') ? true :
        (res.status === 'error' || res.state === 'disconnected') ? false :
          null;

  const lastSync = res.last_sync ?? res.synced_at ?? res.last ?? res.updated_at ?? null;

  let hasCreds = null;
  if (typeof hasFlag === 'boolean') hasCreds = hasFlag;
  else if (email || password || codcli) hasCreds = credsOk; // si hay campos, chequea completos

  return { hasCreds, connected, lastSync };
}

export default function AdminActionsSidebar({ onSynced }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [syncing, setSyncing] = useState(false);
  const [mx, setMx] = useState({ hasCreds: null, connected: null, lastSync: null, loading: false });

  const load = async () => {
    try {
      const list = await BusinessesAPI.listMine();
      setItems(Array.isArray(list) ? list : []);
      if (!selectedId) {
        const active = localStorage.getItem('activeBusinessId');
        if (active) setSelectedId(active);
      }
    } catch (e) {
      console.error('AdminActionsSidebar.load', e);
      setItems([]);
    }
  };

  useEffect(() => { load(); }, []);

  const activeBiz = useMemo(
    () => items.find(b => String(b.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  // Estado de Maxi del negocio seleccionado
  useEffect(() => {
    let alive = true;
    if (!selectedId) { setMx({ hasCreds: null, connected: null, lastSync: null, loading: false }); return; }
    (async () => {
      setMx(prev => ({ ...prev, loading: true }));
      try {
        const res = await BusinessesAPI.maxiStatus(selectedId);
        if (!alive) return;
        const n = normalizeMaxiStatus(res || {});
        setMx({ ...n, loading: false });
      } catch {
        if (!alive) return;
        setMx({ hasCreds: null, connected: null, lastSync: null, loading: false });
      }
    })();
    return () => { alive = false; };
  }, [selectedId]);

  const handleSync = async () => {
    if (!selectedId || syncing) return;

    if (mx.hasCreds === false) {
      alert('Este local no tiene credenciales de Maxi configuradas.');
      return;
    }
    if (!window.confirm('¿Iniciar sincronización de artículos/categorías para este local?')) return;

    setSyncing(true);
    const prev = localStorage.getItem('activeBusinessId');
    try {
      localStorage.setItem('activeBusinessId', String(selectedId));
      await BusinessesAPI.syncNow(selectedId);
      window.dispatchEvent(new CustomEvent('business:synced', { detail: { businessId: selectedId } }));
      onSynced?.();
      alert('Sincronización iniciada.');
    } catch (e) {
      console.error('sync error', e);
      alert('No se pudo iniciar la sincronización. Intentalo de nuevo.');
    } finally {
      if (prev) localStorage.setItem('activeBusinessId', prev);
      else localStorage.removeItem('activeBusinessId');
      setSyncing(false);
    }
  };

  // Badge compacto y limpio
  const renderBadge = () => {
    if (mx.loading) return <Chip size="small" variant="outlined" label="Verificando..." />;
    if (mx.connected === true) return <Chip size="small" color="success" label="Conectado a Maxi" />;
    if (mx.connected === false) return <Chip size="small" color="error" label="Desconectado" />;
    return null; // si no sabemos, no mostramos nada para evitar ruido visual
  };

  return (
    <Paper elevation={0} sx={{
      position: 'sticky',
      top: 'calc(var(--navbar-height) + 12px)',
      alignSelf: 'start',
      border: '1px solid var(--color-border)',
      borderLeft: '4px solid var(--color-secondary)',
      borderRadius: '12px',
      p: 2,
      background: 'var(--color-surface)',
    }}>
      <Stack spacing={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ m: 0, color: 'var(--color-fg)' }}>
            Acciones de administración
          </Typography>
          {renderBadge()}
        </Stack>

        <FormControl size="small" fullWidth>
          <InputLabel>Local</InputLabel>
          <Select
            label="Local"
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {items.map(b => (
              <MenuItem key={b.id} value={String(b.id)}>
                {String(b.name ?? b.nombre ?? `#${b.id}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip
          title={mx.hasCreds === false ? 'Configura las credenciales de Maxi para habilitar la sincronización' : ''}
          placement="top"
          arrow
          disableHoverListener={mx.hasCreds !== false}
        >
          <span>
            <Button
              onClick={handleSync}
              disabled={!selectedId || syncing || mx.hasCreds === false}
              fullWidth
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                py: 1.2,
                bgcolor: 'var(--color-secondary) !important',
                color: 'var(--on-secondary) !important',
                '&:hover': { filter: 'brightness(.96)' },
                '&.Mui-disabled': { opacity: .6 }
              }}
              startIcon={syncing ? <CircularProgress size={16} sx={{ color: 'var(--on-secondary)' }} /> : null}
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar datos de este local'}
            </Button>
          </span>
        </Tooltip>

        <Divider />

        <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.45 }}>
          Trae artículos y categorías desde Maxi para el local seleccionado. La vista de artículos
          se actualizará automáticamente al finalizar.
        </Typography>
      </Stack>
    </Paper>
  );
}
