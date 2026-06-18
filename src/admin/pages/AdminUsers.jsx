/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import { showAlert } from '../../servicios/appAlert';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAPI } from '../../servicios/apiAdmin';
import { AccessAPI } from '../../servicios/apiAccess';
import {
  TextField, IconButton, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Chip, Tooltip,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';

const BRAND = { tinta: '#15213E', celeste: '#5BC2EA', paper: '#F2F4F7', celesteProfundo: '#2492C8' };

const ACCOUNT_STATUS_STYLE = {
  active:    { bg: '#e1f5ee', color: '#0F6E56', label: 'Activo' },
  trial:     { bg: '#e6f1fb', color: '#185FA5', label: 'Demo' },
  pending:   { bg: '#fef3c7', color: '#d97706', label: 'Pendiente' },
  expired:   { bg: '#fff3f3', color: '#b91c1c', label: 'Vencido' },
  suspended: { bg: '#f1f5f9', color: '#475569', label: 'Suspendido' },
};

function AccountBadge({ status }) {
  const s = ACCOUNT_STATUS_STYLE[status] || { bg: '#f1f5f9', color: '#475569', label: status };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function useUsers() {
  const [state, setState] = useState({ rows: [], total: 0, page: 1, pageSize: 20, q: '', status: '' });
  const refetch = async (patch = {}) => {
    const next = { ...state, ...patch };
    setState(next);
    try {
      const res = await AdminAPI.listUsers({ q: next.q, status: next.status, page: next.page, pageSize: next.pageSize });
      setState(s => ({ ...s, ...res }));
    } catch {}
  };
  useEffect(() => { refetch({}); }, []);
  return { state, setState, refetch };
}

export default function AdminUsers() {
  const { state, setState, refetch } = useUsers();
  const [confirmDel, setConfirmDel] = useState(null);
  const [actDlg, setActDlg]   = useState(null);
  const [suspDlg, setSuspDlg] = useState(null);
  const [form, setForm] = useState({ type: 'trial', duration_days: 30, notes: '' });
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState('');
  const nav = useNavigate();

  const showNotify = (msg) => { setNotify(msg); setTimeout(() => setNotify(''), 3000); };

  const handleActivate = async () => {
    if (!actDlg) return;
    setSaving(true);
    try {
      await AccessAPI.activateUser(actDlg.id, {
        type: form.type,
        duration_days: form.duration_days ? Number(form.duration_days) : undefined,
        notes: form.notes,
      });
      showNotify(`✅ ${actDlg.name || actDlg.email} activado`);
      setActDlg(null);
      refetch({});
    } catch { showNotify('❌ Error al activar'); }
    setSaving(false);
  };

  const handleSuspend = async () => {
    if (!suspDlg) return;
    setSaving(true);
    try {
      await AccessAPI.suspendUser(suspDlg.id, { notes: form.notes });
      showNotify(`✅ ${suspDlg.name || suspDlg.email} suspendido`);
      setSuspDlg(null);
      refetch({});
    } catch { showNotify('❌ Error al suspender'); }
    setSaving(false);
  };

  const colores = ['#E6F1FB/#185FA5','#E1F5EE/#0F6E56','#EEEDFE/#3C3489','#FAEEDA/#633806'].map(s => s.split('/'));

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: '#fff', padding: '20px 28px', borderBottom: '0.5px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: BRAND.tinta }}>
          Usuarios
        </h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
          {state.total} usuarios registrados
        </p>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Notificación */}
        {notify && (
          <div style={{ background: '#f0fdf4', border: '0.5px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#166534' }}>
            {notify}
          </div>
        )}

        {/* Buscador */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: 10, border: '0.5px solid #e2e8f0' }}>
          <SearchIcon style={{ color: '#94a3b8', fontSize: 20 }} />
          <input
            value={state.q}
            onChange={e => setState(s => ({ ...s, q: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && refetch({ page: 1 })}
            placeholder="Buscar por nombre o email…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: BRAND.tinta, background: 'transparent' }}
          />
          <select
            value={state.status}
            onChange={e => refetch({ status: e.target.value, page: 1 })}
            style={{ border: '0.5px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 13, color: BRAND.tinta, background: '#fff', cursor: 'pointer' }}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="trial">Demo</option>
            <option value="pending">Pendiente</option>
            <option value="expired">Vencido</option>
            <option value="suspended">Suspendido</option>
          </select>
          <button
            onClick={() => refetch({ page: 1 })}
            style={{ background: BRAND.celesteProfundo, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Buscar
          </button>
        </div>

        {/* Tabla */}
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Header tabla */}
          <div style={{
            display: 'grid', gridTemplateColumns: '36px 1fr 160px 100px 80px 120px',
            padding: '10px 16px', background: BRAND.paper,
            borderBottom: '0.5px solid #e2e8f0', gap: 12,
          }}>
            {['', 'Usuario', 'Email', 'Estado', 'Vence', 'Acciones'].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
            ))}
          </div>

          {state.rows.length === 0 && (
            <p style={{ padding: '24px 16px', margin: 0, fontSize: 13, color: '#94a3b8' }}>Sin resultados.</p>
          )}

          {state.rows.map((u, i) => {
            const initial = (u.name || u.email || '?')[0].toUpperCase();
            const [bg, fg] = colores[i % colores.length];
            const isAdmin = u.role === 'app_admin';
            return (
              <div
                key={u.id}
                style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 160px 100px 80px 120px',
                  padding: '10px 16px', gap: 12, alignItems: 'center',
                  borderTop: '0.5px solid #f8fafc', cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                onClick={() => nav(`/admin/usuarios/${u.id}`)}
              >
                {/* Avatar */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {initial}
                </div>

                {/* Nombre */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: BRAND.tinta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{u.role}</p>
                </div>

                {/* Email */}
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>

                {/* Estado */}
                <AccountBadge status={u.account_status || u.status} />

                {/* Vence */}
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                  {fmtDate(u.trial_ends_at || u.subscription_ends_at)}
                </p>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                  <Tooltip title="Activar / Extender">
                    <IconButton size="small" onClick={() => { setForm({ type: 'trial', duration_days: 30, notes: '' }); setActDlg(u); }}>
                      <CheckCircleIcon style={{ fontSize: 16, color: '#16a34a' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset contraseña">
                    <IconButton size="small" onClick={async () => {
                      const r = await AdminAPI.resetPassword(u.id);
                      showAlert(`Token: ${r.token_preview}`, 'info', { copyText: r.token_preview });
                    }}>
                      <RestartAltIcon style={{ fontSize: 16, color: '#64748b' }} />
                    </IconButton>
                  </Tooltip>
                  {!isAdmin && u.status !== 'deleted' && (
                    u.account_status === 'suspended' ? (
                      <Tooltip title="Restaurar">
                        <IconButton size="small" onClick={async () => { await AdminAPI.restoreUser(u.id); refetch({}); }}>
                          <CheckCircleIcon style={{ fontSize: 16, color: '#2492C8' }} />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Suspender">
                        <IconButton size="small" onClick={() => { setForm({ notes: '' }); setSuspDlg(u); }}>
                          <BlockIcon style={{ fontSize: 16, color: '#ef4444' }} />
                        </IconButton>
                      </Tooltip>
                    )
                  )}
                  {!isAdmin && (
                    <Tooltip title={u.status === 'deleted' ? 'Restaurar' : 'Eliminar'}>
                      <IconButton size="small" onClick={() => setConfirmDel(u)}>
                        <DeleteOutlineIcon style={{ fontSize: 16, color: u.status === 'deleted' ? '#2492C8' : '#ef4444' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Página {state.page}</span>
          <button
            disabled={state.page <= 1}
            onClick={() => refetch({ page: state.page - 1 })}
            style={{ border: '0.5px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: '#fff', color: BRAND.tinta }}
          >← Anterior</button>
          <button
            disabled={state.page * state.pageSize >= state.total}
            onClick={() => refetch({ page: state.page + 1 })}
            style={{ border: '0.5px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: '#fff', color: BRAND.tinta }}
          >Siguiente →</button>
        </div>
      </div>

      {/* Dialog activar */}
      <Dialog open={!!actDlg} onClose={() => setActDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'Sora', system-ui, sans-serif" }}>
          Activar acceso — {actDlg?.name || actDlg?.email}
        </DialogTitle>
        <DialogContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <TextField select label="Tipo" size="small" fullWidth value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <MenuItem value="trial">Demo (trial)</MenuItem>
              <MenuItem value="full">Cuenta paga (full)</MenuItem>
            </TextField>
            <TextField label="Duración (días)" size="small" fullWidth type="number" value={form.duration_days}
              onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
              helperText="Dejá vacío para sin vencimiento" />
            <TextField label="Notas (opcional)" size="small" fullWidth multiline rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setActDlg(null)} color="inherit">Cancelar</Button>
          <Button onClick={handleActivate} variant="contained" color="success" disabled={saving}>
            {saving ? 'Activando…' : 'Activar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog suspender */}
      <Dialog open={!!suspDlg} onClose={() => setSuspDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#ef4444' }}>
          Suspender — {suspDlg?.name || suspDlg?.email}
        </DialogTitle>
        <DialogContent>
          <TextField label="Motivo (opcional)" size="small" fullWidth multiline rows={2} sx={{ mt: 1 }}
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSuspDlg(null)} color="inherit">Cancelar</Button>
          <Button onClick={handleSuspend} variant="contained" color="error" disabled={saving}>
            {saving ? 'Suspendiendo…' : 'Suspender'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog eliminar */}
      <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {confirmDel?.status === 'deleted' ? 'Restaurar usuario' : 'Eliminar usuario'}
        </DialogTitle>
        <DialogContent>
          {confirmDel?.status === 'deleted'
            ? `¿Restaurar el acceso de ${confirmDel?.name || confirmDel?.email}?`
            : `¿Eliminar a ${confirmDel?.name || confirmDel?.email}? Esta acción se puede revertir.`
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDel(null)}>Cancelar</Button>
          <Button
            color={confirmDel?.status === 'deleted' ? 'primary' : 'error'}
            variant="contained"
            onClick={async () => {
              if (confirmDel?.status === 'deleted') {
                await AdminAPI.restoreUser(confirmDel.id);
              } else {
                await AdminAPI.deleteUser(confirmDel.id);
              }
              setConfirmDel(null);
              refetch({});
            }}
          >
            {confirmDel?.status === 'deleted' ? 'Restaurar' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}