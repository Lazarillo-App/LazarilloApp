import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showAlert } from '../../servicios/appAlert';
import { AdminAPI } from '../../servicios/apiAdmin';
import {
  TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import EditIcon from '@mui/icons-material/Edit';

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

  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (!business) return <div style={{ padding: 24 }}>Negocio no encontrado.</div>;

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '16px 28px', borderBottom: '0.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'flex' }}>
          <ArrowBackIosNewIcon fontSize="small" style={{ color: BRAND.tinta }} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: BRAND.tinta }}>
            {business.name}
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>ID: {business.id}</p>
        </div>
        <Button size="small" startIcon={<EditIcon />} onClick={openEdit} style={{ textTransform: 'none' }}>
          Editar
        </Button>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.tinta, marginBottom: 10 }}>Datos generales</div>
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
              display: 'grid', gridTemplateColumns: '1fr 160px 120px',
              padding: '10px 16px', gap: 12, borderTop: i ? '0.5px solid #f8fafc' : 'none', alignItems: 'center',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: BRAND.tinta, fontWeight: 600 }}>{m.alias || m.name || m.email}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{m.email}</p>
              </div>
              <span style={{ fontSize: 12, color: '#64748b' }}>{ROLE_LABEL[m.role] || m.role}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{m.account_status || ''}</span>
            </div>
          ))}
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
    </div>
  );
}
