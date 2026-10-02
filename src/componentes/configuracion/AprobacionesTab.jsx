// src/componentes/configuracion/AprobacionesTab.jsx
// Vista Operación — Fase 3: "La bandeja del administrador". Ningún cambio de
// un Staff pisa la receta real hasta que se aprueba acá (el backend ya lo
// garantiza — esto es la pantalla para decidir).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Chip, Avatar,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditNoteIcon from '@mui/icons-material/EditNote';
import {
  listarPropuestas, aprobarPropuesta, rechazarPropuesta, pedirRevisionPropuesta,
} from '@/servicios/apiRecetaProposals';
import { showAlert } from '@/servicios/appAlert';

const fmtNum = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return String(v);
};
const fmtMoney = (v) => v == null ? '—' : `$ ${Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtRelativo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const horas = diffMs / 3_600_000;
  if (horas < 1) return 'hace un momento';
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  if (horas < 48) return 'ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function itemKey(it) {
  const ref = Number(it?.articleRefId ?? it?.article_ref_id);
  if (Number.isFinite(ref) && ref !== 0) return `art-${ref}`;
  return `ins-${Number(it?.supplyId ?? it?.supply_id)}`;
}
const itemNombre = (it) => it?.supplyNombre || it?.supply_nombre || '(sin nombre)';
const itemCantUnidad = (it) => `${fmtNum(it?.cantidad)} ${it?.unidad || ''}`.trim();

function DiffRow({ label, note, before, after, isNew, strong }) {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: isNew ? '1fr auto' : '1fr auto auto',
      gap: 2, alignItems: 'center',
      px: 1.5, py: 1,
      '&:nth-of-type(odd)': { bgcolor: '#fdf6ee' },
    }}>
      <Box>
        <Typography fontWeight={strong ? 700 : 400} fontSize="0.85rem" color={strong ? 'text.primary' : 'text.secondary'}>
          {label}
        </Typography>
        {note && (
          <Typography fontSize="0.72rem" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            "{note}"
          </Typography>
        )}
      </Box>
      {!isNew && (
        <Typography fontSize="0.85rem" color="text.disabled" sx={{ textDecoration: before != null ? 'line-through' : 'none', textAlign: 'right' }}>
          {before ?? '—'}
        </Typography>
      )}
      <Typography fontWeight={700} fontSize="0.85rem" color="success.main" sx={{ textAlign: 'right' }}>
        {after}
      </Typography>
    </Box>
  );
}

function ProposalDiff({ proposal }) {
  const before = proposal.payload_before;
  const after = proposal.payload_after;
  const esNueva = !before;

  const beforeItems = Array.isArray(before?.items) ? before.items : [];
  const afterItems = Array.isArray(after?.items) ? after.items : [];
  const beforeMap = new Map(beforeItems.map(it => [itemKey(it), it]));
  const afterMap = new Map(afterItems.map(it => [itemKey(it), it]));
  const keys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()]));

  const unidadCosto = proposal.costo_despues?.unidad || proposal.costo_antes?.unidad || 'u';

  return (
    <Box sx={{ border: '1px solid #eee', borderRadius: 1.5, overflow: 'hidden', mt: 1 }}>
      <Box sx={{
        display: 'grid', gridTemplateColumns: esNueva ? '1fr auto' : '1fr auto auto',
        gap: 2, px: 1.5, py: 0.75, bgcolor: '#fafafa', borderBottom: '1px solid #eee',
      }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">INGREDIENTE</Typography>
        {!esNueva && <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'right' }}>ANTES</Typography>}
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'right' }}>
          {esNueva ? 'CANTIDAD' : 'PROPUESTO'}
        </Typography>
      </Box>

      {keys.map(key => {
        const b = beforeMap.get(key);
        const a = afterMap.get(key);
        const nombre = itemNombre(a || b);
        const nota = a?.observaciones || a?.notas || '';
        if (b && !a) {
          return <DiffRow key={key} label={`${nombre} (quitado)`} before={itemCantUnidad(b)} after="—" isNew={esNueva} />;
        }
        return (
          <DiffRow
            key={key}
            label={nombre}
            note={nota}
            before={b ? itemCantUnidad(b) : null}
            after={itemCantUnidad(a)}
            isNew={esNueva}
          />
        );
      })}

      {!esNueva && proposal.costo_despues && (
        <DiffRow
          label="Costo total"
          before={proposal.costo_antes ? `${fmtMoney(proposal.costo_antes.porUnidad)}/${unidadCosto}` : null}
          after={`${fmtMoney(proposal.costo_despues.porUnidad)}/${unidadCosto}`}
          strong
        />
      )}
    </Box>
  );
}

function ProposalCard({ proposal, onDecided }) {
  const [busy, setBusy] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');

  const esNueva = !proposal.payload_before;
  const nombreDestino = proposal.payload_after?.nombre || proposal.receta_nombre_actual || `#${proposal.article_id || proposal.insumo_id}`;
  const proponente = proposal.created_by_name || proposal.created_by_email || 'Alguien del equipo';
  const inicial = proponente.trim().charAt(0).toUpperCase() || '?';

  const subtitulo = [
    proponente,
    proposal.sector_nombre ? `sector ${proposal.sector_nombre}` : null,
    fmtRelativo(proposal.created_at),
  ].filter(Boolean).join(' · ');

  const runAction = async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      showAlert(successMsg);
      onDecided(proposal.id);
      return true;
    } catch (e) {
      showAlert(e?.message || 'Error', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAprobar = () => runAction(
    () => aprobarPropuesta(proposal.business_id, proposal.id),
    'Propuesta aprobada y aplicada',
  );
  const handleRechazar = () => runAction(
    () => rechazarPropuesta(proposal.business_id, proposal.id),
    'Propuesta rechazada',
  );
  const handlePedirRevision = async () => {
    if (!revisionComment.trim()) return;
    const ok = await runAction(
      () => pedirRevisionPropuesta(proposal.business_id, proposal.id, revisionComment.trim()),
      'Se pidió revisión',
    );
    if (ok) { setRevisionOpen(false); setRevisionComment(''); }
  };

  return (
    <Box sx={{ border: '1px solid #eee', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: '#e8e8e8', color: 'text.secondary' }}>
            {inicial}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={700} fontSize="0.95rem">
              {nombreDestino} — {esNueva ? 'receta nueva' : 'cambio en la receta'}
            </Typography>
            <Typography variant="caption" color="text.secondary">{subtitulo}</Typography>
            {proposal.status === 'in_revision' && proposal.admin_comment && (
              <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic' }} color="warning.main">
                Tu comentario: "{proposal.admin_comment}"
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} disabled={busy} onClick={handleAprobar}>
            Aprobar
          </Button>
          <Button size="small" variant="outlined" startIcon={<EditNoteIcon />} disabled={busy} onClick={() => setRevisionOpen(true)}>
            A revisión
          </Button>
          <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />} disabled={busy} onClick={handleRechazar}>
            Rechazar
          </Button>
        </Stack>
      </Stack>

      <ProposalDiff proposal={proposal} />

      {proposal.concurrentes > 1 && (
        <Box sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: '#fff7e6', border: '1px solid #ffe2a8', borderRadius: 1.5 }}>
          <Typography variant="caption" color="#8a5a00">
            ⚠ Hay <strong>{proposal.concurrentes} propuestas abiertas</strong> sobre {nombreDestino}, de personas distintas.
            Al aprobar una, la otra queda pendiente de decisión.
          </Typography>
        </Box>
      )}

      <Dialog open={revisionOpen} onClose={() => setRevisionOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Pedir revisión</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Si hay dudas, mandale un mensaje a {proponente} — este comentario vuelve a sus manos para que lo corrija.
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

export default function AprobacionesTab({ businessId, onCountChange }) {
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
  useEffect(() => { onCountChange?.(proposals.length); }, [proposals.length, onCountChange]);

  const handleDecided = (id) => {
    setProposals(prev => prev.filter(p => p.id !== id));
  };

  return (
    <Box>
      <Typography variant="overline" fontWeight={800} color="success.main" sx={{ letterSpacing: '0.08em' }}>
        La bandeja del administrador
      </Typography>

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2, mt: 0.5 }}>
        <Typography fontWeight={700} fontSize="0.9rem" color="text.secondary" sx={{ letterSpacing: '0.04em' }}>
          APROBACIONES PENDIENTES
        </Typography>
        <Chip size="small" label={proposals.length} color={proposals.length ? 'warning' : 'default'} sx={{ fontWeight: 700 }} />
      </Stack>

      {loading ? (
        <Stack alignItems="center" py={4}><CircularProgress size={28} /></Stack>
      ) : !proposals.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
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
  );
}
