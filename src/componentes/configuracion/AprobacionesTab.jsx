// src/componentes/configuracion/AprobacionesTab.jsx
// Vista Operación — Fase 3: bandeja de aprobación de recetas propuestas por Staff.
// Ningún cambio de un Staff pisa la receta real hasta que se aprueba acá (el
// backend ya lo garantiza — esto es la pantalla para decidir).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Chip, Divider,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditNoteIcon from '@mui/icons-material/EditNote';
import {
  listarPropuestas, aprobarPropuesta, rechazarPropuesta, pedirRevisionPropuesta,
} from '@/servicios/apiRecetaProposals';
import { showAlert } from '@/servicios/appAlert';

function Card({ children }) {
  return (
    <Box sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e8eaf0', bgcolor: 'background.paper' }}>
      {children}
    </Box>
  );
}
function CardHeader({ icon, title, subtitle }) {
  const tc = 'var(--color-primary, #3b82f6)';
  return (
    <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 1.25 }}>
      {icon && React.cloneElement(icon, { sx: { color: tc, fontSize: 17 } })}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>{subtitle}</Typography>}
      </Box>
    </Box>
  );
}

const fmt = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return String(v);
};

const CAMPOS_LABEL = {
  nombre: 'Nombre',
  porciones: 'Rendimiento',
  porcentajeVenta: 'Objetivo %',
  notas: 'Notas',
  metodoCoccion: 'Método de cocción',
  temperatura: 'Temperatura',
  tiempoMin: 'Tiempo (min)',
};

