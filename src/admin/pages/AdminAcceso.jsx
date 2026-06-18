/* eslint-disable no-empty */
import React, { useState, useEffect, useCallback } from 'react';
import { AccessAPI } from '../../servicios/apiAccess';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Chip, IconButton, Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';

const BRAND = { tinta: '#15213E', celeste: '#5BC2EA', celesteProfundo: '#2492C8', paper: '#F2F4F7' };

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function CodesPanel() {
  const [codes,   setCodes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlg,     setDlg]     = useState(false);
  const [form,    setForm]    = useState({ type: 'trial', duration_days: 30, max_uses: 1, notes: '', prefix: 'LAZ' });
  const [saving,  setSaving]  = useState(false);
  const [notify,  setNotify]  = useState('');
  const [newCode, setNewCode] = useState(null);

  const showNotify = (msg) => { setNotify(msg); setTimeout(() => setNotify(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await AccessAPI.listCodes(); setCodes(res?.codes || []); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await AccessAPI.createCode({
        type: form.type,
        duration_days: form.duration_days ? Number(form.duration_days) : null,
        max_uses: Number(form.max_uses) || 1,
        notes: form.notes || null,
        prefix: form.prefix || 'LAZ',
      });
      if (res?.ok) {
        setNewCode(res.code);
        setDlg(false);
        await load();
        showNotify(`✅ Cupón creado: ${res.code.code}`);
      }
    } catch { showNotify('❌ Error al crear cupón'); }
    setSaving(false);
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('¿Desactivar este cupón?')) return;
    try { await AccessAPI.deactivateCode(id); await load(); showNotify('✅ Cupón desactivado'); } catch { showNotify('❌ Error'); }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).catch(() => {});
    showNotify(`📋 ${code} copiado`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>{codes.length} cupón{codes.length !== 1 ? 'es' : ''}</span>
        <button
          onClick={() => { setForm({ type: 'trial', duration_days: 30, max_uses: 1, notes: '', prefix: 'LAZ' }); setDlg(true); }}
          style={{ background: BRAND.celesteProfundo, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <AddIcon style={{ fontSize: 16 }} /> Nuevo cupón
        </button>
      </div>

      {notify && (
        <div style={{ background: '#f0fdf4', border: '0.5px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#166534' }}>
          {notify}
        </div>
      )}

      {/* Último cupón creado */}
      {newCode && (
        <div style={{ background: '#eff6ff', border: '2px solid #93c5fd', borderRadius: 10, padding: '16px 18px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Último cupón creado</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#1e40af', letterSpacing: '0.1em' }}>{newCode.code}</span>
            <button onClick={() => copyCode(newCode.code)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', display: 'flex', padding: 4 }}>
              <ContentCopyIcon style={{ fontSize: 16 }} />
            </button>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            {newCode.type === 'full' ? 'Acceso completo' : 'Demo'} · {newCode.duration_days ? `${newCode.duration_days} días` : 'Sin vencimiento'} · Máx. {newCode.max_uses} uso{newCode.max_uses !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#94a3b8' }}>Cargando cupones…</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 80px 80px 60px 80px 80px 1fr 40px', padding: '10px 16px', background: BRAND.paper, borderBottom: '0.5px solid #e2e8f0', gap: 8 }}>
            {['Código','Tipo','Duración','Usos','Vence','Estado','Notas',''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
            ))}
          </div>

          {codes.length === 0 && <p style={{ padding: '20px 16px', margin: 0, fontSize: 13, color: '#94a3b8' }}>No hay cupones todavía.</p>}

          {codes.map((c, i) => (
            <div key={c.id} style={{
              display: 'grid', gridTemplateColumns: '180px 80px 80px 60px 80px 80px 1fr 40px',
              padding: '10px 16px', gap: 8, alignItems: 'center',
              borderTop: i > 0 ? '0.5px solid #f8fafc' : 'none',
              opacity: c.active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#1e40af', letterSpacing: '0.04em' }}>{c.code}</span>
                <button onClick={() => copyCode(c.code)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', display: 'flex' }}>
                  <ContentCopyIcon style={{ fontSize: 12 }} />
                </button>
              </div>
              <Chip size="small" label={c.type === 'full' ? 'Completo' : 'Demo'} color={c.type === 'full' ? 'success' : 'info'} />
              <span style={{ fontSize: 12, color: '#64748b' }}>{c.duration_days ? `${c.duration_days}d` : 'Sin límite'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.tinta }}>{c.uses_count}/{c.max_uses}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(c.expires_at)}</span>
              <Chip size="small" label={c.active ? 'Activo' : 'Inactivo'} color={c.active ? 'success' : 'default'} />
              <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes || '—'}</span>
              <div>
                {c.active && (
                  <Tooltip title="Desactivar">
                    <IconButton size="small" color="error" onClick={() => handleDeactivate(c.id)}>
                      <BlockIcon style={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog crear */}
      <Dialog open={dlg} onClose={() => setDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'Sora', system-ui, sans-serif" }}>Nuevo cupón</DialogTitle>
        <DialogContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <TextField select label="Tipo" size="small" fullWidth value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <MenuItem value="trial">Demo (trial)</MenuItem>
              <MenuItem value="full">Completo (full)</MenuItem>
            </TextField>
            <TextField label="Duración (días)" size="small" fullWidth type="number" value={form.duration_days}
              onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))} helperText="Vacío = sin vencimiento" />
            <TextField label="Usos máximos" size="small" fullWidth type="number" value={form.max_uses}
              onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} />
            <TextField label="Prefijo" size="small" fullWidth value={form.prefix}
              onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase().slice(0, 6) }))}
              helperText="Ej: LAZ → LAZ-XXXX1234" />
            <TextField label="Notas internas (opcional)" size="small" fullWidth multiline rows={2}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDlg(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleCreate} variant="contained" disabled={saving}>
            {saving ? 'Creando…' : 'Crear cupón'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default function AdminAcceso() {
  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '20px 28px', borderBottom: '0.5px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: BRAND.tinta }}>
          Acceso y cupones
        </h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Creá y gestioná códigos de acceso</p>
      </div>
      <div style={{ padding: '24px 28px' }}>
        <CodesPanel />
      </div>
    </div>
  );
}