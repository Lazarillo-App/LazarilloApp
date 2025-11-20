/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Paper, Stack, Typography, FormControl, InputLabel, Select, MenuItem,
  Button, Chip, Divider, CircularProgress, Tooltip
} from '@mui/material';
import { BusinessesAPI } from "@/servicios/apiBusinesses";

/* ---------------- utils ---------------- */
function normalizeMaxiStatus(res = {}) {
  const configured = typeof res.configured === 'boolean' ? res.configured : null;
  const email = res.email ?? res.user ?? res.username;
  const codcli = res.codcli ?? res.client_code ?? res.codigo_cliente;

  const hasCreds = configured ?? (!!email && !!codcli);

  const connected =
    typeof res.connected === 'boolean' ? res.connected :
    (res.status === 'ok' || res.state === 'connected') ? true :
    (res.status === 'error' || res.state === 'disconnected') ? false :
    null;

  const lastSync = res.last_sync ?? res.synced_at ?? res.last ?? res.updated_at ?? null;

  return { hasCreds, connected, lastSync };
}

const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
function last7dUntilYesterday() {
  const y = new Date(); y.setDate(y.getDate()-1);
  const from = new Date(y); from.setDate(from.getDate()-6);
  return { from: fmt(from), to: fmt(y) };
}

/* ---------------- componente ---------------- */
export default function AdminActionsSidebar({ onSynced }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(localStorage.getItem('activeBusinessId') || '');
  const [syncingArticles, setSyncingArticles] = useState(false);
  const [syncingSales, setSyncingSales] = useState(false);
  const [mx, setMx] = useState({ hasCreds: null, connected: null, lastSync: null, loading: false });
  const [lastResult, setLastResult] = useState(null);
  const [lastSalesResult, setLastSalesResult] = useState(null);

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

  // Escuchar eventos que afectan la lista o el activo
  useEffect(() => {
    const reload = () => load();

    // 🔔 Auto-sync ventas (7d) al crear negocio (espera lista y dispara)
    const onCreated = async (e) => {
      await load();
      const id = e?.detail?.id || e?.detail?.businessId || null;
      const bizId = id || selectedId || localStorage.getItem('activeBusinessId');
      if (bizId) {
        try { await doSyncSales7d(String(bizId), { silent: true }); } catch {}
      }
    };

    window.addEventListener('business:created', onCreated);
    window.addEventListener('business:deleted', reload);
    window.addEventListener('business:switched', reload);
    window.addEventListener('business:list:updated', reload);

    return () => {
      window.removeEventListener('business:created', onCreated);
      window.removeEventListener('business:deleted', reload);
      window.removeEventListener('business:switched', reload);
      window.removeEventListener('business:list:updated', reload);
    };
  }, [selectedId]);

  const activeBiz = useMemo(
    () => items.find(b => String(b.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  // Estado de Maxi del negocio seleccionado
  const fetchMxStatus = async (bizId) => {
    setMx(prev => ({ ...prev, loading: true }));
    try {
      const res = await BusinessesAPI.maxiStatus(bizId);
      const n = normalizeMaxiStatus(res || {});
      setMx({ ...n, loading: false });
    } catch {
      setMx({ hasCreds: null, connected: null, lastSync: null, loading: false });
    }
  };

  useEffect(() => {
    let alive = true;
    setLastResult(null);
    setLastSalesResult(null);
    if (!selectedId) {
      setMx({ hasCreds: null, connected: null, lastSync: null, loading: false });
      return () => {};
    }
    (async () => { if (alive) await fetchMxStatus(selectedId); })();
    return () => { alive = false; };
  }, [selectedId]);

  // Si otra parte sincroniza, refrescar status
  useEffect(() => {
    const onSyncedEvt = (e) => {
      const id = e?.detail?.activeBusinessId ?? e?.detail?.bizId;
      if (!id || String(id) !== String(selectedId)) return;
      fetchMxStatus(id);
    };
    window.addEventListener('business:synced', onSyncedEvt);
    return () => window.removeEventListener('business:synced', onSyncedEvt);
  }, [selectedId]);

  /* ================== Acciones ================== */
  const doSyncArticles = async (bizId, { silent = false } = {}) => {
    if (!bizId || syncingArticles) return;
    setSyncingArticles(true);
    const prev = localStorage.getItem('activeBusinessId');
    try {
      // Pre-chequeo (si falla, que decida el backend)
      try {
        const st = await BusinessesAPI.maxiStatus(bizId);
        if (st?.configured === false) {
          throw new Error('UNAUTHORIZED_ACCESS: Local sin credenciales Maxi');
        }
      } catch {}

      localStorage.setItem('activeBusinessId', String(bizId));
      const resp = await BusinessesAPI.syncNow(bizId, { scope: 'articles' });

      setLastResult({
        upserted: Number(resp?.upserted ?? 0),
        mapped: Number(resp?.mapped ?? 0),
        cacheHash: resp?.cacheHash || null,
      });

      window.dispatchEvent(new CustomEvent('business:synced', { detail: { activeBusinessId: bizId } }));
      onSynced?.(resp);

      if (!silent) alert(`Sync artículos OK. Actualizados: ${resp?.upserted ?? 0} · Mapeos: ${resp?.mapped ?? 0}`);
    } catch (e) {
      console.error('sync articles error', e);
      const msg = String(e?.message || '');
      if (!silent) {
        if (msg.includes('UNAUTHORIZED_ACCESS') || msg.includes('UNAUTHORIZED')) {
          alert('Maxi 401: credenciales inválidas o token caído.');
        } else {
          alert('No se pudo sincronizar artículos. Probá nuevamente.');
        }
      }
      throw e;
    } finally {
      if (prev) localStorage.setItem('activeBusinessId', prev);
      else localStorage.removeItem('activeBusinessId');
      setSyncingArticles(false);
      if (bizId) fetchMxStatus(bizId);
    }
  };

  const doSyncSales7d = async (bizId, { silent = false } = {}) => {
    if (!bizId || syncingSales) return;
    setSyncingSales(true);
    try {
      const { from, to } = last7dUntilYesterday();
      const resp = await BusinessesAPI.syncSales(bizId, { mode: 'auto', from, to });
      setLastSalesResult({
        ok: !!resp?.ok,
        from, to,
        upserted: Number(resp?.sales?.upserted ?? resp?.upserted ?? 0),
        updated: Number(resp?.sales?.updated ?? resp?.updated ?? 0),
      });
      if (!silent) alert(`Ventas (7d) OK · ${from} → ${to}.`);
      window.dispatchEvent(new CustomEvent('business:synced', { detail: { activeBusinessId: bizId } }));
    } catch (e) {
      console.error('sync sales 7d error', e);
      if (!silent) alert('No se pudieron sincronizar las ventas de los últimos 7 días.');
      throw e;
    } finally {
      setSyncingSales(false);
    }
  };

  const doBackfill30d = async (bizId) => {
    if (!bizId || syncingSales) return;
    setSyncingSales(true);
    try {
      const resp = await BusinessesAPI.syncSales(bizId, { mode: 'backfill_30d' });
      setLastSalesResult({
        ok: !!resp?.ok,
        from: resp?.sales?.from || null,
        to: resp?.sales?.to || null,
        upserted: Number(resp?.sales?.upserted ?? 0),
        updated: Number(resp?.sales?.updated ?? 0),
      });
      alert('Backfill de 30 días encolado/ejecutado correctamente.');
      window.dispatchEvent(new CustomEvent('business:synced', { detail: { activeBusinessId: bizId } }));
    } catch (e) {
      console.error('backfill 30d error', e);
      alert('No se pudo ejecutar el backfill de 30 días.');
    } finally {
      setSyncingSales(false);
    }
  };

  /* ================== UI ================== */
  const handleSyncArticlesClick = async () => {
    if (!selectedId || syncingArticles) return;
    if (mx.hasCreds === false) { alert('Este local no tiene credenciales de Maxi.'); return; }
    if (!window.confirm('¿Sincronizar artículos/categorías para este local?')) return;
    await doSyncArticles(selectedId);
  };

  const handleSyncSales7dClick = async () => {
    if (!selectedId || syncingSales) return;
    if (!window.confirm('¿Sincronizar ventas de los últimos 7 días para este local?')) return;
    await doSyncSales7d(selectedId);
  };

  const handleBackfill30dClick = async () => {
    if (!selectedId || syncingSales) return;
    if (!window.confirm('¿Ejecutar backfill de ventas de 30 días? Puede tardar.')) return;
    await doBackfill30d(selectedId);
  };

  const renderBadge = () => {
    if (mx.loading) return <Chip size="small" variant="outlined" label="Verificando…" />;
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
      <Stack spacing={1.25} sx={{ width: '100%' }}>
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
              onClick={handleSyncArticlesClick}
              disabled={!selectedId || syncingArticles || mx.hasCreds === false}
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
              startIcon={syncingArticles ? <CircularProgress size={16} sx={{ color: 'var(--on-secondary)' }} /> : null}
            >
              {syncingArticles ? 'Sincronizando…' : 'Sincronizar artículos (Maxi)'}
            </Button>
          </span>
        </Tooltip>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={handleSyncSales7dClick}
            disabled={!selectedId || syncingSales}
            fullWidth
            sx={{ textTransform: 'none', borderRadius: '8px', py: 1.1 }}
            startIcon={syncingSales ? <CircularProgress size={16} /> : null}
          >
            {syncingSales ? 'Sincronizando…' : 'Sincronizar ventas (7 días)'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleBackfill30dClick}
            disabled={!selectedId || syncingSales}
            fullWidth
            sx={{ textTransform: 'none', borderRadius: '8px', py: 1.1 }}
          >
            Backfill 30 días
          </Button>
        </Stack>

        <Divider />

        {mx.lastSync && (
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Última sync artículos: {new Date(mx.lastSync).toLocaleString()}
          </Typography>
        )}

        {lastResult && (
          <Typography variant="body2" sx={{ color: '#334155' }}>
            Artículos → {lastResult.upserted} act. · {lastResult.mapped} mapeos · hash {lastResult.cacheHash}
          </Typography>
        )}

        {lastSalesResult && (
          <Typography variant="body2" sx={{ color: '#334155' }}>
            Ventas {lastSalesResult.from ? `(${lastSalesResult.from} → ${lastSalesResult.to})` : ''} ·
            upserted {lastSalesResult.upserted ?? 0} · updated {lastSalesResult.updated ?? 0}
          </Typography>
        )}

        <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.45 }}>
          • “Sincronizar artículos” trae menú, rubros/subrubros y actualiza el catálogo. <br />
          • “Sincronizar ventas (7 días)” guarda ventas recientes para tableros y totales.
        </Typography>
      </Stack>
    </Paper>
  );
}
