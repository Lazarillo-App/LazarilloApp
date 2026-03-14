// SyncComprasModal.jsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Divider,
  Alert, Stack, Chip, IconButton,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import SyncIcon         from '@mui/icons-material/Sync';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import ErrorIcon        from '@mui/icons-material/Error';
import HistoryIcon      from '@mui/icons-material/History';
import { format, subDays, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { purchasesSync, purchasesFirstDate } from '@/servicios/apiPurchases';

/* ── helpers de fecha ── */
const ymd  = (d) => format(d, 'yyyy-MM-dd');
const ayer = ()  => subDays(new Date(), 1);
const fmt  = (s) => format(parseISO(s), "d 'de' MMMM yyyy", { locale: es });

function buildStaticPresets() {
  const hoy  = new Date();
  const prev = subMonths(hoy, 1);
  return [
    {
      id: '7d',
      label: 'Última semana',
      get: () => ({ from: ymd(subDays(new Date(), 7)), to: ymd(ayer()) }),
    },
    {
      id: 'mesActual',
      label: 'Mes actual',
      get: () => ({
        from: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
        to:   ymd(ayer()),
      }),
    },
    {
      id: 'mesPasado',
      label: 'Mes pasado',
      get: () => ({
        from: ymd(new Date(prev.getFullYear(), prev.getMonth(), 1)),
        to:   ymd(new Date(prev.getFullYear(), prev.getMonth() + 1, 0)),
      }),
    },
    {
      id: '30d',
      label: 'Últimos 30 días',
      get: () => ({ from: ymd(subDays(new Date(), 30)), to: ymd(ayer()) }),
    },
    {
      id: '90d',
      label: 'Últimos 3 meses',
      get: () => ({ from: ymd(subDays(new Date(), 90)), to: ymd(ayer()) }),
    },
  ];
}

export default function SyncComprasModal({ open, onClose, bizId, onSuccess }) {
  const staticPresets = buildStaticPresets();

  const [selectedPreset, setSelectedPreset] = useState('mesActual');
  const [from, setFrom] = useState(staticPresets.find(p => p.id === 'mesActual').get().from);
  const [to,   setTo]   = useState(staticPresets.find(p => p.id === 'mesActual').get().to);
  const [syncing,         setSyncing]         = useState(false);
  const [result,          setResult]          = useState(null);
  const [firstDate,       setFirstDate]       = useState(null);
  const [loadingFirstDate, setLoadingFirstDate] = useState(false);

  const maxDate = ymd(ayer());

  // Al abrir, consultar la fecha más antigua en DB
  useEffect(() => {
    if (!open || !bizId) return;
    setLoadingFirstDate(true);
    purchasesFirstDate(bizId)
      .then(data => setFirstDate(data?.firstDate ?? null))
      .catch(() => setFirstDate(null))
      .finally(() => setLoadingFirstDate(false));
  }, [open, bizId]);

  // Preset dinámico — solo aparece si hay datos en la DB
  const historicoPreset = firstDate
    ? {
        id: 'historico',
        label: 'Todo el histórico',
        get: () => ({ from: firstDate, to: maxDate }),
      }
    : null;

  const allPresets = historicoPreset
    ? [...staticPresets, historicoPreset]
    : staticPresets;

  const handlePreset = useCallback((preset) => {
    setSelectedPreset(preset.id);
    const rango = preset.get();
    setFrom(rango.from);
    setTo(rango.to);
    setResult(null);
  }, []);

  const handleFromChange = (e) => {
    setFrom(e.target.value);
    setSelectedPreset(null);
    setResult(null);
  };

  const handleToChange = (e) => {
    const val = e.target.value;
    setTo(val > maxDate ? maxDate : val);
    setSelectedPreset(null);
    setResult(null);
  };

  const handleSync = async () => {
    if (syncing || !from || !to) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await purchasesSync(bizId, { from, to });
      setResult({ ok: true, ...res });
      onSuccess?.(`✅ Compras sincronizadas: ${res.inserted ?? 0} nuevas, ${res.updated ?? 0} actualizadas`);
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleClose = () => {
    if (syncing) return;
    setResult(null);
    onClose?.();
  };

  const rangoValido = from && to && from <= to && to <= maxDate;
  const diasRango   = rangoValido
    ? Math.ceil((parseISO(to) - parseISO(from)) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon fontSize="small" sx={{ color: '#0369a1' }} />
          <Typography fontWeight={700}>Sincronizar compras</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={syncing}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2.5 }}>

        {/* Presets */}
        <Typography variant="caption" color="text.secondary" fontWeight={600}
          sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Período rápido
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
          {allPresets.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              size="small"
              variant={selectedPreset === p.id ? 'filled' : 'outlined'}
              color={selectedPreset === p.id ? 'primary' : 'default'}
              icon={p.id === 'historico'
                ? <HistoryIcon sx={{ fontSize: '14px !important' }} />
                : undefined}
              onClick={() => handlePreset(p)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
          {/* Spinner mientras consulta la DB */}
          {loadingFirstDate && (
            <Chip
              size="small"
              variant="outlined"
              label="Todo el histórico"
              icon={<CircularProgress size={10} />}
              disabled
            />
          )}
        </Stack>

        {/* Nota cuando está seleccionado el histórico */}
        {selectedPreset === 'historico' && firstDate && (
          <Alert severity="info" icon={<HistoryIcon fontSize="inherit" />}
            sx={{ mb: 2, py: 0.5 }}>
            <Typography variant="caption">
              Primer registro en DB: <strong>{fmt(firstDate)}</strong>
            </Typography>
          </Alert>
        )}

        {/* Selector manual */}
        <Typography variant="caption" color="text.secondary" fontWeight={600}
          sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Rango personalizado
        </Typography>
        <Stack direction="row" gap={2} alignItems="center" sx={{ mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Desde</Typography>
            <input
              type="date"
              value={from}
              max={to || maxDate}
              onChange={handleFromChange}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                borderRadius: 6, fontSize: '0.9rem', outline: 'none',
              }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Hasta</Typography>
            <input
              type="date"
              value={to}
              min={from}
              max={maxDate}
              onChange={handleToChange}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                borderRadius: 6, fontSize: '0.9rem', outline: 'none',
              }}
            />
          </Box>
        </Stack>

        {rangoValido && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            {fmt(from)} → {fmt(to)} · {diasRango} día{diasRango !== 1 ? 's' : ''}
            {diasRango > 7 && (
              <span style={{ color: '#92400e', marginLeft: 8 }}>
                ⚠️ Se dividirá en {Math.ceil(diasRango / 7)} consultas a MaxiRest
              </span>
            )}
          </Typography>
        )}

        {/* Resultado */}
        {result && (
          <Box sx={{ mt: 1 }}>
            <Divider sx={{ mb: 2 }} />
            {result.ok ? (
              <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success" sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={600}>Sincronización completada</Typography>
                <Stack direction="row" gap={2} sx={{ mt: 1 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="success.main">{result.inserted ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Nuevas facturas</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="info.main">{result.updated ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Actualizadas</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700}>{result.items ?? 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Ítems procesados</Typography>
                  </Box>
                  {result.suppliers != null && (
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" fontWeight={700}>{result.suppliers}</Typography>
                      <Typography variant="caption" color="text.secondary">Proveedores</Typography>
                    </Box>
                  )}
                </Stack>
              </Alert>
            ) : (
              <Alert icon={<ErrorIcon fontSize="inherit" />} severity="error">
                <Typography variant="body2" fontWeight={600}>Error al sincronizar</Typography>
                <Typography variant="caption">{result.error}</Typography>
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={syncing} variant="outlined" size="small">
          {result?.ok ? 'Cerrar' : 'Cancelar'}
        </Button>
        <Button
          onClick={handleSync}
          disabled={syncing || !rangoValido}
          variant="contained"
          size="small"
          startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
        >
          {syncing ? 'Sincronizando…' : 'Sincronizar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}