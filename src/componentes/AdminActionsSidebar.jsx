/* eslint-disable no-unused-vars */
// src/componentes/AdminActionsSidebar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Paper, Stack, Typography, FormControl, InputLabel, Select, MenuItem,
  Button, Chip, Divider, CircularProgress, Tooltip
} from '@mui/material';
import { BusinessesAPI } from "@/servicios/apiBusinesses";

// AdminActionsSidebar.jsx
function normalizeMaxiStatus(res = {}) {
  const configured = typeof res.configured === 'boolean' ? res.configured : null;
  const email = res.email ?? res.user ?? res.username;
  const codcli = res.codcli ?? res.client_code ?? res.codigo_cliente;

  const hasCreds = configured ?? (!!email && !!codcli); // usa configured si viene

  const connected =
    typeof res.connected === 'boolean' ? res.connected :
    (res.status === 'ok' || res.state === 'connected') ? true :
    (res.status === 'error' || res.state === 'disconnected') ? false :
    null;

  const lastSync = res.last_sync ?? res.synced_at ?? res.last ?? res.updated_at ?? null;

  return { hasCreds, connected, lastSync };
}

export default function AdminActionsSidebar({ onSynced }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [syncing, setSyncing] = useState(false);
  const [mx, setMx] = useState({ hasCreds: null, connected: null, lastSync: null, loading: false });
  const [lastResult, setLastResult] = useState(null); // { upserted, mapped, cacheHash }

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

  useEffect(() => { load(); /* mount */ }, []);

  const activeBiz = useMemo(
    () => items.find(b => String(b.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  // Estado de Maxi del negocio seleccionado
  useEffect(() => {
    let alive = true;
    setLastResult(null);
    if (!selectedId) {
      setMx({ hasCreds: null, connected: null, lastSync: null, loading: false });
      return () => {};
    }
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

  // Helper: si el catálogo del local está vacío, sincroniza automáticamente
  const ensureCatalogReady = async (bizId) => {
    try {
      const res = await BusinessesAPI.articlesTree(bizId);
      const tree = Array.isArray(res?.tree) ? res.tree : [];
      if (tree.length > 0) return false; // ya hay datos, no hace falta
      // Lanzar sync si hay credenciales o si no sabemos (dejamos que el backend valide)
      await doSync(bizId, { silent: true });
      return true;
    } catch (e) {
      console.warn('ensureCatalogReady error', e);
      return false;
    }
  };

  const doSync = async (bizId, { silent = false } = {}) => {
    if (!bizId || syncing) return;
    setSyncing(true);
    const prev = localStorage.getItem('activeBusinessId');
    try {
      localStorage.setItem('activeBusinessId', String(bizId));
      const resp = await BusinessesAPI.syncNow(bizId, { scope: 'articles' });
      setLastResult({
        upserted: Number(resp?.upserted ?? 0),
        mapped: Number(resp?.mapped ?? 0),
        cacheHash: resp?.cacheHash || null,
      });
      // notificar al resto de la app
      window.dispatchEvent(new CustomEvent('business:synced', { detail: { activeBusinessId: bizId } }));
      onSynced?.(resp);
      if (!silent) alert(`Sync OK. Artículos actualizados: ${resp?.upserted ?? 0}. Mapeos categoría/subrubro: ${resp?.mapped ?? 0}.`);
    } catch (e) {
      console.error('sync error', e);
      if (!silent) alert('No se pudo sincronizar. Revisá credenciales de Maxi o intentá nuevamente.');
      throw e;
    } finally {
      if (prev) localStorage.setItem('activeBusinessId', prev);
      else localStorage.removeItem('activeBusinessId');
      setSyncing(false);
    }
  };

  const handleSyncClick = async () => {
    if (!selectedId || syncing) return;
    if (mx.hasCreds === false) {
      alert('Este local no tiene credenciales de Maxi configuradas.');
      return;
    }
    if (!window.confirm('¿Iniciar sincronización de artículos/categorías para este local?')) return;
    await doSync(selectedId);
  };

  // Badge compacto y limpio
  const renderBadge = () => {
    if (mx.loading) return <Chip size="small" variant="outlined" label="Verificando..." />;
    if (mx.connected === true)  return <Chip size="small" color="success" label="Conectado a Maxi" />;
    if (mx.connected === false) return <Chip size="small" color="error"   label="Desconectado" />;
    return null;
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
      <Stack spacing={1.25}
        sx={{ width: '100%' }}>
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
              onClick={handleSyncClick}
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

        {/* Acción rápida: preparar catálogo si está vacío */}
        <Button
          variant="text"
          onClick={() => ensureCatalogReady(selectedId)}
          disabled={!selectedId || syncing}
          sx={{ textTransform: 'none', alignSelf: 'flex-start', px: 0 }}
        >
          ¿Catálogo vacío? Prepararlo automáticamente
        </Button>

        <Divider />

        {mx.lastSync && (
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Última sincronización: {new Date(mx.lastSync).toLocaleString()}
          </Typography>
        )}

        {lastResult && (
          <Typography variant="body2" sx={{ color: '#334155' }}>
            Resultado: {lastResult.upserted} artículos actualizados · {lastResult.mapped} mapeos · hash {lastResult.cacheHash}
          </Typography>
        )}

        <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.45 }}>
          Trae artículos y categorías desde Maxi para el local seleccionado. La vista de artículos
          se actualizará automáticamente al finalizar.
        </Typography>
      </Stack>
    </Paper>
  );
}