function ScalarDiff({ before, after }) {
  const b = before || {};
  const a = after || {};
  const campos = Object.keys(CAMPOS_LABEL).filter(k => String(b[k] ?? '') !== String(a[k] ?? '') && (b[k] != null || a[k] != null));
  if (!campos.length) return null;
  return (
    <Stack spacing={0.5} sx={{ mb: 1.5 }}>
      {campos.map(k => (
        <Stack key={k} direction="row" spacing={1} alignItems="baseline">
          <Typography variant="caption" fontWeight={600} sx={{ minWidth: 130, flexShrink: 0 }}>{CAMPOS_LABEL[k]}</Typography>
          <Typography variant="caption" color="text.secondary">
            {before ? <>{fmt(b[k])} → </> : null}<strong>{fmt(a[k])}</strong>
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function itemKey(it) {
  const ref = Number(it?.articleRefId ?? it?.article_ref_id);
  if (Number.isFinite(ref) && ref !== 0) return `art-${ref}`;
  return `ins-${Number(it?.supplyId ?? it?.supply_id)}`;
}
function itemNombre(it) {
  return it?.supplyNombre || it?.supply_nombre || '(sin nombre)';
}
function itemCantUnidad(it) {
  return `${fmt(it?.cantidad)} ${it?.unidad || ''}`.trim();
}

function ItemsDiff({ before, after }) {
  const beforeItems = Array.isArray(before?.items) ? before.items : [];
  const afterItems = Array.isArray(after?.items) ? after.items : [];
  const beforeMap = new Map(beforeItems.map(it => [itemKey(it), it]));
  const afterMap = new Map(afterItems.map(it => [itemKey(it), it]));
  const keys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()]));

  if (!keys.length) return <Typography variant="caption" color="text.secondary">Sin ingredientes.</Typography>;

  return (
    <Stack spacing={0.5}>
      {keys.map(key => {
        const b = beforeMap.get(key);
        const a = afterMap.get(key);
        if (b && !a) {
          return (
            <Stack key={key} direction="row" spacing={1}>
              <Chip size="small" label="quitado" color="error" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
              <Typography variant="caption" sx={{ textDecoration: 'line-through' }} color="text.secondary">
                {itemNombre(b)} · {itemCantUnidad(b)}
              </Typography>
            </Stack>
          );
        }
        if (!b && a) {
          return (
            <Stack key={key} direction="row" spacing={1}>
              <Chip size="small" label="nuevo" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
              <Typography variant="caption">{itemNombre(a)} · {itemCantUnidad(a)}</Typography>
            </Stack>
          );
        }
        const cambio = itemCantUnidad(b) !== itemCantUnidad(a);
        return (
          <Stack key={key} direction="row" spacing={1}>
            {cambio && <Chip size="small" label="cambiado" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
            <Typography variant="caption">
              {itemNombre(a)} · {cambio ? <>{itemCantUnidad(b)} → <strong>{itemCantUnidad(a)}</strong></> : itemCantUnidad(a)}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

function ProposalCard({ proposal, onDecided }) {
  const [busy, setBusy] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');

  const nombreDestino = proposal.payload_after?.nombre || proposal.receta_nombre_actual || `#${proposal.article_id || proposal.insumo_id}`;
  const fecha = proposal.created_at ? new Date(proposal.created_at).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '';

  const handleAprobar = async () => {
    setBusy(true);
    try {
      await aprobarPropuesta(proposal.business_id, proposal.id);
      showAlert('Propuesta aprobada y aplicada');
      onDecided(proposal.id);
    } catch (e) {
      showAlert(e?.message || 'Error aprobando la propuesta', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRechazar = async () => {
    setBusy(true);
    try {
      await rechazarPropuesta(proposal.business_id, proposal.id);
      showAlert('Propuesta rechazada');
      onDecided(proposal.id);
    } catch (e) {
      showAlert(e?.message || 'Error rechazando la propuesta', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePedirRevision = async () => {
    if (!revisionComment.trim()) return;
    setBusy(true);
    try {
      await pedirRevisionPropuesta(proposal.business_id, proposal.id, revisionComment.trim());
      showAlert('Se pidió revisión');
      setRevisionOpen(false);
      setRevisionComment('');
      onDecided(proposal.id);
    } catch (e) {
      showAlert(e?.message || 'Error pidiendo revisión', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ border: '1px solid #eee', borderRadius: 2, p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box>
          <Typography fontWeight={700} fontSize="0.92rem">{nombreDestino}</Typography>
          <Typography variant="caption" color="text.secondary">
            Propuesto por {proposal.created_by_name || proposal.created_by_email || 'alguien del equipo'} · {fecha}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {proposal.status === 'in_revision' && (
            <Chip size="small" label="a revisión" color="warning" sx={{ height: 22 }} />
          )}
          {proposal.concurrentes > 1 && (
            <Chip size="small" label={`${proposal.concurrentes} propuestas abiertas`} color="default" sx={{ height: 22 }} />
          )}
        </Stack>
      </Stack>

      {proposal.status === 'in_revision' && proposal.admin_comment && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }} color="text.secondary">
          Tu comentario: "{proposal.admin_comment}"
        </Typography>
      )}

      <Divider sx={{ my: 1 }} />

      <ScalarDiff before={proposal.payload_before} after={proposal.payload_after} />
      <ItemsDiff before={proposal.payload_before} after={proposal.payload_after} />

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button size="small" variant="contained" startIcon={<CheckCircleIcon />} disabled={busy} onClick={handleAprobar}>
          Aprobar
        </Button>
        <Button size="small" variant="outlined" color="warning" startIcon={<EditNoteIcon />} disabled={busy}
          onClick={() => setRevisionOpen(true)}>
          A revisión
        </Button>
        <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />} disabled={busy} onClick={handleRechazar}>
          Rechazar
        </Button>
      </Stack>

      <Dialog open={revisionOpen} onClose={() => setRevisionOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Pedir revisión</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Contale a quien la propuso qué hay que ajustar — vuelve a sus manos, no se pierde.
          </Typography>
          <TextField
            autoFocus fullWidth multiline minRows={3}
            placeholder="Ej: revisá la cantidad del ingrediente X, parece un error de tipeo"
            value={revisionComment}
            onChange={(e) => setRevisionComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevisionOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={!revisionComment.trim() || busy} onClick={handlePedirRevision}>
            Enviar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function AprobacionesTab({ businessId }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const list = await listarPropuestas(businessId);
      setProposals(list.map(p => ({ ...p, business_id: businessId })));
    } catch (e) {
      showAlert(e?.message || 'Error cargando propuestas', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleDecided = (id) => {
    setProposals(prev => prev.filter(p => p.id !== id));
  };

  return (
    <Card>
      <CardHeader
        icon={<FactCheckIcon />}
        title="Aprobaciones"
        subtitle="Cambios de recetas propuestos por el equipo, pendientes de tu revisión"
      />
      <Box sx={{ p: 2.5 }}>
        {loading ? (
          <Stack alignItems="center" py={4}><CircularProgress size={28} /></Stack>
        ) : !proposals.length ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No hay propuestas pendientes.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {proposals.map(p => (
              <ProposalCard key={p.id} proposal={p} onDecided={handleDecided} />
            ))}
          </Stack>
        )}
      </Box>
    </Card>
  );
}
