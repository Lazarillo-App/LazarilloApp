import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showAlert } from '../../servicios/appAlert';
import { AdminAPI } from '../../servicios/apiAdmin';
import {
  TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import EditIcon from '@mui/icons-material/Edit';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { showConfirm } from '../../servicios/appConfirm';

const BRAND = { tinta: '#15213E', celeste: '#5BC2EA', paper: '#F2F4F7', celesteProfundo: '#2492C8' };

const ROLE_LABEL = { owner: 'Dueño', admin: 'Administrador', staff: 'Staff' };

export default function AdminBusinessDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [business, setBusiness] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', color_hex: '' });
  const [saving, setSaving] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [peek, setPeek] = useState(null);
  const [peekLoading, setPeekLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await AdminAPI.getBusiness(id);
      setBusiness(r.business);
      setStaff(r.staff || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const openEdit = () => {
    setForm({
      name: business?.name || '',
      slug: business?.slug || '',
      color_hex: business?.color_hex || '',
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await AdminAPI.updateBusiness(id, form);
      setEditOpen(false);
      await load();
      showAlert('Negocio actualizado.', 'success');
    } catch {
      showAlert('No se pudo guardar.', 'error');
    } finally { setSaving(false); }
  };

  const handleTogglePause = async () => {
    if (business.paused_at) {
      if (!(await showConfirm(`¿Reactivar "${business.name}"?`))) return;
      try {
        await AdminAPI.resumeBusiness(id);
        await load();
        showAlert('Negocio reactivado.', 'success');
      } catch { showAlert('No se pudo reactivar.', 'error'); }
    } else {
      if (!(await showConfirm(`¿Pausar "${business.name}"? No se pierde nada, pero deja de usarse hasta reactivarlo.`, { danger: true }))) return;
      try {
        await AdminAPI.pauseBusiness(id);
        await load();
        showAlert('Negocio pausado.', 'success');
      } catch { showAlert('No se pudo pausar.', 'error'); }
    }
  };

  const handleRevoke = async (m) => {
    if (!(await showConfirm(`¿Sacar a ${m.alias || m.name || m.email} del staff de este negocio?`, { danger: true }))) return;
    try {
      await AdminAPI.revokeAssignment(m.id);
      await load();
      showAlert('Acceso revocado.', 'success');
    } catch { showAlert('No se pudo revocar.', 'error'); }
  };

  const handleToggleRole = async (m) => {
    const nextRole = m.role === 'admin' ? 'staff' : 'admin';
    if (!(await showConfirm(`¿Cambiar el rol de ${m.alias || m.name || m.email} a ${ROLE_LABEL[nextRole]}?`))) return;
    try {
      await AdminAPI.updateAssignmentRole(m.id, nextRole);
      await load();
      showAlert('Rol actualizado.', 'success');
    } catch { showAlert('No se pudo cambiar el rol.', 'error'); }
  };

  const handleReassignOwner = async () => {
    const uid = Number(newOwnerId);
    if (!Number.isFinite(uid)) return;
    setSaving(true);
    try {
      await AdminAPI.reassignOwner(id, uid);
      setReassignOpen(false);
      setNewOwnerId('');
      await load();
      showAlert('Dueño reasignado.', 'success');
    } catch {
      showAlert('No se pudo reasignar (verificá el ID de usuario).', 'error');
    } finally { setSaving(false); }
  };

  const loadPeek = async () => {
    setPeekLoading(true);
    try {
      const [maxi, ventas] = await Promise.all([
        AdminAPI.peekMaxiStatus(id).catch(() => null),
        AdminAPI.peekVentasSummary(id).catch(() => null),
      ]);
      setPeek({ maxi, ventas });
    } finally { setPeekLoading(false); }
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (!business) return <div style={{ padding: 24 }}>Negocio no encontrado.</div>;

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '16px 28px', borderBottom: '0.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'flex' }}>
          <ArrowBackIosNewIcon fontSize="small" style={{ color: BRAND.tinta }} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: BRAND.tinta }}>
              {business.name}
            </h1>
            {business.paused_at && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#f1f5f9', color: '#475569' }}>
                Pausado{business.paused_by_cascade ? ' (por suspensión del dueño)' : ''}
              </span>
            )}
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>ID: {business.id}</p>
        </div>
        <Button
          size="small"
          startIcon={business.paused_at ? <PlayCircleIcon /> : <PauseCircleIcon />}
          onClick={handleTogglePause}
          color={business.paused_at ? 'primary' : 'error'}
          style={{ textTransform: 'none' }}
        >
          {business.paused_at ? 'Reactivar' : 'Pausar'}
        </Button>
        <Button size="small" startIcon={<EditIcon />} onClick={openEdit} style={{ textTransform: 'none' }}>
          Editar
        </Button>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.tinta }}>Datos generales</div>
            <Button size="small" startIcon={<SwapHorizIcon />} onClick={() => setReassignOpen(true)} style={{ textTransform: 'none' }}>
              Reasignar dueño
            </Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, fontSize: 13 }}>
            <span style={{ color: '#94a3b8' }}>Organización</span>
            <span>{business.organization_name || '—'}</span>
            <span style={{ color: '#94a3b8' }}>Dueño</span>
            <span>{business.owner_name || '—'} {business.owner_email ? `(${business.owner_email})` : ''}</span>
            <span style={{ color: '#94a3b8' }}>Slug</span>
            <span>{business.slug || '—'}</span>
            <span style={{ color: '#94a3b8' }}>Creado</span>
            <span>{business.created_at ? new Date(business.created_at).toLocaleDateString('es-AR') : '—'}</span>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: BRAND.tinta, borderBottom: '0.5px solid #e2e8f0' }}>
            Staff ({staff.length})
          </div>
          {staff.length === 0 && (
            <p style={{ padding: '16px', margin: 0, fontSize: 13, color: '#94a3b8' }}>Sin miembros asignados.</p>
          )}
          {staff.map((m, i) => (
            <div key={m.id ?? `owner-${i}`} style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 100px 80px',
              padding: '10px 16px', gap: 12, borderTop: i ? '0.5px solid #f8fafc' : 'none', alignItems: 'center',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: BRAND.tinta, fontWeight: 600 }}>{m.alias || m.name || m.email}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{m.email}</p>
              </div>
              <span style={{ fontSize: 12, color: '#64748b' }}>{ROLE_LABEL[m.role] || m.role}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{m.account_status || ''}</span>
              {m.role !== 'owner' && m.id != null ? (
                <div style={{ display: 'flex', gap: 2 }}>
                  <button title="Cambiar rol" onClick={() => handleToggleRole(m)}
                    style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 4 }}>
                    <SwapHorizIcon style={{ fontSize: 16, color: '#64748b' }} />
                  </button>
                  <button title="Quitar acceso" onClick={() => handleRevoke(m)}
                    style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 4 }}>
                    <PersonRemoveIcon style={{ fontSize: 16, color: '#ef4444' }} />
                  </button>
                </div>
              ) : <span />}
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', fontSize: 13, fontWeight: 700, color: BRAND.tinta, borderBottom: '0.5px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Ver negocio (solo lectura)</span>
            {!peek && (
              <Button size="small" startIcon={<VisibilityIcon />} onClick={loadPeek} disabled={peekLoading} style={{ textTransform: 'none' }}>
                {peekLoading ? 'Cargando…' : 'Ver'}
              </Button>
            )}
          </div>
          {peek && (
            <div style={{ padding: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>MaxiRest</div>
                <div>{peek.maxi?.configured ? `Configurado (${peek.maxi.email || peek.maxi.codcli || ''})` : 'No configurado'}</div>
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Ventas del mes (top artículos)</div>
                {peek.ventas?.items?.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {peek.ventas.items.slice(0, 5).map(v => (
                      <li key={v.articulo_id}>{v.nombre}: {v.qty} un. — ${Number(v.amount).toLocaleString('es-AR')}</li>
                    ))}
                  </ul>
                ) : <span style={{ color: '#94a3b8' }}>Sin ventas registradas.</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Editar negocio</DialogTitle>
        <DialogContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <TextField label="Nombre" size="small" fullWidth value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <TextField label="Slug" size="small" fullWidth value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            <TextField label="Color (hex)" size="small" fullWidth value={form.color_hex}
              onChange={e => setForm(f => ({ ...f, color_hex: e.target.value }))} />
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reassignOpen} onClose={() => setReassignOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Reasignar dueño</DialogTitle>
        <DialogContent>
          <p style={{ marginTop: 0, fontSize: 13, color: '#64748b' }}>
            Ingresá el ID de usuario del nuevo dueño (visible en Usuarios → detalle).
          </p>
          <TextField label="ID de usuario" size="small" fullWidth type="number" value={newOwnerId}
            onChange={e => setNewOwnerId(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReassignOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleReassignOwner} variant="contained" disabled={saving || !newOwnerId}>
            {saving ? 'Guardando…' : 'Reasignar'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
