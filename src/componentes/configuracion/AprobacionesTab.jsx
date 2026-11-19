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
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  listarPropuestas, aprobarPropuesta, rechazarPropuesta, pedirRevisionPropuesta,
  listarPropuestasEquipo, jefeOkPropuesta, reasignarPropuesta,
} from '@/servicios/apiRecetaProposals';
import SelectorRevisor from '@/componentes/SelectorRevisor';
import { showAlert } from '@/servicios/appAlert';
import { useAuth } from '@/context/AuthContext';

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

const CELESTE = '#5BC2EA';
const gridRevisar = { xs: '1fr auto', md: 'minmax(0,1fr) 120px 150px 210px' };

// Marca sobre el USO de insumos en esta receta (Diego 19/11/2026): se muestra la
// receta de origen con el insumo adentro, y desde ahí se llega a su elaboración.
function InsumosARevisar({ revisar, onAbrirReceta }) {
  return (
    <Box sx={{ mt: 1.25, border: `1.5px solid ${CELESTE}`, borderRadius: 1.5, overflow: 'hidden' }}>
      <Box sx={{
        display: { xs: 'none', md: 'grid' }, gridTemplateColumns: gridRevisar, gap: 2,
        px: 1.5, py: 0.75, bgcolor: '#fafafa', borderBottom: '1px solid #eee',
      }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">INSUMO A REVISAR (EN ESTA RECETA)</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'center' }}>CANTIDAD</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'center' }}>SE USA EN</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textAlign: 'center' }}>SU ELABORACIÓN</Typography>
      </Box>
      {revisar.map((r) => {
        const verReceta = r.tiene_receta && onAbrirReceta ? (
          <Typography component="span" fontSize="0.85rem" onClick={() => onAbrirReceta({ insumo_id: r.insumo_id, insumo_nombre: r.nombre })}
            sx={{ color: '#1b7fa6', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Ver su receta
          </Typography>
        ) : (
          <Typography component="span" fontSize="0.8rem" color="text.disabled">Sin receta propia</Typography>
        );
        const cant = r.cantidad != null ? `${fmtNum(r.cantidad)} ${r.unidad || ''}`.trim() : 'Ya no está en la receta';
        const usos = r.usos != null ? `${r.usos} ${r.usos === 1 ? 'receta' : 'recetas'}` : '—';
        return (
          <Box key={r.insumo_id} sx={{
            display: 'grid', gridTemplateColumns: gridRevisar, gap: { xs: 0.5, md: 2 }, alignItems: 'center',
            px: 1.5, py: 1.1, bgcolor: '#f2fbfe', '& + &': { borderTop: '1px solid #e3f3fa' },
          }}>
            <Typography fontWeight={700} fontSize="0.85rem" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{r.nombre}</Typography>
            <Typography fontSize="0.85rem" sx={{ textAlign: { xs: 'right', md: 'center' }, whiteSpace: 'nowrap' }}>{cant}</Typography>
            <Typography fontSize="0.85rem" color="text.secondary" sx={{ textAlign: { xs: 'left', md: 'center' }, whiteSpace: 'nowrap' }}>
              <Box component="span" sx={{ display: { md: 'none' } }}>Se usa en </Box>{usos}
            </Typography>
            <Box sx={{ textAlign: { xs: 'right', md: 'center' } }}>{verReceta}</Box>
          </Box>
        );
      })}
    </Box>
  );
}

function ProposalCard({ proposal, onDecided, onUpdated, currentUserId, onAbrirReceta, modo = 'admin' }) {
  const esJefe = modo === 'jefe';
  const [busy, setBusy] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [finalizarNota, setFinalizarNota] = useState('');
  const [reasignarOpen, setReasignarOpen] = useState(false);
  const [reasignarA, setReasignarA] = useState(proposal.asignado_a_user_id ?? null);
  // Pedir revisión le manda un mensaje al proponente para que corrija — no tiene
  // sentido cuando el que está revisando (admin/owner) es la misma persona que
  // propuso el cambio (ej. un admin que también carga recetas): terminaría
  // pidiéndose una revisión a sí mismo.
  const esPropia = currentUserId != null && Number(proposal.created_by_user_id) === Number(currentUserId);

  const esNueva = !proposal.payload_before;
  // "Marcar a revisión" (desde Sectores o desde el header de una receta) crea la
  // propuesta con payload_after = {} a propósito — es solo un flag de "revisar
  // esto", todavía sin ningún cambio cargado. Aprobar ESO (antes posible, bug real
  // que borró recetas: ver fix en approveProposal) no tiene nada que aplicar. Date
  // de que distinguís por la ausencia de `items`, no por estar vacío (una propuesta
  // real puede guardar una receta sin ingredientes a propósito).
  const sinContenido = proposal.payload_after?.tipo !== 'insumo_nuevo' && (
    !proposal.payload_after
    || typeof proposal.payload_after !== 'object'
    || !Object.prototype.hasOwnProperty.call(proposal.payload_after, 'items')
  );
  // receta_nombre_actual viene NULL cuando todavía no existe receta (ej. una
  // "receta nueva" marcada a revisión sin cargar nada) — en ese caso el
  // backend igual resuelve el nombre real del insumo/artículo (insumo_nombre/
  // articulo_nombre, vía LEFT JOIN), así que antes de caer al "#id" en bruto
  // hay que probarlos.
  const nombreDestino = proposal.payload_after?.nombre || proposal.receta_nombre_actual
    || proposal.insumo_nombre || proposal.articulo_nombre
    || `#${proposal.article_id || proposal.insumo_id}`;
  const proponente = proposal.created_by_name || proposal.created_by_email || 'Alguien del equipo';
  const inicial = proponente.trim().charAt(0).toUpperCase() || '?';

  const revisar = Array.isArray(proposal.revisar) ? proposal.revisar : [];
  const esMarca = sinContenido && proposal.payload_after?.tipo !== 'discontinuar';
  const etiqueta = esMarca
    ? (revisar.length ? `Marcada a revisión · uso de ${revisar.length} ${revisar.length === 1 ? 'insumo' : 'insumos'}` : 'Marcada a revisión')
    : (esNueva ? 'Receta nueva' : 'Cambio en la receta');

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

  // Jefe de cocina: su OK no aplica nada, pasa la propuesta al administrador.
  const handleAprobar = () => runAction(
    () => (esJefe ? jefeOkPropuesta(proposal.business_id, proposal.id) : aprobarPropuesta(proposal.business_id, proposal.id)),
    esJefe ? 'Listo: pasó al administrador' : 'Propuesta aprobada y aplicada',
  );
  // Sin contenido (solo "marcada a revisión", sin cambio propuesto) no hay
  // nada que aprobar NI nada que rechazar — la acción real acá es sacarla de
  // la bandeja porque ya se resolvió (se revisó y no hace falta nada más),
  // no "rechazar" algo que nunca se llegó a proponer.
  const handleRechazar = (nota = '') => runAction(
    () => rechazarPropuesta(proposal.business_id, proposal.id, nota),
    sinContenido ? 'Revisión finalizada' : 'Propuesta rechazada',
  );
  const handleReasignar = async () => {
    setBusy(true);
    try {
      const r = await reasignarPropuesta(proposal.business_id, proposal.id, reasignarA);
      onUpdated?.(proposal.id, { asignado_a_user_id: r?.asignado_a_user_id ?? null, asignado_a_nombre: r?.asignado_a_nombre || null });
      showAlert(r?.asignado_a_nombre ? `Ahora la revisa ${r.asignado_a_nombre}` : 'Ahora la revisan admin y dueño');
      setReasignarOpen(false);
    } catch (e) {
      showAlert(e?.message || 'No se pudo reasignar', 'error');
    } finally { setBusy(false); }
  };
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
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }} spacing={{ xs: 1.5, md: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: '#e8e8e8', color: 'text.secondary' }}>
            {inicial}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <Typography
                fontWeight={700} fontSize="0.95rem"
                onClick={onAbrirReceta ? () => onAbrirReceta(proposal) : undefined}
                sx={onAbrirReceta ? { cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, width: 'fit-content' } : undefined}
              >
                {nombreDestino}
              </Typography>
              <Chip size="small" label={etiqueta} sx={{
                height: 22, fontSize: '0.7rem', fontWeight: 600,
                bgcolor: esMarca ? '#e6f6fc' : '#f1f1f1', color: esMarca ? '#1b7fa6' : 'text.secondary',
              }} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {subtitulo}
              {esMarca && <> · para <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>{proposal.asignado_a_nombre || 'admin y dueño'}</Box></>}
            </Typography>
            {!esJefe && proposal.jefe_ok_por && (
              <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label={`OK de ${proposal.jefe_ok_por} · jefe de cocina`}
                sx={{ display: 'flex', width: 'fit-content', mt: 0.75, height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: '#e8f5e9', color: '#2e7d32', '& .MuiChip-icon': { color: '#2e7d32' } }} />
            )}
            {!esMarca && proposal.status === 'in_revision' && proposal.admin_comment && (
              <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic' }} color="warning.main">
                Tu comentario: "{proposal.admin_comment}"
              </Typography>
            )}
          </Box>
        </Stack>
        {esMarca ? (
          <Stack direction="row" spacing={1} flexShrink={0} flexWrap="wrap" useFlexGap
            sx={{ '& .MuiButton-root': { minHeight: { xs: 44, md: 34 }, flex: { xs: '1 1 auto', md: 'none' } } }}>
            {onAbrirReceta && (
              <Button size="small" variant="contained" disableElevation startIcon={<EditIcon />} disabled={busy}
                onClick={() => onAbrirReceta(proposal)}
                sx={{ bgcolor: CELESTE, '&:hover': { bgcolor: '#3fb3e0' } }}>
                Abrir receta y corregir
              </Button>
            )}
            {!esJefe && (
              <Button size="small" variant="outlined" color="inherit" startIcon={<SwapHorizIcon />} disabled={busy}
                onClick={() => { setReasignarA(proposal.asignado_a_user_id ?? null); setReasignarOpen(true); }}
                sx={{ borderColor: '#cfd6dc', color: 'text.secondary' }}>
                Reasignar
              </Button>
            )}
            <Button size="small" variant="outlined" startIcon={<TaskAltIcon />} disabled={busy} onClick={() => setFinalizarOpen(true)}>
              Finalizar revisión
            </Button>
          </Stack>
        ) : (
        <Stack direction="row" spacing={1} flexShrink={0}>
          {!sinContenido && !(esJefe && proposal.status !== 'pending') && (
            <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} disabled={busy} onClick={handleAprobar}>
              {esJefe ? 'Dar OK' : 'Aprobar'}
            </Button>
          )}
          {!esPropia && (
            <Button size="small" variant="outlined" startIcon={<EditNoteIcon />} disabled={busy} onClick={() => setRevisionOpen(true)}>
              A revisión
            </Button>
          )}
          {sinContenido ? (
            <Button size="small" variant="outlined" startIcon={<TaskAltIcon />} disabled={busy} onClick={() => handleRechazar()}>
              Finalizar revisión
            </Button>
          ) : (
            <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />} disabled={busy} onClick={() => handleRechazar()}>
              Rechazar
            </Button>
          )}
        </Stack>
        )}
      </Stack>

      {esMarca ? (
        <>
          {proposal.admin_comment && (
            <Box sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: '#fff7e6', border: '1px solid #ffe2a8', borderRadius: 1.5 }}>
              <Typography fontSize="0.82rem" color="#6b4800">
                💬 <strong>{proponente}:</strong> "{proposal.admin_comment}"
              </Typography>
            </Box>
          )}
          {revisar.length > 0 && <InsumosARevisar revisar={revisar} onAbrirReceta={onAbrirReceta} />}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Al guardar la receta de {nombreDestino}, esta revisión se cierra sola. Si no hace falta cambiar nada, «Finalizar revisión».
          </Typography>
        </>
      ) : sinContenido ? (
        <Box sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Todavía no tiene ningún cambio cargado — solo quedó marcada para que alguien la revise.
            No hay nada que aprobar hasta que esa persona abra la receta, cargue el cambio y lo guarde.
          </Typography>
        </Box>
      ) : (
        <ProposalDiff proposal={proposal} />
      )}

      <Dialog open={finalizarOpen} onClose={() => !busy && setFinalizarOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Finalizar revisión</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            La marca sale de la bandeja sin cambiar la receta. Si querés, dejá cómo se resolvió: le llega a {proponente} y queda en Notificaciones.
          </Typography>
          <TextField autoFocus fullWidth multiline minRows={2} size="small" label="Cómo se resolvió (opcional)"
            placeholder="Ej: se pesó el cucharón, son 60 g: está bien"
            value={finalizarNota} onChange={(e) => setFinalizarNota(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button color="inherit" disabled={busy} onClick={() => setFinalizarOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={busy} onClick={async () => { if (await handleRechazar(finalizarNota.trim())) setFinalizarOpen(false); }}>
            Finalizar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reasignarOpen} onClose={() => !busy && setReasignarOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Reasignar revisión</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Elegí quién tiene que revisar {nombreDestino}. Le llega un aviso.
          </Typography>
          <SelectorRevisor businessId={proposal.business_id} value={reasignarA} onChange={setReasignarA} minWidth="100%" />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button color="inherit" disabled={busy} onClick={() => setReasignarOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={busy || (reasignarA ?? null) === (proposal.asignado_a_user_id ?? null)} onClick={handleReasignar}>
            Reasignar
          </Button>
        </DialogActions>
      </Dialog>

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

export default function AprobacionesTab({ businessId, onCountChange, onAbrirReceta, modo = 'admin' }) {
  const esJefe = modo === 'jefe';
  const { user } = useAuth() || {};
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const list = await (esJefe ? listarPropuestasEquipo(businessId) : listarPropuestas(businessId));
      setProposals(list.map(p => ({ ...p, business_id: businessId })));
    } catch (e) {
      showAlert(e?.message || 'Error cargando propuestas', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId, esJefe]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onCountChange?.(proposals.length); }, [proposals.length, onCountChange]);

  const handleDecided = (id) => {
    setProposals(prev => prev.filter(p => p.id !== id));
  };
  const handleUpdated = (id, patch) => {
    setProposals(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  };

  return (
    <Box>
      <Typography variant="overline" fontWeight={800} color="success.main" sx={{ letterSpacing: '0.08em' }}>
        {esJefe ? 'Tu equipo' : 'La bandeja del administrador'}
      </Typography>
      {esJefe && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
          Con tu OK el cambio pasa al administrador para la aprobación final. Nada impacta en los costos hasta entonces.
        </Typography>
      )}

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2, mt: 0.5 }}>
        <Typography fontWeight={700} fontSize="0.9rem" color="text.secondary" sx={{ letterSpacing: '0.04em' }}>
          {esJefe ? 'ESPERANDO TU OK' : 'APROBACIONES PENDIENTES'}
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
            <ProposalCard key={p.id} proposal={p} onDecided={handleDecided} onUpdated={handleUpdated} currentUserId={user?.id} onAbrirReceta={onAbrirReceta} modo={modo} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
