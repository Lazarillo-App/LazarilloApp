// src/componentes/configuracion/ConfigHistorialTab.jsx
// Historial de actividad del equipo: quién cambió qué, cuándo (recetas, insumos, precios).
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, Paper, Chip, IconButton, Collapse,
  CircularProgress, Alert, Button, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import { AuditLogAPI } from '../../servicios/apiBusinesses';

const ENTITY_LABELS = {
  receta: 'Receta',
  receta_elaborado: 'Receta de elaborado',
  insumo: 'Insumo',
  merma: 'Merma',
  receta_item_merma: 'Merma de ingrediente',
  precio_config: 'Precio',
  team_member: 'Miembro del equipo',
};

const ACTION_LABELS = {
  create: 'creó',
  update: 'editó',
  delete: 'eliminó',
  restore: 'restauró',
  reassign: 'reasignó',
};

const ACTION_COLORS = {
  create: '#16a34a',
  update: '#3b82f6',
  delete: '#dc2626',
  restore: '#8b5cf6',
  reassign: '#f59e0b',
};

function fmtValue(v) {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v);
}

function DiffDetail({ diff }) {
  const before = diff?.before || {};
  const after = diff?.after || {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  if (!keys.length) return <Typography variant="caption" color="text.secondary">Sin detalle adicional.</Typography>;
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      {keys.map(k => (
        <Stack key={k} direction="row" spacing={1} alignItems="baseline">
          <Typography variant="caption" fontWeight={600} sx={{ minWidth: 120 }}>{k}</Typography>
          {k in before ? (
            <Typography variant="caption" color="text.secondary">
              {fmtValue(before[k])} → <strong>{fmtValue(after[k])}</strong>
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">{fmtValue(after[k])}</Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function AuditRow({ entry }) {
  const [open, setOpen] = useState(false);
  const hasDiff = entry.diff && (Object.keys(entry.diff.before || {}).length || Object.keys(entry.diff.after || {}).length);
  const fecha = entry.created_at ? new Date(entry.created_at) : null;
  const fechaStr = fecha
    ? fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, mb: 1, overflow: 'hidden' }}>
      <Stack
        direction="row" alignItems="center" spacing={1.5}
        sx={{ px: 1.5, py: 1, cursor: hasDiff ? 'pointer' : 'default' }}
        onClick={() => hasDiff && setOpen(o => !o)}
      >
        <Chip
          size="small"
          label={ACTION_LABELS[entry.action] || entry.action}
          sx={{
            bgcolor: `${ACTION_COLORS[entry.action] || '#64748b'}18`,
            color: ACTION_COLORS[entry.action] || '#64748b',
            fontWeight: 700, fontSize: '0.7rem', height: 22,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            <strong>{entry.user_alias_snapshot || 'Alguien'}</strong>{' '}
            {ACTION_LABELS[entry.action] || entry.action}{' '}
            {(ENTITY_LABELS[entry.entity_type] || entry.entity_type)?.toLowerCase()}
            {entry.metadata?.nombre ? ` "${entry.metadata.nombre}"` : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">{fechaStr}</Typography>
        </Box>
        {hasDiff && (
          <IconButton size="small" sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      {hasDiff && (
        <Collapse in={open}>
          <Box sx={{ px: 1.5, pb: 1.5, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
            <DiffDetail diff={entry.diff} />
          </Box>
        </Collapse>
      )}
    </Paper>
  );
}

export default function ConfigHistorialTab({ businessId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [entityType, setEntityType] = useState('');

  const cargar = useCallback(async (reset = true) => {
    if (!businessId) return;
    reset ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const before = reset ? undefined : entries[entries.length - 1]?.id;
      const res = await AuditLogAPI.list(businessId, { entityType: entityType || undefined, before, limit: 30 });
      const data = res?.data || [];
      setEntries(prev => reset ? data : [...prev, ...data]);
      setHasMore(!!res?.hasMore);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, entityType]);

  useEffect(() => { cargar(true); }, [businessId, entityType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <HistoryIcon sx={{ color: 'var(--color-primary, #3b82f6)', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
          Historial de actividad
        </Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Tipo</InputLabel>
          <Select label="Tipo" value={entityType} onChange={e => setEntityType(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="receta">Recetas</MenuItem>
            <MenuItem value="receta_elaborado">Recetas de elaborados</MenuItem>
            <MenuItem value="insumo">Insumos</MenuItem>
            <MenuItem value="merma">Mermas</MenuItem>
            <MenuItem value="receta_item_merma">Merma de ingredientes</MenuItem>
            <MenuItem value="precio_config">Precios</MenuItem>
            <MenuItem value="team_member">Equipo</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Quién cambió qué en recetas, insumos y precios — y cuándo.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={28} /></Stack>
      ) : entries.length === 0 ? (
        <Box sx={{ border: '1px dashed #e5e7eb', borderRadius: 2, p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">Todavía no hay cambios registrados.</Typography>
        </Box>
      ) : (
        <>
          {entries.map(e => <AuditRow key={e.id} entry={e} />)}
          {hasMore && (
            <Stack alignItems="center" sx={{ mt: 1 }}>
              <Button size="small" onClick={() => cargar(false)} disabled={loadingMore}>
                {loadingMore ? <CircularProgress size={16} /> : 'Ver más'}
              </Button>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
